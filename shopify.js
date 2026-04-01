// Shopify Admin API client
const db = require('./db');

async function apiCall(shop, endpoint, method = 'GET', body = null) {
  const token = db.getShopToken(shop);
  if (!token) throw new Error(`No token for shop ${shop}`);

  const url = `https://${shop}/admin/api/2026-01/${endpoint}`;
  const options = {
    method,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API ${response.status}: ${text}`);
  }
  return response.json();
}

// Get recent orders for a customer
async function getCustomerOrders(shop, customerId) {
  const data = await apiCall(shop, `customers/${customerId}/orders.json?status=any&limit=10`);
  return data.orders || [];
}

// Get product recommendations (simple: other products from same collection)
async function getProductRecommendations(shop, productId) {
  try {
    const data = await apiCall(shop, `products.json?limit=4`);
    return (data.products || []).filter(p => p.id.toString() !== productId.toString());
  } catch {
    return [];
  }
}

// Create discount code
async function createDiscountCode(shop, code, percentage, usageLimit = 1) {
  // Create price rule first
  const priceRule = await apiCall(shop, 'price_rules.json', 'POST', {
    price_rule: {
      title: code,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'percentage',
      value: `-${percentage}`,
      customer_selection: 'all',
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      usage_limit: usageLimit
    }
  });

  // Create discount code
  const discount = await apiCall(shop, `price_rules/${priceRule.price_rule.id}/discount_codes.json`, 'POST', {
    discount_code: { code }
  });

  return discount.discount_code;
}

// Ensure webhooks are registered
async function ensureWebhooks(shop, token) {
  const requiredWebhooks = [
    { topic: 'checkouts/create', address: `${getServerUrl()}/webhooks/checkouts-create` },
    { topic: 'orders/create', address: `${getServerUrl()}/webhooks/orders-create` },
    { topic: 'orders/fulfilled', address: `${getServerUrl()}/webhooks/orders-fulfilled` },
  ];

  // Get existing webhooks
  const existing = await apiCall(shop, 'webhooks.json');
  const existingTopics = (existing.webhooks || []).map(w => w.topic);

  for (const wh of requiredWebhooks) {
    if (!existingTopics.includes(wh.topic)) {
      try {
        await apiCall(shop, 'webhooks.json', 'POST', {
          webhook: { topic: wh.topic, address: wh.address, format: 'json' }
        });
        console.log(`[SHOPIFY] Webhook registered: ${wh.topic} for ${shop}`);
      } catch (err) {
        console.error(`[SHOPIFY] Webhook registration failed for ${wh.topic}:`, err.message);
      }
    }
  }
}

// Get all customers with their last order date
async function getAllCustomers(shop, sinceId = null) {
  let endpoint = 'customers.json?limit=250';
  if (sinceId) endpoint += `&since_id=${sinceId}`;
  const data = await apiCall(shop, endpoint);
  return data.customers || [];
}

// Get abandoned checkouts (last N minutes, sorted by most recent)
async function getAbandonedCheckouts(shop, sinceMinutes = 60) {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  const data = await apiCall(shop, `checkouts.json?status=open&updated_at_min=${since}&limit=50`);
  return data.checkouts || [];
}

function getServerUrl() {
  return process.env.SERVER_URL || 'https://whatsapp-shopify-automation-production.up.railway.app';
}

module.exports = { apiCall, getCustomerOrders, getProductRecommendations, createDiscountCode, ensureWebhooks, getAllCustomers, getAbandonedCheckouts };
