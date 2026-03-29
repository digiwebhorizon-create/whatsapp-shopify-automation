const db = require('./db');
const whatsapp = require('./whatsapp');
const shopify = require('./shopify');

// ═══════════════════════════════════════════════════
// FLOW 1: ABANDONED CART
// Checkout created → wait → check if converted → send messages
// 3 messages: 1h, 24h, 48h
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

    // Save checkout
    db.saveCheckout({
      id: String(checkout.id),
      shop,
      email: checkout.email,
      phone,
      cart_url: checkout.abandoned_checkout_url || `https://${shop}/checkouts/${checkout.token}`,
      total_price: checkout.total_price,
      line_items: checkout.line_items?.slice(0, 3) || [],
      customer_name: checkout.billing_address?.first_name || checkout.customer?.first_name || ''
    });

    const now = new Date();

    // Schedule 3 messages
    // Message 1: 1 hour later
    const msg1Time = new Date(now.getTime() + 60 * 60 * 1000);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 1,
      template: 'cart_reminder_1',
      scheduled_at: msg1Time.toISOString(),
      metadata: { checkout_id: String(checkout.id), customer_name: checkout.billing_address?.first_name || '' }
    });

    // Message 2: 24 hours later
    const msg2Time = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 2,
      template: 'cart_reminder_2',
      scheduled_at: msg2Time.toISOString(),
      metadata: { checkout_id: String(checkout.id) }
    });

    // Message 3: 48 hours later (with promo code)
    const msg3Time = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 3,
      template: 'cart_reminder_promo',
      scheduled_at: msg3Time.toISOString(),
      metadata: { checkout_id: String(checkout.id), promo_code: 'RETOUR10' }
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

    // Schedule upsell message 5 days after fulfillment
    const sendTime = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

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

      // For now, send as text message (will switch to templates once Meta approves them)
      const text = buildMessageText(msg, metadata);
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

// Build message text (temporary - will use Meta templates in production)
function buildMessageText(msg, metadata) {
  const name = metadata.customer_name || 'cher client';
  const shop = msg.shop.replace('.myshopify.com', '');

  switch (msg.template) {
    case 'cart_reminder_1':
      return `Bonjour ${name} ! 👋\n\nVous avez laissé des articles dans votre panier sur ${shop}. Ils sont toujours disponibles !\n\nFinalisez votre commande ici : ${metadata.cart_url || `https://${msg.shop}`}\n\n— L'équipe Le Bourlingueur`;

    case 'cart_reminder_2':
      return `${name}, votre panier vous attend ! 🛒\n\nVos articles sont toujours réservés mais les stocks sont limités.\n\nRetrouvez votre panier : ${metadata.cart_url || `https://${msg.shop}`}\n\n— Le Bourlingueur`;

    case 'cart_reminder_promo':
      return `Dernière chance ${name} ! 🎁\n\nProfitez de -10% sur votre panier avec le code ${metadata.promo_code || 'RETOUR10'}\n\nFinalisez votre commande : ${metadata.cart_url || `https://${msg.shop}`}\n\nCode valable 48h.\n\n— Le Bourlingueur`;

    case 'post_purchase_upsell':
      return `Bonjour ${name} ! 😊\n\nMerci pour votre commande ! Nous espérons que vous êtes satisfait(e).\n\nDécouvrez nos nouveautés qui pourraient vous plaire :\n👉 https://${msg.shop}/collections/all\n\n— Le Bourlingueur`;

    case 'winback_news':
      return `${name}, ça fait longtemps ! 👋\n\nDécouvrez nos dernières nouveautés sur Le Bourlingueur.\n\n👉 https://${msg.shop}\n\nÀ bientôt !`;

    case 'winback_offer_15':
      return `${name}, vous nous manquez ! ❤️\n\nPour votre retour, profitez de -15% avec le code ${metadata.promo_code || 'RETOUR15'}\n\n👉 https://${msg.shop}\n\nCode valable 7 jours.\n\n— Le Bourlingueur`;

    case 'winback_offer_20':
      return `${name}, dernière offre exclusive ! 🎁\n\n-20% sur tout le site avec le code ${metadata.promo_code || 'RETOUR20'}\n\n👉 https://${msg.shop}\n\nCode valable 7 jours. Ne manquez pas cette occasion !\n\n— Le Bourlingueur`;

    default:
      return `Message de Le Bourlingueur - ${msg.template}`;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { abandonedCart, upsell, winback, processQueue };
