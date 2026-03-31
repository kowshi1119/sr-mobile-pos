const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;
    const where = search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } }
    ]} : {};
    const customers = await prisma.customer.findMany({
      where,
      include: { _count: { select: { sales: true, repairs: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        sales: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
        repairs: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, phone, whatsappNumber, whatsappOptIn } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(phone && { phone }), ...(whatsappNumber !== undefined && { whatsappNumber }), ...(whatsappOptIn !== undefined && { whatsappOptIn }) }
    });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
