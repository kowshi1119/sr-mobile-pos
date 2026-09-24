const { sendError, badRequest } = require('../utils/errors');
const { requirePermission } = require('../middleware/auth');
const permissions = require('../utils/permissions');
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const QRCode = require('qrcode');

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
  const rand = require('crypto').randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  const variant = variantCode ? `-${variantCode.substring(0, 3).toUpperCase()}` : '';
  return `${catPrefix}-${prodCode}-${rand}${variant}`;
}

// Generate barcode (unique numeric)
// Staff without products.viewCost never receive cost prices.
function hideCost(req, data) {
  if (permissions.has(req.user, 'products.viewCost')) return data;
  const strip = p => { if (!p || typeof p !== 'object') return p; const { costPrice, ...rest } = p; return rest; };
  return Array.isArray(data) ? data.map(strip) : strip(data);
}

// Form values arrive as strings; blank optional amounts become their default, invalid ones are rejected.
function readAmount(value, label, { required = false, fallback = 0 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw badRequest(`${label} is required.`);
    return fallback;
  }
  const text = String(value).replace(/,/g, '').trim();
  const n = Number(text);
  if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(n) || n > 99999999.99)
    throw badRequest(`${label} must be a number of 0 or more with at most two decimal places.`);
  return n;
}
function readCount(value, label, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw badRequest(`${label} must be a whole number of 0 or more.`);
  return n;
}

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
      throw badRequest(`Barcode "${requestedBarcode}" ${conflict}`);
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
router.get('/', requirePermission('products.view', 'sales.create', 'bundles.manage', 'suppliers.manage'), async (req, res) => {
  try {
    const { category, search, barcode } = req.query;
    const where = { isActive: true };
    if (category) where.categoryId = category;
    if (search) where.OR = [
      { name: { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) } },
      { sku: { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) } },
      { barcode: { contains: search, ...(process.env.DESKTOP_MODE === '1' ? {} : { mode: 'insensitive' }) } }
    ];

    if (barcode) {
      const scanCode = String(barcode).trim();
      const normalizedScan = normalizeImei(scanCode);

      const product = await prisma.product.findFirst({
        where: { barcode: scanCode, isActive: true },
        include: { category: true, variants: true }
      });
      if (product) return res.json(hideCost(req, [product]));

      const variant = await prisma.productVariant.findFirst({
        where: { barcode: scanCode },
        include: { product: { include: { category: true, variants: true } } }
      });
      if (variant?.product?.isActive) return res.json(hideCost(req, [{ ...variant.product, matchedVariant: variant }]));

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
        return res.json(hideCost(req, [{
          ...imeiRecord.product,
          matchedImei: {
            id: imeiRecord.id,
            imei: imeiRecord.imei,
            status: imeiRecord.status,
            sale: imeiRecord.sale
          }
        }]));
      }

      return res.json([]);
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true, variants: true, _count: { select: { imeiRecords: { where: { status: 'IN_STOCK' } } } } },
      orderBy: { name: 'asc' }
    });
    res.json(hideCost(req, products));
  } catch (err) { sendError(res, err); }
});

// POST /api/products
router.post('/', requirePermission('products.create'), async (req, res) => {
  try {
    const { categoryId, name, sellingPrice, costPrice, stockQuantity, lowStockThreshold, warrantyMonths, imageUrl, barcode, hasImei, imeiNumbers, variants } = req.body;
    const productName = typeof name === 'string' ? name.trim() : '';
    if (!productName) throw badRequest('Product name is required.');
    if (!categoryId) throw badRequest('Choose a category. Create one first under Categories if the list is empty.');
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) throw badRequest('The selected category was not found. Choose another category.');
    const parsedSellingPrice = readAmount(sellingPrice, 'Selling price', { required: true });
    const parsedCostPrice = readAmount(costPrice, 'Cost price');
    const parsedStockQuantity = readCount(stockQuantity, 'Stock quantity');
    const parsedThreshold = readCount(lowStockThreshold, 'Low stock alert', 5);

    const sku = generateSku(category.name, productName);
    const reservedBarcodes = new Set();
    const resolvedBarcode = await ensureUniqueBarcode(barcode, { reservedBarcodes });
    const preparedVariants = Array.isArray(variants) && variants.length > 0
      ? await Promise.all(
          variants.map(async v => ({
            variantName: String(v.variantName || '').trim() || (() => { throw badRequest('Each variant needs a name.'); })(),
            priceOverride: v.priceOverride ? readAmount(v.priceOverride, 'Variant price') : null,
            stockQuantity: readCount(v.stockQuantity, 'Variant stock'),
            barcode: await ensureUniqueBarcode(v.barcode, { reservedBarcodes })
          }))
        )
      : [];
    const { normalized: cleanedImeis, duplicateEntries, invalidEntries } = prepareImeiBatch(imeiNumbers);
    const existingImeis = cleanedImeis.length > 0
      ? await prisma.imeiRecord.findMany({ where: { imei: { in: cleanedImeis } }, select: { imei: true } })
      : [];
    const existingSet = new Set(existingImeis.map(item => item.imei));
    const newImeis = cleanedImeis.filter(imei => !existingSet.has(imei));

    const product = await prisma.product.create({
      data: {
        categoryId, name: productName, sku, barcode: resolvedBarcode,
        sellingPrice: parsedSellingPrice,
        costPrice: parsedCostPrice,
        stockQuantity: hasImei && cleanedImeis.length > 0 ? newImeis.length : parsedStockQuantity,
        lowStockThreshold: parsedThreshold,
        warrantyMonths: warrantyMonths ? readCount(warrantyMonths, 'Warranty months') : null,
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
      ...hideCost(req, product),
      imeiSummary: {
        createdCount: newImeis.length,
        skippedExisting: cleanedImeis.filter(imei => existingSet.has(imei)),
        skippedDuplicateInput: duplicateEntries,
        invalidEntries
      }
    });
  } catch (err) { sendError(res, err); }
});

// PATCH /api/products/:id
router.patch('/:id', requirePermission('products.edit', 'products.editPrice', 'products.editStock'), async (req, res) => {
  try {
    const { name, sellingPrice, costPrice, stockQuantity, lowStockThreshold, warrantyMonths, imageUrl, barcode, isActive } = req.body;
    const existingProduct = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' });
    // The edit form sends every field, so only values that actually change need their permission.
    const canSeeCost = permissions.has(req.user, 'products.viewCost');
    const differs = (value, current) => value !== undefined && String(value).trim() !== '' && Number(String(value).replace(/,/g, '')) !== Number(current);
    const priceChange = differs(sellingPrice, existingProduct.sellingPrice) || (canSeeCost && differs(costPrice, existingProduct.costPrice));
    const stockChange = differs(stockQuantity, existingProduct.stockQuantity);
    const detailChange = (name !== undefined && String(name).trim() !== existingProduct.name) || differs(lowStockThreshold, existingProduct.lowStockThreshold)
      || (warrantyMonths !== undefined && (warrantyMonths ? Number(warrantyMonths) : null) !== existingProduct.warrantyMonths)
      || (imageUrl !== undefined && (imageUrl || null) !== existingProduct.imageUrl) || (barcode !== undefined && normalizeBarcode(barcode) !== existingProduct.barcode)
      || (isActive !== undefined && !!isActive !== existingProduct.isActive);
    const missing = [[priceChange, 'products.editPrice', 'change prices'], [stockChange, 'products.editStock', 'change stock'], [detailChange, 'products.edit', 'edit product details']]
      .find(([changed, key]) => changed && !permissions.has(req.user, key));
    if (missing) return res.status(403).json({ error: `You don't have permission to ${missing[2]}.` });

    const nextBarcode = barcode !== undefined
      ? await ensureUniqueBarcode(barcode, { excludeProductId: req.params.id, reservedBarcodes: new Set() })
      : undefined;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && String(name).trim() && { name: String(name).trim() }),
        ...(sellingPrice !== undefined && { sellingPrice: readAmount(sellingPrice, 'Selling price', { required: true }) }),
        ...(costPrice !== undefined && canSeeCost && { costPrice: readAmount(costPrice, 'Cost price') }),
        ...(stockQuantity !== undefined && { stockQuantity: readCount(stockQuantity, 'Stock quantity') }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: readCount(lowStockThreshold, 'Low stock alert', 5) }),
        ...(warrantyMonths !== undefined && { warrantyMonths: warrantyMonths ? readCount(warrantyMonths, 'Warranty months') : null }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(nextBarcode !== undefined && { barcode: nextBarcode }),
        ...(isActive !== undefined && { isActive })
      },
      include: { category: true, variants: true }
    });
    res.json(hideCost(req, product));
  } catch (err) { sendError(res, err); }
});

// DELETE /api/products/:id
router.delete('/:id', requirePermission('products.delete'), async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Product deactivated' });
  } catch (err) { sendError(res, err); }
});

// GET /api/products/:id/label-data
router.get('/:id/label-data', requirePermission('products.view'), async (req, res) => {
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
  } catch (e) { sendError(res, e); }
});

// GET /api/products/:id — Single product by ID (used by global QR scanner)
router.get('/:id', requirePermission('products.view', 'sales.create'), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, variants: true }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(hideCost(req, product));
  } catch (err) { sendError(res, err); }
});

// GET /api/products/:id/qr
router.get('/:id/qr', requirePermission('products.view'), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const srMobileStr = `SR-MOBILE|PROD|${product.id}|${product.sku}|${product.barcode}|${product.name}|${product.sellingPrice}`;
    const qrDataUrl = await QRCode.toDataURL(srMobileStr, { width: 300, margin: 2 });
    const barcodeQrDataUrl = await QRCode.toDataURL(product.barcode, { width: 300, margin: 2 });
    res.json({ qrDataUrl, barcodeQrDataUrl, barcode: product.barcode, sku: product.sku, name: product.name });
  } catch (err) { sendError(res, err); }
});

// POST /api/products/upload-image
router.post('/upload-image', requirePermission('products.create', 'products.edit'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if(process.env.DESKTOP_MODE==='1') {
      const b=req.file.buffer;
      const ext=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b[0]===255&&b[1]===216&&b[2]===255?'jpg':b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'?'webp':null;
      if(!ext)return res.status(400).json({error:'Choose a PNG, JPEG or WebP image'});
      const name=require('crypto').randomUUID()+'.'+ext;
      require('fs').writeFileSync(require('path').join(req.app.locals.desktop.paths.uploads,name),b,{flag:'wx'});
      return res.json({imageUrl:'/uploads/'+name});
    }
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'sr-mobile-pos/products' });
    res.json({ imageUrl: result.secure_url });
  } catch (err) { sendError(res, err); }
});

// GET /api/products/:id/imei
router.get('/:id/imei', requirePermission('products.view', 'sales.create'), async (req, res) => {
  try {
    const imeis = await prisma.imeiRecord.findMany({
      where: { productId: req.params.id },
      include: { sale: { select: { invoiceNumber: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(imeis);
  } catch (err) { sendError(res, err); }
});

// POST /api/products/:id/imei
router.post('/:id/imei', requirePermission('products.editStock'), async (req, res) => {
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
  } catch (err) { sendError(res, err); }
});

module.exports = router;
