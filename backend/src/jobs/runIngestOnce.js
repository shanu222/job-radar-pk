import { migrate, pool } from '../db.js';
import { runIngest } from './ingest.js';

await migrate();
console.table(await runIngest());
await pool.end();
