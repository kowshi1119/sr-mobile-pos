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

function normalizeBarcode(value = '') {
  return String(value ?? '').trim();
}

async function findBarcodeConflict(barcode, { excludeProductId, reservedBarcodes } = {}) {
  if (!barcode) return null;
  if (reservedBarcodes?.has(barcode)) return 'is duplicated in this request';

  const [productMatch, variantMatch, imeiMatch] = await Promise.all([
    prisma.product.findFirst({
      where: {
        barcode,
        ...(excludeProductId ? { NOT: { id: excludeProductId } } : {})
      },
      select: { id: true, name: true }
    }),
    prisma.productVariant.findFirst({
      where: { barcode },
      select: { id: true, variantName: true }
    }),
    prisma.imeiRecord.findFirst({
      where: { imei: barcode },
      select: { id: true }
    })
  ]);

  if (productMatch) return `is already used by product "${productMatch.name}"`;
  if (variantMatch) return `is already used by variant "${variantMatch.variantName}"`;
  if (imeiMatch) return 'matches an existing IMEI number';
  return null;
}

async function ensureUniqueBarcode(inputBarcode, options = {}) {
  const requestedBarcode = normalizeBarcode(inputBarcode);

  if (requestedBarcode) {
    const conflict = await findBarcodeConflict(requestedBarcode, options);
    if (conflict) {
      const error = new Error(`Barcode "${requestedBarcode}" ${conflict}`);
      error.status = 400;
      throw error;
    }

    options.reservedBarcodes?.add(requestedBarcode);
    return requestedBarcode;
  }

  let generatedBarcode = generateBarcode();
  while (await findBarcodeConflict(generatedBarcode, options)) {
    generatedBarcode = generateBarcode();
  }

  options.reservedBarcodes?.add(generatedBarcode);
  return generatedBarcode;
}

function normalizeImei(value = '') {
  return String(value).replace(/[\s-]+/g, '').trim();
}

function prepareImeiBatch(values = []) {
  const invalidEntries = [];
  const duplicateEntries = [];
  const normalized = [];
  const seen = new Set();

  for (const rawValue of Array.isArray(values) ? values : []) {
    const raw = String(rawValue ?? '').trim();
    if (!raw) continue;

    const cleaned = normalizeImei(raw);
    if (!cleaned) {
      invalidEntries.push(raw);
      continue;
    }

    if (seen.has(cleaned)) {
      duplicateEntries.push(cleaned);
      continue;
    }

    seen.add(cleaned);
    normalized.push(cleaned);
  }

  return { normalized, duplicateEntries, invalidEntries };
}

// GET /api/products
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, barcode } = req.query;
    const where = { isActive: true };
    if (category) where.categoryId = category;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } }
    ];

    if (barcode) {
      const scanCode = String(barcode).trim();
      const normalizedScan = normalizeImei(scanCode);

      const product = await prisma.product.findFirst({
        where: { barcode: scanCode, isActive: true },
        include: { category: true, variants: true }
      });
      if (product) return res.json([product]);

      const variant = await prisma.productVariant.findFirst({
        where: { barcode: scanCode },
        include: { product: { include: { category: true, variants: true } } }
      });
      if (variant?.product?.isActive) return res.json([{ ...variant.product, matchedVariant: variant }]);

      const imeiFilters = [{ imei: scanCode }];
      if (normalizedScan && normalizedScan !== scanCode) imeiFilters.push({ imei: normalizedScan });

      const imeiRecord = await prisma.imeiRecord.findFirst({
        where: { OR: imeiFilters },
        include: {
          sale: { select: { invoiceNumber: true, createdAt: true } },
          product: { include: { category: true, variants: true } }
        }
      });

      if (imeiRecord?.product?.isActive) {
        return res.json([{
          ...imeiRecord.product,
          matchedImei: {
            id: imeiRecord.id,
            imei: imeiRecord.imei,
            status: imeiRecord.status,
            sale: imeiRecord.sale
          }
        }]);
      }

      return res.json([]);
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
    const { categoryId, name, sellingPrice, costPrice, stockQuantity, lowStockThreshold, warrantyMonths, imageUrl, barcode, hasImei, imeiNumbers, variants } = req.body;
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(400).json({ error: 'Category not found' });

    const sku = generateSku(category.name, name);
    const reservedBarcodes = new Set();
    const resolvedBarcode = await ensureUniqueBarcode(barcode, { reservedBarcodes });
    const preparedVariants = Array.isArray(variants) && variants.length > 0
      ? await Promise.all(
          variants.map(async v => ({
            variantName: v.variantName,
            priceOverride: v.priceOverride ? parseFloat(v.priceOverride) : null,
            stockQuantity: parseInt(v.stockQuantity) || 0,
            barcode: await ensureUniqueBarcode(v.barcode, { reservedBarcodes })
          }))
        )
      : [];
    const parsedStockQuantity = parseInt(stockQuantity) || 0;
    const { normalized: cleanedImeis, duplicateEntries, invalidEntries } = prepareImeiBatch(imeiNumbers);
    const existingImeis = cleanedImeis.length > 0
      ? await prisma.imeiRecord.findMany({ where: { imei: { in: cleanedImeis } }, select: { imei: true } })
      : [];
    const existingSet = new Set(existingImeis.map(item => item.imei));
    const newImeis = cleanedImeis.filter(imei => !existingSet.has(imei));

    const product = await prisma.product.create({
      data: {
        categoryId, name, sku, barcode: resolvedBarcode,
        sellingPrice: parseFloat(sellingPrice),
        costPrice: parseFloat(costPrice),
        stockQuantity: hasImei && cleanedImeis.length > 0 ? newImeis.length : parsedStockQuantity,
        lowStockThreshold: parseInt(lowStockThreshold) || 5,
        warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null,
        imageUrl: imageUrl || null,
        hasImei: !!hasImei,
        variants: preparedVariants.length > 0 ? {
          create: preparedVariants
        } : undefined,
        imeiRecords: newImeis.length > 0 ? {
          create: newImeis.map(imei => ({ imei, status: 'IN_STOCK' }))
        } : undefined
      },
      include: { category: true, variants: true, imeiRecords: true }
    });

    res.status(201).json({
      ...product,
      imeiSummary: {
        createdCount: newImeis.length,
        skippedExisting: cleanedImeis.filter(imei => existingSet.has(imei)),
        skippedDuplicateInput: duplicateEntries,
        invalidEntries
      }
    });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// PATCH /api/products/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, sellingPrice, costPrice, stockQuantity, lowStockThreshold, warrantyMonths, imageUrl, barcode, isActive } = req.body;
    const existingProduct = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' });

    const nextBarcode = barcode !== undefined
      ? await ensureUniqueBarcode(barcode, { excludeProductId: req.params.id, reservedBarcodes: new Set() })
      : undefined;

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
        ...(nextBarcode !== undefined && { barcode: nextBarcode }),
        ...(isActive !== undefined && { isActive })
      },
      include: { category: true, variants: true }
    });
    res.json(product);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// DELETE /api/products/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Product deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id/label-data
router.get('/:id/label-data', auth, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true }
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.sellingPrice,
      qty: parseInt(req.query.qty) || 1,
      category: product.category?.name || ''
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/products/:id — Single product by ID (used by global QR scanner)
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, variants: true }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id/qr
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const srMobileStr = `SR-MOBILE|PROD|${product.id}|${product.sku}|${product.barcode}|${product.name}|${product.sellingPrice}`;
    const qrDataUrl = await QRCode.toDataURL(srMobileStr, { width: 300, margin: 2 });
    const barcodeQrDataUrl = await QRCode.toDataURL(product.barcode, { width: 300, margin: 2 });
    res.json({ qrDataUrl, barcodeQrDataUrl, barcode: product.barcode, sku: product.sku, name: product.name });
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

    const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { normalized: cleanedImeis, duplicateEntries, invalidEntries } = prepareImeiBatch(imeiNumbers);
    if (cleanedImeis.length === 0) {
      return res.status(400).json({
        error: 'No valid IMEI numbers provided',
        created: [],
        skippedExisting: [],
        skippedDuplicateInput: duplicateEntries,
        invalidEntries
      });
    }

    const existingRecords = await prisma.imeiRecord.findMany({
      where: { imei: { in: cleanedImeis } },
      select: { imei: true }
    });
    const existingSet = new Set(existingRecords.map(item => item.imei));
    const imeisToCreate = cleanedImeis.filter(imei => !existingSet.has(imei));

    const created = imeisToCreate.length > 0
      ? await prisma.$transaction(
          imeisToCreate.map(imei =>
            prisma.imeiRecord.create({ data: { productId: req.params.id, imei, status: 'IN_STOCK' } })
          )
        )
      : [];

    if (created.length > 0) {
      await prisma.product.update({ where: { id: req.params.id }, data: { stockQuantity: { increment: created.length } } });
    }

    res.status(created.length > 0 ? 201 : 200).json({
      created,
      skippedExisting: cleanedImeis.filter(imei => existingSet.has(imei)),
      skippedDuplicateInput: duplicateEntries,
      invalidEntries,
      message: created.length > 0 ? `${created.length} IMEI number(s) added` : 'No new IMEI numbers were added'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
