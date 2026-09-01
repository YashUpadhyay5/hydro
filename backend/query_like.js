const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'storage', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT * FROM location_footprints WHERE date LIKE '2026-07-21%'", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log(`Found ${rows.length} footprints today (LIKE match).`);
        if (rows.length > 0) {
            console.log(rows.slice(0, 5));
        }
    });
});

db.close();
