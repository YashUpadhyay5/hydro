const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'storage', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting:', err.message);
        return;
    }
});

db.serialize(() => {
    db.all("SELECT * FROM location_footprints ORDER BY timestamp DESC LIMIT 5", [], (err, rows) => {
        if (err) {
            console.error('Error querying footprint:', err.message);
            return;
        }
        console.log(`Latest 5 footprints:`);
        if (rows.length > 0) {
            console.log(rows);
        } else {
            console.log("No footprints found in DB at all.");
        }
    });
});

db.close();
