const { sendError, badRequest } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const router = require('express').Router()
const { prisma } = require('../db');
const auth = require('../middleware/auth')

router.get('/', auth, async (req, res) => {
  try {
    const bundles = await prisma.bundle.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellingPrice: true,
                imageUrl: true,
                hasImei: true,
                stockQuantity: true,
                sku: true,
                barcode: true
              }
            }
          }
        }
      }
    })
    res.json(bundles)
  } catch (e) {
    sendError(res, e)
  }
})

router.post('/', requirePermission('bundles.manage'), async (req, res) => {
  try {
    const { name, description, bundlePrice, items } = req.body
    if (!name || !bundlePrice || !items?.length) {
      return res.status(400).json({ error: 'Missing fields' })
    }
    const bundle = await prisma.bundle.create({
      data: {
        name,
        description,
        bundlePrice: Number(bundlePrice),
        items: {
          create: items.map(i => ({
            productId: i.productId,
            quantity: i.quantity || 1
          }))
        }
      },
      include: { items: { include: { product: true } } }
    })
    res.status(201).json(bundle)
  } catch (e) {
    sendError(res, e)
  }
})

router.patch('/:id', requirePermission('bundles.manage'), async (req, res) => {
  try {
    const { name, description, bundlePrice, isActive } = req.body
    const bundle = await prisma.bundle.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(bundlePrice !== undefined && { bundlePrice: Number(bundlePrice) }),
        ...(isActive !== undefined && { isActive })
      }
    })
    res.json(bundle)
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
