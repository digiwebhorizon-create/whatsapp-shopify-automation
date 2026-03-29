const express = require('express');
const cron = require('node-cron');
const db = require('./db');
const whatsapp = require('./whatsapp');
const shopify = require('./shopify');
const flows = require('./flows');

const app = express();
const PORT = process.env.PORT || 3000;

// Shopify credentials
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = 'read_orders,write_orders,read_customers,write_customers,read_products,read_checkouts,write_discounts,read_shipping,read_fulfillments';

app.use(express.json({ limit: '10mb' }));

// ─── Health check ────────────────────────────────
app.get('/health', (req, res) => {
  const stats = db.getStats();
  res.json({ status: 'running', ...stats });
});

// ─── Shopify OAuth ───────────────────────────────
app.get('/', (req, res) => {
  const { shop } = req.query;
  if (shop) {
    const redirectUri = `https://${req.get('host')}/auth/callback`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.redirect(installUrl);
  }
  res.send('WhatsApp Shopify Automation - Running');
});

app.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send('Missing shop or code');

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code })
    });
    const data = await response.json();

    if (data.access_token) {
      db.saveShop(shop, data.access_token);
      console.log(`[AUTH] Token obtained for ${shop}`);
      res.send(`<h1>App installed!</h1><p>Shop: ${shop}</p><p>Token: ${data.access_token}</p>`);
    } else {
      res.status(500).send('Failed: ' + JSON.stringify(data));
    }
  } catch (err) {
    res.status(500).send('OAuth error: ' + err.message);
  }
});

// ─── Shopify Webhooks ────────────────────────────

// Checkout created → Abandoned Cart flow
app.post('/webhooks/checkouts-create', async (req, res) => {
  res.status(200).send('OK'); // Respond immediately
  try {
    const checkout = req.body;
    const shopDomain = req.get('x-shopify-shop-domain');
    console.log(`[WEBHOOK] checkouts/create from ${shopDomain} - checkout ${checkout.id}`);
    await flows.abandonedCart.onCheckoutCreated(shopDomain, checkout);
  } catch (err) {
    console.error('[WEBHOOK] checkouts/create error:', err.message);
  }
});

// Order created → Cancel abandoned cart flow
app.post('/webhooks/orders-create', async (req, res) => {
  res.status(200).send('OK');
  try {
    const order = req.body;
    const shopDomain = req.get('x-shopify-shop-domain');
    console.log(`[WEBHOOK] orders/create from ${shopDomain} - order ${order.id}`);
    await flows.abandonedCart.onOrderCreated(shopDomain, order);
  } catch (err) {
    console.error('[WEBHOOK] orders/create error:', err.message);
  }
});

// Order fulfilled → Upsell flow
app.post('/webhooks/orders-fulfilled', async (req, res) => {
  res.status(200).send('OK');
  try {
    const order = req.body;
    const shopDomain = req.get('x-shopify-shop-domain');
    console.log(`[WEBHOOK] orders/fulfilled from ${shopDomain} - order ${order.id}`);
    await flows.upsell.onOrderFulfilled(shopDomain, order);
  } catch (err) {
    console.error('[WEBHOOK] orders/fulfilled error:', err.message);
  }
});

// ─── Dashboard API ───────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

app.get('/api/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.getRecentMessages(limit));
});

app.get('/api/flows', (req, res) => {
  res.json(db.getFlowSettings());
});

app.post('/api/flows/:flowName/toggle', (req, res) => {
  const { flowName } = req.params;
  const { enabled } = req.body;
  db.setFlowEnabled(flowName, enabled);
  res.json({ flowName, enabled });
});

// Force process queue (debug)
app.post('/api/process-queue', async (req, res) => {
  try {
    const pending = db.getPendingMessages();
    console.log(`[DEBUG] Pending messages: ${pending.length}`);
    console.log(`[DEBUG] isWithinSendingHours: ${require('./whatsapp').isWithinSendingHours()}`);
    console.log(`[DEBUG] SQLite now: ${db.getSqliteNow()}`);
    if (pending.length > 0) {
      console.log(`[DEBUG] First msg scheduled_at: ${pending[0].scheduled_at}`);
    }
    await flows.processQueue();
    res.json({ ok: true, stats: db.getStats(), debug: { pending: pending.length, sqliteNow: db.getSqliteNow(), sendingHours: require('./whatsapp').isWithinSendingHours() } });
  } catch (err) {
    res.json({ ok: false, error: err.message, stack: err.stack });
  }
});

// ─── CRON Jobs ───────────────────────────────────

// Process message queue every minute (send pending messages within hours 9-21)
cron.schedule('* * * * *', async () => {
  try {
    await flows.processQueue();
  } catch (err) {
    console.error('[CRON] processQueue error:', err.message);
  }
});

// Winback scan daily at 10:00
cron.schedule('0 10 * * *', async () => {
  try {
    console.log('[CRON] Running winback scan...');
    await flows.winback.scan();
  } catch (err) {
    console.error('[CRON] winback error:', err.message);
  }
});

// Webhook health check daily at 8:00
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('[CRON] Checking webhook health...');
    const shops = db.getShops();
    for (const shop of shops) {
      await shopify.ensureWebhooks(shop.domain, shop.token);
    }
  } catch (err) {
    console.error('[CRON] webhook health error:', err.message);
  }
});

// ─── Start ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[SERVER] TEST_MODE: ${process.env.TEST_MODE === 'true'}`);
  db.init();
  console.log('[DB] Initialized');

  // Auto-register shop from environment variables on startup
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN || 'lebourlingueur.myshopify.com';
  const shopToken = process.env.SHOPIFY_STORE_TOKEN || '';
  if (shopToken) {
    db.saveShop(shopDomain, shopToken);
    console.log(`[STARTUP] Shop registered: ${shopDomain}`);
  }

  // Register webhooks for all shops on startup
  const shops = db.getShops();
  for (const shop of shops) {
    shopify.ensureWebhooks(shop.domain, shop.token).catch(err => {
      console.error(`[STARTUP] Webhook setup failed for ${shop.domain}:`, err.message);
    });
  }
});
