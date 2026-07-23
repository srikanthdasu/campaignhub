const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch(err => console.error("❌ Database Error:", err.message));
pool.on('error', (err) => {
  console.error('⚠️  Unexpected PG pool error (connection dropped, pool will recover):', err.message);
});

module.exports = pool;