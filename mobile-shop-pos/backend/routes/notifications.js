const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(notifications);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notifications/webhook — Meta WhatsApp delivery status
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const statuses = change.value?.statuses || [];
          for (const status of statuses) {
            await prisma.notification.updateMany({
              where: { providerMessageId: status.id },
              data: { status: status.status === 'delivered' || status.status === 'read' ? 'SENT' : status.status === 'failed' ? 'FAILED' : undefined }
            }).catch(() => {});
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (err) { res.sendStatus(200); }
});

// GET webhook verification
router.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'sr_mobile_verify';
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

module.exports = router;
