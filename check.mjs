import { config } from 'dotenv'
config()

import pg from 'pg'

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})
const client = await pool.connect()

const result = await client.query(`
  SELECT order_number, status, payment_status, shiprocket_order_id, awb_code, tracking_url
  FROM "Order"
  WHERE order_number = 'TFM-30859569-5HC0'
`)

console.log(JSON.stringify(result.rows, null, 2))

await client.release()
await pool.end()