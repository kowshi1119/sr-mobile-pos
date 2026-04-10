const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

router.use(auth);

const EXPORTERS = {
  categories: tx => tx.category.findMany({ orderBy: { createdAt: 'asc' } }),
  customers: tx => tx.customer.findMany({ orderBy: { createdAt: 'asc' } }),
  products: tx => tx.product.findMany({ orderBy: { createdAt: 'asc' } }),
  productVariants: tx => tx.productVariant.findMany({ orderBy: { createdAt: 'asc' } }),
  bundles: tx => tx.bundle.findMany({ orderBy: { createdAt: 'asc' } }),
  bundleItems: tx => tx.bundleItem.findMany({ orderBy: { id: 'asc' } }),
  suppliers: tx => tx.supplier.findMany({ orderBy: { createdAt: 'asc' } }),
  supplierPurchases: tx => tx.supplierPurchase.findMany({ orderBy: { createdAt: 'asc' } }),
  supplierPurchaseItems: tx => tx.supplierPurchaseItem.findMany({ orderBy: { id: 'asc' } }),
  expenses: tx => tx.expense.findMany({ orderBy: { createdAt: 'asc' } }),
  salesTargets: tx => tx.salesTarget.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
  sales: tx => tx.sale.findMany({ orderBy: { createdAt: 'asc' } }),
  imeiRecords: tx => tx.imeiRecord.findMany({ orderBy: { createdAt: 'asc' } }),
  saleItems: tx => tx.saleItem.findMany({ orderBy: { id: 'asc' } }),
  warrantyRecords: tx => tx.warrantyRecord.findMany({ orderBy: { createdAt: 'asc' } }),
  repairs: tx => tx.repair.findMany({ orderBy: { createdAt: 'asc' } }),
  notifications: tx => tx.notification.findMany({ orderBy: { createdAt: 'asc' } }),
  debtRecords: tx => tx.debtRecord.findMany({ orderBy: { createdAt: 'asc' } }),
  loyaltyAccounts: tx => tx.loyaltyAccount.findMany({ orderBy: { createdAt: 'asc' } }),
  loyaltyTransactions: tx => tx.loyaltyTransaction.findMany({ orderBy: { createdAt: 'asc' } }),
  offlineSales: tx => tx.offlineSale.findMany({ orderBy: { createdAt: 'asc' } }),
  invoiceCounters: tx => tx.invoiceCounter.findMany({ orderBy: { id: 'asc' } }),
  aiChatSessions: tx => tx.aiChatSession.findMany({ orderBy: { createdAt: 'asc' } }),
};

async function importMany(delegate, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const { count } = await delegate.createMany({ data: rows, skipDuplicates: true });
  return count;
}

async function clearAllBusinessData(tx) {
  const summary = {};

  summary.notifications = (await tx.notification.deleteMany()).count;
  summary.saleItems = (await tx.saleItem.deleteMany()).count;
  summary.warrantyRecords = (await tx.warrantyRecord.deleteMany()).count;
  summary.debtRecords = (await tx.debtRecord.deleteMany()).count;
  summary.loyaltyTransactions = (await tx.loyaltyTransaction.deleteMany()).count;
  summary.loyaltyAccounts = (await tx.loyaltyAccount.deleteMany()).count;
  summary.supplierPurchaseItems = (await tx.supplierPurchaseItem.deleteMany()).count;
  summary.supplierPurchases = (await tx.supplierPurchase.deleteMany()).count;
  summary.bundleItems = (await tx.bundleItem.deleteMany()).count;
  summary.imeiRecords = (await tx.imeiRecord.deleteMany()).count;
  summary.repairs = (await tx.repair.deleteMany()).count;
  summary.sales = (await tx.sale.deleteMany()).count;
  summary.offlineSales = (await tx.offlineSale.deleteMany()).count;
  summary.bundles = (await tx.bundle.deleteMany()).count;
  summary.productVariants = (await tx.productVariant.deleteMany()).count;
  summary.products = (await tx.product.deleteMany()).count;
  summary.expenses = (await tx.expense.deleteMany()).count;
  summary.salesTargets = (await tx.salesTarget.deleteMany()).count;
  summary.suppliers = (await tx.supplier.deleteMany()).count;
  summary.categories = (await tx.category.deleteMany()).count;
  summary.customers = (await tx.customer.deleteMany()).count;
  summary.aiChatSessions = (await tx.aiChatSession.deleteMany()).count;
  await tx.invoiceCounter.deleteMany();
  await tx.invoiceCounter.upsert({
    where: { id: 1 },
    update: { lastNum: 0 },
    create: { id: 1, lastNum: 0 },
  });
  summary.invoiceCounters = 1;

  return summary;
}

router.get('/export', async (req, res) => {
  try {
    const data = {};
    for (const [key, reader] of Object.entries(EXPORTERS)) {
      data[key] = await reader(prisma);
    }

    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: req.admin?.email || 'admin',
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to export data' });
  }
});

router.post('/import', async (req, res) => {
  try {
    const merge = req.body?.merge !== false;
    const payload = req.body?.data && typeof req.body.data === 'object' ? req.body.data : req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Valid backup JSON is required' });
    }

    const source = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const summary = {};

    await prisma.$transaction(async tx => {
      if (!merge) {
        await clearAllBusinessData(tx);
      }

      summary.categories = await importMany(tx.category, source.categories);
      summary.customers = await importMany(tx.customer, source.customers);
      summary.suppliers = await importMany(tx.supplier, source.suppliers);
      summary.products = await importMany(tx.product, source.products);
      summary.productVariants = await importMany(tx.productVariant, source.productVariants);
      summary.bundles = await importMany(tx.bundle, source.bundles);
      summary.bundleItems = await importMany(tx.bundleItem, source.bundleItems);
      summary.supplierPurchases = await importMany(tx.supplierPurchase, source.supplierPurchases);
      summary.supplierPurchaseItems = await importMany(tx.supplierPurchaseItem, source.supplierPurchaseItems);
      summary.expenses = await importMany(tx.expense, source.expenses);
      summary.salesTargets = await importMany(tx.salesTarget, source.salesTargets);
      summary.sales = await importMany(tx.sale, source.sales);
      summary.repairs = await importMany(tx.repair, source.repairs);
      summary.imeiRecords = await importMany(tx.imeiRecord, source.imeiRecords);
      summary.saleItems = await importMany(tx.saleItem, source.saleItems);
      summary.warrantyRecords = await importMany(tx.warrantyRecord, source.warrantyRecords);
      summary.notifications = await importMany(tx.notification, source.notifications);
      summary.debtRecords = await importMany(tx.debtRecord, source.debtRecords);
      summary.loyaltyAccounts = await importMany(tx.loyaltyAccount, source.loyaltyAccounts);
      summary.loyaltyTransactions = await importMany(tx.loyaltyTransaction, source.loyaltyTransactions);
      summary.offlineSales = await importMany(tx.offlineSale, source.offlineSales);
      summary.invoiceCounters = await importMany(tx.invoiceCounter, source.invoiceCounters);
      summary.aiChatSessions = await importMany(tx.aiChatSession, source.aiChatSessions);
    });

    const importedCount = Object.values(summary).reduce((sum, value) => sum + Number(value || 0), 0);
    res.json({ imported: true, merge, importedCount, summary });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to import backup' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const { confirmText } = req.body || {};
    if (confirmText !== 'RESET') {
      return res.status(400).json({ error: 'Type RESET to confirm data reset' });
    }

    const summary = await prisma.$transaction(async tx => clearAllBusinessData(tx));
    const deletedCount = Object.values(summary).reduce((sum, value) => sum + Number(value || 0), 0);

    res.json({ reset: true, deletedCount, summary });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to reset data' });
  }
});

module.exports = router;
