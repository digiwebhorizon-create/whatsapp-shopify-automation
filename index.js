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

app.get('/api/messages-by-flow', (req, res) => {
  res.json(db.getMessagesByFlow());
});

app.get('/api/messages-by-day', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getMessagesByDay(days));
});

app.get('/api/checkouts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.getCheckoutsDetailed(limit));
});

app.get('/api/messages-by-template', (req, res) => {
  res.json(db.getMessagesByTemplate());
});

app.get('/api/daily-revenue', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(db.getDailyRevenue(days));
});

app.get('/api/hourly-distribution', (req, res) => {
  res.json(db.getHourlyDistribution());
});

// ─── Dashboard HTML ─────────────────────────────
app.get('/dashboard', (req, res) => {
  res.send(getDashboardHTML());
});

// ─── Short URL redirect ─────────────────────────
app.get('/r/:id', (req, res) => {
  const url = db.getRedirectUrl(req.params.id);
  if (url) {
    res.redirect(url);
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

// ─── Dashboard HTML Generator ────────────────────
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Le Bourlingueur - WhatsApp Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e4e4e7; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #1a1d29 0%, #252836 100%); padding: 20px 30px; border-bottom: 1px solid #2d3142; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; color: #fff; }
  .header h1 span { color: #25d366; }
  .header .status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #a1a1aa; }
  .header .dot { width: 8px; height: 8px; border-radius: 50%; background: #25d366; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

  /* KPI Cards */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .kpi { background: #1a1d29; border-radius: 12px; padding: 20px; border: 1px solid #2d3142; }
  .kpi .label { font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .kpi .value { font-size: 32px; font-weight: 700; color: #fff; }
  .kpi .sub { font-size: 13px; color: #a1a1aa; margin-top: 4px; }
  .kpi.green .value { color: #25d366; }
  .kpi.blue .value { color: #3b82f6; }
  .kpi.orange .value { color: #f59e0b; }
  .kpi.red .value { color: #ef4444; }
  .kpi.purple .value { color: #a855f7; }

  /* Sections */
  .section { background: #1a1d29; border-radius: 12px; border: 1px solid #2d3142; margin-bottom: 24px; overflow: hidden; }
  .section-header { padding: 16px 20px; border-bottom: 1px solid #2d3142; display: flex; justify-content: space-between; align-items: center; }
  .section-header h2 { font-size: 16px; color: #fff; }
  .section-body { padding: 20px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; border-bottom: 1px solid #2d3142; }
  td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #1f2233; }
  tr:hover { background: #1f2233; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge.sent { background: #064e3b; color: #34d399; }
  .badge.queued { background: #1e3a5f; color: #60a5fa; }
  .badge.failed { background: #4c1d1d; color: #f87171; }
  .badge.cancelled { background: #3f3f46; color: #a1a1aa; }
  .badge.converted { background: #064e3b; color: #34d399; }
  .badge.abandoned { background: #4c1d1d; color: #f87171; }

  /* Flow toggles */
  .flow-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1f2233; }
  .flow-row:last-child { border: none; }
  .flow-name { font-weight: 600; }
  .flow-desc { font-size: 12px; color: #71717a; }
  .toggle { position: relative; width: 44px; height: 24px; cursor: pointer; }
  .toggle input { display: none; }
  .toggle .slider { position: absolute; inset: 0; background: #3f3f46; border-radius: 12px; transition: 0.3s; }
  .toggle .slider:before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
  .toggle input:checked + .slider { background: #25d366; }
  .toggle input:checked + .slider:before { transform: translateX(20px); }

  /* Charts area */
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; padding-top: 10px; }
  .bar { display: flex; flex-direction: column; align-items: center; flex: 1; }
  .bar-fill { width: 100%; border-radius: 4px 4px 0 0; min-height: 2px; transition: height 0.5s; }
  .bar-label { font-size: 10px; color: #71717a; margin-top: 4px; }
  .bar-value { font-size: 10px; color: #a1a1aa; margin-bottom: 2px; }

  /* Refresh */
  .refresh-btn { background: #25d366; color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; }
  .refresh-btn:hover { background: #20bd5a; }
  .last-refresh { font-size: 12px; color: #71717a; }

  @media (max-width: 768px) {
    .chart-grid { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>

<div class="header">
  <h1><span>WhatsApp</span> Dashboard — Le Bourlingueur</h1>
  <div class="status">
    <div class="dot"></div>
    <span>Production</span>
    <span style="margin-left:12px" class="last-refresh" id="lastRefresh"></span>
    <button class="refresh-btn" onclick="loadAll()">Actualiser</button>
  </div>
</div>

<div class="container">

  <!-- KPI Cards -->
  <div class="kpi-grid" id="kpiGrid"></div>

  <!-- Charts -->
  <div class="chart-grid">
    <div class="section">
      <div class="section-header"><h2>Messages par flow</h2></div>
      <div class="section-body" id="flowChart"></div>
    </div>
    <div class="section">
      <div class="section-header"><h2>Distribution horaire</h2></div>
      <div class="section-body" id="hourlyChart"></div>
    </div>
  </div>

  <!-- Flow Controls -->
  <div class="section">
    <div class="section-header"><h2>Flows</h2></div>
    <div class="section-body" id="flowControls"></div>
  </div>

  <!-- Checkouts -->
  <div class="section">
    <div class="section-header">
      <h2>Paniers abandonnes</h2>
      <span style="font-size:12px;color:#71717a" id="checkoutCount"></span>
    </div>
    <div class="section-body" style="overflow-x:auto">
      <table id="checkoutsTable">
        <thead><tr><th>Date</th><th>Client</th><th>Email</th><th>Telephone</th><th>Montant</th><th>Articles</th><th>Statut</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <!-- Recent Messages -->
  <div class="section">
    <div class="section-header">
      <h2>Messages recents</h2>
      <span style="font-size:12px;color:#71717a" id="msgCount"></span>
    </div>
    <div class="section-body" style="overflow-x:auto">
      <table id="messagesTable">
        <thead><tr><th>Date</th><th>Telephone</th><th>Flow</th><th>Template</th><th>Statut</th><th>Envoye</th><th>Erreur</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

</div>

<script>
const API = '';

async function api(path) {
  const r = await fetch(API + path);
  return r.json();
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z'));
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function badge(status) {
  return '<span class="badge ' + status + '">' + status + '</span>';
}

async function loadAll() {
  document.getElementById('lastRefresh').textContent = 'Mis a jour: ' + new Date().toLocaleTimeString('fr-FR');

  // Stats
  const stats = await api('/api/stats');
  document.getElementById('kpiGrid').innerHTML = [
    kpi('Messages envoyes', stats.messages_sent, '', 'green'),
    kpi('En attente', stats.messages_queued, '', 'blue'),
    kpi('Echoues', stats.messages_failed, '', 'red'),
    kpi('Annules', stats.messages_cancelled, 'Client a converti', 'orange'),
    kpi('Paniers abandonnes', stats.abandoned_checkouts, stats.total_checkouts + ' total detectes', ''),
    kpi('Paniers recuperes', stats.recovered_checkouts, stats.recovery_rate + '% taux conversion', 'green'),
    kpi('Revenu recupere', stats.revenue_recovered.toFixed(2) + ' EUR', '', 'purple'),
    kpi('Clients', stats.total_customers, stats.total_optins + ' opt-ins', 'blue'),
  ].join('');

  // Flow chart
  const byFlow = await api('/api/messages-by-flow');
  renderFlowChart(byFlow);

  // Hourly
  const hourly = await api('/api/hourly-distribution');
  renderHourlyChart(hourly);

  // Flows
  const flows = await api('/api/flows');
  renderFlows(flows);

  // Checkouts
  const checkouts = await api('/api/checkouts?limit=30');
  renderCheckouts(checkouts);

  // Messages
  const messages = await api('/api/messages?limit=50');
  renderMessages(messages);
}

function kpi(label, value, sub, color) {
  return '<div class="kpi ' + color + '"><div class="label">' + label + '</div><div class="value">' + value + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
}

function renderFlowChart(data) {
  const flows = {};
  data.forEach(r => {
    if (!flows[r.flow]) flows[r.flow] = { sent: 0, queued: 0, failed: 0, cancelled: 0 };
    flows[r.flow][r.status] = r.count;
  });
  const names = { abandoned_cart: 'Panier abandonne', upsell: 'Upsell', winback: 'Winback' };
  let html = '<table><thead><tr><th>Flow</th><th>Envoyes</th><th>En attente</th><th>Echoues</th><th>Annules</th><th>Total</th></tr></thead><tbody>';
  for (const [flow, d] of Object.entries(flows)) {
    const total = d.sent + d.queued + d.failed + d.cancelled;
    html += '<tr><td>' + (names[flow] || flow) + '</td><td>' + badge('sent') + ' ' + d.sent + '</td><td>' + badge('queued') + ' ' + d.queued + '</td><td>' + badge('failed') + ' ' + d.failed + '</td><td>' + badge('cancelled') + ' ' + d.cancelled + '</td><td><strong>' + total + '</strong></td></tr>';
  }
  html += '</tbody></table>';
  document.getElementById('flowChart').innerHTML = html;
}

function renderHourlyChart(data) {
  const hours = Array(24).fill(0);
  data.forEach(r => { hours[r.hour] = r.count; });
  const max = Math.max(...hours, 1);
  let html = '<div class="bar-chart">';
  for (let h = 0; h < 24; h++) {
    const pct = (hours[h] / max * 100);
    const color = (h >= 9 && h < 21) ? '#25d366' : '#3f3f46';
    html += '<div class="bar"><div class="bar-value">' + (hours[h] || '') + '</div><div class="bar-fill" style="height:' + pct + '%;background:' + color + '"></div><div class="bar-label">' + h + 'h</div></div>';
  }
  html += '</div><div style="font-size:11px;color:#71717a;margin-top:8px">Vert = fenetre d envoi (9h-21h)</div>';
  document.getElementById('hourlyChart').innerHTML = html;
}

function renderFlows(flows) {
  const names = { abandoned_cart: 'Panier abandonne', upsell: 'Upsell post-achat', winback: 'Winback reactivation' };
  const descs = { abandoned_cart: '3 messages: 30min, 24h, 48h', upsell: '1 message: J+5 apres livraison', winback: '3 messages: J+30, J+60, J+90' };
  let html = '';
  flows.forEach(f => {
    html += '<div class="flow-row"><div><div class="flow-name">' + (names[f.flow_name] || f.flow_name) + '</div><div class="flow-desc">' + (descs[f.flow_name] || '') + '</div></div><label class="toggle"><input type="checkbox" ' + (f.enabled ? 'checked' : '') + ' onchange="toggleFlow(\\'' + f.flow_name + '\\', this.checked)"><span class="slider"></span></label></div>';
  });
  document.getElementById('flowControls').innerHTML = html;
}

async function toggleFlow(name, enabled) {
  await fetch('/api/flows/' + name + '/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
}

function renderCheckouts(data) {
  document.getElementById('checkoutCount').textContent = data.length + ' derniers';
  const tbody = document.querySelector('#checkoutsTable tbody');
  tbody.innerHTML = data.map(c => {
    let items = '-';
    try {
      const parsed = JSON.parse(c.line_items || '[]');
      items = parsed.map(i => i.title + (i.quantity > 1 ? ' x' + i.quantity : '')).join(', ');
    } catch(e) {}
    return '<tr><td>' + formatDate(c.created_at) + '</td><td>' + (c.customer_name || '-') + '</td><td>' + (c.email || '-') + '</td><td>' + (c.phone || '-') + '</td><td><strong>' + (c.total_price || '0') + ' EUR</strong></td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + items + '</td><td>' + (c.converted ? badge('converted') + ' ' + formatDate(c.converted_at) : badge('abandoned')) + '</td></tr>';
  }).join('');
}

function renderMessages(data) {
  document.getElementById('msgCount').textContent = data.length + ' derniers';
  const tbody = document.querySelector('#messagesTable tbody');
  tbody.innerHTML = data.map(m => {
    return '<tr><td>' + formatDate(m.created_at) + '</td><td>' + m.phone + '</td><td>' + m.flow + '</td><td style="font-size:12px">' + m.template + '</td><td>' + badge(m.status) + '</td><td>' + formatDate(m.sent_at) + '</td><td style="font-size:11px;color:#f87171;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m.error || '') + '</td></tr>';
  }).join('');
}

// Auto-refresh every 60s
loadAll();
setInterval(loadAll, 60000);
</script>
</body>
</html>`;
}

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
