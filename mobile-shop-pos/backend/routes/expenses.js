const { sendError, badRequest } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const router = require('express').Router()
const { prisma } = require('../db');
const auth = require('../middleware/auth')

const CATEGORIES = [
  'Rent', 'Salary', 'Electricity', 'Internet',
  'Supplies', 'Marketing', 'Maintenance',
  'Transport', 'Other'
]

router.get('/categories', requirePermission('expenses.manage'), (_, res) => {
  res.json(CATEGORIES)
})

router.get('/summary/monthly', requirePermission('expenses.manage', 'analytics.view'), async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const results = []
    for (let m = 1; m <= 12; m++) {
      const start = new Date(year, m - 1, 1)
      const end = new Date(year, m, 0, 23, 59, 59)
      const expenses = await prisma.expense.findMany({
        where: { date: { gte: start, lte: end } }
      })
      results.push({
        month: new Date(year, m - 1, 1).toLocaleString('en', { month: 'short' }),
        monthNum: m,
        total: Math.round(expenses.reduce((s, e) => s + Number(e.amount), 0))
      })
    }
    res.json(results)
  } catch (e) {
    sendError(res, e)
  }
})

router.get('/', requirePermission('expenses.manage'), async (req, res) => {
  try {
    const { from, to, category } = req.query
    const where = {}
    if (category) where.category = category
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' }
    })
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
    res.json({ expenses, total: Math.round(total) })
  } catch (e) {
    sendError(res, e)
  }
})

router.post('/', requirePermission('expenses.manage'), async (req, res) => {
  try {
    const { category, description, amount, date } = req.body
    if (!category || !amount) {
      return res.status(400).json({ error: 'Category and amount required' })
    }
    const expense = await prisma.expense.create({
      data: {
        category,
        description: description || category,
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date()
      }
    })
    res.status(201).json(expense)
  } catch (e) {
    sendError(res, e)
  }
})

router.delete('/:id', requirePermission('expenses.manage'), async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
