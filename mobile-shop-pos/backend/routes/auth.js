const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHashedPassword = process.env.ADMIN_PASSWORD;

    if (email !== adminEmail) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, adminHashedPassword);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ email: adminEmail, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout  (client-side only — just confirms)
router.post('/logout', (req, res) => res.json({ message: 'Logged out' }));

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ email: req.admin.email, role: req.admin.role });
});

module.exports = router;
