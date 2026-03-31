const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Generate SKU
function generateSku(categoryName, productName, variantCode = '') {
  const catPrefix = categoryName.substring(0, 2).toUpperCase().replace(/\s/g, '');
  const prodCode = productName.substring(0, 4).toUpperCase().replace(/\s/g, '');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  const variant = variantCode ? `-${variantCode.substring(0, 3).toUpperCase()}` : '';
  return `${catPrefix}-${prodCode}-${rand}${variant}`;
}

// Generate barcode (unique numeric)
function generateBarcode() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// GET /api/products
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, barcode } = req.query;
    const where = { isActive: true };
    if (category) where.categoryId = category;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } }
    ];
    if (barcode) {
      // Also check variants
      const product = await prisma.product.findFirst({ where: { barcode, isActive: true }, include: { category: true, variants: true } });
      if (!product) {
        const variant = await prisma.productVariant.findFirst({ where: { barcode }, include: { product: { include: { category: true } } } });
        if (variant) return res.json([{ ...variant.product, matchedVariant: variant }]);
        return res.json([]);
      }
      return res.json([product]);
    }
    const products = await prisma.product.findMany({
      where,
      include: { category: true, variants: true, _count: { select: { imeiRecords: { where: { status: 'IN_STOCK' } } } } },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products
router.post('/', auth, async (req, res) => {
  try {
    const { categoryId, name, sellingPrice, costPrice, stockQuantity, lowStockThreshold, warrantyMonths, imageUrl, hasImei, imeiNumbers, variants } = req.body;
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    const sku = generateSku(category.name, name);
    const barcode = generateBarcode();

    const product = await prisma.product.create({
      data: {
        categoryId, name, sku, barcode,
        sellingPrice: parseFloat(sellingPrice),
        costPrice: parseFloat(costPrice),
        stockQuantity: parseInt(stockQuantity) || 0,
        lowStockThreshold: parseInt(lowStockThreshold) || 5,
        warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null,
        imageUrl: imageUrl || null,
        hasImei: hasImei || false,
        variants: variants && variants.length > 0 ? {
          create: variants.map(v => ({
            variantName: v.variantName,
            priceOverride: v.priceOverride ? parseFloat(v.priceOverride) : null,
            stockQuantity: parseInt(v.stockQuantity) || 0,
            barcode: generateBarcode()
          }))
        } : undefined,
        imeiRecords: imeiNumbers && imeiNumbers.length > 0 ? {
          create: imeiNumbers.filter(i => i.trim()).map(imei => ({ imei: imei.trim(), status: 'IN_STOCK' }))
        } : undefined
      },
      include: { category: true, variants: true, imeiRecords: true }
    });
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/products/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, sellingPrice, costPrice, stockQuantity, lowStockThreshold, warrantyMonths, imageUrl, isActive } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(sellingPrice !== undefined && { sellingPrice: parseFloat(sellingPrice) }),
        ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
        ...(stockQuantity !== undefined && { stockQuantity: parseInt(stockQuantity) }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: parseInt(lowStockThreshold) }),
        ...(warrantyMonths !== undefined && { warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive })
      },
      include: { category: true, variants: true }
    });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Product deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id/qr
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const qrDataUrl = await QRCode.toDataURL(product.barcode, { width: 300, margin: 2 });
    res.json({ qrDataUrl, barcode: product.barcode, sku: product.sku, name: product.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products/upload-image
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'sr-mobile-pos/products' });
    res.json({ imageUrl: result.secure_url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id/imei
router.get('/:id/imei', auth, async (req, res) => {
  try {
    const imeis = await prisma.imeiRecord.findMany({
      where: { productId: req.params.id },
      include: { sale: { select: { invoiceNumber: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(imeis);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products/:id/imei
router.post('/:id/imei', auth, async (req, res) => {
  try {
    const { imeiNumbers } = req.body;
    if (!imeiNumbers || !imeiNumbers.length) return res.status(400).json({ error: 'No IMEI numbers provided' });
    const created = await prisma.$transaction(
      imeiNumbers.filter(i => i.trim()).map(imei =>
        prisma.imeiRecord.create({ data: { productId: req.params.id, imei: imei.trim(), status: 'IN_STOCK' } })
      )
    );
    // Update stock count
    await prisma.product.update({ where: { id: req.params.id }, data: { stockQuantity: { increment: created.length } } });
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
