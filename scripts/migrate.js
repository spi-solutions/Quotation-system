/**
 * Run database migrations (SQL files in supabase/migrations/) in order.
 * Requires: DATABASE_URL in .env.local (Postgres connection string).
 * Run: npm run migrate   or   node scripts/migrate.js
 *
 * If connection times out (e.g. port 5432 blocked): run the SQL files manually
 * in Supabase Dashboard → SQL Editor, in filename order.
 */
const fs = require('fs')
const path = require('path')

// Load .env.local from project root (cwd when run via npm run migrate)
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

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local')
  process.exit(1)
}

async function run() {
  const pg = await import('pg')
  const client = new pg.default.Client({ connectionString: DATABASE_URL })
  await client.connect()

  const migrationsDir = path.join(root, 'supabase', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    let sql = fs.readFileSync(filePath, 'utf8')
    // Remove single-line comments so we don't split CREATE SCHEMA etc.
    sql = sql.replace(/^--.*$/gm, '').trim()
    if (!sql) {
      console.log('  SKIP (no statements):', file)
      continue
    }
    try {
      await client.query(sql)
      console.log('✓', file)
    } catch (e) {
      if (e.code === '42P07') {
        console.log('  SKIP (already exists):', file)
      } else {
        console.error('FAIL:', file, e.message)
        throw e
      }
    }
  }

  await client.end()
  console.log('\nMigrations done.')
}

run().catch((e) => {
  console.error(e)
  if (e.code === 'ETIMEDOUT' || (e.errors && e.errors.some((x) => x.code === 'ETIMEDOUT'))) {
    console.error('\nPort 5432 is not reachable from this network. Run the SQL manually:')
    console.error('  Supabase Dashboard → SQL Editor → paste supabase/migrations/20260226100000_app_schema_and_tables.sql → Run')
  }
  process.exit(1)
})
