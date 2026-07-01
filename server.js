const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Password protection: daily password is the current date (YYYYMMDD) ---
const AUTH_SECRET = process.env.AUTH_SECRET || 'project-tracker-auth-secret';
const COOKIE_NAME = 'pt_auth';
const LOGIN_PATH = '/login';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Helper: today's date as YYYYMMDD
function getTodayPassword() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper: signed token derived from today's password
function generateAuthToken() {
  const today = getTodayPassword();
  return crypto.createHmac('sha256', AUTH_SECRET).update(today).digest('hex');
}

// Helper: parse cookies manually (no extra dependency needed)
function parseCookies(req) {
  const cookies = {};
  const raw = req.headers.cookie;
  if (!raw) return cookies;
  raw.split(';').forEach(part => {
    const [key, ...rest] = part.split('=');
    if (!key) return;
    cookies[key.trim()] = decodeURIComponent(rest.join('=').trim());
  });
  return cookies;
}

// Helper: check if request is authenticated for today
function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] === generateAuthToken();
}

// Helper: set the daily auth cookie
function setAuthCookie(res) {
  const token = generateAuthToken();
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; ${secure}Path=/; Max-Age=86400; SameSite=Lax`);
}

// --- Public login routes ---
app.get(LOGIN_PATH, (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post(LOGIN_PATH, (req, res) => {
  const { password } = req.body;
  if (password && password === getTodayPassword()) {
    setAuthCookie(res);
    return res.redirect('/');
  }
  res.redirect(`${LOGIN_PATH}?error=1`);
});

// --- Auth gate for everything else ---
app.use((req, res, next) => {
  if (isAuthenticated(req)) {
    return next();
  }
  res.redirect(LOGIN_PATH);
});

// --- Static files and app routes (protected) ---
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_DATA = [
  {
    id: 1, certName: 'ISO 9001 质量管理体系认证', certDesc: '投标资质要求',
    person: '张明', deadline: '2026-08-15', startDate: '2026-07-01', expectedDate: '2026-08-10',
    budget: 15000, actualPrice: null, vendor: '技术部', status: '进行中',
    remark: '已提交初审材料，等待现场审核',
    updater: '张明', updatedAt: '2026-07-01T14:00:00'
  },
  {
    id: 2, certName: '信息安全管理体系认证 ISO 27001', certDesc: '客户准入要求',
    person: '李芳', deadline: '2026-09-30', startDate: '', expectedDate: '2026-09-20',
    budget: 30000, actualPrice: null, vendor: '质量部', status: '未开始',
    remark: '待确认认证范围后启动',
    updater: '李芳', updatedAt: '2026-07-01T14:00:00'
  },
  {
    id: 3, certName: '高新技术企业认定', certDesc: '税收优惠 + 品牌资质',
    person: '王强', deadline: '2026-06-30', startDate: '2026-05-01', expectedDate: '2026-06-25',
    budget: 80000, actualPrice: 76000, vendor: '行政部', status: '已完成',
    remark: '证书已下发，有效期三年',
    updater: '王强', updatedAt: '2026-06-28T10:30:00'
  }
];

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Read data error:', e.message);
  }
  const initial = { items: DEFAULT_DATA };
  writeData(initial);
  return initial;
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET all items
app.get('/api/items', (req, res) => {
  const data = readData();
  res.json(data.items);
});

// POST new item
app.post('/api/items', (req, res) => {
  const data = readData();
  const newItem = { ...req.body, id: Date.now() };
  if (!newItem.updatedAt) newItem.updatedAt = new Date().toISOString();
  data.items.push(newItem);
  writeData(data);
  res.json(newItem);
});

// PUT update item
app.put('/api/items/:id', (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const idx = data.items.findIndex(i => i.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: '项目不存在' });
  }
  const updated = { ...data.items[idx], ...req.body, id };
  if (!updated.updatedAt) updated.updatedAt = new Date().toISOString();
  data.items[idx] = updated;
  writeData(data);
  res.json(updated);
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  data.items = data.items.filter(i => i.id !== id);
  writeData(data);
  res.json({ success: true });
});

// BULK IMPORT - restore data from backup
app.post('/api/items/bulk', (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected an array of items' });
  }
  const data = readData();
  // Replace all items with imported data
  data.items = incoming.map(item => ({
    ...item,
    id: item.id || Date.now() + Math.random()
  }));
  writeData(data);
  res.json({ success: true, count: data.items.length });
});

// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log('Share this URL with your team for real-time collaboration!');
});
