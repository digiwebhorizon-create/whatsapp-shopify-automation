const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// Shopify App credentials (set in Railway environment variables)
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = 'read_orders,write_orders,read_customers,write_customers,read_products,read_checkouts,write_discounts,read_shipping,read_fulfillments';

app.use(express.json());

// Store tokens in memory (will persist to DB later)
const tokens = {};

// Health check
app.get('/health', (req, res) => {
  res.send('WhatsApp Shopify Automation - Running');
});

// Shopify app install - redirect to OAuth
app.get('/', (req, res) => {
  const { shop, hmac, host } = req.query;

  if (shop) {
    const redirectUri = `https://${req.get('host')}/auth/callback`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.redirect(installUrl);
  }

  // Not from Shopify, show status
  res.send('WhatsApp Shopify Automation - Running');
});

// OAuth callback - exchange code for token
app.get('/auth/callback', async (req, res) => {
  const { shop, code, hmac } = req.query;

  if (!shop || !code) {
    return res.status(400).send('Missing shop or code parameter');
  }

  try {
    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code: code
      })
    });

    const data = await response.json();

    if (data.access_token) {
      tokens[shop] = data.access_token;
      console.log(`\n========================================`);
      console.log(`TOKEN OBTAINED FOR ${shop}`);
      console.log(`Access Token: ${data.access_token}`);
      console.log(`========================================\n`);

      res.send(`
        <html>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>App installed successfully!</h1>
          <p>Shop: <strong>${shop}</strong></p>
          <p>Token: <code>${data.access_token}</code></p>
          <p style="color: green; font-size: 20px;">Copiez ce token et envoyez-le a Damien!</p>
        </body>
        </html>
      `);
    } else {
      console.error('Token exchange failed:', data);
      res.status(500).send('Failed to get access token: ' + JSON.stringify(data));
    }
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('OAuth error: ' + error.message);
  }
});

// Shopify webhooks endpoint
app.post('/webhooks/:topic', (req, res) => {
  console.log(`Webhook received: ${req.params.topic}`);
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
