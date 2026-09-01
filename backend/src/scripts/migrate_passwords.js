const sequelize = require('../config/database');
const Employee = require('../shared/models/Employee');
const { hashPassword } = require('../modules/auth/services/authService');

async function runPasswordMigration() {
  console.log('=====================================================');
  console.log('[MIGRATION LOG] Starting Plain-Text Password Hashing Migration');
  console.log('=====================================================');

  try {
    await sequelize.authenticate();
    console.log('[MIGRATION LOG] Database Connection Established Successfully.');

    const employees = await Employee.findAll();
    console.log(`[MIGRATION LOG] Total Employees Found in Database: ${employees.length}`);

    let updatedCount = 0;
    let alreadyHashedCount = 0;

    for (const emp of employees) {
      const currentPwd = emp.password || 'password123';
      
      // Check if password is already hashed with bcrypt
      if (currentPwd.startsWith('$2a$') || currentPwd.startsWith('$2b$') || currentPwd.startsWith('$2y$')) {
        alreadyHashedCount++;
      } else {
        const hashed = await hashPassword(currentPwd);
        // Direct query update to bypass model hooks during explicit migration
        await Employee.update(
          { password: hashed },
          { where: { id: emp.id } }
        );
        updatedCount++;
        console.log(`[MIGRATION SUCCESS] Account: ${emp.email} (ID: ${emp.id}) -> Password Hashed Successfully.`);
      }
    }

    console.log('=====================================================');
    console.log(`[MIGRATION COMPLETE] Accounts Updated: ${updatedCount} | Already Hashed: ${alreadyHashedCount}`);
    console.log('=====================================================');
  } catch (err) {
    console.error('[MIGRATION ERROR] Migration Failed:', err);
  }
}

if (require.main === module) {
  runPasswordMigration().then(() => process.exit(0));
}

module.exports = runPasswordMigration;
