const Employee = require('../../../../shared/models/Employee');
const Attendance = require('../../../../shared/models/Attendance');
const Leave = require('../../../../shared/models/Leave');
const { Op } = require('sequelize');

class AttendanceSummaryService {
  /**
   * Generates authoritative attendance metrics for a single date.
   * Single source of truth for HR dashboards & WhatsApp notifications.
   */
  static async getDailySummary(dateStr = new Date().toISOString().split('T')[0]) {
    // 1. Fetch Active Employees
    const activeEmployees = await Employee.findAll({
      where: {
        status: { [Op.or]: ['ACTIVE', 'Active', 'active', null] }
      }
    });

    // Support alternate date formats in query (YYYY-MM-DD vs DD-MM-YYYY)
    let altDate = dateStr;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        altDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    // 2. Fetch Attendance Records for Target Date
    const attendanceRecords = await Attendance.findAll({
      where: {
        date: { [Op.or]: [dateStr, altDate] }
      }
    });

    // 3. Fetch Approved Leaves for Target Date
    let leaveRecords = [];
    try {
      leaveRecords = await Leave.findAll({
        where: {
          status: { [Op.or]: ['APPROVED', 'Approved', 'approved'] },
          startDate: { [Op.lte]: dateStr },
          endDate: { [Op.gte]: dateStr }
        }
      });
    } catch (e) {
      console.warn('[AttendanceSummaryService] Leave query fallback warning:', e.message);
    }

    const totalEmployees = activeEmployees.length;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let halfDayCount = 0;
    let lateCount = 0;
    let notMarkedCount = 0;

    // Create maps for quick lookup
    const attendanceMap = new Map();
    attendanceRecords.forEach(a => {
      const uId = String(a.userId || a.user_id || a.employeeId);
      attendanceMap.set(uId, a);
    });

    const leaveMap = new Map();
    leaveRecords.forEach(l => {
      const uId = String(l.userId || l.user_id || l.employeeId);
      leaveMap.set(uId, l);
    });

    // Categorize each active employee
    activeEmployees.forEach(emp => {
      const empId = String(emp.id || emp.userId || emp.employeeId);
      const att = attendanceMap.get(empId);
      const lve = leaveMap.get(empId);

      if (att) {
        const status = String(att.status || '').toUpperCase();
        if (status.includes('HALF') || status.includes('HALF_DAY')) {
          halfDayCount++;
        } else {
          presentCount++;
        }

        if (att.isLate || status.includes('LATE')) {
          lateCount++;
        }
      } else if (lve) {
        const leaveType = String(lve.leaveType || lve.type || '').toUpperCase();
        if (leaveType.includes('HALF')) {
          halfDayCount++;
        } else {
          leaveCount++;
        }
      } else {
        // No attendance and no approved leave
        absentCount++;
        notMarkedCount++;
      }
    });

    const attendancePercentage = totalEmployees > 0 
      ? Number((((presentCount + (halfDayCount * 0.5)) / totalEmployees) * 100).toFixed(2)) 
      : 0;

    return {
      date: dateStr,
      totalEmployees,
      present: presentCount,
      absent: absentCount,
      onLeave: leaveCount,
      halfDay: halfDayCount,
      late: lateCount,
      notMarked: notMarkedCount,
      attendancePercentage: attendancePercentage.toFixed(2),
      isHoliday: false,
      isWeekOff: false
    };
  }
}

module.exports = AttendanceSummaryService;
