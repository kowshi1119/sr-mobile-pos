const { sendError, badRequest } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const auth = require('../middleware/auth');

function readWarranty(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 120) throw badRequest('Warranty months must be a whole number from 0 to 120.');
  return n;
}

// GET /api/categories
router.get('/', auth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (err) { sendError(res, err); }
});

// POST /api/categories
router.post('/', requirePermission('categories.manage'), async (req, res) => {
  try {
    const { icon } = req.body;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) throw badRequest('Category name is required.');
    const category = await prisma.category.create({
      data: { name, icon: icon || null, warrantyMonths: readWarranty(req.body.warrantyMonths) ?? 3 }
    });
    res.status(201).json(category);
  } catch (err) { sendError(res, err); }
});

// PATCH /api/categories/:id
router.patch('/:id', requirePermission('categories.manage'), async (req, res) => {
  try {
    const { icon, isActive } = req.body;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
    if (name === '') throw badRequest('Category name is required.');
    const warrantyMonths = readWarranty(req.body.warrantyMonths);
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(icon !== undefined && { icon: icon || null }), ...(warrantyMonths !== undefined && { warrantyMonths }), ...(isActive !== undefined && { isActive: !!isActive }) }
    });
    res.json(category);
  } catch (err) { sendError(res, err); }
});

// DELETE /api/categories/:id
router.delete('/:id', requirePermission('categories.manage'), async (req, res) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Category deactivated' });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
