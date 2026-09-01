const sequelize = require('./src/core/config/database');
const Employee = require('./src/shared/models/Employee');

async function test() {
  try {
    const user = await Employee.findByPk('hmpl001');
    console.log("Success:", user ? user.id : 'null');
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
