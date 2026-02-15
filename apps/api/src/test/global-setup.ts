import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Neither TEST_DATABASE_URL nor DATABASE_URL is set. Copy .env.example to .env at project root.',
    );
  }
  return url;
}

function getAdminUrl(): string {
  const testUrl = getTestDatabaseUrl();
  const url = new URL(testUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function getDatabaseName(): string {
  const testUrl = getTestDatabaseUrl();
  const url = new URL(testUrl);
  return url.pathname.slice(1);
}

async function ensureDatabaseExists(): Promise<void> {
  const adminPool = new Pool({ connectionString: getAdminUrl() });
  try {
    const dbName = getDatabaseName();
    const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (result.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created test database: ${dbName}`);
    }
  } finally {
    await adminPool.end();
  }
}

async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: getTestDatabaseUrl() });
  const db = drizzle(pool);
  try {
    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'src/database/migrations'),
    });
  } finally {
    await pool.end();
  }
}

async function truncateAllTables(): Promise<void> {
  const pool = new Pool({ connectionString: getTestDatabaseUrl() });
  try {
    const result = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '__drizzle_%'
    `);
    const tables = result.rows.map((r: { tablename: string }) => `"${r.tablename}"`);
    if (tables.length > 0) {
      await pool.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
    }
  } finally {
    await pool.end();
  }
}

export async function setup(): Promise<void> {
  await ensureDatabaseExists();
  await runMigrations();
  await truncateAllTables();
}
