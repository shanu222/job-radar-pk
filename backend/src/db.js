import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';

// Return DATE columns as 'YYYY-MM-DD' strings (avoids timezone shifts between PKT and UTC)
pg.types.setTypeParser(1082, (v) => v);

const ssl =
  config.databaseUrl && !/localhost|127\.0\.0\.1|railway\.internal/.test(config.databaseUrl)
    ? { rejectUnauthorized: false }
    : false;

export const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl, max: 10 });

export const query = (text, params) => pool.query(text, params);

export async function migrate() {
  const dir = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(dir, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
