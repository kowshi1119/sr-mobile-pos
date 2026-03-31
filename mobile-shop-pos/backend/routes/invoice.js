const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/invoice/:invoice_number  (public - no auth)
router.get('/:invoiceNumber', async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { invoiceNumber: req.params.invoiceNumber },
      include: {
        customer: true,
        items: { include: { product: { include: { category: true } }, variant: true, imei: true } },
        warrantyRecords: { include: { product: true } }
      }
    });
    if (!sale) return res.status(404).json({ error: 'Invoice not found' });

    // Check active repair for this customer
    const repair = await prisma.repair.findFirst({
      where: { customerId: sale.customerId, status: { not: 'DELIVERED' } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ sale, repair });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
