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

    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('abandoned_cart', 1);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('upsell', 1);
    INSERT OR IGNORE INTO flow_settings (flow_name, enabled) VALUES ('winback', 1);
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

function getRecentMessages(limit) {
  return db.prepare(`
    SELECT * FROM messages ORDER BY created_at DESC LIMIT ?
  `).all(limit);
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

// ─── Stats ───────────────────────────────────────
function clearAll() {
  db.exec("DELETE FROM messages; DELETE FROM checkouts; DELETE FROM redirects;");
}

function getSqliteNow() {
  return db.prepare("SELECT datetime('now') as now").get().now;
}

function getStats() {
  const sent = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'sent'").get();
  const queued = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'queued'").get();
  const failed = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'failed'").get();
  const cancelled = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'cancelled'").get();
  const checkouts = db.prepare("SELECT COUNT(*) as count FROM checkouts WHERE converted = 0").get();
  const recovered = db.prepare("SELECT COUNT(*) as count FROM checkouts WHERE converted = 1").get();
  const totalCheckouts = db.prepare("SELECT COUNT(*) as count FROM checkouts").get();
  const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get();
  const totalOptins = db.prepare("SELECT COUNT(*) as count FROM optins WHERE opted_in = 1").get();

  // Revenue recovered (sum of converted checkout totals)
  const revenue = db.prepare("SELECT COALESCE(SUM(CAST(total_price AS REAL)), 0) as total FROM checkouts WHERE converted = 1").get();

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
function getMessagesByFlow() {
  return db.prepare(`
    SELECT flow, status, COUNT(*) as count
    FROM messages GROUP BY flow, status ORDER BY flow, status
  `).all();
}

function getMessagesByDay(days = 30) {
  return db.prepare(`
    SELECT DATE(created_at) as day, flow, status, COUNT(*) as count
    FROM messages
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY day, flow, status ORDER BY day DESC
  `).all(days);
}

function getCheckoutsDetailed(limit = 50) {
  return db.prepare(`
    SELECT id, shop, email, phone, total_price, customer_name, converted, converted_at, created_at,
           line_items
    FROM checkouts ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

function getMessagesByTemplate() {
  return db.prepare(`
    SELECT template, status, COUNT(*) as count
    FROM messages GROUP BY template, status ORDER BY template
  `).all();
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

function getHourlyDistribution() {
  return db.prepare(`
    SELECT CAST(strftime('%H', sent_at) AS INTEGER) as hour, COUNT(*) as count
    FROM messages WHERE status = 'sent' AND sent_at IS NOT NULL
    GROUP BY hour ORDER BY hour
  `).all();
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

module.exports = {
  init, saveShop, getShops, getShopToken,
  saveCheckout, getCheckoutById, markCheckoutConverted, getUnconvertedCheckout,
  queueMessage, getPendingMessages, updateMessageStatus, cancelMessages, hasActiveFlow, getRecentMessages,
  isOptedIn, saveOptin, optOut,
  getFlowSettings, isFlowEnabled, setFlowEnabled,
  saveCustomer, getInactiveCustomers, updateWinbackStage,
  saveRedirect, getRedirectUrl, clearAll,
  getSqliteNow, getStats,
  getMessagesByFlow, getMessagesByDay, getCheckoutsDetailed, getMessagesByTemplate, getDailyRevenue, getHourlyDistribution,
  createCampaign, getCampaigns, getCampaignById, updateCampaignStatus,
  getCustomersWithPhone, getAllCustomersWithPhone
};
