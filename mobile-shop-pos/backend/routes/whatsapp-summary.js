const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const { sendWhatsApp } = require('../utils/whatsapp')
const prisma = new PrismaClient()

router.post('/send', auth, async (req, res) => {
  try {
    const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER
    if (!ownerPhone) {
      return res.status(400).json({ error: 'OWNER_WHATSAPP_NUMBER not set in .env' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      include: {
        items: {
          include: {
            product: { select: { name: true, costPrice: true } }
          }
        }
      }
    })

    const revenue = sales.reduce((s, x) => s + Number(x.totalAmount), 0)
    const cog = sales.reduce((s, sale) =>
      s + sale.items.reduce((is, item) =>
        is + Number(item.quantity || 0) * Number(item.product?.costPrice || 0)
      , 0)
    , 0)
    const profit = revenue - cog
    const orders = sales.length

    const pendingRepairs = await prisma.repair.count({
      where: { status: { notIn: ['DELIVERED'] } }
    })

    const pMap = {}
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const n = item.product?.name || 'Unknown'
        pMap[n] = (pMap[n] || 0) + Number(item.quantity || 0)
      })
    })
    const topProduct = Object.entries(pMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    const msgId = await sendWhatsApp(ownerPhone, 'daily_summary', [
      orders.toString(),
      `LKR ${Math.round(revenue).toLocaleString()}`,
      `LKR ${Math.round(profit).toLocaleString()}`,
      topProduct,
      pendingRepairs.toString()
    ])

    res.json({
      sent: !!msgId,
      summary: { orders, revenue, profit, topProduct, pendingRepairs }
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/preview', auth, async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      include: {
        items: {
          include: {
            product: { select: { name: true, costPrice: true } }
          }
        }
      }
    })

    const revenue = sales.reduce((s, x) => s + Number(x.totalAmount), 0)
    const cog = sales.reduce((s, sale) =>
      s + sale.items.reduce((is, item) =>
        is + Number(item.quantity || 0) * Number(item.product?.costPrice || 0)
      , 0)
    , 0)

    const pendingRepairs = await prisma.repair.count({
      where: { status: { notIn: ['DELIVERED'] } }
    })

    const pMap = {}
    sales.forEach(s => s.items.forEach(item => {
      const n = item.product?.name || 'Unknown'
      pMap[n] = (pMap[n] || 0) + Number(item.quantity || 0)
    }))
    const topProduct = Object.entries(pMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    res.json({
      orders: sales.length,
      revenue: Math.round(revenue),
      profit: Math.round(revenue - cog),
      topProduct,
      pendingRepairs,
      message:
        `S R Mobile Daily Report\n` +
        `Orders: ${sales.length}\n` +
        `Revenue: LKR ${Math.round(revenue).toLocaleString()}\n` +
        `Profit: LKR ${Math.round(revenue - cog).toLocaleString()}\n` +
        `Top Product: ${topProduct}\n` +
        `Pending Repairs: ${pendingRepairs}`
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
