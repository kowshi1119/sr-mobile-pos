const { sendError, badRequest } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const router = require('express').Router()
const { prisma } = require('../db');
const auth = require('../middleware/auth')

router.get('/', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { search } = req.query
    const where = { isActive: true }
    if (search) {
      where.name = { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) }
    }
    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { purchases: true } }
      },
      orderBy: { name: 'asc' }
    })
    res.json(suppliers)
  } catch (e) {
    sendError(res, e)
  }
})

router.get('/purchases/all', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { from, to } = req.query
    const where = {}
    if (from || to) {
      where.purchasedAt = {}
      if (from) where.purchasedAt.gte = new Date(from)
      if (to) where.purchasedAt.lte = new Date(to)
    }
    const purchases = await prisma.supplierPurchase.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        items: true
      },
      orderBy: { purchasedAt: 'desc' }
    })
    res.json(purchases)
  } catch (e) {
    sendError(res, e)
  }
})

router.get('/:id', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        purchases: {
          include: { items: true },
          orderBy: { purchasedAt: 'desc' }
        }
      }
    })
    if (!supplier) return res.status(404).json({ error: 'Not found' })
    res.json(supplier)
  } catch (e) {
    sendError(res, e)
  }
})

router.post('/', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const supplier = await prisma.supplier.create({
      data: { name, phone, email, address, notes }
    })
    res.status(201).json(supplier)
  } catch (e) {
    sendError(res, e)
  }
})

router.patch('/:id', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { name, phone, email, address, notes, isActive } = req.body
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive })
      }
    })
    res.json(supplier)
  } catch (e) {
    sendError(res, e)
  }
})

router.post('/:id/purchases', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const { invoiceRef, items, notes, purchasedAt } = req.body
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items required' })
    }

    const totalAmount = items.reduce((s, i) => s + (Number(i.unitCost) * Number(i.quantity)), 0)

    const purchase = await prisma.supplierPurchase.create({
      data: {
        supplierId: req.params.id,
        invoiceRef: invoiceRef || null,
        totalAmount: Math.round(totalAmount * 100) / 100,
        notes: notes || null,
        purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
        items: {
          create: items.map(i => ({
            productId: i.productId || null,
            productName: i.productName,
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost),
            totalCost: Number(i.unitCost) * Number(i.quantity)
          }))
        }
      },
      include: { items: true }
    })

    for (const item of items) {
      if (item.productId && item.updateStock) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: Number(item.quantity) },
            costPrice: Number(item.unitCost)
          }
        }).catch(() => {})
      }
    }

    res.status(201).json(purchase)
  } catch (e) {
    sendError(res, e)
  }
})

router.get('/:id/purchases', requirePermission('suppliers.manage'), async (req, res) => {
  try {
    const purchases = await prisma.supplierPurchase.findMany({
      where: { supplierId: req.params.id },
      include: { items: true },
      orderBy: { purchasedAt: 'desc' }
    })
    res.json(purchases)
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
