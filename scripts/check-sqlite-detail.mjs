import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../data/love-crm.db'));

const customers = db.prepare('SELECT id, name, display_name, status, category, total_amount FROM customers').all();
console.log('=== customers ===');
console.table(customers);

const messages = db.prepare('SELECT id, customer_id, direction, text FROM messages').all();
console.log('=== messages ===');
console.table(messages);

const appraisals = db.prepare('SELECT * FROM appraisals').all();
console.log('=== appraisals ===');
console.table(appraisals);

db.close();
