const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const QRCode = require('qrcode');
const { sendWhatsApp } = require('../utils/whatsapp');
const prisma = new PrismaClient();

async function getNextInvoiceNumber() {
  const counter = await prisma.invoiceCounter.upsert({
    where: { id: 1 },
    update: { lastNum: { increment: 1 } },
    create: { id: 1, lastNum: 1 }
  });
  return `INV-${String(counter.lastNum).padStart(4, '0')}`;
}

// POST /api/sales — Complete sale transaction
router.post('/', auth, async (req, res) => {
  const { customer: customerData, items, paymentMethod, creditAmount, discountAmount, discountType } = req.body;

  try {
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
      const invoiceNumber = await getNextInvoiceNumber();

      // 3. Calculate total
      const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
      const appliedDiscount = parseFloat(discountAmount) || 0;
      const totalAmount = Math.max(0, itemsTotal - appliedDiscount);

      // 4. Create sale
      const sale = await tx.sale.create({
        data: {
          customerId: customer.id,
          invoiceNumber,
          totalAmount,
          discountAmount: appliedDiscount,
          discountType: discountType || 'NONE',
          paymentMethod
        }
      });

      // 5. Process each item
      const warrantyData = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, include: { category: true } });
        if (!product) throw new Error(`Product ${item.productId} not found`);

        let imeiRecord = null;
        if (product.hasImei) {
          if (!item.imeiId) throw new Error(`Please select an IMEI for ${product.name}`);
          if (item.quantity !== 1) throw new Error(`IMEI product ${product.name} must be sold one unit at a time`);

          imeiRecord = await tx.imeiRecord.findUnique({ where: { id: item.imeiId } });
          if (!imeiRecord) throw new Error(`Selected IMEI was not found for ${product.name}`);
          if (imeiRecord.productId !== item.productId) throw new Error(`Selected IMEI does not belong to ${product.name}`);
          if (imeiRecord.status !== 'IN_STOCK') throw new Error(`IMEI ${imeiRecord.imei} is already sold`);
        }

        // Check stock
        if (!product.hasImei && product.stockQuantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            variantId: item.variantId || null,
            imeiId: item.imeiId || null,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice)
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
      const invoiceUrl = `${process.env.FRONTEND_URL}/invoice/${invoiceNumber}`;
      const qrDataUrl = await QRCode.toDataURL(invoiceUrl, { width: 300, margin: 2 });

      return { sale, customer, invoiceNumber, qrDataUrl, invoiceUrl };
    });

    // 12. Credit sale — create DebtRecord outside transaction
    const parsedCredit = parseFloat(creditAmount);
    if (!isNaN(parsedCredit) && parsedCredit > 0) {
      await prisma.debtRecord.create({
        data: {
          customerId: result.customer.id,
          saleId: result.sale.id,
          type: 'CREDIT',
          amount: parsedCredit,
          description: `Credit sale - ${result.invoiceNumber}`
        }
      });
      await prisma.customer.update({
        where: { id: result.customer.id },
        data: { totalDebt: { increment: parsedCredit } }
      });
    }

    // 11. Async WhatsApp notification (outside transaction)
    setImmediate(async () => {
      try {
        if (result.customer.whatsappOptIn && result.customer.whatsappNumber) {
          const msgId = await sendWhatsApp(
            result.customer.whatsappNumber,
            'invoice_notification',
            [result.invoiceNumber, result.sale.totalAmount.toString(), result.invoiceUrl]
          );
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
      } catch (e) { console.error('WhatsApp notification failed:', e.message); }
    });

    // Auto-earn loyalty points after sale
    setImmediate(async () => {
      try {
        if (result.customer?.id) {
          const pts = Math.floor(Number(result.sale.totalAmount) * (10 / 1000))
          if (pts > 0) {
            let acc = await prisma.loyaltyAccount.findUnique({
              where: { customerId: result.customer.id }
            })
            if (!acc) {
              acc = await prisma.loyaltyAccount.create({
                data: { customerId: result.customer.id }
              })
            }
            await prisma.loyaltyAccount.update({
              where: { id: acc.id },
              data: {
                points: { increment: pts },
                totalEarned: { increment: pts },
                transactions: {
                  create: {
                    type: 'EARN',
                    points: pts,
                    description: `Sale ${result.invoiceNumber}`,
                    saleId: result.sale.id
                  }
                }
              }
            })
          }
        }
      } catch (loyaltyErr) {
        console.error('Loyalty earn error:', loyaltyErr.message)
      }
    })

    res.status(201).json({
      sale: result.sale,
      invoiceNumber: result.invoiceNumber,
      qrDataUrl: result.qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales
router.get('/', auth, async (req, res) => {
  try {
    const { date, search } = req.query;
    const where = {};
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }
    if (search) where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } }
    ];
    const sales = await prisma.sale.findMany({
      where,
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sales);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sales/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: { include: { product: true, variant: true, imei: true } }, warrantyRecords: { include: { product: true } } }
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
