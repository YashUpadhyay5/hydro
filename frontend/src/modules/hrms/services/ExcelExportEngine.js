import * as XLSX from 'xlsx';

const FORMS_LIST = ['Form S', 'Form U', 'Form V Muster', 'Form V Register', 'Form W', 'Form X', 'Form T'];

/**
 * Format headers and data rows for a statutory form key
 */
function buildSheetData(formKey, month, records, companyName) {
  let headers = [];
  let rows = [];

  if (formKey === 'Form S') {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Gender', 'Designation', 'Joining Date', 'Shift Timing', 'Rest Interval', 'Weekly Off'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.gender, r.designation, r.joiningDate, r.shift, r.restInterval, r.weeklyOff]);
  } else if (formKey === 'Form U') {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Gender', 'Father Name', 'DOB', 'Joining Date', 'Designation', 'PF Eligible', 'PF No', 'ESI Eligible', 'ESIC No'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.gender, r.fatherName, r.dob, r.joiningDate, r.designation, r.pfEligible, r.pfNumber, r.esiEligible, r.esicNumber]);
  } else if (formKey === 'Form V Muster') {
    const daysInMonth = records[0]?.daysInMonth || 31;
    const dayCols = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    headers = ['S.No', 'Employee Name', 'Emp Code', ...dayCols, 'Present', 'Leaves', 'Sundays', 'Absent'];
    rows = records.map((r, i) => {
      const dayVals = [];
      for (let d = 1; d <= daysInMonth; d++) {
        dayVals.push(r.dayMarks?.[d] || 'A');
      }
      return [i + 1, r.name, r.empCode, ...dayVals, r.presentCount, r.leaveCount, r.sundayCount, r.absentCount];
    });
  } else if (formKey === 'Form V Register') {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Start Time', 'Rest Interval', 'End Time', 'Normal Hours/Day', 'Overtime Hours'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.startTime, r.restInterval, r.endTime, r.normalHours, r.overtimeHours]);
  } else if (formKey === 'Form W') {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Worked Days', 'Basic Salary (₹)', 'HRA (₹)', 'Allowances (₹)', 'Gross Salary (₹)', 'PF (₹)', 'PT (₹)', 'Total Deductions (₹)', 'Net Salary (₹)'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.daysWorked, r.basicSalary, r.hra, r.allowances, r.grossSalary, r.pfDeduction, r.ptDeduction, r.totalDeductions, r.netSalary]);
  } else if (formKey === 'Form X') {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Allowed Leaves', 'Consumed Leaves', 'Earned Leave (EL)', 'Casual Leave (CL)', 'Remaining Balance'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.allowedLeaves, r.consumedLeaves, r.elCount, r.clCount, r.remainingBalance]);
  } else if (formKey === 'Form T') {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Worked Days', 'Gross Salary (₹)', 'Basic (₹)', 'HRA (₹)', 'PF (₹)', 'PT (₹)', 'Net Payable (₹)', 'Bank Account No', 'Bank Name', 'IFSC Code'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.daysWorked, r.grossSalary, r.basicSalary, r.hra, r.pfDeduction, r.ptDeduction, r.netSalary, r.bankAccountNo, r.bankName, r.bankIfscCode]);
  } else {
    headers = ['S.No', 'Employee Name', 'Emp Code', 'Gender', 'Designation'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.gender, r.designation]);
  }

  const titleRow = [`STATUTORY COMPLIANCE REPORT - ${formKey.toUpperCase()}`];
  const subTitleRow = [`ESTABLISHMENT: ${companyName} | PERIOD: ${month}`];
  const blankRow = [];

  return [titleRow, subTitleRow, blankRow, headers, ...rows];
}

/**
 * Frontend Template Loader & Excel Export Engine
 */
export const ExcelExportEngine = {
  /**
   * Export Single Form Excel
   */
  exportClientExcel: (formKey, month, records, companyName = 'Company Establishment') => {
    if (!records || records.length === 0) {
      alert('No compliance records available for export.');
      return;
    }

    const wsData = buildSheetData(formKey, month, records, companyName);
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, formKey.substring(0, 31));

    const fileName = `${formKey.replace(/\s+/g, '_')}_${month}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  /**
   * Export Bulk ALL Statutory Forms in a Single Workbook (Multi-Tab)
   */
  exportAllClientExcel: (month, recordsMap, companyName = 'Company Establishment') => {
    const workbook = XLSX.utils.book_new();

    FORMS_LIST.forEach((formKey) => {
      const records = recordsMap[formKey] || [];
      if (records.length > 0) {
        const wsData = buildSheetData(formKey, month, records, companyName);
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(workbook, worksheet, formKey.substring(0, 31));
      }
    });

    const fileName = `All_Statutory_Compliance_Forms_${month}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  /**
   * Export via Backend Express ExcelJS streaming endpoint
   */
  exportServerExcel: async (formKey, month, token = '') => {
    try {
      const response = await fetch(`/api/compliance/export?formKey=${encodeURIComponent(formKey)}&month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Server export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formKey.replace(/\s+/g, '_')}_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Server Excel export fallback to client engine:', err);
    }
  },

  /**
   * Bulk Server Export (All Forms)
   */
  exportServerAllExcel: async (month, token = '') => {
    try {
      const response = await fetch(`/api/compliance/export-all?month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Server bulk export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All_Statutory_Compliance_Forms_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Server bulk Excel export fallback to client engine:', err);
    }
  }
};
