const fetch = require('node-fetch');

async function sendWhatsApp(to, templateName, params = []) {
  try {
    const phone = to.replace(/\D/g, '');
    const formatted = phone.startsWith('0') ? '94' + phone.slice(1) : phone;

    const body = {
      messaging_product: 'whatsapp',
      to: formatted,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: params.length > 0 ? [{
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: String(p) }))
        }] : []
      }
    };

    const res = await fetch(`https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.messages?.[0]?.id) return data.messages[0].id;
    console.error('WhatsApp send failed:', JSON.stringify(data));
    return null;
  } catch (err) {
    console.error('WhatsApp error:', err.message);
    return null;
  }
}

module.exports = { sendWhatsApp };
