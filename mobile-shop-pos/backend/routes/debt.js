const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/debt — All customers with outstanding debt > 0 (sorted highest first)
router.get('/', auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { totalDebt: { gt: 0 } },
      orderBy: { totalDebt: 'desc' },
      select: { id: true, name: true, phone: true, whatsappNumber: true, totalDebt: true }
    });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/debt/:customerId — Debt records + balance for one customer
router.get('/:customerId', auth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      select: { id: true, name: true, phone: true, totalDebt: true }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const records = await prisma.debtRecord.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'desc' },
      include: { sale: { select: { invoiceNumber: true } } }
    });

    res.json({ customer, records, totalDebt: customer.totalDebt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/debt — Create a debt record
router.post('/', auth, async (req, res) => {
  const { customerId, saleId, type, amount, description } = req.body;
  if (!customerId || !type || !amount) {
    return res.status(400).json({ error: 'customerId, type and amount are required' });
  }
  if (!['CREDIT', 'PAYMENT'].includes(type)) {
    return res.status(400).json({ error: 'type must be CREDIT or PAYMENT' });
  }

  try {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const record = await prisma.debtRecord.create({
      data: {
        customerId,
        saleId: saleId || null,
        type,
        amount: parsedAmount,
        description: description || null
      }
    });

    // Update customer totalDebt
    if (type === 'CREDIT') {
      await prisma.customer.update({
        where: { id: customerId },
        data: { totalDebt: { increment: parsedAmount } }
      });
    } else {
      // PAYMENT — decrement but never below 0
      const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { totalDebt: true } });
      const newDebt = Math.max(0, Number(customer.totalDebt) - parsedAmount);
      await prisma.customer.update({
        where: { id: customerId },
        data: { totalDebt: newDebt }
      });
    }

    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/debt/:id/pay — Mark debt record as paid, decrement customer totalDebt
router.patch('/:id/pay', auth, async (req, res) => {
  try {
    const record = await prisma.debtRecord.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ error: 'Debt record not found' });
    if (record.isPaid) return res.status(400).json({ error: 'Debt record is already paid' });

    const updated = await prisma.debtRecord.update({
      where: { id: req.params.id },
      data: { isPaid: true, paidAt: new Date() }
    });

    // Only CREDIT records affect totalDebt; marking it paid reduces the balance
    if (record.type === 'CREDIT') {
      const customer = await prisma.customer.findUnique({ where: { id: record.customerId }, select: { totalDebt: true } });
      const newDebt = Math.max(0, Number(customer.totalDebt) - Number(record.amount));
      await prisma.customer.update({
        where: { id: record.customerId },
        data: { totalDebt: newDebt }
      });
    }

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
