const { sendError, badRequest } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const auth = require('../middleware/auth');

router.get('/', requirePermission('customers.view', 'sales.create', 'repairs.manage', 'debt.manage'), async (req, res) => {
  try {
    const { search, showAll, inactive } = req.query;
    const where = {};

    // isActive filter
    if (inactive === 'true') {
      where.isActive = false;
    } else if (showAll !== 'true') {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) } },
        { phone: { contains: search } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: { _count: { select: { sales: true, repairs: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(customers);
  } catch (err) { sendError(res, err); }
});

router.get('/:id', requirePermission('customers.view', 'debt.manage'), async (req, res) => {
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
  } catch (err) { sendError(res, err); }
});

router.patch('/:id', requirePermission('customers.manage'), async (req, res) => {
  try {
    const { name, phone, whatsappNumber, whatsappOptIn } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(phone && { phone }), ...(whatsappNumber !== undefined && { whatsappNumber }), ...(whatsappOptIn !== undefined && { whatsappOptIn }) }
    });
    res.json(customer);
  } catch (err) { sendError(res, err); }
});

// Soft delete (deactivate)
router.patch('/:id/deactivate', requirePermission('customers.manage'), async (req, res) => {
  try {
    const c = await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json(c);
  } catch (e) { sendError(res, e); }
});

// Reactivate
router.patch('/:id/activate', requirePermission('customers.manage'), async (req, res) => {
  try {
    const c = await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: true }
    });
    res.json(c);
  } catch (e) { sendError(res, e); }
});

// Hard delete (only if no sales/repairs)
router.delete('/:id', requirePermission('customers.manage'), async (req, res) => {
  try {
    const salesCount = await prisma.sale.count({ where: { customerId: req.params.id } });
    const repairsCount = await prisma.repair.count({ where: { customerId: req.params.id } });
    if (salesCount > 0 || repairsCount > 0) {
      return res.status(400).json({
        error: `Cannot delete — this customer has ${salesCount} sale(s) and ${repairsCount} repair(s). Deactivate instead.`,
        canDeactivate: true
      });
    }
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ message: 'Customer deleted permanently' });
  } catch (e) { sendError(res, e); }
});

module.exports = router;
