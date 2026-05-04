/**
 * Create (or promote) an admin user in public.users + public.profiles.
 * Uses service role so RLS on users/profiles does not block inserts.
 *
 * Usage:
 *   node scripts/create-admin-user.js [email] [password]
 *
 * Defaults (if args omitted):
 *   email:    process.env.ADMIN_EMAIL || admin@quote.local
 *   password: process.env.ADMIN_PASSWORD || Admin@123
 *
 * Loads .env.local from project root (same pattern as migrate.js).
 */
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    const m = trimmed.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function hashPassword(password) {
  const { hash } = await import('bcryptjs')
  return hash(password, 10)
}

async function main() {
  const email = (
    process.argv[2] ||
    process.env.ADMIN_EMAIL ||
    'admin@quote.local'
  )
    .trim()
    .toLowerCase()
  const password =
    process.argv[3] || process.env.ADMIN_PASSWORD || 'Admin@123'

  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, serviceKey)
  const password_hash = await hashPassword(password)

  const { data: existing, error: findErr } = await sb
    .from('users')
    .select('id,email,role')
    .eq('email', email)
    .maybeSingle()

  if (findErr) {
    console.error('Lookup failed:', findErr.message)
    process.exit(1)
  }

  let userId
  if (existing) {
    const { error: upErr } = await sb
      .from('users')
      .update({ password_hash, role: 'admin' })
      .eq('id', existing.id)
    if (upErr) {
      console.error('Update user failed:', upErr.message)
      process.exit(1)
    }
    userId = existing.id
    console.log('Updated existing user to admin:', email, 'id=', userId)
  } else {
    const { data: inserted, error: insErr } = await sb
      .from('users')
      .insert({ email, password_hash, role: 'admin' })
      .select('id')
      .single()
    if (insErr) {
      console.error('Insert user failed:', insErr.message)
      process.exit(1)
    }
    userId = inserted.id
    console.log('Created admin user:', email, 'id=', userId)
  }

  const authUserId = String(userId)
  const { data: prof } = await sb
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const profileRow = {
    auth_user_id: authUserId,
    name: 'Administrator',
    email,
    phone: null,
    address: null,
    role: 'admin',
  }

  if (prof) {
    const { error: pErr } = await sb
      .from('profiles')
      .update({
        name: profileRow.name,
        email: profileRow.email,
        role: 'admin',
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)
    if (pErr) {
      console.error('Update profile failed:', pErr.message)
      process.exit(1)
    }
    console.log('Updated profile for auth_user_id=', authUserId)
  } else {
    const { error: pErr } = await sb.from('profiles').insert(profileRow)
    if (pErr) {
      console.error('Insert profile failed:', pErr.message)
      process.exit(1)
    }
    console.log('Created admin profile for auth_user_id=', authUserId)
  }

  console.log('\nLogin with:')
  console.log('  Email:', email)
  console.log('  Password:', password === process.argv[3] ? '(as provided)' : '(from env or default)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
