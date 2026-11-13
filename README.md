# GeoIntel — Sistema de Administración

Monorepo para recopilar y consultar información de **política mexicana, geopolítica mundial, economía, geoeconomía, finanzas y geofinanzas**, con panel de administración.

## Estructura

```
├── apps/
│   ├── web/          # Frontend — SvelteKit (SPA, adapter-vercel)
│   └── api/          # Backend — Node.js + Express (serverless en Vercel)
├── supabase/
│   └── schema.sql    # Tablas, RLS y temas iniciales
├── scripts/
│   └── create-admin.js  # Crea el admin inicial (bcrypt)
├── .env / .env.example
└── vercel.json       # Rewrites: /api/* → backend, resto → frontend
```

## Stack

- **Frontend:** SvelteKit 2 + Svelte 5 + Vite
- **Backend:** Node.js + Express + `@supabase/supabase-js` + `bcryptjs` + `jsonwebtoken`
- **BD:** Supabase (Postgres) con RLS — solo `service_role` accede
- **Deploy:** Vercel (monorepo, una sola función serverless para la API)

## Seguridad

- Contraseñas hasheadas con **bcrypt** (costo 12) — nunca se guardan en claro.
- Autenticación con **JWT** (8h) emitido tras login.
- Todo lo sensible va en `.env` (no commiteado): claves de Supabase, `JWT_SECRET`, credenciales del seed.
- RLS activado en todas las tablas; el frontend nunca habla directo con Supabase.

## Balanceador de cargas

`apps/api/src/loadBalancer.js` reparte las consultas entre uno o varios endpoints de Supabase (separa URLs con coma en `SUPABASE_URL`):

- Estrategia **least-in-flight** entre nodos saludables.
- Health check cada 30 s; nodo con error se marca caído y se recupera a los 15 s.
- Estado visible en `/api/health` y en el Dashboard del panel.

## Puesta en marcha (local)

```bash
npm install

# 1) Crea el proyecto en Supabase y ejecuta supabase/schema.sql en el SQL Editor
# 2) Edita .env con tus claves de Supabase y un JWT_SECRET largo

# 3) Crea el usuario admin (password se cifra con bcrypt)
npm run seed:admin

# 4) Levanta backend y frontend
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:5173 (proxy /api → :4000)
```

## Deploy en Vercel

1. Sube el repo a GitHub/GitLab.
2. En Vercel: **New Project** → importa el repo (monorepo raíz).
3. Configura las variables de entorno del proyecto con los valores de `.env`
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CORS_ORIGIN`, etc.).
4. El `vercel.json` raíz ya enruta `/api/*` a `apps/api/api/index.js` y el resto a `apps/web`.
5. Ejecuta `node scripts/create-admin.js` una vez (local o en CI) para crear el admin.

## Endpoints principales

| Método | Ruta               | Auth | Descripción                    |
|--------|--------------------|------|--------------------------------|
| POST   | /api/auth/login    | —    | Login → JWT                    |
| GET    | /api/auth/me       | ✔    | Usuario actual                 |
| GET    | /api/stats         | —    | Dashboard + estado del LB      |
| GET    | /api/topics        | —    | Listar temas                   |
| POST   | /api/topics        | ✔    | Crear tema                     |
| GET    | /api/entries       | —    | Listar registros (filtros)     |
| POST   | /api/entries       | ✔    | Crear registro                 |
| PATCH/DELETE /api/entries/:id | ✔ | Editar/eliminar        |
| GET/POST | /api/analyses    | —/✔  | Análisis del panel             |
