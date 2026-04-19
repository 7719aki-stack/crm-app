import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../data/love-crm.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

for (const { name } of tables) {
  const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get();
  console.log(`  ${name}: ${count.cnt} rows`);
}

db.close();
