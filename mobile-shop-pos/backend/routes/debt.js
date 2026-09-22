const express = require('express');
const router = express.Router();
const { prisma, Prisma } = require('../db');
const { money } = require('../utils/money');
const auth = require('../middleware/auth');

// GET /api/debt — All customers with outstanding debt > 0 (sorted highest first)
router.get('/', auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { totalDebt: { gt: 0 } },
      orderBy: { totalDebt: 'desc' },
      select: { id: true, name: true, phone: true, whatsappNumber: true, totalDebt: true }
    });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/debt/:customerId — Debt records + balance for one customer
router.get('/:customerId', auth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      select: { id: true, name: true, phone: true, totalDebt: true }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const records = await prisma.debtRecord.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'desc' },
      include: { sale: { select: { invoiceNumber: true } } }
    });

    res.json({ customer, records, totalDebt: customer.totalDebt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/debt — Create a debt record
router.post('/', auth, async (req, res) => {
  const { customerId, saleId, type, amount, description } = req.body;
  if (!customerId || !type || !amount) {
    return res.status(400).json({ error: 'customerId, type and amount are required' });
  }
  if (!['CREDIT', 'PAYMENT'].includes(type)) {
    return res.status(400).json({ error: 'type must be CREDIT or PAYMENT' });
  }

  try {
    const parsedAmount = money(amount);
    if(parsedAmount.lte(0))return res.status(400).json({error:'Amount must be positive'});
    const record=await prisma.$transaction(async tx=>{
      const customer=await tx.customer.findUnique({where:{id:customerId}});
      if(!customer)throw new Error('Customer not found');
      const balance=new Prisma.Decimal(customer.totalDebt);
      const next=type==='CREDIT'?balance.plus(parsedAmount):Prisma.Decimal.max(0,balance.minus(parsedAmount));
      const record=await tx.debtRecord.create({data:{customerId,saleId:saleId||null,type,amount:parsedAmount,description:description||null}});
      await tx.customer.update({where:{id:customerId},data:{totalDebt:money(next.toDecimalPlaces(2))}});
      return record;
    });

    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/debt/:id/pay — Mark debt record as paid, decrement customer totalDebt
router.patch('/:id/pay', auth, async (req, res) => {
  try {
    const updated=await prisma.$transaction(async tx=>{
      const record=await tx.debtRecord.findUnique({where:{id:req.params.id}});
      if(!record||record.isPaid)throw new Error('Debt record unavailable or already paid');
      const updated=await tx.debtRecord.update({where:{id:record.id},data:{isPaid:true,paidAt:new Date()}});
      if(record.type==='CREDIT') {
        const customer=await tx.customer.findUnique({where:{id:record.customerId}});
        const next=Prisma.Decimal.max(0,new Prisma.Decimal(customer.totalDebt).minus(record.amount));
        await tx.customer.update({where:{id:record.customerId},data:{totalDebt:money(next.toDecimalPlaces(2))}});
      }
      return updated;
    });

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
