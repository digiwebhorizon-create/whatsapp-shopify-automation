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
  return phone.replace(/[^0-9]/g, '');
}

// Check if current time is within sending hours (9h-21h Europe/Paris)
// In TEST_MODE, always return true
function isWithinSendingHours() {
  if (process.env.TEST_MODE === 'true') return true;
  const now = new Date();
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const hour = parisTime.getHours();
  return hour >= 9 && hour < 21;
}

module.exports = { sendTemplate, sendText, isWithinSendingHours };
