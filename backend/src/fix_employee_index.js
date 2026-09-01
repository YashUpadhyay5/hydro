const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'storage', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
    return;
  }
  console.log('Connected to SQLite database.');
});

db.serialize(() => {
  // Employees Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_employees_email ON location_employees(email);", (err) => {
    if (err) console.error(err);
    else console.log('Index created for employee email');
  });
});

db.close();
