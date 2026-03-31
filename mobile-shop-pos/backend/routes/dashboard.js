const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/dashboard/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const [sales, newCustomers, newRepairs] = await Promise.all([
      prisma.sale.findMany({ where: { createdAt: { gte: today, lt: tomorrow } }, select: { totalAmount: true } }),
      prisma.customer.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.repair.count({ where: { createdAt: { gte: today, lt: tomorrow } } })
    ]);
    res.json({
      todaySales: sales.reduce((s, x) => s + parseFloat(x.totalAmount), 0),
      todaySalesCount: sales.length,
      newCustomers,
      newRepairs
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/low-stock
router.get('/low-stock', auth, async (req, res) => {
  try {
    const products = await prisma.$queryRaw`
      SELECT id, name, sku, "stockQuantity", "lowStockThreshold"
      FROM "Product"
      WHERE "isActive" = true AND "stockQuantity" <= "lowStockThreshold"
      ORDER BY "stockQuantity" ASC
    `;
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/pending-repairs
router.get('/pending-repairs', auth, async (req, res) => {
  try {
    const repairs = await prisma.repair.findMany({
      where: { status: { notIn: ['DELIVERED'] } },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { promisedAt: 'asc' }
    });
    res.json(repairs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/recent-sales
router.get('/recent-sales', auth, async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      take: 10,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sales);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/top-products
router.get('/top-products', auth, async (req, res) => {
  try {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const top = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { createdAt: { gte: monthStart } } },
      _sum: { quantity: true, unitPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });
    const products = await prisma.product.findMany({ where: { id: { in: top.map(t => t.productId) } }, select: { id: true, name: true, sku: true } });
    const result = top.map(t => {
      const p = products.find(x => x.id === t.productId);
      return { ...p, unitsSold: t._sum.quantity, totalRevenue: parseFloat(t._sum.unitPrice) * t._sum.quantity };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
