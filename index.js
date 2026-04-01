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
// DASHBOARD_EMAILS: comma-separated list of authorized emails
const DASHBOARD_EMAILS = (process.env.DASHBOARD_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

function isValidLogin(email, password) {
  if (!DASHBOARD_PASSWORD) return true; // No password = open access
  if (password !== DASHBOARD_PASSWORD) return false;
  if (DASHBOARD_EMAILS.length === 0) return true; // No email list = any email OK
  return DASHBOARD_EMAILS.includes(email.toLowerCase());
}

function requireAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) return next();
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/dash_auth=([^;]+)/);
  if (match) {
    try {
      const decoded = Buffer.from(match[1], 'base64').toString();
      const [email, pass] = decoded.split(':');
      if (isValidLogin(email, pass)) return next();
    } catch (e) {}
  }
  res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (isValidLogin(email || '', password || '')) {
    const token = Buffer.from((email || '') + ':' + (password || '')).toString('base64');
    res.setHeader('Set-Cookie', `dash_auth=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Email ou mot de passe incorrect' });
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

// Order fulfilled → Upsell flow + Review flow
app.post('/webhooks/orders-fulfilled', async (req, res) => {
  res.status(200).send('OK');
  try {
    const order = req.body;
    const shopDomain = req.get('x-shopify-shop-domain');
    console.log(`[WEBHOOK] orders/fulfilled from ${shopDomain} - order ${order.id}`);
    await flows.upsell.onOrderFulfilled(shopDomain, order);
    await flows.review.onOrderFulfilled(shopDomain, order);
    await flows.crosssell.onOrderFulfilled(shopDomain, order);
  } catch (err) {
    console.error('[WEBHOOK] orders/fulfilled error:', err.message);
  }
});

// ─── WhatsApp Webhook (Meta) ────────────────────

// Verification endpoint for Meta webhook setup
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'whatsapp_webhook_verify_token';

app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('[WA-WEBHOOK] Verification successful');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
});

// Incoming messages handler
const OPT_OUT_KEYWORDS = ['stop', 'arret', 'desabonner'];
const OPT_IN_KEYWORDS = ['start', 'reprendre'];

app.post('/webhooks/whatsapp', (req, res) => {
  res.status(200).send('OK'); // Respond immediately

  try {
    const body = req.body;
    const entries = body.entry || [];
    const defaultShop = process.env.SHOPIFY_STORE_DOMAIN || 'lebourlingueur.myshopify.com';

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const messages = change.value?.messages || [];

        // Handle message status updates (delivered, read)
        const statuses = change.value?.statuses || [];
        for (const status of statuses) {
          if (status.id && (status.status === 'delivered' || status.status === 'read')) {
            db.updateMessageDeliveryStatus(status.id, status.status);
            console.log(`[WA-WEBHOOK] Status: ${status.id} → ${status.status}`);
          }
        }

        for (const msg of messages) {
          const phone = msg.from;
          const text = (msg.text?.body || '').trim();

          if (!phone || !text) continue;

          // Store incoming message
          db.saveIncomingMessage(phone, text);
          console.log(`[WA-WEBHOOK] Incoming from ${phone}: ${text}`);

          const textLower = text.toLowerCase();

          // Check for opt-out keywords
          if (OPT_OUT_KEYWORDS.includes(textLower)) {
            db.optOut(phone, defaultShop);
            console.log(`[WA-WEBHOOK] Opt-out: ${phone}`);
          }
          // Check for opt-in keywords
          else if (OPT_IN_KEYWORDS.includes(textLower)) {
            db.saveOptin(phone, defaultShop, 'whatsapp_reply');
            console.log(`[WA-WEBHOOK] Opt-in: ${phone}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[WA-WEBHOOK] Error processing incoming message:', err.message);
  }
});

// ─── Dashboard API (auth protected) ─────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json({ ...db.getStats(from, to), test_mode: process.env.TEST_MODE === 'true', wa_cost: parseFloat(process.env.WA_COST_PER_MESSAGE || '0.08') });
});

app.get('/api/messages', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { from, to } = req.query;
  res.json(db.getRecentMessages(limit, from, to));
});

app.get('/api/flows', requireAuth, (req, res) => {
  res.json(db.getFlowSettings());
});

app.post('/api/flows/:flowName/toggle', requireAuth, (req, res) => {
  const { flowName } = req.params;
  const { enabled } = req.body;
  db.setFlowEnabled(flowName, enabled);
  res.json({ flowName, enabled });
});

app.get('/api/messages-by-flow', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json(db.getMessagesByFlow(from, to));
});

app.get('/api/messages-by-day', requireAuth, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getMessagesByDay(days));
});

app.get('/api/checkouts', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { from, to } = req.query;
  res.json(db.getCheckoutsDetailed(limit, from, to));
});

app.get('/api/messages-by-template', requireAuth, (req, res) => {
  res.json(db.getMessagesByTemplate());
});

app.get('/api/daily-revenue', requireAuth, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getDailyRevenue(days));
});

app.get('/api/hourly-distribution', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json(db.getHourlyDistribution(from, to));
});

// ─── Meta Templates API ─────────────────────────
app.get('/api/templates', requireAuth, async (req, res) => {
  const result = await whatsapp.getTemplates();
  if (result.success) {
    res.json(result.templates);
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.put('/api/templates/:id', requireAuth, async (req, res) => {
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
  const { name, template, segment, scheduled_at } = req.body;
  if (!name || !template) return res.status(400).json({ error: 'name and template required' });

  // Get contacts based on segment
  const contacts = db.getContacts(segment || 'all');
  if (contacts.length === 0) return res.status(400).json({ error: 'Aucun contact dans ce segment' });

  const defaultShop = process.env.SHOPIFY_STORE_DOMAIN || 'lebourlingueur.myshopify.com';
  const sendAt = scheduled_at || new Date().toISOString();

  const campaignId = db.createCampaign({
    name, template,
    template_params: [],
    target_filter: segment || 'all',
    target_count: contacts.length
  });

  db.updateCampaignStatus(campaignId, scheduled_at ? 'scheduled' : 'sending');
  let queued = 0;
  for (const contact of contacts) {
    db.queueMessage({
      shop: contact.shop || defaultShop,
      phone: contact.phone,
      flow: 'campaign_' + campaignId,
      step: 1,
      template,
      scheduled_at: sendAt,
      metadata: {
        campaign_id: campaignId,
        customer_name: (contact.first_name || contact.name || '').split(' ')[0],
        contact_id: contact.id
      }
    });
    queued++;
  }

  res.json({ success: true, campaign_id: campaignId, queued, total: contacts.length, scheduled_at: sendAt });
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

// ─── Template & Flow Stats ──────────────────────
app.get('/api/template-stats', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json(db.getTemplateStats(from, to));
});

app.get('/api/flow-conversion-stats', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json(db.getFlowConversionStats(from, to));
});

// ─── Delivery Stats ─────────────────────────────
app.get('/api/delivery-stats', requireAuth, (req, res) => {
  const { from, to } = req.query;
  res.json(db.getDeliveryStats(from, to));
});

app.get('/api/revenue-chart', requireAuth, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getDailyRevenue(days));
});

// ─── A/B Test Results ───────────────────────────
app.get('/api/ab-results', requireAuth, (req, res) => {
  res.json(db.getABTestResults());
});

// ─── Incoming Messages API ─────────────────────
app.get('/api/incoming-messages', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { from, to } = req.query;
  res.json(db.getIncomingMessages(limit, from, to));
});

// ─── Alerts API ────────────────────────────────
app.get('/api/alerts', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.getAlerts(limit));
});

// ─── Export CSV ────────────────────────────────
app.get('/api/export/contacts', requireAuth, (req, res) => {
  const contacts = db.getContacts('all');
  const header = 'id,first_name,last_name,phone,email,tags,source,shop,created_at';
  const rows = contacts.map(c =>
    [c.id, csvEscape(c.first_name), csvEscape(c.last_name), c.phone, csvEscape(c.email), csvEscape(c.tags), c.source, c.shop, c.created_at].join(',')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
  res.send([header, ...rows].join('\n'));
});

app.get('/api/export/messages', requireAuth, (req, res) => {
  const { from, to } = req.query;
  const messages = db.getRecentMessages(10000, from, to);
  const header = 'id,shop,phone,flow,step,template,status,wa_message_id,scheduled_at,sent_at,error,created_at';
  const rows = messages.map(m =>
    [m.id, m.shop, m.phone, m.flow, m.step, m.template, m.status, m.wa_message_id || '', m.scheduled_at, m.sent_at || '', csvEscape(m.error || ''), m.created_at].join(',')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="messages.csv"');
  res.send([header, ...rows].join('\n'));
});

app.get('/api/export/stats', requireAuth, (req, res) => {
  const { from, to } = req.query;
  const stats = db.getStats(from, to);
  const header = Object.keys(stats).join(',');
  const row = Object.values(stats).join(',');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stats.csv"');
  res.send([header, row].join('\n'));
});

function csvEscape(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

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

// ─── System Health Check ────────────────────────
app.get('/api/health', requireAuth, async (req, res) => {
  const checks = {};

  // 1. Check Shopify webhooks
  try {
    const shops = db.getShops();
    checks.shops = shops.map(s => s.domain);
    if (shops.length > 0) {
      const existing = await shopify.apiCall(shops[0].domain, 'webhooks.json');
      checks.shopify_webhooks = (existing.webhooks || []).map(w => ({
        topic: w.topic,
        address: w.address,
        created_at: w.created_at
      }));
    } else {
      checks.shopify_webhooks = 'No shops registered';
    }
  } catch (err) {
    checks.shopify_webhooks = { error: err.message };
  }

  // 2. Check Meta WhatsApp templates
  try {
    const result = await whatsapp.getTemplates();
    if (result.success) {
      checks.meta_templates = result.templates.map(t => ({
        name: t.name,
        status: t.status,
        language: t.language,
        category: t.category
      }));
    } else {
      checks.meta_templates = { error: result.error };
    }
  } catch (err) {
    checks.meta_templates = { error: err.message };
  }

  // 3. Check required templates
  const requiredTemplates = ['panier_rappel_1', 'panier_rappel_2', 'panier_rappel_promo', 'post_purchase_upsell', 'winback_news', 'winback_offer_15', 'winback_offer_20', 'demande_avis', 'birthday_wish'];
  const existingNames = Array.isArray(checks.meta_templates) ? checks.meta_templates.map(t => t.name) : [];
  checks.missing_templates = requiredTemplates.filter(t => !existingNames.includes(t));

  // 4. Queue status
  checks.queue = {
    pending: db.getPendingMessages().length,
    sending_hours: whatsapp.isWithinSendingHours(),
    sqlite_now: db.getSqliteNow(),
    test_mode: process.env.TEST_MODE === 'true'
  };

  // 5. WhatsApp webhook
  checks.whatsapp_webhook = {
    verify_endpoint: '/webhooks/whatsapp',
    verify_token_set: !!process.env.WA_VERIFY_TOKEN,
    note: 'Configure in Meta Business Suite → WhatsApp → Configuration → Webhook URL'
  };

  res.json(checks);
});

// ─── Create missing Meta templates ──────────────
app.post('/api/create-templates', requireAuth, async (req, res) => {
  const results = {};

  // Check which templates already exist
  const existing = await whatsapp.getTemplates();
  const existingNames = existing.success ? existing.templates.map(t => t.name) : [];

  // Template: demande_avis
  if (!existingNames.includes('demande_avis')) {
    results.demande_avis = await whatsapp.createTemplate(
      'demande_avis',
      'MARKETING',
      'fr',
      [
        { type: 'BODY', text: "Bonjour {{1}} ! 😊\\n\\nVotre commande a ete livree depuis quelques jours. Nous esperons que tout vous plait !\\n\\nVotre avis compte enormement pour nous. Pourriez-vous prendre 30 secondes pour nous laisser un avis ? ⭐\\n\\nMerci beaucoup !\\nL'equipe Le Bourlingueur" },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Laisser un avis ⭐', url: 'https://le-bourlingueur.com/pages/avis' }] }
      ]
    );
  } else {
    results.demande_avis = { skipped: true, reason: 'Template already exists' };
  }

  // Template: birthday_wish
  if (!existingNames.includes('birthday_wish')) {
    results.birthday_wish = await whatsapp.createTemplate(
      'birthday_wish',
      'MARKETING',
      'fr',
      [
        { type: 'BODY', text: "Joyeux anniversaire {{1}} ! 🎂🎉\\n\\nPour celebrer ce jour special, voici un code promo rien que pour vous :\\n\\n🎁 *{{2}}* — {{3}}% de reduction\\n\\nValable 7 jours sur tout le site !\\n\\nBon anniversaire de la part de toute l'equipe Le Bourlingueur ! 🥳" },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'En profiter 🎁', url: 'https://le-bourlingueur.com' }] }
      ]
    );
  } else {
    results.birthday_wish = { skipped: true, reason: 'Template already exists' };
  }

  res.json(results);
});

// Force re-register webhooks with correct URL
app.post('/api/fix-webhooks', requireAuth, async (req, res) => {
  try {
    const shops = db.getShops();
    const results = [];
    for (const shop of shops) {
      await shopify.ensureWebhooks(shop.domain, shop.token);
      // Verify
      const existing = await shopify.apiCall(shop.domain, 'webhooks.json');
      results.push({
        shop: shop.domain,
        webhooks: (existing.webhooks || []).map(w => ({ topic: w.topic, address: w.address }))
      });
    }
    res.json({ success: true, results });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Clear all data (debug)
app.post('/api/clear', requireAuth, (req, res) => {
  db.clearAll();
  res.json({ ok: true });
});

// Force process queue (debug)
app.post('/api/process-queue', requireAuth, async (req, res) => {
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

// Birthday scan daily at 8:00
cron.schedule('0 8 * * *', async () => {
  try {
    console.log('[CRON] Running birthday scan...');
    await flows.birthday.scan();
  } catch (err) {
    console.error('[CRON] birthday error:', err.message);
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
