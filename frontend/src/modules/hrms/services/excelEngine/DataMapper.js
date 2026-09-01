import { AttendanceColumnGenerator } from './AttendanceColumnGenerator.js';

export class DataMapper {
  /**
   * Universal entity matcher across DB tables
   */
  static matchesEmp(record, emp) {
    if (!record || !emp) return false;
    const rUser = String(record.userId || record.user_id || record.userName || record.user_name || record.employeeId || record.employee_id || '').trim().toLowerCase();
    const rName = String(record.userName || record.user_name || record.name || record.fullName || '').trim().toLowerCase();

    const empId = String(emp.id || '').trim().toLowerCase();
    const empCode = String(emp.empCode || emp.emp_code || emp.employeeId || emp.employee_id || emp.code || '').trim().toLowerCase();
    const empName = String(emp.name || emp.fullName || '').trim().toLowerCase();

    if (!rUser && !rName) return false;

    return (
      (empId && (rUser === empId || rName === empId)) ||
      (empCode && (rUser === empCode || rName === empCode)) ||
      (empName && (rName === empName || rUser === empName)) ||
      (empName && rName && (rName.includes(empName) || empName.includes(rName))) ||
      (empName && rUser && (rUser.includes(empName) || empName.includes(rUser)))
    );
  }

  /**
   * Map DB data into template metadata placeholders dynamically
   */
  static mapMetadata(employees = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    const emp0 = employees[0] || {};
    const companyName = emp0.legalEntity || emp0.legal_entity || emp0.companyName || emp0.department || 'Company Establishment';
    const companyAddress = emp0.location || emp0.address || 'Registered Workplace Premises';

    const adminEmp = employees.find(e => String(e.role || '').toUpperCase() === 'ADMIN');
    const employerName = adminEmp?.name || emp0.reportingManager || emp0.reporting_manager || 'Employer / Management';
    const managerName = adminEmp?.name || emp0.reportingManager || emp0.reporting_manager || 'Manager Incharge';
    const currentYear = new Date().getFullYear();
    const regNo = emp0.legalEntity ? `REG-${String(emp0.legalEntity).toUpperCase().replace(/\s+/g, '')}-${currentYear}` : `REG-HRMS-${currentYear}`;

    const maleCount = employees.filter(e => {
      const g = String(e.gender || '').trim().toLowerCase();
      return g === 'male' || g === 'm';
    }).length;
    const femaleCount = employees.filter(e => {
      const g = String(e.gender || '').trim().toLowerCase();
      return g === 'female' || g === 'f';
    }).length;
    const totalEmployees = employees.length;

    // Dynamic payment date (last day of selectedMonth)
    let paymentDate = '';
    try {
      const [y, m] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0);
      paymentDate = lastDay.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    } catch (e) {
      paymentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    }

    return {
      companyName,
      companyAddress,
      employerName,
      managerName,
      regNo,
      totalEmployees,
      maleCount,
      femaleCount,
      paymentDate
    };
  }

  /**
   * Map DB employee records to Form U row array
   */
  static mapFormURows(employees = []) {
    return employees.map((emp, idx) => [
      idx + 1,
      emp.name || emp.fullName || '-',
      emp.empCode || emp.emp_code || emp.employeeId || emp.code || `EMP${String(idx + 1).padStart(3, '0')}`,
      emp.gender || '-',
      emp.fatherName || emp.spouseName || '-',
      emp.dob || emp.dateOfBirth || '-',
      emp.joiningDate || emp.joining_date || emp.doj || emp.createdAt?.split('T')[0] || '-',
      emp.jobTitle || emp.job_title || emp.designation || emp.role || 'Staff',
      emp.address || emp.presentAddress || emp.location || '-',
      emp.permanentAddress || emp.address || '-'
    ]);
  }

  /**
   * Map DB employee records to Form S row array
   */
  static mapFormSRows(employees = []) {
    return employees.map((emp, idx) => [
      idx + 1,
      emp.name || '-',
      emp.gender || 'Male',
      emp.fatherName || '-',
      emp.jobTitle || emp.job_title || emp.designation || '-',
      emp.empCode || emp.emp_code || emp.employeeId || `EMP${String(idx + 1).padStart(3, '0')}`,
      emp.joiningDate || emp.joining_date || emp.doj || '-',
      'Adult',
      emp.shift || (emp.attendance_setting === '9-6' || emp.attendanceSetting === '9-6' ? 'Shift-1' : 'Shift-Flex'),
      emp.startTime || '09:00 AM',
      emp.restInterval || '0.5 Hr',
      emp.endTime || '06:00 PM',
      emp.weeklyOffs || emp.weekly_offs || 'Sunday'
    ]);
  }

  /**
   * Map DB employee records and attendance calendar for Form V Muster
   */
  static mapFormVMusterRows(employees = [], attendance = [], leaves = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    const daysCount = AttendanceColumnGenerator.getDaysInMonth(selectedMonth);
    const [year, month] = selectedMonth.split('-');

    return employees.map((emp, idx) => {
      const empPunches = attendance.filter(a => this.matchesEmp(a, emp));
      const empLeaves = leaves.filter(l => this.matchesEmp(l, emp));

      const dailySymbols = [];
      for (let day = 1; day <= daysCount; day++) {
        const dayPad = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayPad}`;
        const symbol = AttendanceColumnGenerator.getAttendanceSymbol(dateStr, empPunches, empLeaves, emp.weekly_offs || emp.weeklyOffs);
        dailySymbols.push(symbol);
      }

      return {
        seq: idx + 1,
        name: emp.name || '-',
        fatherSpouse: emp.fatherName || emp.spouseName || '-',
        gender: emp.gender || '-',
        doj: emp.joiningDate || emp.joining_date || emp.doj || '-',
        designation: emp.jobTitle || emp.job_title || emp.designation || '-',
        dailySymbols
      };
    });
  }

  /**
   * Map DB employee records to Form W row array
   */
  static mapFormWRows(employees = [], attendance = [], payslips = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    return employees.map((emp, idx) => {
      const p = payslips.find(ps => this.matchesEmp(ps, emp)) || {};
      const grossComp = Number(emp.compensation_gross || emp.compensationGross || emp.ctc || 0);

      const basic = Number(p.basicSalary || emp.basicSalary || (grossComp > 0 ? Math.round((grossComp / 12) * 0.5) : 0));
      const hra = Number(p.hra || emp.hra || (basic > 0 ? Math.round(basic * 0.4) : 0));
      const allowances = Number(p.allowances || emp.allowances || (grossComp > 0 ? Math.round((grossComp / 12) * 0.1) : 0));
      const gross = Number(p.grossSalary || (basic + hra + allowances));
      const pf = Number(p.pfDeduction || (basic > 0 && (emp.pf_eligible !== 0) ? Math.round(basic * 0.12) : 0));
      const pt = Number(p.ptDeduction || (gross > 15000 ? 208 : 0));
      const totalDed = Number(p.totalDeductions || (pf + pt));
      const net = Number(p.netSalary || (gross - totalDed));

      return [
        idx + 1,
        emp.name || '-',
        emp.empCode || emp.emp_code || emp.employeeId || `EMP${String(idx + 1).padStart(3, '0')}`,
        p.daysWorked || 30,
        basic > 0 ? basic : 0,
        0,
        hra > 0 ? hra : 0,
        allowances > 0 ? allowances : 0,
        0,
        0,
        gross > 0 ? gross : 0,
        pf > 0 ? pf : 0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        pt > 0 ? pt : 0,
        totalDed > 0 ? totalDed : 0,
        net > 0 ? net : 0,
        p.paymentDate || selectedMonth
      ];
    });
  }
}
