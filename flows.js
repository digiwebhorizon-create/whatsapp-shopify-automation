const db = require('./db');
const whatsapp = require('./whatsapp');
const shopify = require('./shopify');

// TEST MODE: set to true for quick testing (1min, 2min, 3min instead of 1h, 24h, 48h)
const TEST_MODE = process.env.TEST_MODE === 'true';
const DELAYS = TEST_MODE
  ? { cart1: 1 * 60 * 1000, cart2: 2 * 60 * 1000, cart3: 3 * 60 * 1000, upsell: 5 * 60 * 1000 }  // 1, 2, 3, 5 minutes
  : { cart1: 30 * 60 * 1000, cart2: 24 * 60 * 60 * 1000, cart3: 48 * 60 * 60 * 1000, upsell: 10 * 24 * 60 * 60 * 1000 }; // 30min, 24h, 48h, 10j

// ═══════════════════════════════════════════════════
// FLOW 1: ABANDONED CART
// Checkout created → wait → check if converted → send messages
// 3 messages: 1h, 24h, 48h (or 1min, 2min, 3min in TEST_MODE)
// ═══════════════════════════════════════════════════
const abandonedCart = {
  async onCheckoutCreated(shop, checkout) {
    if (!db.isFlowEnabled('abandoned_cart')) return;

    // Dedup: skip if this checkout was already processed
    if (db.getCheckoutById(String(checkout.id))) {
      console.log(`[CART] Checkout ${checkout.id} already processed - skipping`);
      return;
    }

    const phone = checkout.phone || checkout.billing_address?.phone || checkout.shipping_address?.phone;
    if (!phone) {
      console.log(`[CART] No phone for checkout ${checkout.id} - skipping`);
      return;
    }

    if (!db.isOptedIn(phone, shop)) {
      console.log(`[CART] Phone ${phone} not opted in - skipping`);
      return;
    }

    // Dedup: skip if this phone already has an active abandoned_cart flow
    if (db.hasActiveFlow(phone, 'abandoned_cart')) {
      console.log(`[CART] Phone ${phone} already in abandoned_cart flow - skipping`);
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
      variant_id: li.variant_id || null,
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

    // Schedule 3 messages (using Meta templates with button)
    // Message 1
    const msg1Time = new Date(now.getTime() + DELAYS.cart1);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 1,
      template: 'panier_rappel_1',
      scheduled_at: msg1Time.toISOString(),
      metadata: sharedMeta
    });

    // Message 2
    const msg2Time = new Date(now.getTime() + DELAYS.cart2);
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 2,
      template: 'panier_rappel_2',
      scheduled_at: msg2Time.toISOString(),
      metadata: sharedMeta
    });

    // Message 3 (with dynamic promo code)
    const msg3Time = new Date(now.getTime() + DELAYS.cart3);
    const promoCode = 'LB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    // Create discount code on Shopify (async, non-blocking for queue)
    try {
      await shopify.createDiscountCode(shop, promoCode, 10, 1);
      console.log(`[CART] Created discount code ${promoCode} for ${phone}`);
    } catch (err) {
      console.error(`[CART] Failed to create discount code ${promoCode}: ${err.message}`);
    }
    db.queueMessage({
      shop, phone, flow: 'abandoned_cart', step: 3,
      template: 'panier_rappel_promo',
      scheduled_at: msg3Time.toISOString(),
      metadata: { ...sharedMeta, promo_code: promoCode }
    });

    console.log(`[CART] 3 messages queued for ${phone} (checkout ${checkout.id})`);
  },

  async onOrderCreated(shop, order) {
    // Customer converted! Cancel ALL pending abandoned cart messages
    const email = order.email;
    const phone = order.phone || order.billing_address?.phone || order.shipping_address?.phone;
    const altPhones = [order.phone, order.billing_address?.phone, order.shipping_address?.phone].filter(Boolean);

    // Mark checkout as converted (by email)
    if (email) db.markCheckoutConverted(shop, email);

    // Cancel pending messages for ALL phone numbers associated with this order
    const cancelledPhones = new Set();
    for (const p of altPhones) {
      if (p && !cancelledPhones.has(p)) {
        db.cancelMessages(shop, p, 'abandoned_cart');
        cancelledPhones.add(p);
      }
    }

    // Also cancel by matching checkout email → phone (safety net)
    if (email) {
      const matchingCheckouts = db.getCheckoutsByEmail(shop, email);
      for (const ck of matchingCheckouts) {
        if (ck.phone && !cancelledPhones.has(ck.phone)) {
          db.cancelMessages(shop, ck.phone, 'abandoned_cart');
          cancelledPhones.add(ck.phone);
        }
      }
    }

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

    console.log(`[CART] Order created — cancelled messages for ${[...cancelledPhones].join(', ')} (email: ${email || 'none'})`);
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

        const wb15Code = 'LB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        try {
          await shopify.createDiscountCode(shop.domain, wb15Code, 15, 1);
          console.log(`[WINBACK] Created discount code ${wb15Code} for ${customer.phone}`);
        } catch (err) {
          console.error(`[WINBACK] Failed to create discount code ${wb15Code}: ${err.message}`);
        }

        db.queueMessage({
          shop: shop.domain, phone: customer.phone, flow: 'winback', step: 2,
          template: 'winback_offer_15',
          scheduled_at: new Date().toISOString(),
          metadata: { customer_name: customer.name, customer_id: customer.id, promo_code: wb15Code }
        });
        db.updateWinbackStage(customer.id, 2);
        console.log(`[WINBACK] Stage 2 queued for ${customer.phone}`);
      }

      // Stage 3: 90 days inactive → -20% (last chance)
      const inactive90 = db.getInactiveCustomers(shop.domain, 90);
      for (const customer of inactive90) {
        if (customer.winback_stage >= 3) continue;
        if (!db.isOptedIn(customer.phone, shop.domain)) continue;

        const wb20Code = 'LB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        try {
          await shopify.createDiscountCode(shop.domain, wb20Code, 20, 1);
          console.log(`[WINBACK] Created discount code ${wb20Code} for ${customer.phone}`);
        } catch (err) {
          console.error(`[WINBACK] Failed to create discount code ${wb20Code}: ${err.message}`);
        }

        db.queueMessage({
          shop: shop.domain, phone: customer.phone, flow: 'winback', step: 3,
          template: 'winback_offer_20',
          scheduled_at: new Date().toISOString(),
          metadata: { customer_name: customer.name, customer_id: customer.id, promo_code: wb20Code }
        });
        db.updateWinbackStage(customer.id, 3);
        console.log(`[WINBACK] Stage 3 queued for ${customer.phone}`);
      }
    }
  }
};

// ═══════════════════════════════════════════════════
// FLOW 4: REVIEW (J+15 after delivery)
// Order fulfilled → wait 15 days → send review request
// ═══════════════════════════════════════════════════
const REVIEW_DELAY = TEST_MODE
  ? 4 * 60 * 1000  // 4 minutes in test mode
  : 15 * 24 * 60 * 60 * 1000; // 15 days

const review = {
  async onOrderFulfilled(shop, order) {
    if (!db.isFlowEnabled('review')) return;

    const phone = order.phone || order.billing_address?.phone || order.shipping_address?.phone;
    if (!phone) {
      console.log(`[REVIEW] No phone for order ${order.id} - skipping`);
      return;
    }
    if (!db.isOptedIn(phone, shop)) {
      console.log(`[REVIEW] Phone ${phone} not opted in - skipping`);
      return;
    }

    // Don't send if already in an active review flow
    if (db.hasActiveFlow(phone, 'review')) {
      console.log(`[REVIEW] ${phone} already in review flow - skipping`);
      return;
    }

    const customerName = order.customer?.first_name || order.billing_address?.first_name || '';
    const sendTime = new Date(Date.now() + REVIEW_DELAY);

    db.queueMessage({
      shop, phone, flow: 'review', step: 1,
      template: 'demande_avis',
      scheduled_at: sendTime.toISOString(),
      metadata: {
        order_id: String(order.id),
        customer_name: customerName
      }
    });

    console.log(`[REVIEW] Review request queued for ${phone} (order ${order.id}, send in 15 days)`);
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
      const checkouts = await shopify.getAbandonedCheckouts(shop.domain, 60); // last 60 min
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
  let processedCount = 0;
  let failedCount = 0;

  for (const msg of pending) {
    try {
      const metadata = JSON.parse(msg.metadata || '{}');

      // Safety check: skip if checkout was converted since queueing
      if (msg.flow === 'abandoned_cart' && metadata.checkout_id) {
        const checkout = db.getCheckoutById(metadata.checkout_id);
        if (checkout && checkout.converted) {
          db.updateMessageStatus(msg.id, 'cancelled', null, 'Checkout already converted');
          console.log(`[QUEUE] Skipped ${msg.template} for ${msg.phone} — checkout ${metadata.checkout_id} already converted`);
          continue;
        }
      }

      let result;

      // Abandoned cart templates → use Meta templates with button
      const cartTemplates = ['panier_rappel_1', 'panier_rappel_2', 'panier_rappel_promo'];
      if (cartTemplates.includes(msg.template)) {
        // A/B test: 50% with product images, 50% without
        // Variant is determined per phone+checkout (consistent across all 3 messages)
        const abSeed = (metadata.checkout_id || '') + msg.phone;
        const abHash = abSeed.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
        const variant = (Math.abs(abHash) % 2 === 0) ? 'with_images' : 'no_images';

        if (variant === 'with_images') {
          // Send product images before the template
          const images = (metadata.items || []).filter(i => i.image_url);
          for (const item of images) {
            try {
              await whatsapp.sendImage(msg.phone, item.image_url);
              await sleep(300);
            } catch (imgErr) {
              console.log(`[QUEUE] Image send failed for ${item.title}: ${imgErr.message}`);
            }
          }
        }

        // Save A/B variant to message metadata
        db.setMessageVariant(msg.id, variant);
        console.log(`[A/B] ${msg.phone} → variant ${variant} (step ${msg.step})`);

        // Generate short URL for checkout
        let shortId = 'shop';
        if (metadata.cart_url) {
          shortId = Math.random().toString(36).slice(2, 8);
          db.saveRedirect(shortId, metadata.cart_url);
        }

        // Send Meta template with button
        const name = metadata.customer_name || 'cher client';
        result = await whatsapp.sendTemplate(msg.phone, msg.template, 'fr', [
          {
            type: 'body',
            parameters: [{ type: 'text', text: name }]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: shortId }]
          }
        ]);
      }
      // Other templates → use Meta templates (text only, no button)
      else {
        const name = metadata.customer_name || 'cher client';
        result = await whatsapp.sendTemplate(msg.phone, msg.template, 'fr', [
          {
            type: 'body',
            parameters: [{ type: 'text', text: name }]
          }
        ]);
      }

      if (result.success) {
        db.updateMessageStatus(msg.id, 'sent', result.messageId, null);
        console.log(`[QUEUE] Sent: ${msg.flow} step ${msg.step} → ${msg.phone}`);
        processedCount++;
      } else {
        db.updateMessageStatus(msg.id, 'failed', null, result.error);
        console.error(`[QUEUE] Failed: ${msg.flow} step ${msg.step} → ${msg.phone}: ${result.error}`);
        failedCount++;
      }

      // Small delay between messages to avoid rate limiting
      await sleep(1000);
    } catch (err) {
      db.updateMessageStatus(msg.id, 'failed', null, err.message);
      console.error(`[QUEUE] Error processing message ${msg.id}:`, err.message);
      failedCount++;
    }
  }

  // Alert if failure rate exceeds 10%
  const totalProcessed = processedCount + failedCount;
  if (totalProcessed > 0 && failedCount / totalProcessed > 0.10) {
    const alertMsg = `High failure rate: ${failedCount}/${totalProcessed} messages failed (${Math.round(failedCount / totalProcessed * 100)}%)`;
    console.warn(`[ALERT] ${alertMsg}`);
    db.saveAlert('high_failure_rate', alertMsg);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { abandonedCart, upsell, winback, review, processQueue, pollAbandonedCheckouts };
