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

// ─── Stats ───────────────────────────────────────
function getSqliteNow() {
  return db.prepare("SELECT datetime('now') as now").get().now;
}

function getStats() {
  const sent = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'sent'").get();
  const queued = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'queued'").get();
  const failed = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'failed'").get();
  const checkouts = db.prepare("SELECT COUNT(*) as count FROM checkouts WHERE converted = 0").get();
  const recovered = db.prepare("SELECT COUNT(*) as count FROM checkouts WHERE converted = 1").get();

  return {
    messages_sent: sent.count,
    messages_queued: queued.count,
    messages_failed: failed.count,
    abandoned_checkouts: checkouts.count,
    recovered_checkouts: recovered.count
  };
}

module.exports = {
  init, saveShop, getShops, getShopToken,
  saveCheckout, markCheckoutConverted, getUnconvertedCheckout,
  queueMessage, getPendingMessages, updateMessageStatus, cancelMessages, hasActiveFlow, getRecentMessages,
  isOptedIn, saveOptin, optOut,
  getFlowSettings, isFlowEnabled, setFlowEnabled,
  saveCustomer, getInactiveCustomers, updateWinbackStage,
  getSqliteNow, getStats
};
