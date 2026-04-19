/**
 * Supabase → SQLite 移行スクリプト
 * 既存データを削除してSupabaseの本番データで上書き
 */
import pg from 'pg';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local から DATABASE_URL を読む
const envPath = join(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) throw new Error('DATABASE_URL not found in .env.local');
const DATABASE_URL = dbUrlMatch[1].trim();

console.log('Connecting to Supabase...');
const pgClient = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pgClient.connect();
console.log('Connected.\n');

// --- Fetch from Supabase ---
const [customersRes, messagesRes, appraisalsRes, scenariosRes] = await Promise.all([
  pgClient.query('SELECT * FROM customers ORDER BY id'),
  pgClient.query('SELECT * FROM messages ORDER BY id'),
  pgClient.query('SELECT * FROM appraisals ORDER BY id'),
  pgClient.query('SELECT * FROM scenario_schedules ORDER BY id').catch(() => ({ rows: [] })),
]);

console.log(`Fetched from Supabase:`);
console.log(`  customers:         ${customersRes.rows.length}`);
console.log(`  messages:          ${messagesRes.rows.length}`);
console.log(`  appraisals:        ${appraisalsRes.rows.length}`);
console.log(`  scenario_schedules: ${scenariosRes.rows.length}`);
await pgClient.end();

if (customersRes.rows.length === 0) {
  console.log('\nNo data found in Supabase. Exiting without changes.');
  process.exit(0);
}

// --- Write to SQLite ---
const sqlite = new Database(join(__dirname, '../data/love-crm.db'));

sqlite.exec('BEGIN');
try {
  // 既存データ削除（FK制約順）
  sqlite.exec('DELETE FROM scenario_schedules');
  sqlite.exec('DELETE FROM appraisals');
  sqlite.exec('DELETE FROM messages');
  sqlite.exec('DELETE FROM customers');
  sqlite.exec("DELETE FROM sqlite_sequence WHERE name IN ('customers','messages','appraisals','scenario_schedules')");

  // customers
  const insertCustomer = sqlite.prepare(`
    INSERT INTO customers
      (id, name, display_name, contact, status, tags, notes, line_id, line_user_id,
       picture_url, status_message, category, crisis_level, temperature,
       next_action, total_amount, created_at, updated_at)
    VALUES
      (@id, @name, @display_name, @contact, @status, @tags, @notes, @line_id, @line_user_id,
       @picture_url, @status_message, @category, @crisis_level, @temperature,
       @next_action, @total_amount, @created_at, @updated_at)
  `);
  for (const row of customersRes.rows) {
    insertCustomer.run({
      ...row,
      tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags ?? '[]'),
      created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() ?? new Date().toISOString(),
    });
  }

  // messages
  const insertMessage = sqlite.prepare(`
    INSERT INTO messages (id, customer_id, source, direction, text, raw_type, created_at)
    VALUES (@id, @customer_id, @source, @direction, @text, @raw_type, @created_at)
  `);
  for (const row of messagesRes.rows) {
    insertMessage.run({
      ...row,
      created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
    });
  }

  // appraisals
  const insertAppraisal = sqlite.prepare(`
    INSERT INTO appraisals (id, customer_id, type, status, price, paid, notes, created_at, delivered_at)
    VALUES (@id, @customer_id, @type, @status, @price, @paid, @notes, @created_at, @delivered_at)
  `);
  for (const row of appraisalsRes.rows) {
    insertAppraisal.run({
      ...row,
      created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
      delivered_at: row.delivered_at?.toISOString() ?? null,
    });
  }

  // scenario_schedules
  const insertScenario = sqlite.prepare(`
    INSERT INTO scenario_schedules
      (id, customer_id, scenario_type, step_no, scheduled_at, status, message_body, sent_at, created_at, updated_at)
    VALUES
      (@id, @customer_id, @scenario_type, @step_no, @scheduled_at, @status, @message_body, @sent_at, @created_at, @updated_at)
  `);
  for (const row of scenariosRes.rows) {
    insertScenario.run({
      ...row,
      scheduled_at: row.scheduled_at?.toISOString() ?? '',
      sent_at: row.sent_at?.toISOString() ?? null,
      created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() ?? new Date().toISOString(),
    });
  }

  // sqlite_sequence を更新（AUTO INCREMENT の起点を合わせる）
  const maxIds = {
    customers: customersRes.rows.reduce((m, r) => Math.max(m, r.id), 0),
    messages: messagesRes.rows.reduce((m, r) => Math.max(m, r.id), 0),
    appraisals: appraisalsRes.rows.reduce((m, r) => Math.max(m, r.id), 0),
    scenario_schedules: scenariosRes.rows.reduce((m, r) => Math.max(m, r.id), 0),
  };
  const upsertSeq = sqlite.prepare("INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES (?, ?)");
  for (const [table, max] of Object.entries(maxIds)) {
    if (max > 0) upsertSeq.run(table, max);
  }

  sqlite.exec('COMMIT');
  console.log('\nImported to SQLite successfully:');
  for (const [table, max] of Object.entries(maxIds)) {
    console.log(`  ${table}: max id = ${max}`);
  }
} catch (err) {
  sqlite.exec('ROLLBACK');
  throw err;
} finally {
  sqlite.close();
}

console.log('\nDone!');
