const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'storage', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT DISTINCT user_id FROM location_footprints", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log(`Found ${rows.length} unique user_ids in location_footprints:`);
        console.log(rows.map(r => r.user_id));
    });
});

db.close();
