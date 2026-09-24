const { sendError, badRequest, AppError } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const permissions = require('../utils/permissions');
const express = require('express');
const router = express.Router();
const { prisma, Prisma } = require('../db');
const { money } = require('../utils/money');
const auth = require('../middleware/auth');
const QRCode = require('qrcode');
const { sendWhatsApp } = require('../utils/whatsapp');

async function getNextInvoiceNumber(tx) {
  const counter = await tx.invoiceCounter.upsert({
    where: { id: 1 },
    update: { lastNum: { increment: 1 } },
    create: { id: 1, lastNum: 1 }
  });
  return `INV-${String(counter.lastNum).padStart(4, '0')}`;
}

// POST /api/sales — Complete sale transaction
router.post('/', requirePermission('sales.create'), async (req, res) => {
  const { customer: customerData, items, paymentMethod, creditAmount, discountAmount, discountType } = req.body;

  try {
    if (!customerData || !Array.isArray(items) || !items.length || !['CASH','CARD','TRANSFER'].includes(paymentMethod)) return res.status(400).json({error:'Customer, sale items and valid payment method required'});
    for(const item of items) if(!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100000) return res.status(400).json({error:'Quantity must be a positive whole number'});
    if(money(discountAmount||0).gt(0)&&!permissions.has(req.user,'sales.discount')) return res.status(403).json({error:"You don't have permission to give discounts."});
    const result = await prisma.$transaction(async (tx) => {
      // 1. Save or find customer
      // If phone is empty, always create a new anonymous walk-in customer
      let customer;
      const phoneProvided = customerData.phone && customerData.phone.trim();
      if (!phoneProvided) {
        customer = await tx.customer.create({
          data: {
            name: customerData.name && customerData.name.trim() ? customerData.name.trim() : 'Walk-in Customer',
            phone: `WIC-${Date.now()}`,
            whatsappNumber: customerData.whatsappNumber || null,
            whatsappOptIn: false
          }
        });
      } else {
        customer = await tx.customer.findFirst({ where: { phone: customerData.phone.trim() } });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              name: customerData.name && customerData.name.trim() ? customerData.name.trim() : 'Walk-in Customer',
              phone: customerData.phone.trim(),
              whatsappNumber: customerData.whatsappNumber || customerData.phone.trim(),
              whatsappOptIn: customerData.whatsappOptIn || false
            }
          });
        } else {
          // Update opt-in if changed
          if (customerData.whatsappOptIn !== undefined) {
            customer = await tx.customer.update({
              where: { id: customer.id },
              data: { whatsappOptIn: customerData.whatsappOptIn, name: customerData.name && customerData.name.trim() ? customerData.name.trim() : customer.name }
            });
          }
        }
      }

      // 2. Invoice number
      const invoiceNumber = await getNextInvoiceNumber(tx);

      // 3. Calculate total
      const itemsTotal = items.reduce((sum, item) => sum.plus(money(item.unitPrice).times(item.quantity)), new Prisma.Decimal(0));
      const appliedDiscount = money(discountAmount || 0);
      if(appliedDiscount.gt(itemsTotal)) return Promise.reject(badRequest('Discount exceeds sale total'));
      const totalAmount = money(itemsTotal.minus(appliedDiscount));

      // 4. Create sale
      const sale = await tx.sale.create({
        data: {
          customerId: customer.id,
          invoiceNumber,
          totalAmount,
          discountAmount: process.env.DESKTOP_MODE === '1' ? appliedDiscount : Number(appliedDiscount),
          discountType: discountType || 'NONE',
          paymentMethod,
          soldBy: req.user?.displayName || null
        }
      });

      // 5. Process each item
      const warrantyData = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, include: { category: true } });
        if (!product || !product.isActive) throw badRequest(`Product ${item.productId} not found`);

        let imeiRecord = null;
        if (product.hasImei) {
          if (!item.imeiId) throw badRequest(`Please select an IMEI for ${product.name}`);
          if (item.quantity !== 1) throw badRequest(`IMEI product ${product.name} must be sold one unit at a time`);

          imeiRecord = await tx.imeiRecord.findUnique({ where: { id: item.imeiId } });
          if (!imeiRecord) throw badRequest(`Selected IMEI was not found for ${product.name}`);
          if (imeiRecord.productId !== item.productId) throw badRequest(`Selected IMEI does not belong to ${product.name}`);
          if (imeiRecord.status !== 'IN_STOCK') throw badRequest(`IMEI ${imeiRecord.imei} is already sold`);
        }

        // Validate variant ownership and stock before changing either record.
        let variant=null;
        if(item.variantId) {
          variant=await tx.productVariant.findUnique({where:{id:item.variantId}});
          if(!variant||variant.productId!==product.id||variant.stockQuantity<item.quantity||product.hasImei)throw badRequest('Invalid variant or insufficient variant stock');
        }
        // A price different from the catalogue needs sales.changePrice, except for bundle lines,
        // whose bundle price is split across the bundled products.
        const catalogPrice=new Prisma.Decimal(variant?.priceOverride ?? product.sellingPrice);
        if(!money(item.unitPrice).eq(catalogPrice)&&!permissions.has(req.user,'sales.changePrice')) {
          const bundle=item.bundleId?await tx.bundle.findFirst({where:{id:item.bundleId,isActive:true,items:{some:{productId:product.id}}}}):null;
          if(!bundle)throw new AppError(403,`You don't have permission to change the price of ${product.name}.`);
        }
        // Check stock
        if (!product.hasImei && !item.variantId && product.stockQuantity < item.quantity) {
          throw badRequest(`Insufficient stock for ${product.name}`);
        }

        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            variantId: item.variantId || null,
            imeiId: item.imeiId || null,
            quantity: item.quantity,
            unitPrice: money(item.unitPrice)
          }
        });

        // 6. Deduct stock
        if (item.variantId) {
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { decrement: item.quantity } } });
        } else if (!product.hasImei) {
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
        }

        // 7. Mark IMEI as SOLD
        if (imeiRecord) {
          await tx.imeiRecord.update({
            where: { id: imeiRecord.id },
            data: { status: 'SOLD', saleId: sale.id }
          });
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: 1 } } });
        }

        // 8. Warranty
        const wMonths = product.warrantyMonths || product.category.warrantyMonths;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + wMonths);
        warrantyData.push({ saleId: sale.id, productId: item.productId, warrantyMonths: wMonths, expiresAt });
      }

      // 9. Save warranty records
      await tx.warrantyRecord.createMany({ data: warrantyData });

      // 10. Generate invoice QR
      const invoiceUrl = process.env.DESKTOP_MODE === '1' ? `SR-MOBILE|INVOICE|${invoiceNumber}` : `${process.env.FRONTEND_URL}/invoice/${invoiceNumber}`;
      const qrDataUrl = await QRCode.toDataURL(invoiceUrl, { width: 300, margin: 2 });

      const parsedCredit=money(creditAmount||0);
      if(parsedCredit.gt(totalAmount))throw badRequest('Credit exceeds sale total');
      if(parsedCredit.gt(0)) {
        await tx.debtRecord.create({data:{customerId:customer.id,saleId:sale.id,type:'CREDIT',amount:parsedCredit,description:'Credit sale - '+invoiceNumber}});
        await tx.customer.update({where:{id:customer.id},data:{totalDebt:money(new Prisma.Decimal(customer.totalDebt).plus(parsedCredit))}});
      }
      const pts=Number(totalAmount.div(100).floor());
      if(pts>0) {
        const account=await tx.loyaltyAccount.upsert({where:{customerId:customer.id},create:{customerId:customer.id},update:{}});
        await tx.loyaltyAccount.update({where:{id:account.id},data:{points:{increment:pts},totalEarned:{increment:pts},transactions:{create:{type:'EARN',points:pts,description:'Sale '+invoiceNumber,saleId:sale.id}}}});
      }
      return { sale, customer, invoiceNumber, qrDataUrl, invoiceUrl };
    });

    let integrationNotice=process.env.DESKTOP_MODE==='1'?'Sale saved locally. Invoice QR codes identify records on this PC.':undefined;
    {
      try {
        if (result.customer.whatsappOptIn && result.customer.whatsappNumber) {
          const msgId = await sendWhatsApp(
            result.customer.whatsappNumber,
            'invoice_notification',
            [result.invoiceNumber, result.sale.totalAmount.toString(), process.env.DESKTOP_MODE==='1'?'Please collect your invoice from the shop.':result.invoiceUrl]
          );
          if(!msgId)integrationNotice='Your sale was saved locally. WhatsApp requires an internet connection and configured service; the notification was not sent.';
          await prisma.notification.create({
            data: {
              customerId: result.customer.id,
              saleId: result.sale.id,
              messageType: 'invoice',
              templateName: 'invoice_notification',
              status: msgId ? 'SENT' : 'FAILED',
              providerMessageId: msgId || null,
              sentAt: msgId ? new Date() : null
            }
          });
        }
      } catch { integrationNotice='Your sale was saved. The optional notification could not be recorded.'; }
    }

    res.status(201).json({
      integrationNotice,
      sale: result.sale,
      invoiceNumber: result.invoiceNumber,
      qrDataUrl: result.qrDataUrl
    });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/sales
router.get('/', requirePermission('sales.view'), async (req, res) => {
  try {
    const { date, search } = req.query;
    const where = {};
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }
    if (search) where.OR = [
      { invoiceNumber: { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) } },
      { customer: { name: { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) } } }
    ];
    const sales = await prisma.sale.findMany({
      where,
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(permissions.stripCost(req.user, sales));
  } catch (err) { sendError(res, err); }
});

// GET /api/sales/:id
router.get('/:id', requirePermission('sales.view', 'sales.create'), async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: { include: { product: true, variant: true, imei: true } }, warrantyRecords: { include: { product: true } } }
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(permissions.stripCost(req.user, sale));
  } catch (err) { sendError(res, err); }
});

module.exports = router;
