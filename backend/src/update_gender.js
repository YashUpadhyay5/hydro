const { Sequelize } = require('sequelize');

const dbs = [
  'C:/Users/Falcon/Desktop/hydro-copy/Hydro/storage/database.sqlite',
  'C:/Users/Falcon/Desktop/hydro-copy/Hydro/backend/storage/database.sqlite'
];

(async () => {
  for (const dbPath of dbs) {
    try {
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: dbPath, logging: false });
      await sequelize.query("UPDATE location_employees SET gender = 'Male' WHERE gender IS NULL OR gender = ''");
      console.log("Successfully updated null genders in:", dbPath);
    } catch (err) {
      console.error("Error updating:", dbPath, err.message);
    }
  }
})();
