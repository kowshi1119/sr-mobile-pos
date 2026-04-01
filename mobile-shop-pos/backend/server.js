require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/health', (req, res) => res.json({ status: 'ok', shop: 'S R Mobile Chunnakam', time: new Date() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/invoice', require('./routes/invoice'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/debt', require('./routes/debt'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 S R Mobile POS Backend running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health\n`);
});
