import { Pool, PoolClient } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

export type TestDatabase = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Neither TEST_DATABASE_URL nor DATABASE_URL is set. Copy .env.example to .env at project root.',
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function createTestTransaction(): Promise<{
  db: TestDatabase;
  client: PoolClient;
}> {
  const client = await getPool().connect();
  await client.query('BEGIN');
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function rollbackTestTransaction(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK');
  client.release();
}

export async function closeTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
