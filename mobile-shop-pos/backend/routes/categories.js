const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/categories
router.get('/', auth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/categories
router.post('/', auth, async (req, res) => {
  try {
    const { name, icon, warrantyMonths } = req.body;
    const category = await prisma.category.create({
      data: { name, icon, warrantyMonths: warrantyMonths || 3 }
    });
    res.status(201).json(category);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/categories/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, icon, warrantyMonths, isActive } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(icon !== undefined && { icon }), ...(warrantyMonths && { warrantyMonths }), ...(isActive !== undefined && { isActive }) }
    });
    res.json(category);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/categories/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Category deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
