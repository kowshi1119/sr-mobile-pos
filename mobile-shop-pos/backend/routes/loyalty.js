const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const auth = require('../middleware/auth')
const prisma = new PrismaClient()

const POINTS_PER_LKR = 10 / 1000
const POINTS_REDEEM_RATE = 1

router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    let account = await prisma.loyaltyAccount.findUnique({
      where: { customerId: req.params.customerId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        customer: {
          select: { name: true, phone: true }
        }
      }
    })

    if (!account) {
      account = await prisma.loyaltyAccount.create({
        data: { customerId: req.params.customerId },
        include: {
          transactions: true,
          customer: { select: { name: true, phone: true } }
        }
      })
    }

    res.json(account)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/earn', auth, async (req, res) => {
  try {
    const { customerId, saleId, saleAmount } = req.body
    if (!customerId || !saleAmount) {
      return res.status(400).json({ error: 'customerId and saleAmount required' })
    }

    const pointsEarned = Math.floor(Number(saleAmount) * POINTS_PER_LKR)
    if (pointsEarned <= 0) {
      return res.json({ points: 0, message: 'No points earned' })
    }

    let account = await prisma.loyaltyAccount.findUnique({ where: { customerId } })
    if (!account) {
      account = await prisma.loyaltyAccount.create({ data: { customerId } })
    }

    const updated = await prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: { increment: pointsEarned },
        totalEarned: { increment: pointsEarned },
        transactions: {
          create: {
            type: 'EARN',
            points: pointsEarned,
            description: `Earned from sale LKR ${saleAmount}`,
            saleId: saleId || null
          }
        }
      }
    })

    res.json({ pointsEarned, totalPoints: updated.points })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/redeem', auth, async (req, res) => {
  try {
    const { customerId, pointsToRedeem } = req.body
    if (!customerId || !pointsToRedeem) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const account = await prisma.loyaltyAccount.findUnique({ where: { customerId } })
    if (!account) {
      return res.status(404).json({ error: 'No loyalty account found' })
    }
    if (account.points < pointsToRedeem) {
      return res.status(400).json({ error: `Only ${account.points} points available` })
    }

    const discountValue = pointsToRedeem * POINTS_REDEEM_RATE

    await prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: { decrement: pointsToRedeem },
        totalRedeemed: { increment: pointsToRedeem },
        transactions: {
          create: {
            type: 'REDEEM',
            points: -pointsToRedeem,
            description: `Redeemed for LKR ${discountValue} discount`
          }
        }
      }
    })

    res.json({ discountValue, pointsUsed: pointsToRedeem })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const accounts = await prisma.loyaltyAccount.findMany({
      where: { points: { gt: 0 } },
      include: {
        customer: { select: { name: true, phone: true } }
      },
      orderBy: { points: 'desc' },
      take: 20
    })
    res.json(accounts)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
