const express = require('express');
const router = express.Router();
const Leave = require('../../../../shared/models/Leave');
const Expense = require('../../../../shared/models/Expense');
const Attendance = require('../../../../shared/models/Attendance');
const Employee = require('../../../../shared/models/Employee');

const handleSummary = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [pendingLeavesCount, pendingExpensesCount, todayAttendanceCount, activeEmployeesCount] = await Promise.all([
      Leave.count({ where: { status: 'pending' } }),
      Expense.count({ where: { status: 'pending' } }),
      Attendance.count({ where: { date: todayStr } }),
      Employee.count({ where: { role: { [require('sequelize').Op.ne]: 'ADMIN' } } })
    ]);

    return res.status(200).json({
      pendingLeavesCount,
      pendingExpensesCount,
      todayAttendanceCount,
      activeEmployeesCount,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return res.status(500).json({ error: error.message });
  }
};

router.get('/', handleSummary);
router.get('/summary', handleSummary);

module.exports = router;
