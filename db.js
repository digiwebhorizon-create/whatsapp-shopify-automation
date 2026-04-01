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
function saveRedirect(id, url) {
  db.prepare('INSERT OR REPLACE INTO redirects (id, url) VALUES (?, ?)').run(id, url);
}

function getRedirectUrl(id) {
  const row = db.prepare('SELECT url FROM redirects WHERE id = ?').get(id);
  return row?.url;
}

// ─── Redirect click tracking ────────────────────
function trackRedirectClick(redirectId, ip, userAgent) {
  db.prepare(`
    INSERT INTO redirect_clicks (redirect_id, ip, user_agent) VALUES (?, ?, ?)
  `).run(redirectId, ip || '', userAgent || '');
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

  // Add conversion data per template (for abandoned_cart: check if the checkout linked to the message converted)
  const convRows = db.prepare(`
    SELECT m.template, COUNT(DISTINCT CASE WHEN c.converted = 1 THEN c.id END) as converted,
      COALESCE(SUM(CASE WHEN c.converted = 1 THEN CAST(c.total_price AS REAL) END), 0) as revenue
    FROM messages m
    LEFT JOIN checkouts c ON m.checkout_id = c.id
    WHERE m.flow = 'abandoned_cart' ${df.sql.replace(/c\./g, 'm.')}
    GROUP BY m.template
  `).all(...df.params);

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

function getABTestResults() {
  // Get step 1 abandoned cart messages that were sent, with their checkout conversion status
  const messages = db.prepare(`
    SELECT m.id, m.phone, m.metadata, m.status,
           c.converted, c.total_price
    FROM messages m
    LEFT JOIN checkouts c ON json_extract(m.metadata, '$.checkout_id') = c.id
    WHERE m.flow = 'abandoned_cart' AND m.step = 1 AND m.status = 'sent'
  `).all();

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

  // Count clicks per variant (check redirect_clicks for messages with short URLs)
  // We track all redirect clicks globally — clicks mean WhatsApp-attributed traffic
  const totalClicks = db.prepare('SELECT COUNT(*) as c FROM redirect_clicks').get().c;

  // Add conversion rates and click rate
  for (const v of Object.values(results)) {
    v.conversion_rate = v.sent > 0 ? Math.round(v.converted / v.sent * 100) : 0;
  }

  // Global attribution stats
  const totalSent = db.prepare("SELECT COUNT(*) as c FROM messages WHERE flow = 'abandoned_cart' AND status = 'sent'").get().c;
  const totalConverted = db.prepare("SELECT COUNT(*) as c FROM checkouts WHERE converted = 1").get().c;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(CAST(total_price AS REAL)), 0) as t FROM checkouts WHERE converted = 1").get().t;

  return {
    ...results,
    attribution: {
      total_wa_clicks: totalClicks,
      total_sent: totalSent,
      total_converted: totalConverted,
      total_revenue: totalRevenue,
      click_rate: totalSent > 0 ? Math.round(totalClicks / totalSent * 100) : 0
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
  getFlowSettings, isFlowEnabled, setFlowEnabled,
  saveCustomer, getInactiveCustomers, updateWinbackStage,
  saveRedirect, getRedirectUrl, trackRedirectClick, getRedirectClicks, getTotalClicks, clearAll,
  getSqliteNow, getStats,
  getMessagesByFlow, getMessagesByDay, getCheckoutsDetailed, getMessagesByTemplate, getTemplateStats, getFlowConversionStats, getDeliveryStats, getDailyRevenue, getHourlyDistribution,
  createCampaign, getCampaigns, getCampaignById, updateCampaignStatus,
  getCustomersWithPhone, getAllCustomersWithPhone,
  addContact, updateContact, deleteContact, getContacts, getSegments,
  setMessageVariant, getABTestResults,
  saveIncomingMessage, getIncomingMessages,
  saveAlert, getAlerts
};
