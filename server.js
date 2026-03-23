require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Supabase setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple session store (in-memory)
const sessions = new Map();

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function authMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ---- API Routes ----

// Admin login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const { data: admin, error } = await supabase
    .from('admin')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = generateSessionId();
  sessions.set(sessionId, { username, createdAt: Date.now() });
  res.json({ sessionId });
});

// Admin logout
app.post('/api/logout', authMiddleware, (req, res) => {
  const sessionId = req.headers['x-session-id'];
  sessions.delete(sessionId);
  res.json({ message: 'Logged out' });
});

// Change admin password
app.post('/api/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new password required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const { data: admin, error } = await supabase
    .from('admin')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !admin || !bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  await supabase.from('admin').update({ password: hashedPassword }).eq('id', 1);
  res.json({ message: 'Password changed successfully' });
});

// Add warranty (admin only)
app.post('/api/warranties', authMiddleware, async (req, res) => {
  const { customer_name, customer_phone, customer_address, product_name, product_category,
    product_brand, product_model, serial_number, invoice_number, purchase_date, warranty_months, notes } = req.body;

  if (!customer_name || !customer_phone || !product_name || !invoice_number || !purchase_date || !warranty_months) {
    return res.status(400).json({ error: 'Required fields: customer_name, customer_phone, product_name, invoice_number, purchase_date, warranty_months' });
  }

  // Calculate warranty end date
  const purchaseDate = new Date(purchase_date);
  const endDate = new Date(purchaseDate);
  endDate.setMonth(endDate.getMonth() + parseInt(warranty_months));
  const warranty_end_date = endDate.toISOString().split('T')[0];

  const { data, error } = await supabase.from('warranties').insert({
    customer_name, customer_phone, customer_address: customer_address || '',
    product_name, product_category: product_category || '',
    product_brand: product_brand || '', product_model: product_model || '',
    serial_number: serial_number || '', invoice_number,
    purchase_date, warranty_months: parseInt(warranty_months),
    warranty_end_date, notes: notes || ''
  }).select('id').single();

  if (error) {
    return res.status(500).json({ error: 'Failed to add warranty' });
  }

  res.json({ id: data.id, message: 'Warranty added successfully', phone: customer_phone });
});

// Update warranty (admin only)
app.put('/api/warranties/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { customer_name, customer_phone, customer_address, product_name, product_category,
    product_brand, product_model, serial_number, invoice_number, purchase_date, warranty_months, notes } = req.body;

  // Recalculate warranty end date
  const purchaseDate = new Date(purchase_date);
  const endDate = new Date(purchaseDate);
  endDate.setMonth(endDate.getMonth() + parseInt(warranty_months));
  const warranty_end_date = endDate.toISOString().split('T')[0];

  const { error } = await supabase.from('warranties').update({
    customer_name, customer_phone, customer_address: customer_address || '',
    product_name, product_category: product_category || '',
    product_brand: product_brand || '', product_model: product_model || '',
    serial_number: serial_number || '', invoice_number,
    purchase_date, warranty_months: parseInt(warranty_months),
    warranty_end_date, notes: notes || ''
  }).eq('id', id);

  if (error) {
    return res.status(500).json({ error: 'Failed to update warranty' });
  }

  res.json({ message: 'Warranty updated successfully' });
});

// Delete warranty (admin only)
app.delete('/api/warranties/:id', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('warranties').delete().eq('id', req.params.id);
  if (error) {
    return res.status(500).json({ error: 'Failed to delete warranty' });
  }
  res.json({ message: 'Warranty deleted successfully' });
});

// Get all warranties (admin only)
app.get('/api/warranties', authMiddleware, async (req, res) => {
  const { search, status } = req.query;

  let query = supabase.from('warranties').select('*');

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,invoice_number.ilike.%${search}%,product_name.ilike.%${search}%`
    );
  }

  const today = new Date().toISOString().split('T')[0];
  if (status === 'active') {
    query = query.gte('warranty_end_date', today);
  } else if (status === 'expired') {
    query = query.lt('warranty_end_date', today);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch warranties' });
  }
  res.json(data);
});

// Public: Search warranty by phone or invoice
app.get('/api/warranty-check', async (req, res) => {
  const { phone, invoice } = req.query;

  if (!phone && !invoice) {
    return res.status(400).json({ error: 'Please provide phone number or invoice number' });
  }

  const columns = 'customer_name, customer_address, product_name, product_category, product_brand, product_model, serial_number, invoice_number, purchase_date, warranty_months, warranty_end_date';

  let query;
  if (phone) {
    query = supabase.from('warranties').select(columns).eq('customer_phone', phone).order('purchase_date', { ascending: false });
  } else {
    query = supabase.from('warranties').select(columns).eq('invoice_number', invoice).order('purchase_date', { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: 'Failed to check warranty' });
  }
  res.json(data);
});

// Serve index.html for all non-API routes
app.get('/{*splat}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Cleanup expired sessions every hour
setInterval(() => {
  const oneDay = 24 * 60 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (Date.now() - session.createdAt > oneDay) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Goyal Enterprises Warranty Tracker running at http://localhost:${PORT}`);
  console.log(`📋 Admin login: username "admin", password "goyal@1999"`);
  console.log(`🗄️  Database: Supabase (${process.env.SUPABASE_URL})`);
});
