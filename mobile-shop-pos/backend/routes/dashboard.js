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

// GET /api/dashboard/analytics/monthly
router.get('/analytics/monthly', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const months = []

    for (let m = 1; m <= 12; m++) {
      const start = new Date(year, m - 1, 1)
      const end   = new Date(year, m, 0, 23, 59, 59, 999)

      let revenue = 0
      let ordersCount = 0
      let costOfGoods = 0
      let topProduct = '—'

      try {
        const sales = await prisma.sale.findMany({
          where: { createdAt: { gte: start, lte: end } },
          select: {
            totalAmount: true,
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                product: {
                  select: {
                    name: true,
                    costPrice: true
                  }
                }
              }
            }
          }
        })

        ordersCount = sales.length
        revenue = sales.reduce(
          (s, x) => s + Number(x.totalAmount || 0), 0
        )
        costOfGoods = sales.reduce((s, sale) =>
          s + sale.items.reduce((is, item) =>
            is + (Number(item.quantity || 0) *
                  Number(item.product?.costPrice || 0))
          , 0)
        , 0)

        // Top product
        const productQty = {}
        sales.forEach(sale => {
          sale.items.forEach(item => {
            const name = item.product?.name || 'Unknown'
            productQty[name] =
              (productQty[name] || 0) +
              Number(item.quantity || 0)
          })
        })
        const sorted = Object.entries(productQty)
          .sort((a, b) => b[1] - a[1])
        topProduct = sorted[0]?.[0] || '—'
      } catch (innerErr) {
        console.error(`Month ${m} error:`, innerErr.message)
      }

      const grossProfit  = revenue - costOfGoods
      const profitMargin = revenue > 0
        ? Math.round((grossProfit / revenue) * 1000) / 10
        : 0
      const avgOrderValue = ordersCount > 0
        ? Math.round(revenue / ordersCount)
        : 0

      months.push({
        month: new Date(year, m - 1, 1)
          .toLocaleString('en', { month: 'short' }),
        monthNum: m,
        year,
        revenue:       Math.round(revenue),
        costOfGoods:   Math.round(costOfGoods),
        grossProfit:   Math.round(grossProfit),
        profitMargin,
        ordersCount,
        avgOrderValue,
        topProduct
      })
    }

    const yearTotal = {
      revenue:    months.reduce((s,m)=>s+m.revenue,    0),
      profit:     months.reduce((s,m)=>s+m.grossProfit,0),
      costOfGoods:months.reduce((s,m)=>s+m.costOfGoods,0),
      orders:     months.reduce((s,m)=>s+m.ordersCount, 0)
    }
    yearTotal.profitMargin = yearTotal.revenue > 0
      ? Math.round(
          (yearTotal.profit / yearTotal.revenue) * 1000
        ) / 10
      : 0

    res.json({ months, yearTotal })
  } catch (e) {
    console.error('Monthly analytics error:', e.message)
    res.json({
      months: Array.from({ length: 12 }, (_, i) => ({
        month: new Date(0, i).toLocaleString(
          'en', { month: 'short' }
        ),
        monthNum: i + 1,
        year: new Date().getFullYear(),
        revenue: 0, costOfGoods: 0, grossProfit: 0,
        profitMargin: 0, ordersCount: 0,
        avgOrderValue: 0, topProduct: '—'
      })),
      yearTotal: {
        revenue:0, profit:0, costOfGoods:0,
        orders:0, profitMargin:0
      }
    })
  }
})

// GET /api/dashboard/analytics/products
router.get('/analytics/products', auth, async (req, res) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(new Date().getFullYear(), 0, 1)
    const to = req.query.to
      ? new Date(req.query.to)
      : new Date()

    to.setHours(23, 59, 59, 999)

    const items = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: { gte: from, lte: to }
        }
      },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
        product: {
          select: {
            name: true,
            sku: true,
            costPrice: true,
            category: { select: { name: true } }
          }
        }
      }
    })

    const map = {}
    items.forEach(item => {
      const id = item.productId
      if (!map[id]) {
        map[id] = {
          productId:   id,
          productName: item.product?.name || 'Unknown',
          sku:         item.product?.sku  || '',
          category:    item.product?.category?.name || 'Other',
          totalQty:    0,
          totalRevenue:0,
          totalCost:   0
        }
      }
      const qty = Number(item.quantity || 0)
      const rev = Number(item.unitPrice || 0) * qty
      const cog = Number(item.product?.costPrice || 0) * qty
      map[id].totalQty     += qty
      map[id].totalRevenue += rev
      map[id].totalCost    += cog
    })

    const products = Object.values(map).map(p => ({
      ...p,
      totalRevenue: Math.round(p.totalRevenue),
      totalProfit:  Math.round(p.totalRevenue - p.totalCost),
      profitMargin: p.totalRevenue > 0
        ? Math.round(
            ((p.totalRevenue - p.totalCost) /
              p.totalRevenue) * 1000
          ) / 10
        : 0
    }))

    const sortBy = key =>
      [...products].sort((a, b) => b[key] - a[key]).slice(0, 10)

    const catMap = {}
    products.forEach(p => {
      if (!catMap[p.category]) {
        catMap[p.category] = {
          category: p.category,
          revenue: 0, profit: 0, qty: 0
        }
      }
      catMap[p.category].revenue += p.totalRevenue
      catMap[p.category].profit  += p.totalProfit
      catMap[p.category].qty     += p.totalQty
    })

    res.json({
      topByQuantity: sortBy('totalQty'),
      topByRevenue:  sortBy('totalRevenue'),
      topByProfit:   sortBy('totalProfit'),
      lowPerformers: products
        .filter(p => p.totalRevenue > 0)
        .sort((a, b) => a.totalRevenue - b.totalRevenue)
        .slice(0, 5),
      categoryBreakdown: Object.values(catMap)
        .sort((a, b) => b.revenue - a.revenue)
    })
  } catch (e) {
    console.error('Products analytics error:', e.message)
    res.json({
      topByQuantity: [], topByRevenue: [],
      topByProfit: [], lowPerformers: [],
      categoryBreakdown: []
    })
  }
})

// GET /api/dashboard/analytics/trends
router.get('/analytics/trends', auth, async (req, res) => {
  try {
    const days = Math.min(
      parseInt(req.query.days) || 30, 90
    )
    const result = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)

      let revenue = 0
      let cog = 0
      let orders = 0

      try {
        const sales = await prisma.sale.findMany({
          where: { createdAt: { gte: d, lt: next } },
          select: {
            totalAmount: true,
            items: {
              select: {
                quantity: true,
                product: {
                  select: { costPrice: true }
                }
              }
            }
          }
        })
        orders  = sales.length
        revenue = sales.reduce(
          (s, x) => s + Number(x.totalAmount || 0), 0
        )
        cog = sales.reduce((s, sale) =>
          s + sale.items.reduce((is, item) =>
            is + Number(item.quantity || 0) *
                 Number(item.product?.costPrice || 0)
          , 0)
        , 0)
      } catch (_) {}

      result.push({
        date:    d.toISOString().split('T')[0],
        revenue: Math.round(revenue),
        profit:  Math.round(revenue - cog),
        orders
      })
    }

    const revenues  = result.map(d => d.revenue)
    const half      = Math.floor(days / 2)
    const firstHalf = revenues.slice(0, half)
    const secHalf   = revenues.slice(half)
    const avg1 = firstHalf.length
      ? firstHalf.reduce((s,v)=>s+v,0)/firstHalf.length : 0
    const avg2 = secHalf.length
      ? secHalf.reduce((s,v)=>s+v,0)/secHalf.length   : 0
    const growthRate = avg1 > 0
      ? Math.round(((avg2-avg1)/avg1)*1000)/10 : 0

    const bySorted = [...result]
      .sort((a, b) => b.revenue - a.revenue)

    res.json({
      days: result,
      weeklyAvg: Math.round(
        revenues.slice(-7).reduce((s,v)=>s+v,0) /
        Math.min(7, revenues.slice(-7).length || 1)
      ),
      bestDay:  {
        date:    bySorted[0]?.date    || null,
        revenue: bySorted[0]?.revenue || 0
      },
      worstDay: {
        date:    bySorted[bySorted.length-1]?.date    || null,
        revenue: bySorted[bySorted.length-1]?.revenue || 0
      },
      growthRate
    })
  } catch (e) {
    console.error('Trends analytics error:', e.message)
    res.json({
      days: [], weeklyAvg: 0,
      bestDay:  { date: null, revenue: 0 },
      worstDay: { date: null, revenue: 0 },
      growthRate: 0
    })
  }
})

// GET /api/dashboard/analytics/customers
router.get('/analytics/customers', auth, async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      select: {
        customerId: true,
        totalAmount: true,
        createdAt: true,
        customer: {
          select: { id: true, name: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const custMap = {}
    sales.forEach(sale => {
      const id = sale.customerId
      if (!custMap[id]) {
        custMap[id] = {
          id,
          name:        sale.customer?.name  || 'Unknown',
          phone:       sale.customer?.phone || '',
          totalSpent:  0,
          orderCount:  0,
          lastPurchase:null
        }
      }
      custMap[id].totalSpent  += Number(sale.totalAmount||0)
      custMap[id].orderCount  += 1
      if (!custMap[id].lastPurchase) {
        custMap[id].lastPurchase = sale.createdAt
      }
    })

    const list = Object.values(custMap)
    const returning = list.filter(c => c.orderCount > 1)
    const newCust   = list.filter(c => c.orderCount === 1)

    let totalDebt = 0
    let debtCount = 0
    try {
      const withDebt = await prisma.customer.findMany({
        where: { totalDebt: { gt: 0 } },
        select: { totalDebt: true }
      })
      totalDebt = withDebt.reduce(
        (s, c) => s + Number(c.totalDebt || 0), 0
      )
      debtCount = withDebt.length
    } catch (_) {}

    const totalSpentAll = list.reduce(
      (s, c) => s + c.totalSpent, 0
    )

    res.json({
      topSpenders: list
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map(c => ({
          ...c,
          totalSpent: Math.round(c.totalSpent)
        })),
      newVsReturning: {
        newCustomers:       newCust.length,
        returningCustomers: returning.length,
        returningRevenue:   Math.round(
          returning.reduce((s,c)=>s+c.totalSpent, 0)
        )
      },
      avgCustomerValue: list.length > 0
        ? Math.round(totalSpentAll / list.length)
        : 0,
      debtSummary: {
        totalDebt: Math.round(totalDebt),
        customersWithDebt: debtCount
      }
    })
  } catch (e) {
    console.error('Customer analytics error:', e.message)
    res.json({
      topSpenders: [],
      newVsReturning: {
        newCustomers: 0, returningCustomers: 0,
        returningRevenue: 0
      },
      avgCustomerValue: 0,
      debtSummary: { totalDebt: 0, customersWithDebt: 0 }
    })
  }
})

module.exports = router;
