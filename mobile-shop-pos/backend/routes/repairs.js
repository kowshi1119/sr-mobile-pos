const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/whatsapp');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) where.OR = [
      { deviceName: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search } } }
    ];
    const repairs = await prisma.repair.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(repairs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { customerId, customerData, deviceName, issueDescription, estimatedCost, promisedAt, notes } = req.body;
    let customer;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: customerId } });
    } else if (customerData) {
      customer = await prisma.customer.upsert({
        where: { phone: customerData.phone },
        update: { name: customerData.name },
        create: { name: customerData.name, phone: customerData.phone, whatsappNumber: customerData.whatsappNumber || customerData.phone, whatsappOptIn: customerData.whatsappOptIn || false }
      });
    }
    if (!customer) return res.status(400).json({ error: 'Customer required' });
    const repair = await prisma.repair.create({
      data: {
        customerId: customer.id,
        deviceName, issueDescription,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        promisedAt: promisedAt ? new Date(promisedAt) : null,
        notes: notes || null,
        status: 'RECEIVED'
      },
      include: { customer: true }
    });
    res.status(201).json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const repair = await prisma.repair.findUnique({
      where: { id: req.params.id },
      include: { customer: { include: { sales: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 5 } } } }
    });
    if (!repair) return res.status(404).json({ error: 'Repair not found' });
    res.json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { deviceName, issueDescription, estimatedCost, actualCost, promisedAt, notes } = req.body;
    const repair = await prisma.repair.update({
      where: { id: req.params.id },
      data: {
        ...(deviceName && { deviceName }),
        ...(issueDescription && { issueDescription }),
        ...(estimatedCost !== undefined && { estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null }),
        ...(actualCost !== undefined && { actualCost: actualCost ? parseFloat(actualCost) : null }),
        ...(promisedAt !== undefined && { promisedAt: promisedAt ? new Date(promisedAt) : null }),
        ...(notes !== undefined && { notes })
      },
      include: { customer: true }
    });
    res.json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/repairs/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, actualCost } = req.body;
    const updateData = { status };
    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (actualCost) updateData.actualCost = parseFloat(actualCost);
    }
    const repair = await prisma.repair.update({
      where: { id: req.params.id },
      data: updateData,
      include: { customer: true }
    });

    // Send WhatsApp if READY
    if (status === 'READY' && repair.customer.whatsappOptIn && repair.customer.whatsappNumber) {
      setImmediate(async () => {
        try {
          const msgId = await sendWhatsApp(
            repair.customer.whatsappNumber,
            'repair_ready',
            [repair.customer.name, repair.deviceName]
          );
          await prisma.notification.create({
            data: {
              customerId: repair.customerId,
              repairId: repair.id,
              messageType: 'repair_ready',
              templateName: 'repair_ready',
              status: msgId ? 'SENT' : 'FAILED',
              providerMessageId: msgId || null,
              sentAt: msgId ? new Date() : null
            }
          });
        } catch (e) { console.error('Repair WhatsApp failed:', e.message); }
      });
    }

    res.json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
