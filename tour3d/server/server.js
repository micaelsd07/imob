// API do Fabelle Tour 3D: login, imóveis, cômodos (fotos), conexões e tour público.
// Banco de dados: SQLite local (arquivo data/tour3d.db), sem serviço externo.
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3333);
const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Banco ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'tour3d.db'));
db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  agency TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT, city TEXT,
  price REAL, bedrooms INTEGER, bathrooms INTEGER, area REAL,
  description TEXT,
  published INTEGER DEFAULT 0,
  start_room_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  image TEXT NOT NULL,
  width INTEGER, height INTEGER,
  initial_yaw REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  target_room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  yaw REAL NOT NULL, pitch REAL NOT NULL,
  label TEXT
);
`);

// Migração: papel do usuário (admin pode gerenciar a equipe)
if (!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'role'").get())
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'corretor'");

// Usuário inicial (altere por variáveis de ambiente)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@fabelle.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fabelle123';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL)) {
  db.prepare('INSERT INTO users (name, email, password_hash, agency, role) VALUES (?,?,?,?,?)')
    .run('Administrador', ADMIN_EMAIL, bcrypt.hashSync(ADMIN_PASSWORD, 10), 'Fabelle Imóveis', 'admin');
  console.log(`Usuário criado: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}
// Garante que exista ao menos um administrador
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get())
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(ADMIN_EMAIL);

// ---------- Helpers ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, crypto.randomUUID() + (path.extname(file.originalname).toLowerCase() || '.jpg')),
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'imovel';

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

function ownProperty(req, res, id) {
  const p = db.prepare('SELECT * FROM properties WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!p) res.status(404).json({ error: 'Imóvel não encontrado.' });
  return p;
}

function ownRoom(req, res, id) {
  const r = db.prepare(`SELECT r.* FROM rooms r JOIN properties p ON p.id = r.property_id
                        WHERE r.id = ? AND p.user_id = ?`).get(id, req.user.id);
  if (!r) res.status(404).json({ error: 'Cômodo não encontrado.' });
  return r;
}

function removeFile(name) {
  if (name) fs.rm(path.join(UPLOAD_DIR, path.basename(name)), () => {});
}

function fullProperty(p) {
  const rooms = db.prepare('SELECT * FROM rooms WHERE property_id = ? ORDER BY sort, id').all(p.id);
  const hs = db.prepare(`SELECT h.* FROM hotspots h JOIN rooms r ON r.id = h.room_id WHERE r.property_id = ?`).all(p.id);
  return {
    ...p,
    published: !!p.published,
    rooms: rooms.map((r) => ({
      ...r,
      url: `/uploads/${r.image}`,
      hotspots: hs.filter((h) => h.room_id === r.id),
    })),
  };
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  const user = { id: u.id, name: u.name, email: u.email, agency: u.agency, role: u.role };
  res.json({ token: jwt.sign(user, JWT_SECRET, { expiresIn: '7d' }), user });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.put('/api/auth/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!u || !bcrypt.compareSync(String(current || ''), u.password_hash))
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  if (String(next || '').length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(next), 10), u.id);
  res.json({ ok: true });
});

// ---------- Equipe (somente admin) ----------
function adminOnly(req, res, next) {
  const u = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (u?.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores.' });
  next();
}
const listUsers = () => db.prepare(`SELECT u.id, u.name, u.email, u.agency, u.role, u.created_at,
  (SELECT COUNT(*) FROM properties p WHERE p.user_id = u.id) AS property_count FROM users u ORDER BY u.id`).all();

app.get('/api/users', auth, adminOnly, (_req, res) => res.json(listUsers()));

app.post('/api/users', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!b.name?.trim() || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Informe nome e e-mail válidos.' });
  if (String(b.password || '').length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
  db.prepare('INSERT INTO users (name, email, password_hash, agency, role) VALUES (?,?,?,?,?)')
    .run(b.name.trim(), email, bcrypt.hashSync(String(b.password), 10), b.agency || req.user.agency || null,
      b.role === 'admin' ? 'admin' : 'corretor');
  res.status(201).json(listUsers());
});

app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Você não pode excluir a própria conta.' });
  db.prepare('SELECT r.image FROM rooms r JOIN properties p ON p.id = r.property_id WHERE p.user_id = ?').all(id)
    .forEach((r) => removeFile(r.image));
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json(listUsers());
});

// ---------- Imóveis ----------
app.get('/api/properties', auth, (req, res) => {
  const list = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM rooms r WHERE r.property_id = p.id) AS room_count,
      (SELECT image FROM rooms r WHERE r.property_id = p.id ORDER BY sort, id LIMIT 1) AS cover
    FROM properties p WHERE user_id = ? ORDER BY created_at DESC, id DESC`).all(req.user.id);
  res.json(list.map((p) => ({ ...p, published: !!p.published, cover: p.cover ? `/uploads/${p.cover}` : null })));
});

app.post('/api/properties', auth, (req, res) => {
  const b = req.body || {};
  if (!b.title?.trim()) return res.status(400).json({ error: 'Informe o título do imóvel.' });
  const slug = `${slugify(b.title)}-${crypto.randomBytes(3).toString('hex')}`;
  const r = db.prepare(`INSERT INTO properties (user_id,title,slug,address,city,price,bedrooms,bathrooms,area,description)
                        VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, b.title.trim(), slug, b.address || null, b.city || null, num(b.price),
      num(b.bedrooms), num(b.bathrooms), num(b.area), b.description || null);
  res.status(201).json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(r.lastInsertRowid)));
});

app.get('/api/properties/:id', auth, (req, res) => {
  const p = ownProperty(req, res, req.params.id);
  if (p) res.json(fullProperty(p));
});

app.put('/api/properties/:id', auth, (req, res) => {
  const p = ownProperty(req, res, req.params.id);
  if (!p) return;
  const b = { ...p, ...req.body };
  db.prepare(`UPDATE properties SET title=?,address=?,city=?,price=?,bedrooms=?,bathrooms=?,area=?,description=?,
              published=?,start_room_id=? WHERE id=?`)
    .run(b.title, b.address, b.city, num(b.price), num(b.bedrooms), num(b.bathrooms), num(b.area),
      b.description, b.published ? 1 : 0, num(b.start_room_id), p.id);
  res.json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(p.id)));
});

app.delete('/api/properties/:id', auth, (req, res) => {
  const p = ownProperty(req, res, req.params.id);
  if (!p) return;
  db.prepare('SELECT image FROM rooms WHERE property_id = ?').all(p.id).forEach((r) => removeFile(r.image));
  db.prepare('DELETE FROM properties WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

// ---------- Cômodos ----------
app.post('/api/properties/:id/rooms', auth, upload.single('image'), (req, res) => {
  const p = ownProperty(req, res, req.params.id);
  if (!p) return removeFile(req.file?.filename);
  if (!req.file) return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WEBP.' });
  const sort = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM rooms WHERE property_id = ?').get(p.id).n;
  const r = db.prepare('INSERT INTO rooms (property_id,name,type,sort,image,width,height) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, req.body.name || 'Cômodo', req.body.type || 'outro', sort, req.file.filename,
      num(req.body.width), num(req.body.height));
  if (!p.start_room_id) db.prepare('UPDATE properties SET start_room_id = ? WHERE id = ?').run(r.lastInsertRowid, p.id);
  res.status(201).json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(p.id)));
});

app.put('/api/rooms/:id', auth, upload.single('image'), (req, res) => {
  const room = ownRoom(req, res, req.params.id);
  if (!room) return removeFile(req.file?.filename);
  const b = req.body || {};
  let image = room.image, width = room.width, height = room.height;
  if (req.file) {
    removeFile(room.image);
    image = req.file.filename;
    width = num(b.width);
    height = num(b.height);
  }
  db.prepare('UPDATE rooms SET name=?, type=?, initial_yaw=?, image=?, width=?, height=? WHERE id=?')
    .run(b.name ?? room.name, b.type ?? room.type, num(b.initial_yaw) ?? room.initial_yaw, image, width, height, room.id);
  res.json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(room.property_id)));
});

app.delete('/api/rooms/:id', auth, (req, res) => {
  const room = ownRoom(req, res, req.params.id);
  if (!room) return;
  removeFile(room.image);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
  const p = db.prepare('SELECT * FROM properties WHERE id = ?').get(room.property_id);
  if (p.start_room_id === room.id) {
    const first = db.prepare('SELECT id FROM rooms WHERE property_id = ? ORDER BY sort, id LIMIT 1').get(p.id);
    db.prepare('UPDATE properties SET start_room_id = ? WHERE id = ?').run(first?.id ?? null, p.id);
  }
  res.json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(p.id)));
});

app.post('/api/properties/:id/reorder', auth, (req, res) => {
  const p = ownProperty(req, res, req.params.id);
  if (!p) return;
  const stmt = db.prepare('UPDATE rooms SET sort = ? WHERE id = ? AND property_id = ?');
  (req.body.ids || []).forEach((id, i) => stmt.run(i, id, p.id));
  res.json(fullProperty(p));
});

// ---------- Conexões entre cômodos (pontos de passagem) ----------
app.post('/api/rooms/:id/hotspots', auth, (req, res) => {
  const room = ownRoom(req, res, req.params.id);
  if (!room) return;
  const { target_room_id, yaw, pitch, label } = req.body || {};
  const target = db.prepare('SELECT id FROM rooms WHERE id = ? AND property_id = ?').get(target_room_id, room.property_id);
  if (!target || target.id === room.id) return res.status(400).json({ error: 'Escolha outro cômodo deste imóvel.' });
  db.prepare('INSERT INTO hotspots (room_id,target_room_id,yaw,pitch,label) VALUES (?,?,?,?,?)')
    .run(room.id, target.id, Number(yaw) || 0, Number(pitch) || 0, label || null);
  res.json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(room.property_id)));
});

app.delete('/api/hotspots/:id', auth, (req, res) => {
  const h = db.prepare(`SELECT h.*, r.property_id FROM hotspots h JOIN rooms r ON r.id = h.room_id
                        JOIN properties p ON p.id = r.property_id WHERE h.id = ? AND p.user_id = ?`)
    .get(req.params.id, req.user.id);
  if (!h) return res.status(404).json({ error: 'Conexão não encontrada.' });
  db.prepare('DELETE FROM hotspots WHERE id = ?').run(h.id);
  res.json(fullProperty(db.prepare('SELECT * FROM properties WHERE id = ?').get(h.property_id)));
});

// ---------- Tour público ----------
app.get('/api/public/tours/:slug', (req, res) => {
  const p = db.prepare('SELECT * FROM properties WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Tour não encontrado ou ainda não publicado.' });
  const { user_id, ...rest } = fullProperty(p);
  const agency = db.prepare('SELECT agency FROM users WHERE id = ?').get(user_id)?.agency;
  res.json({ ...rest, agency });
});

// ---------- Front-end compilado (produção) ----------
const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Erro inesperado.' });
});

app.listen(PORT, () => console.log(`Fabelle Tour 3D rodando em http://localhost:${PORT}`));
