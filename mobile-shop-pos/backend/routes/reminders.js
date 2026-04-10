const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const prisma = new PrismaClient()

router.get('/upgrade-candidates', auth, async (req, res) => {
  try {
    const elevenMonthsAgo = new Date()
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: twelveMonthsAgo,
          lte: elevenMonthsAgo
        }
      },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    })

    const candidates = []
    sales.forEach(sale => {
      const hasPhone = sale.items.some(item =>
        item.product?.hasImei === true ||
        (item.product?.category?.name || '').toLowerCase().includes('phone')
      )
      if (hasPhone && sale.customer) {
        candidates.push({
          customerId: sale.customer.id,
          customerName: sale.customer.name,
          phone: sale.customer.phone,
          whatsapp: sale.customer.whatsappNumber,
          optIn: sale.customer.whatsappOptIn,
          invoiceNumber: sale.invoiceNumber,
          purchaseDate: sale.createdAt,
          products: sale.items.map(i => i.product?.name).filter(Boolean)
        })
      }
    })

    res.json(candidates)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/warranty-expiring', auth, async (req, res) => {
  try {
    const now = new Date()
    const in30d = new Date()
    in30d.setDate(in30d.getDate() + 30)

    const warranties = await prisma.warrantyRecord.findMany({
      where: {
        expiresAt: { gte: now, lte: in30d }
      },
      include: {
        product: { select: { name: true } },
        sale: {
          include: { customer: true }
        }
      },
      orderBy: { expiresAt: 'asc' }
    })

    res.json(warranties.map(w => ({
      warrantyId: w.id,
      productName: w.product?.name,
      expiresAt: w.expiresAt,
      daysLeft: Math.ceil((new Date(w.expiresAt) - now) / (1000 * 60 * 60 * 24)),
      customerName: w.sale?.customer?.name,
      customerPhone: w.sale?.customer?.phone,
      whatsapp: w.sale?.customer?.whatsappNumber,
      optIn: w.sale?.customer?.whatsappOptIn,
      invoiceNumber: w.sale?.invoiceNumber
    })))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
