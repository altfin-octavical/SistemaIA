import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config(); // .env local de apps/api tiene prioridad si existe
dotenv.config({ path: path.join(rootDir, '.env') }); // fallback: .env de la raíz
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { LoadBalancer } from './loadBalancer.js';
import { requireAuth } from './auth.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Supabase + balanceador de cargas
// SUPABASE_URL admite una lista separada por comas (endpoints/replicas).
// El balanceador reparte las consultas entre los nodos disponibles.
// ---------------------------------------------------------------------------
const endpoints = (process.env.SUPABASE_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!endpoints.length || !serviceKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const nodes = endpoints.map((url) => ({
  url,
  client: createClient(url, serviceKey, { auth: { persistSession: false } }),
  healthy: true,
  inFlight: 0,
}));

const lb = new LoadBalancer(nodes, {
  healthCheckMs: 30_000,
  maxInFlightPerNode: Number(process.env.MAX_INFLIGHT_PER_NODE || 50),
});

// Devuelve el cliente Supabase con menos carga disponible.
function db() {
  return lb.acquire();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET debe definirse en .env (mín. 32 caracteres)');
  process.exit(1);
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

  const { data, error } = await db()
    .from('admin_users')
    .select('id, email, name, password_hash, role, active')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || !data.active) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { sub: data.id, email: data.email, role: data.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({
    token,
    user: { id: data.id, email: data.email, name: data.name, role: data.role },
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { data, error } = await db()
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', req.user.sub)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: data });
});

// ---------------------------------------------------------------------------
// Temas / categorías temáticas
// ---------------------------------------------------------------------------
app.get('/api/topics', async (_req, res) => {
  const { data, error } = await db()
    .from('topics')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ topics: data });
});

app.post('/api/topics', requireAuth, async (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name requerido' });
  const { data, error } = await db()
    .from('topics')
    .insert({ name, description: description ?? null })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ topic: data });
});

app.patch('/api/topics/:id', requireAuth, async (req, res) => {
  const { name, description, active } = req.body ?? {};
  const { data, error } = await db()
    .from('topics')
    .update({ name, description, active })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ topic: data });
});

// ---------------------------------------------------------------------------
// Fuentes / registros de inteligencia
// ---------------------------------------------------------------------------
app.get('/api/entries', async (req, res) => {
  const { topic_id, search, limit = 100, offset = 0 } = req.query;
  let q = db()
    .from('entries')
    .select('*, topics(name)', { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);
  if (topic_id) q = q.eq('topic_id', topic_id);
  if (search) q = q.ilike('title', `%${search}%`);
  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ entries: data, total: count });
});

app.post('/api/entries', requireAuth, async (req, res) => {
  const { topic_id, title, summary, url, source_name, published_at, relevance } = req.body ?? {};
  if (!topic_id || !title) return res.status(400).json({ error: 'topic_id y title requeridos' });
  const { data, error } = await db()
    .from('entries')
    .insert({
      topic_id,
      title,
      summary: summary ?? null,
      url: url ?? null,
      source_name: source_name ?? null,
      published_at: published_at ?? null,
      relevance: relevance ?? 'media',
      created_by: req.user.sub,
    })
    .select('*, topics(name)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ entry: data });
});

app.patch('/api/entries/:id', requireAuth, async (req, res) => {
  const allowed = ['title', 'summary', 'url', 'source_name', 'published_at', 'relevance', 'topic_id'];
  const patch = Object.fromEntries(
    Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k))
  );
  const { data, error } = await db()
    .from('entries')
    .update(patch)
    .eq('id', req.params.id)
    .select('*, topics(name)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ entry: data });
});

app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  const { error } = await db().from('entries').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Análisis / notas del panel
// ---------------------------------------------------------------------------
app.get('/api/analyses', async (_req, res) => {
  const { data, error } = await db()
    .from('analyses')
    .select('*, topics(name)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ analyses: data });
});

app.post('/api/analyses', requireAuth, async (req, res) => {
  const { topic_id, title, body } = req.body ?? {};
  if (!title || !body) return res.status(400).json({ error: 'title y body requeridos' });
  const { data, error } = await db()
    .from('analyses')
    .insert({ topic_id: topic_id ?? null, title, body, created_by: req.user.sub })
    .select('*, topics(name)')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ analysis: data });
});

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------
app.get('/api/stats', async (_req, res) => {
  const [topics, entries, analyses] = await Promise.all([
    db().from('topics').select('id', { count: 'exact', head: true }),
    db().from('entries').select('id', { count: 'exact', head: true }),
    db().from('analyses').select('id', { count: 'exact', head: true }),
  ]);
  const byTopic = await db()
    .from('entries')
    .select('topic_id, topics(name)');
  const counts = {};
  for (const e of byTopic.data ?? []) {
    const name = e.topics?.name ?? 'Sin tema';
    counts[name] = (counts[name] ?? 0) + 1;
  }
  res.json({
    topics: topics.count ?? 0,
    entries: entries.count ?? 0,
    analyses: analyses.count ?? 0,
    byTopic: counts,
    loadBalancer: lb.stats(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, nodes: lb.stats() });
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
