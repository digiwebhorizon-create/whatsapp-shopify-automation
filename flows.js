const db = require('./db');
const whatsapp = require('./whatsapp');
const shopify = require('./shopify');

// TEST MODE: set to true for quick testing (1min, 2min, 3min instead of 1h, 24h, 48h)
const TEST_MODE = process.env.TEST_MODE === 'true';
const DELAYS = TEST_MODE
  ? { cart1: 1 * 60 * 1000, cart2: 2 * 60 * 1000, cart3: 3 * 60 * 1000, upsell: 5 * 60 * 1000 }  // 1, 2, 3, 5 minutes
  : { cart1: 60 * 60 * 1000, cart2: 24 * 60 * 60 * 1000, cart3: 48 * 60 * 60 * 1000, upsell: 5 * 24 * 60 * 60 * 1000 }; // 1h, 24h, 48h, 5j

// ═══════════════════════════════════════════════════
// FLOW 1: ABANDONED CART
// Checkout created → wait → check if converted → send messages
// 3 messages: 1h, 24h, 48h (or 1min, 2min, 3min in TEST_MODE)
// ═══════════════════════════════════════════════════
const abandonedCart = {
  async onCheckoutCreated(shop, checkout) {
    if (!db.isFlowEnabled('abandoned_cart')) return;

    const phone = checkout.phone || checkout.billing_address?.phone || checkout.shipping_address?.phone;
    if (!phone) {
      console.log(`[CART] No phone for checkout ${checkout.id} - skipping`);
      return;
    }

    if (!db.isOptedIn(phone, shop)) {
      console.log(`[CART] Phone ${phone} not opted in - skipping`);
      return;
    }

    const cartUrl = checkout.abandoned_checkout_url || `https://${shop}/checkouts/${checkout.token}`;
    const customerName = checkout.billing_address?.first_name || checkout.customer?.first_name || '';

    // Extract cart items for message display
    const items = (checkout.line_items || []).slice(0, 5).map(li => ({
      title: li.title || li.name || 'Article',
      quantity: li.quantity || 1,
      price: li.price || '0.00',
      product_id: li.product_id || null,
      image_url: li.image_url || li.variant?.image?.src || ''
    }));

    // Fetch product images from Shopify API if missing
    for (const item of items) {
      if (!item.image_url && item.product_id) {
        try {
          const product = await shopify.apiCall(shop, `products/${item.product_id}.json?fields=image`);
          if (product?.product?.image?.src) {
            item.image_url = product.product.image.src;
          }
        } catch (err) {
          console.log(`[CART] Could not fetch image for product ${item.product_id}: ${err.message}`);
        }
      }
    }

    // Save checkout
    db.saveCheckout({
      id: String(checkout.id),
      shop,
      email: checkout.email,
      phone,
      cart_url: cartUrl,
      total_price: checkout.total_price,
      line_items: items,
      customer_name: customerName
    });

    const now = new Date();

    // Shared metadata for all 3 messages
    const sharedMeta = {
      checkout_id: String(checkout.id),
      customer_name: customerName,
      cart_url: cartUrl,
      items
    };

    // Schedule 3 messages
    // Message 1
    const msg1Time = new Date(now.getTime() + DELAYS.cart1);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 1,
      template: 'cart_reminder_1',
      scheduled_at: msg1Time.toISOString(),
      metadata: sharedMeta
    });

    // Message 2
    const msg2Time = new Date(now.getTime() + DELAYS.cart2);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 2,
      template: 'cart_reminder_2',
      scheduled_at: msg2Time.toISOString(),
      metadata: sharedMeta
    });

    // Message 3 (with promo code)
    const msg3Time = new Date(now.getTime() + DELAYS.cart3);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 3,
      template: 'cart_reminder_promo',
      scheduled_at: msg3Time.toISOString(),
      metadata: { ...sharedMeta, promo_code: 'PANIER10' }
    });

    console.log(`[CART] 3 messages queued for ${phone} (checkout ${checkout.id})`);
  },

  async onOrderCreated(shop, order) {
    // Customer converted! Cancel pending abandoned cart messages
    const email = order.email;
    const phone = order.phone || order.billing_address?.phone || order.shipping_address?.phone;

    if (email) db.markCheckoutConverted(shop, email);
    if (phone) db.cancelMessages(shop, phone, 'abandoned_cart');

    // Save/update customer for winback tracking
    if (order.customer) {
      db.saveCustomer({
        id: String(order.customer.id),
        shop,
        email: order.email,
        phone,
        name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
        last_order_at: order.created_at,
        total_orders: order.customer.orders_count || 1
      });
    }

    console.log(`[CART] Order created - cancelled pending messages for ${phone || email}`);
  }
};

// ═══════════════════════════════════════════════════
// FLOW 2: UPSELL POST-PURCHASE
// Order fulfilled → wait 5 days → send product recommendations
// ═══════════════════════════════════════════════════
const upsell = {
  async onOrderFulfilled(shop, order) {
    if (!db.isFlowEnabled('upsell')) return;

    const phone = order.phone || order.billing_address?.phone || order.shipping_address?.phone;
    if (!phone) return;
    if (!db.isOptedIn(phone, shop)) return;

    // Don't send if already in an active upsell flow
    if (db.hasActiveFlow(phone, 'upsell')) {
      console.log(`[UPSELL] ${phone} already in upsell flow - skipping`);
      return;
    }

    // Schedule upsell message
    const sendTime = new Date(Date.now() + DELAYS.upsell);

    // Get product info for recommendations
    const productIds = (order.line_items || []).map(li => li.product_id).filter(Boolean);

    db.queueMessage({
      shop, phone, flow: 'upsell', step: 1,
      template: 'post_purchase_upsell',
      scheduled_at: sendTime.toISOString(),
      metadata: {
        order_id: String(order.id),
        customer_name: order.customer?.first_name || '',
        product_ids: productIds
      }
    });

    console.log(`[UPSELL] Message queued for ${phone} (order ${order.id}, send in 5 days)`);
  }
};

// ═══════════════════════════════════════════════════
// FLOW 3: WINBACK
// Daily scan for inactive customers
// 3 stages: J+30 (news), J+60 (-15%), J+90 (-20%)
// ═══════════════════════════════════════════════════
const winback = {
  async scan() {
    if (!db.isFlowEnabled('winback')) return;

    const shops = db.getShops();

    for (const shop of shops) {
      // Stage 1: 30 days inactive → news
      const inactive30 = db.getInactiveCustomers(shop.domain, 30);
      for (const customer of inactive30) {
        if (customer.winback_stage >= 1) continue;
        if (!db.isOptedIn(customer.phone, shop.domain)) continue;
        if (db.hasActiveFlow(customer.phone, 'winback')) continue;

        db.queueMessage({
          shop: shop.domain, phone: customer.phone, flow: 'winback', step: 1,
          template: 'winback_news',
          scheduled_at: new Date().toISOString(),
          metadata: { customer_name: customer.name, customer_id: customer.id }
        });
        db.updateWinbackStage(customer.id, 1);
        console.log(`[WINBACK] Stage 1 queued for ${customer.phone}`);
      }

      // Stage 2: 60 days inactive → -15%
      const inactive60 = db.getInactiveCustomers(shop.domain, 60);
      for (const customer of inactive60) {
        if (customer.winback_stage >= 2) continue;
        if (!db.isOptedIn(customer.phone, shop.domain)) continue;

        db.queueMessage({
          shop: shop.domain, phone: customer.phone, flow: 'winback', step: 2,
          template: 'winback_offer_15',
          scheduled_at: new Date().toISOString(),
          metadata: { customer_name: customer.name, customer_id: customer.id, promo_code: 'RETOUR15' }
        });
        db.updateWinbackStage(customer.id, 2);
        console.log(`[WINBACK] Stage 2 queued for ${customer.phone}`);
      }

      // Stage 3: 90 days inactive → -20% (last chance)
      const inactive90 = db.getInactiveCustomers(shop.domain, 90);
      for (const customer of inactive90) {
        if (customer.winback_stage >= 3) continue;
        if (!db.isOptedIn(customer.phone, shop.domain)) continue;

        db.queueMessage({
          shop: shop.domain, phone: customer.phone, flow: 'winback', step: 3,
          template: 'winback_offer_20',
          scheduled_at: new Date().toISOString(),
          metadata: { customer_name: customer.name, customer_id: customer.id, promo_code: 'RETOUR20' }
        });
        db.updateWinbackStage(customer.id, 3);
        console.log(`[WINBACK] Stage 3 queued for ${customer.phone}`);
      }
    }
  }
};

// ═══════════════════════════════════════════════════
// ABANDONED CHECKOUT POLLING
// Polls Shopify API every 5 min for abandoned checkouts (more reliable than webhook)
// ═══════════════════════════════════════════════════
async function pollAbandonedCheckouts() {
  if (!db.isFlowEnabled('abandoned_cart')) return;

  const shops = db.getShops();
  for (const shop of shops) {
    try {
      const checkouts = await shopify.getAbandonedCheckouts(shop.domain, 15); // last 15 min
      for (const checkout of checkouts) {
        // Skip if already processed
        if (db.getCheckoutById(checkout.id)) continue;

        console.log(`[POLL] Found abandoned checkout ${checkout.id} for ${shop.domain}`);
        await abandonedCart.onCheckoutCreated(shop.domain, checkout);
      }
    } catch (err) {
      console.error(`[POLL] Error polling ${shop.domain}:`, err.message);
    }
  }
}

// ═══════════════════════════════════════════════════
// QUEUE PROCESSOR
// Runs every minute, sends pending messages within hours 9h-21h
// ═══════════════════════════════════════════════════
async function processQueue() {
  if (!whatsapp.isWithinSendingHours()) return;

  const pending = db.getPendingMessages();
  if (pending.length === 0) return;

  console.log(`[QUEUE] Processing ${pending.length} pending messages...`);

  for (const msg of pending) {
    try {
      const metadata = JSON.parse(msg.metadata || '{}');

      // Check if checkout was converted (for abandoned cart)
      if (msg.flow === 'abandoned_cart' && metadata.checkout_id) {
        const checkout = db.getUnconvertedCheckout(msg.shop, null); // simplified
      }

      // Build message text
      const text = buildMessageText(msg, metadata);

      // Send images grouped then text message below
      const images = (msg.flow === 'abandoned_cart' && metadata.items)
        ? metadata.items.filter(i => i.image_url)
        : [];

      // Send all images rapidly (WhatsApp groups them visually)
      for (const item of images) {
        try {
          await whatsapp.sendImage(msg.phone, item.image_url);
          await sleep(300);
        } catch (imgErr) {
          console.log(`[QUEUE] Image send failed for ${item.title}: ${imgErr.message}`);
        }
      }

      // Then send text message below
      const result = await whatsapp.sendText(msg.phone, text);

      if (result.success) {
        db.updateMessageStatus(msg.id, 'sent', result.messageId, null);
        console.log(`[QUEUE] Sent: ${msg.flow} step ${msg.step} → ${msg.phone}`);
      } else {
        db.updateMessageStatus(msg.id, 'failed', null, result.error);
        console.error(`[QUEUE] Failed: ${msg.flow} step ${msg.step} → ${msg.phone}: ${result.error}`);
      }

      // Small delay between messages to avoid rate limiting
      await sleep(1000);
    } catch (err) {
      db.updateMessageStatus(msg.id, 'failed', null, err.message);
      console.error(`[QUEUE] Error processing message ${msg.id}:`, err.message);
    }
  }
}

// Site public (pas le .myshopify.com)
const SITE_URL = process.env.SITE_URL || 'https://le-bourlingueur.com';

// Build message text — personnalisé avec le prénom, vouvoiement pro
function buildMessageText(msg, metadata) {
  const name = metadata.customer_name || '';

  // Résumé commande (liste articles)
  let recap = '';
  if (metadata.items && metadata.items.length > 0) {
    recap = '\n\n🛍 Votre panier :\n' + metadata.items.map(i => `• ${i.title}${i.quantity > 1 ? ` (x${i.quantity})` : ''} — ${i.price}€`).join('\n');
  }

  switch (msg.template) {
    case 'cart_reminder_1':
      return name
        ? `Bonjour ${name} 👋\n\nVous n'avez pas finalisé votre commande !${recap}\n\nVos articles sont encore disponibles.\n\n👉 le-bourlingueur.com\n\nÀ très bientôt,\nLucie - Le Bourlingueur`
        : `Bonjour 👋\n\nVous avez laissé des articles dans votre panier !${recap}\n\nIls sont encore disponibles.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`;

    case 'cart_reminder_2':
      return name
        ? `Bonjour ${name},\n\nVotre panier vous attend toujours 🛒${recap}\n\nNous vous l'avons réservé, mais pour une durée limitée.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`
        : `Bonjour,\n\nVotre panier vous attend toujours 🛒${recap}\n\nIl est réservé pour une durée limitée.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`;

    case 'cart_reminder_promo':
      return name
        ? `Bonjour ${name},\n\n*-10%* avec le code *${metadata.promo_code || 'PANIER10'}* 🎁${recap}\n\nPour vous aider à finaliser votre commande. Code valable 48h.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`
        : `Bonjour,\n\n*-10%* avec le code *${metadata.promo_code || 'PANIER10'}* 🎁${recap}\n\nCode valable 48h.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`;

    case 'post_purchase_upsell':
      return name
        ? `Bonjour ${name} 😊\n\nMerci pour votre commande ! Découvrez nos dernières nouveautés.\n\n👉 le-bourlingueur.com\n\nÀ très bientôt,\nLucie - Le Bourlingueur`
        : `Bonjour 😊\n\nMerci pour votre commande ! Découvrez nos nouveautés.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`;

    case 'winback_news':
      return name
        ? `Bonjour ${name} 👋\n\nCela fait un moment ! Découvrez nos dernières nouveautés.\n\n👉 le-bourlingueur.com\n\nAu plaisir de vous retrouver,\nLucie - Le Bourlingueur`
        : `Bonjour 👋\n\nDécouvrez nos dernières nouveautés.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`;

    case 'winback_offer_15':
      return name
        ? `Bonjour ${name},\n\nVous nous manquez ! *-15%* avec le code *${metadata.promo_code || 'RETOUR15'}*\n\n👉 le-bourlingueur.com\n\nCode valable 7 jours.\n\nLucie - Le Bourlingueur`
        : `Bonjour,\n\n*-15%* avec le code *${metadata.promo_code || 'RETOUR15'}*\n\n👉 le-bourlingueur.com\n\nCode valable 7 jours.\n\nLucie - Le Bourlingueur`;

    case 'winback_offer_20':
      return name
        ? `Bonjour ${name},\n\nOffre exclusive : *-20%* sur tout le site avec le code *${metadata.promo_code || 'RETOUR20'}* 🎁\n\nNotre meilleure offre, valable 7 jours.\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`
        : `Bonjour,\n\n*-20%* sur tout le site avec le code *${metadata.promo_code || 'RETOUR20'}* 🎁\n\n👉 le-bourlingueur.com\n\nCode valable 7 jours.\n\nLucie - Le Bourlingueur`;

    default:
      return `Bonjour,\n\n👉 le-bourlingueur.com\n\nLucie - Le Bourlingueur`;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { abandonedCart, upsell, winback, processQueue, pollAbandonedCheckouts };
