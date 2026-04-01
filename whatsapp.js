// WhatsApp Cloud API client

const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '988054214398025';
const WA_TOKEN = process.env.WA_TOKEN;

const API_URL = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

async function sendTemplate(to, templateName, language, components) {
  const body = {
    messaging_product: 'whatsapp',
    to: cleanPhone(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: language || 'fr' },
    }
  };

  if (components) {
    body.template.components = components;
  }

  return await sendRequest(body);
}

async function sendImage(to, imageUrl, caption) {
  const body = {
    messaging_product: 'whatsapp',
    to: cleanPhone(to),
    type: 'image',
    image: { link: imageUrl }
  };
  if (caption) body.image.caption = caption;
  return await sendRequest(body);
}

async function sendText(to, text) {
  return await sendRequest({
    messaging_product: 'whatsapp',
    to: cleanPhone(to),
    type: 'text',
    text: { body: text }
  });
}

async function sendRequest(body) {
  const token = WA_TOKEN;
  if (!token) {
    console.error('[WA] No WA_TOKEN set!');
    return { error: 'No token' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok && data.messages?.[0]?.id) {
      console.log(`[WA] Message sent: ${data.messages[0].id} → ${body.to}`);
      return { success: true, messageId: data.messages[0].id };
    } else {
      console.error(`[WA] Send failed:`, JSON.stringify(data));
      return { success: false, error: data.error?.message || JSON.stringify(data) };
    }
  } catch (err) {
    console.error(`[WA] Request error:`, err.message);
    return { success: false, error: err.message };
  }
}

function cleanPhone(phone) {
  let cleaned = phone.replace(/[^0-9]/g, '');
  // Convert French local format (06...) to international (336...)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '33' + cleaned.substring(1);
  }
  return cleaned;
}

// Check if current time is within sending hours (8h-21h Europe/Paris)
// In TEST_MODE, always return true
function isWithinSendingHours() {
  if (process.env.TEST_MODE === 'true') return true;
  const now = new Date();
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const hour = parisTime.getHours();
  return hour >= 8 && hour < 21;
}

// ─── Meta Template Management ────────────────────
const WABA_ID = process.env.WA_BUSINESS_ACCOUNT_ID || '1461913525522653';

async function getTemplates() {
  const token = WA_TOKEN;
  if (!token) return { success: false, error: 'No token' };
  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates?fields=id,name,status,category,language,components&limit=50`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    if (data.data) return { success: true, templates: data.data };
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function updateTemplate(templateId, components) {
  const token = WA_TOKEN;
  if (!token) return { success: false, error: 'No token' };
  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${templateId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ components })
      }
    );
    const data = await response.json();
    if (data.success || response.ok) return { success: true, data };
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function createTemplate(name, category, language, components) {
  const token = WA_TOKEN;
  if (!token) return { success: false, error: 'No token' };
  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, language, components })
      }
    );
    const data = await response.json();
    if (data.id || response.ok) return { success: true, data };
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendTemplate, sendText, sendImage, isWithinSendingHours, getTemplates, updateTemplate, createTemplate };
