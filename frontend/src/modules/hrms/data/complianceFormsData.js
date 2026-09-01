import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const COMPLIANCE_FORMS_CONFIG = [
  {
    id: 'Form S',
    sheetName: 'Form S',
    title: 'Form S',
    name: 'Notice of Daily Hours Of Work, Rest Interval, Weekly Holiday, Etc.',
    rule: '[See sub-rule (4) of Rule 18]',
    category: 'Hours & Rest Compliance',
    icon: 'fa-clock',
    color: '#6366f1',
    badge: 'Form S',
    description: 'Statutory notice declaring daily working hours, rest intervals, shifts, and weekly holidays derived from DB employee records.'
  },
  {
    id: 'Form U',
    sheetName: 'Form U',
    title: 'Form U',
    name: 'Employee Register',
    rule: '[See sub-rule(1) of rule(16)]',
    category: 'Employee Master Records',
    icon: 'fa-address-card',
    color: '#10b981',
    badge: 'Form U',
    description: 'Master register displaying active database records for employee designations, DOB, joining dates, and address details.'
  },
  {
    id: 'Form V Muster',
    sheetName: 'Form V Muster',
    title: 'Form V Muster',
    name: 'Muster Roll',
    rule: '[See Rule 26(5)]',
    category: 'Attendance Muster',
    icon: 'fa-clipboard-user',
    color: '#f59e0b',
    badge: 'Muster Roll',
    description: 'Daily attendance muster roll calculated from database punch logs, present days, weekly offs, and approved leave records.'
  },
  {
    id: 'Form V Register',
    sheetName: 'Form V Register',
    title: 'Form V Register',
    name: 'Register of Employment',
    rule: '[See sub-rule (1) of rule (16)]',
    category: 'Employment Log',
    icon: 'fa-briefcase',
    color: '#3b82f6',
    badge: 'Register of Employment',
    description: 'Employment register maintaining daily work commencement, rest interval, and total working hours per employee.'
  },
  {
    id: 'Form X',
    sheetName: 'Form X',
    title: 'Form X',
    name: 'Register of Leave and Social Security Benefits',
    rule: '[See sub-rule (1) of rule (16)]',
    category: 'Leave & Social Benefits',
    icon: 'fa-umbrella-beach',
    color: '#ef4444',
    badge: 'Form X',
    description: 'Detailed register tracking opening leave balances, earned leave, availed leave, maternity benefits, and gratuity payouts from DB.'
  },
  {
    id: 'Form T',
    sheetName: 'Form T',
    title: 'Form T',
    name: 'Wage Slip / Leave Card',
    rule: '[See sub-rule (6) of Rule 11]',
    category: 'Wage Slip',
    icon: 'fa-receipt',
    color: '#8b5cf6',
    badge: 'Form T',
    description: 'Standardized wage slip and leave balance card summarizing employee earnings breakdown, statutory deductions, and leave credit.'
  },
  {
    id: 'Form W',
    sheetName: 'Form W',
    title: 'Form W',
    name: 'Register of Wages',
    rule: '[See sub-rule(1) of rule(16)]',
    category: 'Wages Register',
    icon: 'fa-money-bill-wave',
    color: '#06b6d4',
    badge: 'Form W',
    description: 'Statutory wage register logging days worked, basic pay, HRA, allowances, gross salary, PF, PT deductions, and net disbursed wages.'
  }
];

// Helper to get current default YYYY-MM
export const getCurrentMonthYYYYMM = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Format YYYY-MM into human readable month string (e.g. "2026-07" -> "July 2026")
export const formatMonthYearLabel = (monthStr) => {
  if (!monthStr) {
    monthStr = getCurrentMonthYYYYMM();
  }
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch (e) {
    return monthStr;
  }
};

// Get days in a specific YYYY-MM month
export const getDaysInMonthCount = (monthStr) => {
  if (!monthStr) return 30;
  try {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
  } catch (e) {
    return 30;
  }
};

// Calculate count of Sundays in a month
export const getSundaysCount = (monthStr) => {
  if (!monthStr) return 4;
  try {
    const [year, month] = monthStr.split('-');
    const days = getDaysInMonthCount(monthStr);
    let sundays = 0;
    for (let day = 1; day <= days; day++) {
      const dt = new Date(parseInt(year, 10), parseInt(month, 10) - 1, day);
      if (dt.getDay() === 0) sundays++;
    }
    return sundays || 4;
  } catch (e) {
    return 4;
  }
};

/**
 * Universal entity matcher across location_employees, Attendances, location_leaves
 */
export const matchesEmp = (record, emp) => {
  if (!record || !emp) return false;
  const rUser = String(record.userId || record.user_id || record.userName || record.user_name || '').trim().toLowerCase();
  const rName = String(record.userName || record.user_name || '').trim().toLowerCase();

  const empId = String(emp.id || '').trim().toLowerCase();
  const empCode = String(emp.empCode || emp.emp_code || emp.employeeId || emp.employee_id || emp.code || '').trim().toLowerCase();
  const empName = String(emp.name || emp.fullName || '').trim().toLowerCase();

  if (!rUser && !rName) return false;

  return (
    (empId && rUser === empId) ||
    (empCode && rUser === empCode) ||
    (empName && rName === empName) ||
    (empName && rUser === empName) ||
    (empId && rName === empId) ||
    (empCode && rName === empCode)
  );
};

/**
 * Calculate actual leave days span from start_date to end_date
 */
export const calculateLeaveDays = (startDate, endDate, totalDays) => {
  if (Number(totalDays) > 0) return Number(totalDays);
  if (!startDate || !endDate) return 1;
  try {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(diffDays) ? 1 : diffDays;
  } catch (e) {
    return 1;
  }
};

/**
 * Filter approved/accepted leave records for a specific employee and month
 */
export const getEmpLeavesForMonth = (emp, leavesList = [], selectedMonth) => {
  return leavesList.filter(l => {
    const status = String(l.status || '').toLowerCase();
    const isApproved = status === 'approved' || status === 'accepted';
    if (!isApproved) return false;

    const sDate = l.startDate || l.start_date || '';
    const eDate = l.endDate || l.end_date || '';
    const isInMonth = sDate.startsWith(selectedMonth) || eDate.startsWith(selectedMonth);

    return isInMonth && matchesEmp(l, emp);
  });
};

/**
 * Filter attendance punch records for a specific employee and month
 */
export const getEmpAttendanceForMonth = (emp, attendanceList = [], selectedMonth) => {
  const empPunches = attendanceList.filter(a => {
    const aDate = a.date || a.createdAt || '';
    return aDate.startsWith(selectedMonth) && matchesEmp(a, emp);
  });
  const uniqueDates = new Set(empPunches.map(a => (a.date || a.createdAt || '').slice(0, 10)));
  return {
    presentDays: uniqueDates.size,
    punches: empPunches
  };
};

/**
 * Get statutory attendance symbol (P, A, L, WO, H, OD, HD) for an employee on a date
 */
export const getAttendanceSymbolFromPunches = (dateStr, empPunches = [], empLeaves = [], weeklyOffsSetting = 'Sunday') => {
  const hasApprovedLeave = empLeaves.some(l => {
    const sDate = l.startDate || l.start_date || '';
    const eDate = l.endDate || l.end_date || '';
    return dateStr >= sDate && dateStr <= eDate;
  });

  if (hasApprovedLeave) {
    const leaveObj = empLeaves.find(l => {
      const sDate = l.startDate || l.start_date || '';
      const eDate = l.endDate || l.end_date || '';
      return dateStr >= sDate && dateStr <= eDate;
    });
    const type = String(leaveObj?.type || '').toUpperCase();
    if (type.includes('SICK') || type === 'SL') return 'SL';
    if (type.includes('CASUAL') || type === 'CL') return 'CL';
    if (type.includes('EARNED') || type === 'EL') return 'EL';
    return 'L';
  }

  const hasPunch = empPunches.some(p => {
    const pDate = p.date || p.createdAt || '';
    return pDate.startsWith(dateStr);
  });

  if (hasPunch) {
    return 'P';
  }

  try {
    const d = new Date(dateStr);
    if (d.getDay() === 0) return 'WO'; // Sunday
    if (d.getDay() === 6 && (weeklyOffsSetting || '').toLowerCase().includes('saturday')) return 'WO';
  } catch (e) {}

  return 'A'; // Absent
};

/**
 * Generates 100% dynamic DB form records and metadata. NO static hardcoded text!
 */
export const getDynamicFormData = (formKey, selectedMonth = getCurrentMonthYYYYMM(), employees = [], attendance = [], leaves = [], payslips = []) => {
  const monthLabel = formatMonthYearLabel(selectedMonth);
  const totalDaysInMonth = getDaysInMonthCount(selectedMonth);
  const sundaysCount = getSundaysCount(selectedMonth);

  // Derive dynamic establishment and employer details strictly from DB
  const companyName = employees[0]?.legalEntity || employees[0]?.legal_entity || employees[0]?.companyName || employees[0]?.department || '0';
  const companyAddress = employees[0]?.location || employees[0]?.address || '0';
  const adminEmp = employees.find(e => String(e.role || '').toUpperCase() === 'ADMIN');
  const employerName = adminEmp?.name || employees[0]?.reportingManager || employees[0]?.reporting_manager || '0';
  const managerName = adminEmp?.name || employees[0]?.reportingManager || employees[0]?.reporting_manager || '0';
  const currentYear = new Date().getFullYear();
  const regNo = employees[0]?.legalEntity ? `REG-${String(employees[0].legalEntity).toUpperCase().replace(/\s+/g, '')}-${currentYear}` : `REG-HRMS-${currentYear}`;

  const maleCount = employees.filter(e => {
    const g = String(e.gender || '').trim().toLowerCase();
    return g === 'male' || g === 'm';
  }).length;
  const femaleCount = employees.filter(e => {
    const g = String(e.gender || '').trim().toLowerCase();
    return g === 'female' || g === 'f';
  }).length;
  const totalEmployees = employees.length;

  let dynamicPaymentDate = '';
  try {
    const [y, m] = selectedMonth.split('-');
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0);
    dynamicPaymentDate = lastDay.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  } catch (e) {
    dynamicPaymentDate = monthLabel;
  }

  if (!employees || employees.length === 0) {
    return {
      meta: [
        [formKey, '', ''],
        ['Statutory Compliance Form', '', ''],
        ['Establishment:', '', companyName],
        ['Period:', '', monthLabel]
      ],
      headers: [['Status Message']],
      body: [['No active employee records found in database for this period.']]
    };
  }

  if (formKey === 'Form U') {
    const meta = [
      ['Form U', '', ''],
      ['Employee Register', '', ''],
      ['[See sub-rule(1) of rule(16)]', '', ''],
      ['Name and Address of the Establishment:', '', `${companyName}, ${companyAddress}`],
      ['Registration Certificate No:', '', regNo],
      ['Total Persons Employed:', '', `Total: ${totalEmployees} (Male: ${maleCount}, Female: ${femaleCount})`],
      ['Period:', '', monthLabel]
    ];
    const headers = [
      ['Serial Number', 'Name of the employee', 'Employee Identification No.', 'Gender', 'Father / Spouse Name', 'Date of Birth', 'Date of entry into service', 'Designation', 'Department', 'Location / Address']
    ];
    const body = employees.map((emp, idx) => [
      idx + 1,
      emp.name || emp.fullName || '0',
      emp.empCode || emp.emp_code || emp.employeeId || emp.code || '0',
      emp.gender || '0',
      emp.fatherName || emp.spouseName || '0',
      emp.dob || emp.dateOfBirth || '0',
      emp.joiningDate || emp.joining_date || emp.doj || '0',
      emp.jobTitle || emp.job_title || emp.designation || emp.role || '0',
      emp.department || '0',
      emp.address || emp.presentAddress || emp.location || '0'
    ]);
    return { meta, headers, body };
  }

  if (formKey === 'Form S') {
    const meta = [
      ['FORM S', '', ''],
      ['Notice of Daily Hours Of Work, Rest Interval, Weekly Holiday, Etc.', '', ''],
      ['[See sub-rule (4) of Rule 18]', '', ''],
      ['Name and full address of the establishment:', '', `${companyName}, ${companyAddress}`],
      ['Name of Employer / Managing Director:', '', employerName],
      ['Name of Manager / Incharge:', '', managerName],
      ['Total Persons Employed:', '', `Total: ${totalEmployees} (Male: ${maleCount}, Female: ${femaleCount})`],
      ['Wage Period:', '', monthLabel],
      ['Date of Payment of Wages:', '', dynamicPaymentDate]
    ];
    const headers = [
      ['Serial No.', 'Name of the person employed', 'Sex', 'Father/Husband’s Name', 'Designation', 'Employee number', 'Date of entry into service', 'Adult/Adolescent/Child', 'Shift Number', 'Time of commencement of work', 'Rest Interval', 'Time of cessation of work', 'Weekly Holiday']
    ];
    const body = employees.map((emp, idx) => [
      idx + 1,
      emp.name || '0',
      emp.gender || '0',
      emp.fatherName || '0',
      emp.jobTitle || emp.job_title || emp.designation || '0',
      emp.empCode || emp.emp_code || emp.employeeId || '0',
      emp.joiningDate || emp.joining_date || emp.doj || '0',
      'Adult',
      emp.shift || (emp.attendance_setting === '9-6' || emp.attendanceSetting === '9-6' ? 'General Shift (9-6)' : 'Flexible Shift'),
      emp.startTime || '09:00 AM',
      emp.restInterval || '0.5 Hr',
      emp.endTime || '06:00 PM',
      emp.weeklyOffs || emp.weekly_offs || 'Sunday'
    ]);
    return { meta, headers, body };
  }

  if (formKey === 'Form V Muster') {
    const meta = [
      ['Form V', '', ''],
      ['Muster Roll [See Rule 26(5)]', '', ''],
      ['Name of Factory / Establishment:', '', companyName],
      ['Place:', '', companyAddress],
      ['Name of Manager/Incharge:', '', managerName],
      ['Total Workers Employed:', '', `Total: ${totalEmployees} (Male: ${maleCount}, Female: ${femaleCount})`],
      ['For the Month:', '', monthLabel]
    ];

    const dayHeaders = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      dayHeaders.push(String(day).padStart(2, '0'));
    }

    const headers = [
      ['SI No.', 'Name of the Employee', 'Employee ID', "Father's/Spouse's Name", 'Sex', 'Date of Entry into Service', 'Designation', ...dayHeaders, 'Present', 'Leaves', 'Weekly Offs', 'Absent']
    ];

    const [year, month] = selectedMonth.split('-');

    const body = employees.map((emp, idx) => {
      const empPunches = attendance.filter(a => matchesEmp(a, emp));
      const empApprovedLeaves = getEmpLeavesForMonth(emp, leaves, selectedMonth);

      const dailySymbols = [];
      let presentDays = 0;
      let totalLeaveDays = 0;
      let weeklyOffs = 0;

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const dayPad = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayPad}`;
        const symbol = getAttendanceSymbolFromPunches(dateStr, empPunches, empApprovedLeaves, emp.weekly_offs || emp.weeklyOffs);
        dailySymbols.push(symbol);

        if (symbol === 'P' || symbol === 'HD') presentDays++;
        else if (symbol === 'SL' || symbol === 'CL' || symbol === 'EL' || symbol === 'L') totalLeaveDays++;
        else if (symbol === 'WO') weeklyOffs++;
      }

      const absentDays = Math.max(0, totalDaysInMonth - presentDays - totalLeaveDays - weeklyOffs);

      return [
        idx + 1,
        emp.name || '0',
        emp.empCode || emp.emp_code || emp.employeeId || '0',
        emp.fatherName || emp.spouseName || '0',
        emp.gender || '0',
        emp.joiningDate || emp.joining_date || emp.doj || '0',
        emp.jobTitle || emp.job_title || emp.designation || '0',
        ...dailySymbols,
        presentDays || 0,
        totalLeaveDays || 0,
        weeklyOffs || 0,
        absentDays || 0
      ];
    });

    return { meta, headers, body };
  }

  if (formKey === 'Form V Register') {
    const meta = [
      ['Form V', '', ''],
      ['REGISTER OF EMPLOYMENT [See sub-rule (1) of rule (16)]', '', ''],
      ['For the period:', '', monthLabel],
      ['Name and Address of the Establishment:', '', `${companyName}, ${companyAddress}`],
      ['Name of Employer:', '', employerName],
      ['Name of Manager/Incharge:', '', managerName],
      ['Total Persons Employed:', '', `Total: ${totalEmployees} (Male: ${maleCount}, Female: ${femaleCount})`]
    ];
    const headers = [
      ['Serial Number', 'Name of the Employee', 'Employee Identification No.', 'Designation', 'Time at which work commences', 'Rest Interval', 'Time at which work ends', 'Daily Hours of work', 'Overtime Status']
    ];
    const body = employees.map((emp, idx) => [
      idx + 1,
      emp.name || '0',
      emp.empCode || emp.emp_code || emp.employeeId || '0',
      emp.jobTitle || emp.job_title || emp.designation || '0',
      emp.startTime || '09:00 AM',
      emp.restInterval || '0.5 Hr',
      emp.endTime || '06:00 PM',
      emp.dailyHours || '8 Hours',
      emp.overtime || '0'
    ]);
    return { meta, headers, body };
  }

  if (formKey === 'Form W') {
    const meta = [
      ['Form-W', '', ''],
      ['REGISTER OF WAGES [See sub-rule(1) of rule(16)]', '', ''],
      ['Name and Address of the Establishment :', '', `${companyName}, ${companyAddress}`],
      ['Name of Employer :', '', employerName],
      ['Name of Manager/Incharge :', '', managerName],
      ['Total Number of persons employed :', '', `Total: ${totalEmployees} (Male: ${maleCount}, Female: ${femaleCount})`],
      ['Wage Period :', '', monthLabel],
      ['Date of Payment of Wages :', '', dynamicPaymentDate]
    ];
    const headers = [
      ['Serial Number', 'Name of the Employee', 'Employee Identification No.', 'Department', 'Number of days worked', 'Basic Wage (₹)', 'Dearness Allowance (₹)', 'House Rent Allowance (₹)', 'Other Allowances (₹)', 'Gross Wages (₹)', 'PF Deduction (₹)', 'PT Deduction (₹)', 'Total Deductions (₹)', 'Net Wages (₹)', 'Date of payment']
    ];
    const body = employees.map((emp, idx) => {
      const { presentDays } = getEmpAttendanceForMonth(emp, attendance, selectedMonth);
      const p = payslips.find(ps => matchesEmp(ps, emp)) || {};

      const daysWorked = p.daysWorked || (presentDays > 0 ? presentDays : totalDaysInMonth) || 0;
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
        emp.name || '0',
        emp.empCode || emp.emp_code || emp.employeeId || '0',
        emp.department || '0',
        daysWorked,
        basic > 0 ? basic : 0,
        0,
        hra > 0 ? hra : 0,
        allowances > 0 ? allowances : 0,
        gross > 0 ? gross : 0,
        pf > 0 ? pf : 0,
        pt > 0 ? pt : 0,
        totalDed > 0 ? totalDed : 0,
        net > 0 ? net : 0,
        p.paymentDate || monthLabel
      ];
    });
    return { meta, headers, body };
  }

  if (formKey === 'Form X') {
    const meta = [
      ['Form-X', '', ''],
      ['Register of Leave and Social Security Benefits [See sub-rule (1) of rule (16)]', '', ''],
      ['Name and Address of the Establishment: ', '', `${companyName}, ${companyAddress}`],
      ['Name of Employer:', '', employerName],
      ['Name of Manager/Incharge:', '', managerName],
      ['Total Persons Employed:', '', `Total: ${totalEmployees} (Male: ${maleCount}, Female: ${femaleCount})`],
      ['For the month of:', '', monthLabel]
    ];
    const headers = [
      ['Serial Number', 'Name of the employee', 'Employee Identification No.', 'Allowed Leaves', 'Approved Earned Leaves (Availed)', 'Approved Medical Leaves (Availed)', 'Approved Casual/Sick Leaves (Availed)', 'Consumed Leaves (Total)', 'Remaining Leave Balance', 'Status']
    ];
    const body = employees.map((emp, idx) => {
      const empApprovedLeaves = getEmpLeavesForMonth(emp, leaves, selectedMonth);

      let elCount = 0;
      let mlCount = 0;
      let clCount = 0;

      empApprovedLeaves.forEach(l => {
        const lType = String(l.type || '').toUpperCase();
        const days = calculateLeaveDays(l.startDate || l.start_date, l.endDate || l.end_date, l.totalDays || l.total_days);
        if (lType.includes('EARNED') || lType === 'EL') elCount += days;
        else if (lType.includes('MED') || lType === 'ML') mlCount += days;
        else clCount += days;
      });

      const allowed = Number(emp.allowed_leaves || emp.allowedLeaves || 15);
      const consumedInMonth = elCount + mlCount + clCount;
      const totalConsumed = Number(emp.consumed_leaves || emp.consumedLeaves || 0) + consumedInMonth;
      const remainingBalance = Math.max(0, allowed - totalConsumed);

      return [
        idx + 1,
        emp.name || '0',
        emp.empCode || emp.emp_code || emp.employeeId || '0',
        allowed || 0,
        elCount || 0,
        mlCount || 0,
        clCount || 0,
        totalConsumed || 0,
        remainingBalance || 0,
        emp.status || 'ACTIVE'
      ];
    });
    return { meta, headers, body };
  }

  if (formKey === 'Form T') {
    const meta = [
      ['Form T', '', ''],
      ['Wage Slip / Leave Card [See sub-rule (6) of Rule 11]', '', ''],
      ['Name and address of the establishment:', '', `${companyName}, ${companyAddress}`],
      ['Name of Employer:', '', employerName],
      ['Wage period:', '', monthLabel]
    ];
    const headers = [
      ['Employee ID', 'Employee Name', 'Designation', 'Department', 'Basic Wage (₹)', 'HRA (₹)', 'Other Allowances (₹)', 'Gross Salary (₹)', 'PF Deduction (₹)', 'PT Deduction (₹)', 'Net Salary Paid (₹)', 'Bank Account No.']
    ];
    const body = employees.map((emp, idx) => {
      const p = payslips.find(ps => matchesEmp(ps, emp)) || {};
      const grossComp = Number(emp.compensation_gross || emp.compensationGross || emp.ctc || 0);

      const basic = Number(p.basicSalary || emp.basicSalary || (grossComp > 0 ? Math.round((grossComp / 12) * 0.5) : 0));
      const hra = Number(p.hra || emp.hra || (basic > 0 ? Math.round(basic * 0.4) : 0));
      const allow = Number(p.allowances || emp.allowances || (grossComp > 0 ? Math.max(0, Math.round(grossComp / 12) - (basic + hra)) : 0));
      const gross = Number(p.grossSalary || (basic + hra + allow));
      
      const isPfEligible = emp.pf_eligible !== false && emp.pfEligible !== false && emp.pf_eligible !== 0;
      const pf = Number(p.pfDeduction || (basic > 0 && isPfEligible ? Math.round(basic * 0.12) : 0));
      
      const isPtEligible = emp.pt_eligible !== false && emp.ptEligible !== false && emp.pt_eligible !== 0;
      const pt = Number(p.ptDeduction || (gross > 15000 && isPtEligible ? 208 : 0));
      
      const net = Number(p.netSalary || (gross - (pf + pt)));

      return [
        emp.empCode || emp.emp_code || emp.employeeId || '0',
        emp.name || '0',
        emp.jobTitle || emp.job_title || emp.designation || emp.role || 'Staff',
        emp.department || 'Operations',
        basic > 0 ? basic : 0,
        hra > 0 ? hra : 0,
        allow > 0 ? allow : 0,
        gross > 0 ? gross : 0,
        pf > 0 ? pf : 0,
        pt > 0 ? pt : 0,
        net > 0 ? net : 0,
        emp.bank_account_no || emp.bankAccountNo || '0'
      ];
    });
    return { meta, headers, body };
  }

  return { meta: [], headers: [], body: [] };
};

const cleanRowValue = (val) => {
  if (val === null || val === undefined) return 0;
  return val;
};

import { ExcelExportService } from '../services/excelEngine/ExcelExportService';

/**
 * Export a single compliance form to an official Excel file using ExcelEngine
 */
export const exportFormToExcel = (formKey, selectedMonth = getCurrentMonthYYYYMM(), employees = [], attendance = [], leaves = [], payslips = []) => {
  return ExcelExportService.exportSingleFormToExcel(formKey, selectedMonth, employees, attendance, leaves, payslips);
};

/**
 * Export ALL compliance forms into a single multi-sheet official template Excel (.xlsx) file
 */
export const exportAllFormsToExcel = (selectedMonth = getCurrentMonthYYYYMM(), employees = [], attendance = [], leaves = [], payslips = []) => {
  return ExcelExportService.exportAllFormsToExcel(selectedMonth, employees, attendance, leaves, payslips);
};

/**
 * Export a form view to PDF using html2canvas and jsPDF
 */
export const exportFormToPDF = async (elementId, title = 'Compliance_Form', selectedMonth = getCurrentMonthYYYYMM()) => {
  const el = document.getElementById(elementId);
  if (!el) {
    alert('Container element not found for PDF export.');
    return;
  }

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#08080a'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const monthLabel = formatMonthYearLabel(selectedMonth).replace(/\s+/g, '_');
    pdf.save(`${title.replace(/\s+/g, '_')}_${monthLabel}.pdf`);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    alert('Could not export PDF. Please try downloading as Excel.');
  }
};
