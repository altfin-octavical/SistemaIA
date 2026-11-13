// Crea (o actualiza) el usuario administrador inicial con contraseña cifrada (bcrypt).
// Uso: node scripts/create-admin.js   (lee .env)
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Define SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL y ADMIN_PASSWORD en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

const { data, error } = await supabase
  .from('admin_users')
  .upsert(
    {
      email: ADMIN_EMAIL.toLowerCase(),
      name: ADMIN_NAME || 'Administrador',
      password_hash,
      role: 'admin',
      active: true,
    },
    { onConflict: 'email' }
  )
  .select('id, email, name, role')
  .single();

if (error) {
  console.error('Error al crear admin:', error.message);
  process.exit(1);
}
console.log('Admin listo:', data);
