import { jsPDF } from 'jspdf';

const FORMS_LIST = ['Form S', 'Form U', 'Form V Muster', 'Form V Register', 'Form W', 'Form X', 'Form T'];

const FORM_TITLES = {
  'Form S': 'Notice of Daily Hours of Work, Rest Interval, Weekly Holiday (Rule 18(4))',
  'Form U': 'Employee Register (Rule 16(1))',
  'Form V Muster': 'Muster Roll - Daily Attendance (Rule 26(5))',
  'Form V Register': 'Register of Employment (Rule 16(1))',
  'Form W': 'Register of Wages (Rule 16(1))',
  'Form X': 'Register of Leave & Social Security (Rule 16(1))',
  'Form T': 'Wage Slip / Leave Card (Rule 11(6))'
};

function getHeadersAndRows(formKey, records) {
  let headers = [];
  let rows = [];

  if (formKey === 'Form S') {
    headers = ['#', 'Employee Name', 'Emp Code', 'Gender', 'Designation', 'Shift Timing', 'Rest Interval', 'Weekly Off'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.gender, r.designation, r.shift, r.restInterval, r.weeklyOff]);
  } else if (formKey === 'Form U') {
    headers = ['#', 'Employee Name', 'Emp Code', 'Gender', 'Father Name', 'DOB', 'Joining Date', 'Designation', 'PF No', 'ESIC No'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.gender, r.fatherName, r.dob, r.joiningDate, r.designation, r.pfNumber || '-', r.esicNumber || '-']);
  } else if (formKey === 'Form V Muster') {
    const daysInMonth = Math.min(records[0]?.daysInMonth || 31, 15); // Show first 15 days in PDF summary or key columns
    const dayCols = Array.from({ length: daysInMonth }, (_, i) => `D${i + 1}`);
    headers = ['#', 'Employee Name', 'Emp Code', ...dayCols, 'Present', 'Leaves', 'Absent'];
    rows = records.map((r, i) => {
      const dayVals = [];
      for (let d = 1; d <= daysInMonth; d++) {
        dayVals.push(r.dayMarks?.[d] || 'A');
      }
      return [i + 1, r.name, r.empCode, ...dayVals, r.presentCount, r.leaveCount, r.absentCount];
    });
  } else if (formKey === 'Form V Register') {
    headers = ['#', 'Employee Name', 'Emp Code', 'Start Time', 'Rest Interval', 'End Time', 'Normal Hours', 'OT Hours'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.startTime, r.restInterval, r.endTime, `${r.normalHours}h`, `${r.overtimeHours}h`]);
  } else if (formKey === 'Form W') {
    headers = ['#', 'Employee Name', 'Emp Code', 'Worked', 'Basic (₹)', 'HRA (₹)', 'Gross (₹)', 'PF (₹)', 'PT (₹)', 'Net Pay (₹)'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.daysWorked, r.basicSalary?.toLocaleString(), r.hra?.toLocaleString(), r.grossSalary?.toLocaleString(), r.pfDeduction, r.ptDeduction, r.netSalary?.toLocaleString()]);
  } else if (formKey === 'Form X') {
    headers = ['#', 'Employee Name', 'Emp Code', 'Allowed', 'Consumed', 'Earned Leave (EL)', 'Casual Leave (CL)', 'Remaining Balance'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.allowedLeaves, r.consumedLeaves, r.elCount, r.clCount, r.remainingBalance]);
  } else if (formKey === 'Form T') {
    headers = ['#', 'Employee Name', 'Emp Code', 'Worked', 'Gross (₹)', 'Basic (₹)', 'PF (₹)', 'Net Payable (₹)', 'Bank Account', 'IFSC'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.daysWorked, r.grossSalary?.toLocaleString(), r.basicSalary?.toLocaleString(), r.pfDeduction, r.netSalary?.toLocaleString(), r.bankAccountNo, r.bankIfscCode]);
  } else {
    headers = ['#', 'Employee Name', 'Emp Code', 'Gender', 'Designation'];
    rows = records.map((r, i) => [i + 1, r.name, r.empCode, r.gender, r.designation]);
  }

  return { headers, rows };
}

/**
 * Render single form page on jsPDF document
 */
function renderPdfPage(doc, formKey, month, records, companyName, isFirstPage = true) {
  if (!isFirstPage) {
    doc.addPage();
  }

  const title = FORM_TITLES[formKey] || formKey;
  const { headers, rows } = getHeadersAndRows(formKey, records);

  // Header Banner
  doc.setFillColor(31, 73, 125);
  doc.rect(10, 10, doc.internal.pageSize.width - 20, 18, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`STATUTORY COMPLIANCE REPORT - ${formKey.toUpperCase()}`, 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${title}`, 14, 24);

  // Metadata Box
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.text(`Establishment: ${companyName}`, 14, 34);
  doc.text(`Period: ${month}  |  Total Active Employees: ${records.length}`, 14, 40);
  doc.line(10, 44, doc.internal.pageSize.width - 10, 44);

  // Render Table manually using jsPDF primitives
  let startY = 50;
  const colWidth = (doc.internal.pageSize.width - 24) / headers.length;
  
  // Table Header Row
  doc.setFillColor(240, 243, 246);
  doc.rect(12, startY, doc.internal.pageSize.width - 24, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  headers.forEach((h, idx) => {
    doc.text(String(h), 14 + (idx * colWidth), startY + 6);
  });

  startY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  rows.forEach((row, rIdx) => {
    if (startY > doc.internal.pageSize.height - 20) {
      doc.addPage();
      startY = 20;
    }

    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(12, startY - 4, doc.internal.pageSize.width - 24, 7, 'F');
    }

    row.forEach((val, cIdx) => {
      const textVal = String(val !== undefined && val !== null ? val : '-');
      doc.text(textVal.substring(0, 18), 14 + (cIdx * colWidth), startY);
    });

    startY += 7;
  });

  // Footer Note
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated on ${new Date().toLocaleDateString()} - Official Statutory Labor Compliance Engine`, 14, doc.internal.pageSize.height - 8);
}

export const PdfExportEngine = {
  /**
   * Export Single Form as PDF
   */
  exportSinglePdf: (formKey, month, records, companyName = 'Company Establishment') => {
    if (!records || records.length === 0) {
      alert('No records available to generate PDF.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    renderPdfPage(doc, formKey, month, records, companyName, true);

    const fileName = `${formKey.replace(/\s+/g, '_')}_${month}.pdf`;
    doc.save(fileName);
  },

  /**
   * Export ALL 7 Statutory Forms in a Single PDF Bundle Document
   */
  exportAllPdf: (month, allFormsMap, companyName = 'Company Establishment') => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let isFirst = true;

    FORMS_LIST.forEach((formKey) => {
      const records = allFormsMap[formKey] || [];
      if (records.length > 0) {
        renderPdfPage(doc, formKey, month, records, companyName, isFirst);
        isFirst = false;
      }
    });

    const fileName = `All_Statutory_Compliance_Forms_${month}.pdf`;
    doc.save(fileName);
  }
};
