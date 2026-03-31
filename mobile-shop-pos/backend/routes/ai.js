const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const fetch = require('node-fetch');
const prisma = new PrismaClient();

const SYSTEM_PROMPT = `You are an admin assistant for S R Mobile, a mobile phone shop POS system in Chunnakam.
Classify the admin message into one of these intents:
product_search, navigate, find_customer, get_sale, show_low_stock,
show_pending_repairs, send_whatsapp_invoice, draft_repair_reply.
Return ONLY a valid JSON object with fields: intent, action, parameters.
No explanation. No text outside the JSON.
Examples:
- "iphone 13" → {"intent":"product_search","action":"search_products","parameters":{"query":"iphone 13"}}
- "go to repairs" → {"intent":"navigate","action":"open_page","parameters":{"page":"repairs"}}
- "show pending repairs" → {"intent":"show_pending_repairs","action":"open_page","parameters":{"page":"repairs"}}
- "find customer 0771234567" → {"intent":"find_customer","action":"search_customer","parameters":{"phone":"0771234567"}}
- "today sales" → {"intent":"navigate","action":"open_page","parameters":{"page":"sales","filter":"today"}}
- "low stock" → {"intent":"show_low_stock","action":"open_page","parameters":{"page":"dashboard","section":"low-stock"}}
- "send invoice whatsapp" → {"intent":"send_whatsapp_invoice","action":"send_invoice","parameters":{}}
- "dashboard" → {"intent":"navigate","action":"open_page","parameters":{"page":"dashboard"}}`;

router.post('/chat', auth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: query }],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content || '{}';

    let parsed;
    try { parsed = JSON.parse(rawText); }
    catch { parsed = { intent: 'navigate', action: 'open_page', parameters: { page: 'dashboard' } }; }

    // Save session
    await prisma.aiChatSession.create({
      data: { query, detectedIntent: parsed.intent || 'unknown', actionTaken: JSON.stringify(parsed) }
    });

    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
