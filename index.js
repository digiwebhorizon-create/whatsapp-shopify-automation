const express = require('express');
const cron = require('node-cron');
const db = require('./db');
const whatsapp = require('./whatsapp');
const shopify = require('./shopify');
const flows = require('./flows');
const { getDashboardHTML } = require('./dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// Shopify credentials
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = 'read_orders,write_orders,read_customers,write_customers,read_products,read_checkouts,write_discounts,read_shipping,read_fulfillments';

app.use(express.json({ limit: '10mb' }));

// ─── Dashboard Auth Middleware ───────────────────
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

function requireAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) return next(); // No password set = open access
  // Check session cookie
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/dash_auth=([^;]+)/);
  if (match && match[1] === Buffer.from(DASHBOARD_PASSWORD).toString('base64')) return next();
  // Check auth header (for API calls from dashboard JS)
  const authHeader = req.headers['x-dash-auth'];
  if (authHeader === DASHBOARD_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!DASHBOARD_PASSWORD || password === DASHBOARD_PASSWORD) {
    const token = Buffer.from(DASHBOARD_PASSWORD || 'open').toString('base64');
    res.setHeader('Set-Cookie', `dash_auth=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Mot de passe incorrect' });
  }
});

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

// ─── Dashboard API (auth protected) ─────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json({ ...db.getStats(from, to), test_mode: process.env.TEST_MODE === 'true', wa_cost: parseFloat(process.env.WA_COST_PER_MESSAGE || '0.08') });
});

app.get('/api/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { from, to } = req.query;
  res.json(db.getRecentMessages(limit, from, to));
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

app.get('/api/messages-by-flow', (req, res) => {
  const { from, to } = req.query;
  res.json(db.getMessagesByFlow(from, to));
});

app.get('/api/messages-by-day', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getMessagesByDay(days));
});

app.get('/api/checkouts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { from, to } = req.query;
  res.json(db.getCheckoutsDetailed(limit, from, to));
});

app.get('/api/messages-by-template', (req, res) => {
  res.json(db.getMessagesByTemplate());
});

app.get('/api/daily-revenue', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getDailyRevenue(days));
});

app.get('/api/hourly-distribution', (req, res) => {
  const { from, to } = req.query;
  res.json(db.getHourlyDistribution(from, to));
});

// ─── Meta Templates API ─────────────────────────
app.get('/api/templates', async (req, res) => {
  const result = await whatsapp.getTemplates();
  if (result.success) {
    res.json(result.templates);
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.put('/api/templates/:id', async (req, res) => {
  const { components } = req.body;
  if (!components) return res.status(400).json({ error: 'Missing components' });
  const result = await whatsapp.updateTemplate(req.params.id, components);
  res.json(result);
});

// ─── Contacts API ───────────────────────────────
app.get('/api/contacts', requireAuth, (req, res) => {
  const segment = req.query.segment || 'all';
  res.json(db.getContacts(segment));
});

app.post('/api/contacts', requireAuth, (req, res) => {
  const { first_name, last_name, phone, email, tags } = req.body;
  if (!phone) return res.status(400).json({ error: 'Le numero de telephone est obligatoire' });
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length < 10) return res.status(400).json({ error: 'Numero invalide' });
  try {
    const id = db.addContact({ first_name, last_name, phone: cleaned, email, tags });
    res.json({ success: true, id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/contacts/:id', requireAuth, (req, res) => {
  const { first_name, last_name, phone, email, tags } = req.body;
  db.updateContact(req.params.id, { first_name, last_name, phone, email, tags });
  res.json({ success: true });
});

app.delete('/api/contacts/:id', requireAuth, (req, res) => {
  db.deleteContact(req.params.id);
  res.json({ success: true });
});

app.get('/api/segments', requireAuth, (req, res) => {
  res.json(db.getSegments());
});

// ─── Campaigns API ──────────────────────────────
app.get('/api/campaigns', requireAuth, (req, res) => {
  res.json(db.getCampaigns());
});

app.get('/api/customers', requireAuth, (req, res) => {
  res.json(db.getAllCustomersWithPhone());
});

app.post('/api/campaigns', requireAuth, async (req, res) => {
  const { name, template, segment } = req.body;
  if (!name || !template) return res.status(400).json({ error: 'name and template required' });

  // Get contacts based on segment
  const contacts = db.getContacts(segment || 'all');
  if (contacts.length === 0) return res.status(400).json({ error: 'Aucun contact dans ce segment' });

  const defaultShop = process.env.SHOPIFY_STORE_DOMAIN || 'lebourlingueur.myshopify.com';

  const campaignId = db.createCampaign({
    name, template,
    template_params: [],
    target_filter: segment || 'all',
    target_count: contacts.length
  });

  db.updateCampaignStatus(campaignId, 'sending');
  let queued = 0;
  for (const contact of contacts) {
    db.queueMessage({
      shop: contact.shop || defaultShop,
      phone: contact.phone,
      flow: 'campaign_' + campaignId,
      step: 1,
      template,
      scheduled_at: new Date().toISOString(),
      metadata: {
        campaign_id: campaignId,
        customer_name: (contact.first_name || contact.name || '').split(' ')[0],
        contact_id: contact.id
      }
    });
    queued++;
  }

  res.json({ success: true, campaign_id: campaignId, queued, total: contacts.length });
});

app.post('/api/campaigns/:id/cancel', (req, res) => {
  const campaign = db.getCampaignById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  // Cancel all pending messages for this campaign
  const flowName = 'campaign_' + req.params.id;
  const shops = db.getShops();
  for (const shop of shops) {
    const customers = db.getCustomersWithPhone(shop.domain);
    for (const c of customers) {
      db.cancelMessages(shop.domain, c.phone, flowName);
    }
  }
  db.updateCampaignStatus(req.params.id, 'cancelled');
  res.json({ success: true });
});

// ─── A/B Test Results ───────────────────────────
app.get('/api/ab-results', requireAuth, (req, res) => {
  res.json(db.getABTestResults());
});

// ─── Dashboard HTML ─────────────────────────────
const dashboardServerUrl = process.env.SERVER_URL || 'https://panier.le-bourlingueur.com';
app.get('/dashboard', (req, res) => {
  res.send(getDashboardHTML(dashboardServerUrl));
});
app.get('/shopify/dashboard', (req, res) => {
  res.send(getDashboardHTML(dashboardServerUrl));
});

// ─── Short URL redirect (with click tracking + UTM) ─
app.get('/r/:id', (req, res) => {
  const url = db.getRedirectUrl(req.params.id);
  if (url) {
    // Track the click
    db.trackRedirectClick(req.params.id, req.ip, req.get('user-agent'));
    // Add UTM params for attribution
    const sep = url.includes('?') ? '&' : '?';
    const tracked = url + sep + 'utm_source=whatsapp&utm_medium=abandoned_cart&utm_campaign=recovery';
    res.redirect(tracked);
  } else {
    res.redirect('https://le-bourlingueur.com');
  }
});

// Clear all data (debug)
app.post('/api/clear', (req, res) => {
  db.clearAll();
  res.json({ ok: true });
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

// Poll abandoned checkouts every 5 minutes (more reliable than webhook)
cron.schedule('*/5 * * * *', async () => {
  try {
    await flows.pollAbandonedCheckouts();
  } catch (err) {
    console.error('[CRON] pollAbandonedCheckouts error:', err.message);
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
