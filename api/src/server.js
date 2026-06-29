import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { prisma } from './utils/db.js';
import { generateReceiptCode, generateMagicToken, computeFileHash } from './utils/crypto.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Proxy configuration
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
} else if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

// CORS Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json());

// In-memory set for admin session tokens (lost on restart)
const activeAdminTokens = new Set();

// Rate limiters
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: rateLimitEnabled ? 100 : 10000,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const orderSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: rateLimitEnabled ? 5 : 1000,
  message: { error: 'Too many order submissions. Please try again later.' }
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: rateLimitEnabled ? 10 : 1000,
  message: { error: 'Too many login attempts.' }
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: rateLimitEnabled ? 20 : 10000,
  message: { error: 'Too many download requests. Please wait a while.' }
});

app.use(globalLimiter);

// Multer storage setup for payment proofs
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `proof-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limit
  }
});

// Admin Authentication Middleware
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  if (!activeAdminTokens.has(token)) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
  next();
}

// --- PUBLIC ROUTES ---

// Expose system settings and product catalog
app.get('/api/settings/book-status', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const orderOpen = process.env.ORDER_OPEN === 'true';
    const products = await prisma.product.findMany();
    
    res.json({
      orderOpen,
      bookPublished: settings?.bookPublished || false,
      products
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve system settings.' });
  }
});

// Public total orders counter
app.get('/api/orders/stats/count', async (req, res) => {
  try {
    const count = await prisma.order.count({
      where: {
        status: 'verified'
      }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// Submit Order Route
app.post('/api/orders', orderSubmitLimiter, upload.single('paymentProof'), async (req, res) => {
  // Check global kill-switch
  if (process.env.ORDER_OPEN !== 'true') {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Ordering is currently closed.' });
  }

  const { name, phone, email, note, productId, contact_time, 'cf-turnstile-response': turnstileResponse } = req.body;

  // 1. Honeypot check
  if (contact_time && contact_time.trim() !== '') {
    console.log('Honeypot triggered! Returning fake response.');
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(201).json({
      success: true,
      receiptCode: 'FAKE-RCDE',
      magicToken: 'fake-magic-token-for-bots',
      message: 'Order received (honeypot)'
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Payment proof image is required.' });
  }

  const filePath = req.file.path;

  try {
    // 2. Validate input fields
    if (!name || name.trim() === '' || !phone || phone.trim() === '') {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Name and phone number are required.' });
    }

    const cleanProductId = productId || 'aether';
    const productExists = await prisma.product.findUnique({
      where: { id: cleanProductId }
    });

    if (!productExists) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Invalid product selected.' });
    }

    // 3. Turnstile validation
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret.trim() !== '') {
      if (!turnstileResponse) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'CAPTCHA response is required.' });
      }
      
      const ip = req.ip;
      const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
      
      const verificationResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileResponse,
          remoteip: ip
        })
      });
      const verificationResult = await verificationResponse.json();
      
      if (!verificationResult.success) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'CAPTCHA validation failed. Please try again.' });
      }
    }

    // 4. Duplicate Image check
    const fileHash = await computeFileHash(filePath);
    const existingOrder = await prisma.order.findUnique({
      where: { paymentProofHash: fileHash }
    });

    if (existingOrder) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'This payment proof has already been uploaded for another order.' });
    }

    // 5. Generate Receipt Code and Magic Token
    let receiptCode = generateReceiptCode();
    let codeExists = await prisma.order.findUnique({ where: { receiptCode } });
    while (codeExists) {
      receiptCode = generateReceiptCode();
      codeExists = await prisma.order.findUnique({ where: { receiptCode } });
    }

    let magicToken = generateMagicToken();
    let tokenExists = await prisma.order.findUnique({ where: { magicToken } });
    while (tokenExists) {
      magicToken = generateMagicToken();
      tokenExists = await prisma.order.findUnique({ where: { magicToken } });
    }

    // Save to Database
    const paymentProofUrl = `/uploads/${req.file.filename}`;
    const newOrder = await prisma.order.create({
      data: {
        receiptCode,
        magicToken,
        productId: cleanProductId,
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        note: note ? note.trim() : null,
        paymentProofUrl,
        paymentProofHash: fileHash,
        status: 'pending'
      }
    });

    res.status(201).json({
      success: true,
      receiptCode: newOrder.receiptCode,
      magicToken: newOrder.magicToken
    });

  } catch (err) {
    console.error('Error creating order:', err);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ error: 'An unexpected database error occurred.' });
  }
});

// View order status details by Receipt Code
app.get('/api/orders/:receiptCode', async (req, res) => {
  const { receiptCode } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { receiptCode },
      include: { product: true }
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const { paymentProofHash, ...publicOrder } = order;
    res.json(publicOrder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
});

// View order status details by Magic Token
app.get('/api/orders/magic/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { magicToken: token },
      include: { product: true }
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const { paymentProofHash, ...publicOrder } = order;
    res.json(publicOrder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
});

// Helper for download processing
async function handleDownload(req, res, order, format) {
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // 1. Verify eligibility
  if (order.status !== 'verified') {
    return res.status(403).json({ error: 'This order payment proof has not been verified yet.' });
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings || !settings.bookPublished) {
    return res.status(403).json({ error: 'The book download is not open yet.' });
  }

  if (format !== 'pdf' && format !== 'epub') {
    return res.status(400).json({ error: 'Invalid download format.' });
  }

  // Resolve locator and name based on order's Product relation
  const locator = format === 'pdf' ? order.product.pdfLocator : order.product.epubLocator;
  const originalFilename = format === 'pdf' ? order.product.pdfFilename : order.product.epubFilename;

  if (!locator) {
    return res.status(404).json({ error: 'The requested format is not configured for this product.' });
  }

  // 2. Increment download counter
  await prisma.order.update({
    where: { id: order.id },
    data: {
      downloadCountPdf: format === 'pdf' ? { increment: 1 } : undefined,
      downloadCountEpub: format === 'epub' ? { increment: 1 } : undefined
    }
  });

  // 3. Resolve local file
  const bookFilesDir = process.env.BOOK_FILES_DIR || path.join(__dirname, '..', 'books');
  const safeLocator = path.normalize(locator).replace(/^(\.\.(\/|\\|$))+/, '');
  const localFilePath = path.join(bookFilesDir, safeLocator);

  if (fs.existsSync(localFilePath)) {
    return res.download(localFilePath, originalFilename);
  }

  return res.status(404).json({ error: 'The physical book file could not be found on the server.' });
}

// Download book by Receipt Code
app.get('/api/orders/:receiptCode/download/:format', downloadLimiter, async (req, res) => {
  const { receiptCode, format } = req.params;
  try {
    const order = await prisma.order.findUnique({ 
      where: { receiptCode },
      include: { product: true }
    });
    await handleDownload(req, res, order, format);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'An error occurred during download preparation.' });
  }
});

// Download book by Magic Token
app.get('/api/orders/magic/:token/download/:format', downloadLimiter, async (req, res) => {
  const { token, format } = req.params;
  try {
    const order = await prisma.order.findUnique({ 
      where: { magicToken: token },
      include: { product: true }
    });
    await handleDownload(req, res, order, format);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'An error occurred during download preparation.' });
  }
});

app.use('/uploads', express.static(uploadsDir));


// --- ADMIN ROUTES ---

// Admin Login
app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'supersecretpassword';

  if (username === adminUser && password === adminPass) {
    const token = generateMagicToken();
    activeAdminTokens.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials.' });
  }
});

// Admin Logout
app.post('/api/admin/logout', adminAuth, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  activeAdminTokens.delete(token);
  res.json({ success: true });
});

// List Admin Orders (including products)
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  const { q, status, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  try {
    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (q && q.trim() !== '') {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { receiptCode: { contains: q } },
        { email: { contains: q } }
      ];
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

// Get unread orders count
app.get('/api/admin/orders/unread', adminAuth, async (req, res) => {
  try {
    const count = await prisma.order.count({
      where: { isRead: false }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count unread orders.' });
  }
});

// Update Order status
app.patch('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { status, isRead } = req.body;

  try {
    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: {
        status,
        isRead: isRead !== undefined ? isRead : undefined
      },
      include: { product: true }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order.' });
  }
});

// Delete Order
app.delete('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await prisma.order.findUnique({ where: { id: Number(id) } });
    if (order && order.paymentProofUrl) {
      const filename = path.basename(order.paymentProofUrl);
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await prisma.order.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order.' });
  }
});

// Get system settings
app.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const products = await prisma.product.findMany();
    res.json({ settings, products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// Update global settings
app.patch('/api/admin/settings', adminAuth, async (req, res) => {
  const { bookPublished } = req.body;
  try {
    const updated = await prisma.settings.update({
      where: { id: 1 },
      data: { bookPublished }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Update a specific product configuration
app.patch('/api/admin/products/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { pdfLocator, epubLocator, pdfFilename, epubFilename } = req.body;

  const validateLocator = (loc) => {
    if (!loc) return true;
    const hasTraversal = loc.includes('..') || loc.includes('/') || loc.includes('\\');
    return !hasTraversal;
  };

  if (pdfLocator && !validateLocator(pdfLocator)) {
    return res.status(400).json({ error: 'Invalid PDF locator. File must not contain traversal paths.' });
  }

  if (epubLocator && !validateLocator(epubLocator)) {
    return res.status(400).json({ error: 'Invalid EPUB locator. File must not contain traversal paths.' });
  }

  try {
    const updated = await prisma.product.update({
      where: { id },
      data: {
        pdfLocator: pdfLocator ? pdfLocator.trim() : null,
        epubLocator: epubLocator ? epubLocator.trim() : null,
        pdfFilename: pdfFilename ? pdfFilename.trim() : 'book.pdf',
        epubFilename: epubFilename ? epubFilename.trim() : 'book.epub'
      }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product details.' });
  }
});

// Global Multer Error Handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Upload failed: Image proof must be under 5MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`Book Selling Server running on port ${PORT}`);
});
