const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const prisma = new PrismaClient()

router.get('/', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1)
    const target = await prisma.salesTarget.findUnique({
      where: { year_month: { year, month } }
    })

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { totalAmount: true }
    })
    const actual = sales.reduce((s, x) => s + Number(x.totalAmount), 0)

    res.json({
      year,
      month,
      targetAmount: target?.targetAmount || 0,
      actualAmount: Math.round(actual),
      progress: target?.targetAmount > 0 ? Math.round((actual / target.targetAmount) * 100) : 0,
      hasTarget: !!target
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', auth, async (req, res) => {
  try {
    const { year, month, targetAmount, notes } = req.body
    if (!year || !month || !targetAmount) {
      return res.status(400).json({ error: 'Missing fields' })
    }
    const target = await prisma.salesTarget.upsert({
      where: { year_month: { year, month } },
      update: {
        targetAmount: parseFloat(targetAmount),
        notes: notes || null
      },
      create: {
        year,
        month,
        targetAmount: parseFloat(targetAmount),
        notes: notes || null
      }
    })
    res.json(target)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
