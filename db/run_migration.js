// run_migration.js
// Usage:
// 1) npm install pg
// 2) export DATABASE_URL="postgres://..." (la connection string di Supabase)
// 3) node db/run_migration.js

const fs = require('fs')
const { Client } = require('pg')

async function run() {
  const fileArg = process.argv[2] || '0001_add_modificatore_fields.sql'
  const sqlPath = `${__dirname}/${fileArg}`
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration SQL non trovata:', sqlPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf8')
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!connectionString) {
    console.error('Imposta la variabile d\'ambiente DATABASE_URL con la connection string di Supabase')
    process.exit(1)
  }

  const client = new Client({ connectionString })
  try {
    await client.connect()
    console.log('Connessione avvenuta. Esecuzione migration...')
    const res = await client.query(sql)
    console.log('Migration eseguita con successo.')
  } catch (err) {
    console.error('Errore esecuzione migration:', err.message || err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
