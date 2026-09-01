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
  // Geotagged Media Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_media_user_id ON geotagged_media(user_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_media_site_id ON geotagged_media(site_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_media_cluster_id ON geotagged_media(cluster_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_media_timestamp ON geotagged_media(timestamp DESC);");

  // Footprints Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_footprints_user_id ON footprints(user_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_footprints_date ON footprints(date);");
  db.run("CREATE INDEX IF NOT EXISTS idx_footprints_timestamp ON footprints(timestamp DESC);");

  // Expenses Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);");

  // Leaves Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_leaves_user_id ON leaves(user_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);");

  // Employees Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);");
  db.run("CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);");

  console.log('Successfully created database indexes.');
});

db.close();
