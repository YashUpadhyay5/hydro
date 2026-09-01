const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'storage', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting:', err.message);
        return;
    }
});

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log('Tables: ', rows.map(r => r.name));
    });
});

db.close();
