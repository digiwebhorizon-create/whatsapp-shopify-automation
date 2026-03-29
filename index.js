const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('WhatsApp Shopify Automation - Running');
});

// Shopify OAuth callback (needed for app install)
app.get('/auth/callback', (req, res) => {
  res.send('App installed successfully');
});

// Shopify webhooks endpoint
app.post('/webhooks/:topic', (req, res) => {
  console.log(`Webhook received: ${req.params.topic}`);
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
