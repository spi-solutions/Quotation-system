/**
 * Verify NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or anon fallback)
 * can read public catalog tables. Does not start Next.js.
 *
 * Run: node scripts/verify-supabase-connection.js
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
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function main() {
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or anon fallback).')
    process.exit(1)
  }
  let host = url
  try {
    host = new URL(url).host
  } catch {
    /* keep raw */
  }
  console.log('Target host:', host)
  console.log('Using key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon')

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key)

  const tables = [
    ['products', () => sb.from('products').select('id', { count: 'exact', head: true })],
    ['fabric_groups', () => sb.from('fabric_groups').select('id', { count: 'exact', head: true })],
    ['widths', () => sb.from('widths').select('id', { count: 'exact', head: true })],
    ['drops', () => sb.from('drops').select('id', { count: 'exact', head: true })],
    ['roller_pricing_grid', () => sb.from('roller_pricing_grid').select('id', { count: 'exact', head: true })],
    ['costing_rules', () => sb.from('costing_rules').select('id', { count: 'exact', head: true })],
    ['quotes', () => sb.from('quotes').select('id', { count: 'exact', head: true })],
    ['users', () => sb.from('users').select('id', { count: 'exact', head: true })],
  ]

  let ok = true
  for (const [name, q] of tables) {
    const { error, count } = await q()
    if (error) {
      console.error(`✗ ${name}:`, error.message)
      ok = false
    } else {
      console.log(`✓ ${name}: ${count ?? 0} rows`)
    }
  }

  if (!ok) process.exit(1)
  console.log('\nSupabase connection OK.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
