const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
let db;

function init() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      domain TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkouts (
      id TEXT PRIMARY KEY,
      shop TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      cart_url TEXT,
      total_price TEXT,
      line_items TEXT,
      customer_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      converted INTEGER DEFAULT 0,
      converted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop TEXT NOT NULL,
      phone TEXT NOT NULL,
      flow TEXT NOT NULL,
      step INTEGER DEFAULT 1,
      template TEXT,
      status TEXT DEFAULT 'queued',
      wa_message_id TEXT,
      scheduled_at TEXT NOT NULL,
      sent_at TEXT,
      error TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS optins (
      phone TEXT NOT NULL,
      shop TEXT NOT NULL,
      opted_in INTEGER DEFAULT 1,
      source TEXT,
      ip TEXT,
      consent_text TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (phone, shop)
    );

    CREATE TABLE IF NOT EXISTS flow_settings (
      flow_name TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shop TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      name TEXT,
      last_order_at TEXT,
      total_orders INTEGER DEFAULT 0,
      winback_stage INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS redirects (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template TEXT NOT NULL,
      template_lang TEXT DEFAULT 'fr',
      template_params TEXT,
      status TEXT DEFAULT 'draft',
      target_filter TEXT DEFAULT 'all',
      target_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS redirect_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      redirect_id TEXT NOT NULL,
      clicked_at TEXT DEFAULT (datetime('now')),
      ip TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT NOT NULL UNIQUE,
      email TEXT,
      tags TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      shop TEXT,
      opted_out INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incoming_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      received_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Global suppression list (RGPD): once a phone is here, no message is EVER
    -- sent to it again, across all shops and all flows. Inserted on STOP reply
    -- or via admin endpoint. Cannot be re-enrolled automatically by any flow.
    CREATE TABLE IF NOT EXISTS suppressed_phones (
      phone TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      source TEXT,
      suppressed_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('abandoned_cart', 1);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('upsell', 1);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('winback', 1);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('review', 1);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('birthday', 0);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('crosssell', 0);
  `);

  // Add delivery_status column if not exists
  try {
    db.prepare('ALTER TABLE messages ADD COLUMN delivery_status TEXT').run();
    console.log('[DB] Added delivery_status column');
  } catch (e) { /* column already exists */ }

  // ─── WhatsApp attribution columns (added 2026-05) ───
  // Enrich the existing redirects + redirect_clicks tables so we can
  // tie a click on /r/:shortId back to the recipient phone, the
  // originating message and checkout — and ultimately attribute the
  // resulting Shopify order to the WhatsApp campaign.
  for (const stmt of [
    "ALTER TABLE redirects ADD COLUMN phone TEXT",
    "ALTER TABLE redirects ADD COLUMN checkout_id TEXT",
    "ALTER TABLE redirects ADD COLUMN flow TEXT",
    "ALTER TABLE redirects ADD COLUMN step INTEGER",
    "ALTER TABLE redirects ADD COLUMN message_id INTEGER",
    "ALTER TABLE redirect_clicks ADD COLUMN phone TEXT",
    "ALTER TABLE redirect_clicks ADD COLUMN checkout_id TEXT",
    "ALTER TABLE redirect_clicks ADD COLUMN message_id INTEGER",
  ]) {
    try { db.prepare(stmt).run(); } catch (e) { /* already exists */ }
  }

  // Orders attributed to a WhatsApp click (within attribution window)
  db.exec(`
    CREATE TABLE IF NOT EXISTS wa_attributed_orders (
      order_id TEXT PRIMARY KEY,
      shop TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      checkout_id TEXT,
      redirect_id TEXT,
      message_id INTEGER,
      flow TEXT,
      template TEXT,
      order_total REAL,
      currency TEXT,
      clicked_at TEXT,
      ordered_at TEXT,
      attribution_window_minutes INTEGER,
      attributed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wa_attr_phone ON wa_attributed_orders(phone);
    CREATE INDEX IF NOT EXISTS idx_wa_attr_ordered ON wa_attributed_orders(ordered_at);
  `);

  console.log('[DB] Tables created');
}

// ─── Shops ───────────────────────────────────────
function saveShop(domain, token) {
  db.prepare('INSERT OR REPLACE INTO shops (domain, token) VALUES (?, ?)').run(domain, token);
}

function getShops() {
  return db.prepare('SELECT * FROM shops').all();
}

function getShopToken(domain) {
  const row = db.prepare('SELECT token FROM shops WHERE domain = ?').get(domain);
  return row?.token;
}

// ─── Checkouts ───────────────────────────────────
function saveCheckout(checkout) {
  db.prepare(`
    INSERT OR REPLACE INTO checkouts (id, shop, email, phone, cart_url, total_price, line_items, customer_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    checkout.id, checkout.shop, checkout.email, checkout.phone,
    checkout.cart_url, checkout.total_price,
    JSON.stringify(checkout.line_items), checkout.customer_name
  );
}

function getCheckoutById(id) {
  return db.prepare('SELECT * FROM checkouts WHERE id = ?').get(String(id));
}

function markCheckoutConverted(shop, email) {
  db.prepare(`
    UPDATE checkouts SET converted = 1, converted_at = datetime('now')
    WHERE shop = ? AND email = ? AND converted = 0
  `).run(shop, email);
}

function getCheckoutsByEmail(shop, email) {
  return db.prepare(`
    SELECT * FROM checkouts WHERE shop = ? AND email = ? ORDER BY created_at DESC
  `).all(shop, email);
}

function getUnconvertedCheckout(shop, email) {
  return db.prepare(`
    SELECT * FROM checkouts WHERE shop = ? AND email = ? AND converted = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(shop, email);
}

// ─── Messages ────────────────────────────────────
function queueMessage(msg) {
  db.prepare(`
    INSERT INTO messages (shop, phone, flow, step, template, scheduled_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(msg.shop, msg.phone, msg.flow, msg.step, msg.template, msg.scheduled_at, JSON.stringify(msg.metadata || {}));
}

function getPendingMessages() {
  // Replace T and Z in scheduled_at to match SQLite datetime format
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM messages
    WHERE status = 'queued' AND replace(replace(scheduled_at, 'T', ' '), 'Z', '') <= ?
    ORDER BY scheduled_at ASC
    LIMIT 20
  `).all(now.replace('T', ' ').replace('Z', '').split('.')[0]);
}

function updateMessageStatus(id, status, waMessageId, error) {
  db.prepare(`
    UPDATE messages SET status = ?, wa_message_id = ?, sent_at = datetime('now'), error = ?
    WHERE id = ?
  `).run(status, waMessageId, error, id);
}

function updateMessageDeliveryStatus(waMessageId, deliveryStatus) {
  db.prepare(`
    UPDATE messages SET delivery_status = ? WHERE wa_message_id = ?
  `).run(deliveryStatus, waMessageId);
}

function cancelMessages(shop, phone, flow) {
  db.prepare(`
    UPDATE messages SET status = 'cancelled'
    WHERE shop = ? AND phone = ? AND flow = ? AND status = 'queued'
  `).run(shop, phone, flow);
}

function hasActiveFlow(phone, flow) {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE phone = ? AND flow = ? AND status IN ('queued', 'sent')
    AND created_at > datetime('now', '-7 days')
  `).get(phone, flow);
  return row.count > 0;
}

function getRecentMessages(limit, from, to) {
  const df = dateClause(from, to);
  return db.prepare(`
    SELECT * FROM messages WHERE 1=1 ${df.sql} ORDER BY created_at DESC LIMIT ?
  `).all(...df.params, limit);
}

// ─── Opt-ins ─────────────────────────────────────
function isOptedIn(phone, shop) {
  // Global kill-switch: a suppressed phone is opted-out everywhere, no exceptions
  if (isSuppressed(phone)) return false;
  const row = db.prepare('SELECT opted_in FROM optins WHERE phone = ? AND shop = ?').get(phone, shop);
  // If no record, default to opted in for now (will enforce strict opt-in later)
  return row ? row.opted_in === 1 : true;
}

function saveOptin(phone, shop, source, ip, consentText) {
  db.prepare(`
    INSERT OR REPLACE INTO optins (phone, shop, opted_in, source, ip, consent_text)
    VALUES (?, ?, 1, ?, ?, ?)
  `).run(phone, shop, source, ip, consentText);
}

function optOut(phone, shop) {
  db.prepare('UPDATE optins SET opted_in = 0 WHERE phone = ? AND shop = ?').run(phone, shop);
}

// ─── Global Suppression (RGPD STOP) ──────────────
// Suppresses a phone number globally and irreversibly until manually removed.
// - Cancels every queued message for this phone (all shops, all flows)
// - Marks all opt-ins as opted_out
// - Flags all matching contacts as opted_out
// - Inserts into the global suppression list so future enrolment attempts
//   are blocked at isOptedIn() check (which all flows already use)
// Returns counts so callers can log/expose what happened.
function suppressPhone(phone, reason, source) {
  if (!phone) throw new Error('phone required');
  const r = String(reason || 'unspecified');
  const s = String(source || 'system');

  const cancelled = db.prepare(`
    UPDATE messages SET status = 'cancelled', error = 'suppressed: ' || ?
    WHERE phone = ? AND status = 'queued'
  `).run(r, phone).changes;

  const optinsRevoked = db.prepare(`
    UPDATE optins SET opted_in = 0 WHERE phone = ?
  `).run(phone).changes;

  const contactsFlagged = db.prepare(`
    UPDATE contacts SET opted_out = 1, updated_at = datetime('now') WHERE phone = ?
  `).run(phone).changes;

  db.prepare(`
    INSERT OR REPLACE INTO suppressed_phones (phone, reason, source)
    VALUES (?, ?, ?)
  `).run(phone, r, s);

  db.prepare(`
    INSERT INTO alerts (type, message)
    VALUES ('suppression', ?)
  `).run(`Phone ${phone} suppressed (reason: ${r}, source: ${s}). Cancelled ${cancelled} queued msgs, revoked ${optinsRevoked} optins, flagged ${contactsFlagged} contacts.`);

  return { phone, reason: r, source: s, cancelled_messages: cancelled, optins_revoked: optinsRevoked, contacts_flagged: contactsFlagged };
}

function isSuppressed(phone) {
  if (!phone) return false;
  const row = db.prepare('SELECT 1 FROM suppressed_phones WHERE phone = ?').get(phone);
  return !!row;
}

function unsuppressPhone(phone) {
  const removed = db.prepare('DELETE FROM suppressed_phones WHERE phone = ?').run(phone).changes;
  if (removed > 0) {
    db.prepare(`INSERT INTO alerts (type, message) VALUES ('suppression', ?)`)
      .run(`Phone ${phone} REMOVED from suppression list (manual admin action).`);
  }
  return { phone, removed: removed > 0 };
}

function getSuppressedPhones(limit) {
  return db.prepare(`
    SELECT phone, reason, source, suppressed_at FROM suppressed_phones
    ORDER BY suppressed_at DESC LIMIT ?
  `).all(limit || 100);
}

// ─── Flow Settings ───────────────────────────────
function getFlowSettings() {
  return db.prepare('SELECT * FROM flow_settings').all();
}

function isFlowEnabled(flowName) {
  const row = db.prepare('SELECT enabled FROM flow_settings WHERE flow_name = ?').get(flowName);
  return row ? row.enabled === 1 : false;
}

function setFlowEnabled(flowName, enabled) {
  db.prepare(`
    UPDATE flow_settings SET enabled = ?, updated_at = datetime('now') WHERE flow_name = ?
  `).run(enabled ? 1 : 0, flowName);
}

// ─── Customers ───────────────────────────────────
function saveCustomer(customer) {
  db.prepare(`
    INSERT OR REPLACE INTO customers (id, shop, email, phone, name, last_order_at, total_orders)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(customer.id, customer.shop, customer.email, customer.phone, customer.name, customer.last_order_at, customer.total_orders);
}

function getInactiveCustomers(shop, daysSinceLastOrder) {
  return db.prepare(`
    SELECT * FROM customers
    WHERE shop = ? AND phone IS NOT NULL AND phone != ''
    AND last_order_at <= datetime('now', '-' || ? || ' days')
    AND winback_stage < 3
  `).all(shop, daysSinceLastOrder);
}

function updateWinbackStage(customerId, stage) {
  db.prepare('UPDATE customers SET winback_stage = ? WHERE id = ?').run(stage, customerId);
}

// ─── Redirects (short URLs) ─────────────────────
function saveRedirect(id, url, meta) {
  // Backward compat: if no meta provided, just persist id+url like before
  const m = meta || {};
  db.prepare(`
    INSERT OR REPLACE INTO redirects (id, url, phone, checkout_id, flow, step, message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, url, m.phone || null, m.checkout_id || null, m.flow || null, m.step || null, m.message_id || null);
}

function getRedirectMeta(id) {
  return db.prepare('SELECT * FROM redirects WHERE id = ?').get(id);
}

function getRedirectUrl(id) {
  const row = db.prepare('SELECT url FROM redirects WHERE id = ?').get(id);
  return row?.url;
}

// ─── Redirect click tracking ────────────────────
function trackRedirectClick(redirectId, ip, userAgent) {
  // Pull phone/checkout_id/message_id from the parent redirect so each click
  // row is self-sufficient for attribution (survives even if redirects row
  // is later cleared).
  const r = db.prepare('SELECT phone, checkout_id, message_id FROM redirects WHERE id = ?').get(redirectId) || {};
  db.prepare(`
    INSERT INTO redirect_clicks (redirect_id, ip, user_agent, phone, checkout_id, message_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(redirectId, ip || '', userAgent || '', r.phone || null, r.checkout_id || null, r.message_id || null);
}

// ─── WhatsApp attribution ────────────────────────
// Returns the most recent click on a WhatsApp link by this phone within
// attributionWindowMinutes. Used at order webhook time to decide whether
// the new Shopify order is attributable to a WhatsApp campaign.
function findRecentClickByPhone(phone, attributionWindowMinutes) {
  if (!phone) return null;
  const win = attributionWindowMinutes || 2880; // default 48h
  return db.prepare(`
    SELECT rc.*, r.url, r.flow, r.step
    FROM redirect_clicks rc
    LEFT JOIN redirects r ON rc.redirect_id = r.id
    WHERE rc.phone = ?
      AND rc.clicked_at >= datetime('now', '-' || ? || ' minutes')
    ORDER BY rc.clicked_at DESC LIMIT 1
  `).get(phone, win);
}

// Records an attributable order. Idempotent on order_id.
function recordAttributedOrder(attribution) {
  const existing = db.prepare('SELECT * FROM wa_attributed_orders WHERE order_id = ?').get(String(attribution.order_id));
  if (existing) return existing;
  db.prepare(`
    INSERT INTO wa_attributed_orders
      (order_id, shop, phone, email, checkout_id, redirect_id, message_id,
       flow, template, order_total, currency, clicked_at, ordered_at, attribution_window_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(attribution.order_id), attribution.shop, attribution.phone || null,
    attribution.email || null, attribution.checkout_id || null,
    attribution.redirect_id || null, attribution.message_id || null,
    attribution.flow || null, attribution.template || null,
    attribution.order_total || 0, attribution.currency || 'EUR',
    attribution.clicked_at || null, attribution.ordered_at || null,
    attribution.attribution_window_minutes || 2880
  );
  return db.prepare('SELECT * FROM wa_attributed_orders WHERE order_id = ?').get(String(attribution.order_id));
}

// Aggregated attribution stats over a time window.
function getAttributionStats(from, to) {
  const dfM = dateClause(from, to, 'm.created_at');
  const dfClicks = dateClause(from, to, 'clicked_at');
  const dfO = dateClause(from, to, 'ordered_at');

  const sentRow = db.prepare(`
    SELECT COUNT(*) as count FROM messages m
    WHERE m.status = 'sent' AND m.flow = 'abandoned_cart' ${dfM.sql}
  `).get(...dfM.params);

  const clickRow = db.prepare(`
    SELECT COUNT(DISTINCT redirect_id || '|' || COALESCE(phone,'')) as count
    FROM redirect_clicks WHERE phone IS NOT NULL ${dfClicks.sql}
  `).get(...dfClicks.params);

  const attrRow = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(order_total), 0) as revenue
    FROM wa_attributed_orders WHERE 1=1 ${dfO.sql}
  `).get(...dfO.params);

  const sent = sentRow.count;
  const clicks = clickRow.count;
  const orders = attrRow.count;
  const revenue = attrRow.revenue;

  return {
    messages_sent: sent,
    clicks,
    attributed_orders: orders,
    attributed_revenue: revenue,
    ctr_pct: sent > 0 ? Math.round((clicks / sent) * 1000) / 10 : 0,
    cr_from_click_pct: clicks > 0 ? Math.round((orders / clicks) * 1000) / 10 : 0,
    cr_overall_pct: sent > 0 ? Math.round((orders / sent) * 1000) / 10 : 0,
    revenue_per_message: sent > 0 ? Math.round((revenue / sent) * 100) / 100 : 0,
  };
}

function getRecentAttributedOrders(limit) {
  return db.prepare(`
    SELECT * FROM wa_attributed_orders ORDER BY attributed_at DESC LIMIT ?
  `).all(limit || 50);
}

function getRedirectClicks(redirectId) {
  return db.prepare('SELECT COUNT(*) as count FROM redirect_clicks WHERE redirect_id = ?').get(redirectId).count;
}

function getTotalClicks() {
  return db.prepare('SELECT COUNT(*) as count FROM redirect_clicks').get().count;
}

// ─── Stats ───────────────────────────────────────
function clearAll() {
  db.exec("DELETE FROM messages; DELETE FROM checkouts; DELETE FROM redirects;");
}

function getSqliteNow() {
  return db.prepare("SELECT datetime('now') as now").get().now;
}

// Date filter helper
function dateClause(from, to, col = 'created_at') {
  let sql = '';
  const params = [];
  if (from) { sql += ` AND ${col} >= ?`; params.push(from); }
  if (to) { sql += ` AND ${col} <= ?`; params.push(to); }
  return { sql, params };
}

function getStats(from, to) {
  const df = dateClause(from, to);
  const sent = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE status = 'sent' ${df.sql}`).get(...df.params);
  const queued = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE status = 'queued' ${df.sql}`).get(...df.params);
  const failed = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE status = 'failed' ${df.sql}`).get(...df.params);
  const cancelled = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE status = 'cancelled' ${df.sql}`).get(...df.params);
  const dcf = dateClause(from, to);
  const checkouts = db.prepare(`SELECT COUNT(*) as count FROM checkouts WHERE converted = 0 ${dcf.sql}`).get(...dcf.params);
  const recovered = db.prepare(`SELECT COUNT(*) as count FROM checkouts WHERE converted = 1 ${dcf.sql}`).get(...dcf.params);
  const totalCheckouts = db.prepare(`SELECT COUNT(*) as count FROM checkouts WHERE 1=1 ${dcf.sql}`).get(...dcf.params);
  const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get();
  const totalOptins = db.prepare("SELECT COUNT(*) as count FROM optins WHERE opted_in = 1").get();

  const revenue = db.prepare(`SELECT COALESCE(SUM(CAST(total_price AS REAL)), 0) as total FROM checkouts WHERE converted = 1 ${dcf.sql}`).get(...dcf.params);

  return {
    messages_sent: sent.count,
    messages_queued: queued.count,
    messages_failed: failed.count,
    messages_cancelled: cancelled.count,
    abandoned_checkouts: checkouts.count,
    recovered_checkouts: recovered.count,
    total_checkouts: totalCheckouts.count,
    recovery_rate: totalCheckouts.count > 0 ? Math.round(recovered.count / totalCheckouts.count * 100) : 0,
    revenue_recovered: revenue.total,
    total_customers: totalCustomers.count,
    total_optins: totalOptins.count
  };
}

// ─── Dashboard detailed stats ───────────────────
function getMessagesByFlow(from, to) {
  const df = dateClause(from, to);
  return db.prepare(`
    SELECT flow, status, COUNT(*) as count
    FROM messages WHERE 1=1 ${df.sql} GROUP BY flow, status ORDER BY flow, status
  `).all(...df.params);
}

function getTemplateStats(from, to) {
  const df = dateClause(from, to);
  // Stats per template: sent, failed, cancelled, queued
  const rows = db.prepare(`
    SELECT template, flow, step, status, COUNT(*) as count
    FROM messages WHERE 1=1 ${df.sql}
    GROUP BY template, flow, step, status
    ORDER BY flow, step, template
  `).all(...df.params);

  // Aggregate per template
  const templates = {};
  rows.forEach(r => {
    const key = r.template;
    if (!templates[key]) templates[key] = { template: key, flow: r.flow, step: r.step, sent: 0, failed: 0, cancelled: 0, queued: 0, total: 0, converted: 0, revenue: 0 };
    templates[key][r.status] = (templates[key][r.status] || 0) + r.count;
    templates[key].total += r.count;
  });

  // Add conversion data per template — LAST-TOUCH attribution.
  // For each converted checkout, only the most recently SENT template before
  // the conversion gets credit. This guarantees that the sum of revenues
  // across templates equals the total recovered revenue (no double counting).
  // A template never sent (status != 'sent') gets no credit, by design.
  const dfm = dateClause(from, to, 'm.created_at');
  const convRows = db.prepare(`
    WITH last_sent AS (
      SELECT
        json_extract(m.metadata, '$.checkout_id') as cid,
        m.template,
        ROW_NUMBER() OVER (
          PARTITION BY json_extract(m.metadata, '$.checkout_id')
          ORDER BY datetime(m.sent_at) DESC
        ) as rn
      FROM messages m
      WHERE m.flow = 'abandoned_cart' AND m.status = 'sent' ${dfm.sql}
    )
    SELECT u.template,
      COUNT(DISTINCT CASE WHEN c.converted = 1 THEN c.id END) as converted,
      COALESCE(SUM(CASE WHEN c.converted = 1 THEN CAST(c.total_price AS REAL) END), 0) as revenue
    FROM last_sent u
    LEFT JOIN checkouts c ON c.id = u.cid
    WHERE u.rn = 1
    GROUP BY u.template
  `).all(...dfm.params);

  convRows.forEach(r => {
    if (templates[r.template]) {
      templates[r.template].converted = r.converted;
      templates[r.template].revenue = r.revenue;
    }
  });

  return Object.values(templates);
}

function getFlowConversionStats(from, to) {
  const df = dateClause(from, to);
  // For abandoned_cart: how many checkouts converted after receiving messages
  const cartStats = db.prepare(`
    SELECT
      COUNT(DISTINCT c.id) as total_checkouts,
      COUNT(DISTINCT CASE WHEN c.converted = 1 THEN c.id END) as converted_checkouts,
      COALESCE(SUM(CASE WHEN c.converted = 1 THEN CAST(c.total_price AS REAL) END), 0) as revenue
    FROM checkouts c
    WHERE 1=1 ${df.sql}
  `).get(...df.params);

  // Messages per step for abandoned_cart
  const cartSteps = db.prepare(`
    SELECT step,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
    FROM messages
    WHERE flow = 'abandoned_cart' ${df.sql}
    GROUP BY step ORDER BY step
  `).all(...df.params);

  return {
    abandoned_cart: {
      ...cartStats,
      conversion_rate: cartStats.total_checkouts > 0 ? Math.round(cartStats.converted_checkouts / cartStats.total_checkouts * 100) : 0,
      steps: cartSteps
    }
  };
}

function getMessagesByDay(days = 30) {
  return db.prepare(`
    SELECT DATE(created_at) as day, flow, status, COUNT(*) as count
    FROM messages
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY day, flow, status ORDER BY day DESC
  `).all(days);
}

function getCheckoutsDetailed(limit = 50, from, to) {
  const df = dateClause(from, to);
  return db.prepare(`
    SELECT id, shop, email, phone, total_price, customer_name, converted, converted_at, created_at,
           line_items
    FROM checkouts WHERE 1=1 ${df.sql} ORDER BY created_at DESC LIMIT ?
  `).all(...df.params, limit);
}

function getMessagesByTemplate() {
  return db.prepare(`
    SELECT template, status, COUNT(*) as count
    FROM messages GROUP BY template, status ORDER BY template
  `).all();
}

function getDeliveryStats(from, to) {
  const df = dateClause(from, to);
  return db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
      COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END) as delivered,
      COUNT(CASE WHEN delivery_status = 'read' THEN 1 END) as read_count
    FROM messages WHERE status = 'sent' ${df.sql}
  `).get(...df.params);
}

function getDailyRevenue(days = 30) {
  return db.prepare(`
    SELECT DATE(converted_at) as day, COUNT(*) as conversions,
           COALESCE(SUM(CAST(total_price AS REAL)), 0) as revenue
    FROM checkouts
    WHERE converted = 1 AND converted_at >= datetime('now', '-' || ? || ' days')
    GROUP BY day ORDER BY day DESC
  `).all(days);
}

function getHourlyDistribution(from, to) {
  const df = dateClause(from, to, 'sent_at');
  return db.prepare(`
    SELECT CAST(strftime('%H', sent_at) AS INTEGER) as hour, COUNT(*) as count
    FROM messages WHERE status = 'sent' AND sent_at IS NOT NULL ${df.sql}
    GROUP BY hour ORDER BY hour
  `).all(...df.params);
}

// ─── Campaigns (push) ───────────────────────────
function createCampaign(campaign) {
  const result = db.prepare(`
    INSERT INTO campaigns (name, template, template_lang, template_params, target_filter, target_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(campaign.name, campaign.template, campaign.template_lang || 'fr',
    JSON.stringify(campaign.template_params || []), campaign.target_filter || 'all', campaign.target_count || 0);
  return result.lastInsertRowid;
}

function getCampaigns(limit = 20) {
  return db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ?').all(limit);
}

function getCampaignById(id) {
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

function updateCampaignStatus(id, status, updates = {}) {
  const sets = ['status = ?'];
  const vals = [status];
  if (updates.sent_count !== undefined) { sets.push('sent_count = ?'); vals.push(updates.sent_count); }
  if (updates.failed_count !== undefined) { sets.push('failed_count = ?'); vals.push(updates.failed_count); }
  if (status === 'sending') { sets.push("sent_at = datetime('now')"); }
  if (status === 'sent' || status === 'completed') { sets.push("completed_at = datetime('now')"); }
  vals.push(id);
  db.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// ─── Customers (for campaigns) ──────────────────
function getCustomersWithPhone(shop) {
  return db.prepare(`
    SELECT id, shop, email, phone, name, last_order_at, total_orders
    FROM customers WHERE shop = ? AND phone IS NOT NULL AND phone != ''
    ORDER BY last_order_at DESC
  `).all(shop);
}

function getAllCustomersWithPhone() {
  return db.prepare(`
    SELECT id, shop, email, phone, name, last_order_at, total_orders
    FROM customers WHERE phone IS NOT NULL AND phone != ''
    ORDER BY last_order_at DESC
  `).all();
}

// ─── Contacts (manual + auto) ───────────────────
function addContact(contact) {
  // Check if contact with same phone already exists
  const existing = db.prepare('SELECT id FROM contacts WHERE phone = ?').get(contact.phone);
  if (existing) {
    // Update existing contact with new info (don't duplicate)
    db.prepare(`
      UPDATE contacts SET first_name = COALESCE(NULLIF(?, ''), first_name),
        last_name = COALESCE(NULLIF(?, ''), last_name),
        email = COALESCE(NULLIF(?, ''), email)
      WHERE id = ?
    `).run(contact.first_name || '', contact.last_name || '', contact.email || '', existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO contacts (first_name, last_name, phone, email, tags, source, shop)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    contact.first_name || '', contact.last_name || '', contact.phone,
    contact.email || '', contact.tags || '', contact.source || 'manual',
    contact.shop || process.env.SHOPIFY_STORE_DOMAIN || 'lebourlingueur.myshopify.com'
  );
  return result.lastInsertRowid;
}

function updateContact(id, data) {
  const sets = [];
  const vals = [];
  if (data.first_name !== undefined) { sets.push('first_name = ?'); vals.push(data.first_name); }
  if (data.last_name !== undefined) { sets.push('last_name = ?'); vals.push(data.last_name); }
  if (data.phone !== undefined) { sets.push('phone = ?'); vals.push(data.phone); }
  if (data.email !== undefined) { sets.push('email = ?'); vals.push(data.email); }
  if (data.tags !== undefined) { sets.push('tags = ?'); vals.push(data.tags); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  db.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

function deleteContact(id) {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
}

function getContacts(segment = 'all') {
  // Merge contacts table + customers table (dedup by phone)
  let query;
  if (segment === 'all') {
    query = `
      SELECT id, first_name, last_name, phone, email, tags, source, shop, created_at FROM contacts WHERE opted_out = 0
      UNION
      SELECT id, name as first_name, '' as last_name, phone, email, '' as tags, 'shopify' as source, shop, created_at
      FROM customers WHERE phone IS NOT NULL AND phone != ''
    `;
  } else if (segment === 'manual') {
    query = `SELECT id, first_name, last_name, phone, email, tags, source, shop, created_at FROM contacts WHERE opted_out = 0 AND source = 'manual'`;
  } else if (segment === 'shopify') {
    query = `SELECT id, name as first_name, '' as last_name, phone, email, '' as tags, 'shopify' as source, shop, created_at FROM customers WHERE phone IS NOT NULL AND phone != ''`;
  } else if (segment === 'buyers') {
    query = `SELECT id, name as first_name, '' as last_name, phone, email, '' as tags, 'shopify' as source, shop, created_at FROM customers WHERE phone IS NOT NULL AND phone != '' AND total_orders > 0`;
  } else if (segment === 'inactive_30') {
    query = `SELECT id, name as first_name, '' as last_name, phone, email, '' as tags, 'shopify' as source, shop, created_at FROM customers WHERE phone IS NOT NULL AND phone != '' AND last_order_at <= datetime('now', '-30 days')`;
  } else if (segment === 'inactive_60') {
    query = `SELECT id, name as first_name, '' as last_name, phone, email, '' as tags, 'shopify' as source, shop, created_at FROM customers WHERE phone IS NOT NULL AND phone != '' AND last_order_at <= datetime('now', '-60 days')`;
  } else if (segment.startsWith('tag:')) {
    const tag = segment.slice(4);
    query = `SELECT id, first_name, last_name, phone, email, tags, source, shop, created_at FROM contacts WHERE opted_out = 0 AND tags LIKE '%${tag.replace(/'/g, "''")}%'`;
  } else {
    query = `SELECT id, first_name, last_name, phone, email, tags, source, shop, created_at FROM contacts WHERE opted_out = 0`;
  }
  return db.prepare(query).all();
}

function getSegments() {
  const allCount = db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT phone FROM contacts WHERE opted_out = 0
      UNION SELECT phone FROM customers WHERE phone IS NOT NULL AND phone != ''
    )
  `).get().c;
  const manualCount = db.prepare("SELECT COUNT(*) as c FROM contacts WHERE opted_out = 0 AND source = 'manual'").get().c;
  const shopifyCount = db.prepare("SELECT COUNT(*) as c FROM customers WHERE phone IS NOT NULL AND phone != ''").get().c;
  const buyersCount = db.prepare("SELECT COUNT(*) as c FROM customers WHERE phone IS NOT NULL AND phone != '' AND total_orders > 0").get().c;
  const inactive30 = db.prepare("SELECT COUNT(*) as c FROM customers WHERE phone IS NOT NULL AND phone != '' AND last_order_at <= datetime('now', '-30 days')").get().c;

  // Get unique tags
  const tags = [];
  const tagRows = db.prepare("SELECT DISTINCT tags FROM contacts WHERE tags != '' AND opted_out = 0").all();
  const tagSet = new Set();
  tagRows.forEach(r => r.tags.split(',').forEach(t => { const trimmed = t.trim(); if (trimmed) tagSet.add(trimmed); }));

  return {
    segments: [
      { id: 'all', name: 'Tous les contacts', count: allCount },
      { id: 'manual', name: 'Ajoutes manuellement', count: manualCount },
      { id: 'shopify', name: 'Clients Shopify', count: shopifyCount },
      { id: 'buyers', name: 'Acheteurs (1+ commande)', count: buyersCount },
      { id: 'inactive_30', name: 'Inactifs +30 jours', count: inactive30 },
    ],
    tags: Array.from(tagSet)
  };
}

// ─── A/B Test tracking ──────────────────────────
function setMessageVariant(id, variant) {
  const row = db.prepare('SELECT metadata FROM messages WHERE id = ?').get(id);
  const meta = JSON.parse(row?.metadata || '{}');
  meta.ab_variant = variant;
  db.prepare('UPDATE messages SET metadata = ? WHERE id = ?').run(JSON.stringify(meta), id);
}

function getABTestResults(from, to) {
  // Step 1 abandoned cart messages that were SENT in the window, with conversion of their checkout
  const dfm = dateClause(from, to, 'm.created_at');
  const messages = db.prepare(`
    SELECT m.id, m.phone, m.metadata, m.status,
           c.converted, c.total_price
    FROM messages m
    LEFT JOIN checkouts c ON json_extract(m.metadata, '$.checkout_id') = c.id
    WHERE m.flow = 'abandoned_cart' AND m.step = 1 AND m.status = 'sent' ${dfm.sql}
  `).all(...dfm.params);

  const results = {
    with_images: { sent: 0, converted: 0, clicked: 0, revenue: 0 },
    no_images: { sent: 0, converted: 0, clicked: 0, revenue: 0 }
  };

  messages.forEach(m => {
    const meta = JSON.parse(m.metadata || '{}');
    const variant = meta.ab_variant;
    if (!variant || !results[variant]) return;
    results[variant].sent++;
    if (m.converted) {
      results[variant].converted++;
      results[variant].revenue += parseFloat(m.total_price || 0);
    }
  });

  for (const v of Object.values(results)) {
    v.conversion_rate = v.sent > 0 ? Math.round(v.converted / v.sent * 100) : 0;
  }

  // Attribution scoped to the same window — only clicks on links sent during
  // this window, only orders attributable to those clicks. This keeps the
  // numbers consistent with the top KPIs and the per-template table.
  const dfClick = dateClause(from, to, 'clicked_at');
  const clicksRow = db.prepare(`
    SELECT COUNT(DISTINCT redirect_id || '|' || COALESCE(phone,'')) as c
    FROM redirect_clicks
    WHERE phone IS NOT NULL ${dfClick.sql}
  `).get(...dfClick.params);

  const dfOrder = dateClause(from, to, 'ordered_at');
  const attrRow = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(order_total), 0) as revenue
    FROM wa_attributed_orders WHERE 1=1 ${dfOrder.sql}
  `).get(...dfOrder.params);

  // total_sent: all sent abandoned_cart messages in the window (all steps)
  const sentRow = db.prepare(`
    SELECT COUNT(*) as c FROM messages m
    WHERE m.flow = 'abandoned_cart' AND m.status = 'sent' ${dfm.sql}
  `).get(...dfm.params);

  return {
    ...results,
    attribution: {
      total_wa_clicks: clicksRow.c,
      total_sent: sentRow.c,
      total_converted: attrRow.count,           // CLICK-attributed only — same as /api/attribution
      total_revenue: attrRow.revenue,           // CLICK-attributed only
      click_rate: sentRow.c > 0 ? Math.round(clicksRow.c / sentRow.c * 100) : 0
    }
  };
}

// ─── Incoming Messages ──────────────────────────
function saveIncomingMessage(phone, message) {
  db.prepare('INSERT INTO incoming_messages (phone, message) VALUES (?, ?)').run(phone, message);
}

function getIncomingMessages(limit = 50, from, to) {
  const df = dateClause(from, to, 'received_at');
  return db.prepare(`
    SELECT * FROM incoming_messages WHERE 1=1 ${df.sql} ORDER BY received_at DESC LIMIT ?
  `).all(...df.params, limit);
}

// ─── Alerts ─────────────────────────────────────
function saveAlert(type, message) {
  db.prepare('INSERT INTO alerts (type, message) VALUES (?, ?)').run(type, message);
}

function getAlerts(limit = 50) {
  return db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit);
}

module.exports = {
  init, saveShop, getShops, getShopToken,
  saveCheckout, getCheckoutById, getCheckoutsByEmail, markCheckoutConverted, getUnconvertedCheckout,
  queueMessage, getPendingMessages, updateMessageStatus, updateMessageDeliveryStatus, cancelMessages, hasActiveFlow, getRecentMessages,
  isOptedIn, saveOptin, optOut,
  suppressPhone, isSuppressed, unsuppressPhone, getSuppressedPhones,
  getFlowSettings, isFlowEnabled, setFlowEnabled,
  saveCustomer, getInactiveCustomers, updateWinbackStage,
  saveRedirect, getRedirectMeta, getRedirectUrl, trackRedirectClick, getRedirectClicks, getTotalClicks, clearAll,
  findRecentClickByPhone, recordAttributedOrder, getAttributionStats, getRecentAttributedOrders,
  getSqliteNow, getStats,
  getMessagesByFlow, getMessagesByDay, getCheckoutsDetailed, getMessagesByTemplate, getTemplateStats, getFlowConversionStats, getDeliveryStats, getDailyRevenue, getHourlyDistribution,
  createCampaign, getCampaigns, getCampaignById, updateCampaignStatus,
  getCustomersWithPhone, getAllCustomersWithPhone,
  addContact, updateContact, deleteContact, getContacts, getSegments,
  setMessageVariant, getABTestResults,
  saveIncomingMessage, getIncomingMessages,
  saveAlert, getAlerts
};
