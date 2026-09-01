import { DataMapper } from './DataMapper.js';
import { ExcelStyleCopier } from './ExcelStyleCopier.js';
import { MergeManager } from './MergeManager.js';
import { FormulaExtender } from './FormulaExtender.js';
import { AttendanceColumnGenerator } from './AttendanceColumnGenerator.js';

export class SheetRenderer {
  /**
   * Completely purges leftover template sample rows beyond actual database records
   */
  static cleanUnusedTemplateRows(worksheet, startRowIndex, actualRecordCount, maxCols = 50) {
    if (!worksheet) return;
    const lastFilledRowIndex = startRowIndex + actualRecordCount - 1;
    const totalSheetRows = Math.max(worksheet.rowCount || 0, 50);

    for (let r = lastFilledRowIndex + 1; r <= totalSheetRows; r++) {
      const row = worksheet.findRow(r) || worksheet.getRow(r);
      if (!row) continue;

      // Clear cell values to erase sample template employees
      for (let c = 1; c <= maxCols; c++) {
        const cell = row.getCell(c);
        if (cell) {
          cell.value = null;
        }
      }
      row.commit();
    }
  }

  /**
   * Render Form U on loaded official template sheet
   */
  static renderFormU(worksheet, employees = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const meta = DataMapper.mapMetadata(employees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);

    // Fill metadata headers dynamically from DB
    worksheet.getCell('D4').value = [meta.companyName, meta.companyAddress].filter(Boolean).join(', ');
    worksheet.getCell('D5').value = meta.employerName || '';
    worksheet.getCell('D6').value = meta.managerName || '';
    worksheet.getCell('D7').value = meta.regNo || '';
    worksheet.getCell('D8').value = monthLabel;
    if (worksheet.getCell('D9')) {
      worksheet.getCell('D9').value = `Total Employed: ${meta.totalEmployees} (Male: ${meta.maleCount}, Female: ${meta.femaleCount})`;
    }

    const templateRowIndex = 11;
    const templateRow = worksheet.getRow(templateRowIndex);
    const formURows = DataMapper.mapFormURows(employees);

    formURows.forEach((rowData, idx) => {
      const targetRowIndex = templateRowIndex + idx;
      const targetRow = worksheet.getRow(targetRowIndex);

      if (idx > 0) {
        ExcelStyleCopier.copyRowFormat(templateRow, targetRow, rowData.length);
      }

      rowData.forEach((val, colIdx) => {
        targetRow.getCell(colIdx + 1).value = val;
      });

      targetRow.commit();
    });

    this.cleanUnusedTemplateRows(worksheet, templateRowIndex, formURows.length, 12);

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  /**
   * Render Form S on loaded official template sheet
   */
  static renderFormS(worksheet, employees = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const meta = DataMapper.mapMetadata(employees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);

    worksheet.getCell('D4').value = [meta.companyName, meta.companyAddress].filter(Boolean).join(', ');
    worksheet.getCell('D5').value = meta.employerName || '';
    worksheet.getCell('D6').value = meta.managerName || '';
    worksheet.getCell('D7').value = monthLabel;
    if (worksheet.getCell('D8')) {
      worksheet.getCell('D8').value = `Total Employed: ${meta.totalEmployees} (Male: ${meta.maleCount}, Female: ${meta.femaleCount})`;
    }
    if (worksheet.getCell('O5')) {
      worksheet.getCell('O5').value = meta.paymentDate;
    }

    const templateRowIndex = 11;
    const templateRow = worksheet.getRow(templateRowIndex);
    const formSRows = DataMapper.mapFormSRows(employees);

    formSRows.forEach((rowData, idx) => {
      const targetRowIndex = templateRowIndex + idx;
      const targetRow = worksheet.getRow(targetRowIndex);

      if (idx > 0) {
        ExcelStyleCopier.copyRowFormat(templateRow, targetRow, rowData.length);
      }

      rowData.forEach((val, colIdx) => {
        targetRow.getCell(colIdx + 1).value = val;
      });
      targetRow.commit();
    });

    this.cleanUnusedTemplateRows(worksheet, templateRowIndex, formSRows.length, 15);

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  /**
   * Render Form V Muster on loaded official template sheet
   */
  static renderFormVMuster(worksheet, employees = [], attendance = [], leaves = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const meta = DataMapper.mapMetadata(employees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);

    worksheet.getCell('D4').value = meta.companyName;
    worksheet.getCell('D5').value = meta.companyAddress;
    worksheet.getCell('D6').value = meta.managerName || '';
    worksheet.getCell('D7').value = `${monthLabel} | Total Workers: ${meta.totalEmployees} (Male: ${meta.maleCount}, Female: ${meta.femaleCount})`;

    const templateRowIndex = 12;
    const templateRow = worksheet.getRow(templateRowIndex);
    const musterData = DataMapper.mapFormVMusterRows(employees, attendance, leaves, selectedMonth);

    musterData.forEach((empData, idx) => {
      const targetRowIndex = templateRowIndex + idx;
      const targetRow = worksheet.getRow(targetRowIndex);

      if (idx > 0) {
        ExcelStyleCopier.copyRowFormat(templateRow, targetRow, 40);
      }

      targetRow.getCell(1).value = empData.seq;
      targetRow.getCell(2).value = empData.name;
      targetRow.getCell(3).value = empData.fatherSpouse;
      targetRow.getCell(4).value = empData.gender;
      targetRow.getCell(5).value = empData.doj;
      targetRow.getCell(6).value = empData.designation;

      let presentDays = 0;
      let leaveDays = 0;
      let woDays = 0;

      empData.dailySymbols.forEach((sym, dIdx) => {
        targetRow.getCell(7 + dIdx).value = sym;
        if (sym === 'P' || sym === 'HD') presentDays++;
        else if (sym === 'SL' || sym === 'CL' || sym === 'EL' || sym === 'L') leaveDays++;
        else if (sym === 'WO') woDays++;
      });

      const totalDays = empData.dailySymbols.length;
      const absentDays = Math.max(0, totalDays - presentDays - leaveDays - woDays);

      targetRow.getCell(7 + totalDays).value = presentDays;
      targetRow.getCell(7 + totalDays + 1).value = leaveDays;
      targetRow.getCell(7 + totalDays + 2).value = woDays;
      targetRow.getCell(7 + totalDays + 3).value = absentDays;

      targetRow.commit();
    });

    this.cleanUnusedTemplateRows(worksheet, templateRowIndex, musterData.length, 42);

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  /**
   * Render Form V Register on loaded official template sheet
   */
  static renderFormVRegister(worksheet, employees = [], attendance = [], leaves = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const meta = DataMapper.mapMetadata(employees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);
    const daysInMonth = AttendanceColumnGenerator.getDaysInMonth(selectedMonth);

    worksheet.getCell('D4').value = [meta.companyName, meta.companyAddress].filter(Boolean).join(', ');
    worksheet.getCell('D5').value = meta.employerName || '';
    worksheet.getCell('D6').value = meta.managerName || '';
    worksheet.getCell('D7').value = `${monthLabel} | Total Persons: ${meta.totalEmployees} (Male: ${meta.maleCount}, Female: ${meta.femaleCount})`;

    const templateRowIndex = 12;
    const templateRow = worksheet.getRow(templateRowIndex);

    const [year, month] = selectedMonth.split('-');

    employees.forEach((emp, idx) => {
      const targetRowIndex = templateRowIndex + idx;
      const targetRow = worksheet.getRow(targetRowIndex);

      if (idx > 0) {
        ExcelStyleCopier.copyRowFormat(templateRow, targetRow, 38);
      }

      const empPunches = attendance.filter(a => DataMapper.matchesEmp(a, emp));
      const empLeaves = leaves.filter(l => DataMapper.matchesEmp(l, emp));

      targetRow.getCell(1).value = idx + 1;
      targetRow.getCell(2).value = emp.name || '';
      targetRow.getCell(3).value = emp.empCode || emp.emp_code || emp.employeeId || '';
      targetRow.getCell(4).value = emp.startTime || '09:00 AM';
      targetRow.getCell(5).value = emp.restInterval || '0.5 Hr';
      targetRow.getCell(6).value = emp.endTime || '06:00 PM';

      for (let day = 1; day <= daysInMonth; day++) {
        const dayPad = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayPad}`;
        const sym = AttendanceColumnGenerator.getAttendanceSymbol(dateStr, empPunches, empLeaves, emp.weekly_offs || emp.weeklyOffs);
        targetRow.getCell(6 + day).value = (sym === 'P' || sym === 'HD') ? 8 : (sym === 'WO' ? 'WO' : (sym === 'SL' || sym === 'CL' || sym === 'EL' || sym === 'L' ? 'L' : 0));
      }

      targetRow.commit();
    });

    this.cleanUnusedTemplateRows(worksheet, templateRowIndex, employees.length, 40);

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  /**
   * Render Form W on loaded official template sheet
   */
  static renderFormW(worksheet, employees = [], attendance = [], payslips = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const meta = DataMapper.mapMetadata(employees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);

    worksheet.getCell('D4').value = [meta.companyName, meta.companyAddress].filter(Boolean).join(', ');
    worksheet.getCell('D5').value = meta.employerName || '';
    worksheet.getCell('D6').value = meta.managerName || '';
    worksheet.getCell('D7').value = meta.regNo || '';
    worksheet.getCell('A8').value = `Wage Period: ${monthLabel} | Total: ${meta.totalEmployees} (Male: ${meta.maleCount}, Female: ${meta.femaleCount}) | Payment Date: ${meta.paymentDate}`;

    const templateRowIndex = 14;
    const templateRow = worksheet.getRow(templateRowIndex);
    const formWRows = DataMapper.mapFormWRows(employees, attendance, payslips, selectedMonth);

    formWRows.forEach((rowData, idx) => {
      const targetRowIndex = templateRowIndex + idx;
      const targetRow = worksheet.getRow(targetRowIndex);

      if (idx > 0) {
        ExcelStyleCopier.copyRowFormat(templateRow, targetRow, rowData.length);
      }

      rowData.forEach((val, colIdx) => {
        targetRow.getCell(colIdx + 1).value = val;
      });
      targetRow.commit();
    });

    this.cleanUnusedTemplateRows(worksheet, templateRowIndex, formWRows.length, 30);

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  /**
   * Render Form X on loaded official template sheet
   */
  static renderFormX(worksheet, employees = [], leaves = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const meta = DataMapper.mapMetadata(employees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);

    worksheet.getCell('D4').value = [meta.companyName, meta.companyAddress].filter(Boolean).join(', ');
    worksheet.getCell('D5').value = meta.employerName || '';
    worksheet.getCell('D6').value = meta.managerName || '';
    worksheet.getCell('D7').value = meta.regNo || '';
    worksheet.getCell('A8').value = `For the month of ${monthLabel} | Total: ${meta.totalEmployees} (Male: ${meta.maleCount}, Female: ${meta.femaleCount})`;

    const templateRowIndex = 12;
    const templateRow = worksheet.getRow(templateRowIndex);

    employees.forEach((emp, idx) => {
      const targetRowIndex = templateRowIndex + idx;
      const targetRow = worksheet.getRow(targetRowIndex);

      if (idx > 0) {
        ExcelStyleCopier.copyRowFormat(templateRow, targetRow, 20);
      }

      const empLeaves = leaves.filter(l => DataMapper.matchesEmp(l, emp));
      let elCount = 0;
      let mlCount = 0;
      let clCount = 0;

      empLeaves.forEach(l => {
        const type = String(l.type || '').toUpperCase();
        if (type.includes('EARNED') || type === 'EL') elCount++;
        else if (type.includes('MED') || type === 'ML') mlCount++;
        else clCount++;
      });

      const allowed = Number(emp.allowed_leaves || emp.allowedLeaves || 15);
      const openingEarned = Number(emp.earned_leaves || emp.earnedLeaves || 1);
      const openingMedical = Number(emp.medical_leaves || emp.medicalLeaves || 0);
      const openingCasual = Number(emp.casual_leaves || emp.casualLeaves || 0);

      targetRow.getCell(1).value = idx + 1;
      targetRow.getCell(2).value = emp.name || '';
      targetRow.getCell(3).value = emp.empCode || emp.emp_code || emp.employeeId || '';
      targetRow.getCell(4).value = allowed;
      targetRow.getCell(5).value = openingEarned;
      targetRow.getCell(6).value = elCount;
      targetRow.getCell(7).value = { formula: `=+D${targetRowIndex}+E${targetRowIndex}-F${targetRowIndex}` };
      targetRow.getCell(8).value = openingMedical;
      targetRow.getCell(9).value = mlCount;
      targetRow.getCell(10).value = 0;
      targetRow.getCell(11).value = openingCasual;
      targetRow.getCell(12).value = clCount;
      targetRow.getCell(13).value = 0;
      targetRow.getCell(14).value = emp.status || 'ACTIVE';

      targetRow.commit();
    });

    this.cleanUnusedTemplateRows(worksheet, templateRowIndex, employees.length, 20);

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  /**
   * Render Form T on loaded official template sheet (Multi-Employee with Keka-style spacing & dynamic live sync)
   */
  static renderFormT(worksheet, employees = [], payslips = [], selectedMonth = new Date().toISOString().slice(0, 7)) {
    if (!worksheet) return;

    const activeEmployees = (employees || []).filter(e => e && e.status !== 'PAST');
    if (!activeEmployees.length) return;

    const meta = DataMapper.mapMetadata(activeEmployees, selectedMonth);
    const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3);
    const daysInMonth = AttendanceColumnGenerator.getDaysInMonth(selectedMonth);

    const CARD_ROWS = 18;
    const SPACER_ROWS = 2;
    const BLOCK_SIZE = CARD_ROWS + SPACER_ROWS;

    // Merge coordinates relative to top of each 18-row card block [r1, c1, r2, c2]
    const MERGE_OFFSETS = [
      [1, 1, 1, 10],   // A1:J1 (Form T Header)
      [2, 1, 2, 10],   // A2:J2 (Wage Slip/Leave Card)
      [3, 1, 3, 10],   // A3:J3 ([See sub-rule (6) of Rule 11])
      [4, 1, 4, 2],    // A4:B4 (1. Name and address label)
      [4, 3, 4, 10],   // C4:J4 (Establishment details)
      [5, 1, 5, 2],    // A5:B5 (2. Name of person employed label)
      [5, 3, 5, 10],   // C5:J5 (Employee Name)
      [6, 1, 6, 2],    // A6:B6 (3. Father/Husband's Name label)
      [6, 3, 6, 10],   // C6:J6 (Father / Spouse Name)
      [7, 1, 7, 2],    // A7:B7 (4. Designation label)
      [7, 3, 7, 10],   // C7:J7 (Designation)
      [8, 1, 8, 2],    // A8:B8 (5. Date of entry into service label)
      [8, 3, 8, 10],   // C8:J8 (Date of Joining)
      [9, 1, 9, 2],    // A9:B9 (6. Wage period label)
      [9, 3, 9, 6],    // C9:F9 (From: 01 Month)
      [9, 7, 9, 10],   // G9:J9 (To: 31 Month)
      [10, 1, 10, 2],  // A10:B10 (7. Earnings label)
      [10, 3, 10, 10], // C10:J10 (Deductions label)
      [11, 3, 11, 6],  // C11:F11 (PF Employee label)
      [11, 7, 11, 10], // G11:J11 (PF Amount)
      [12, 3, 12, 6],  // C12:F12 (Professional Tax label)
      [12, 7, 12, 10], // G12:J12 (PT Amount)
      [13, 3, 13, 10], // C13:J13 (Other deductions / blank)
      [14, 3, 14, 6],  // C14:F14 (Net Amount Paid label)
      [14, 7, 14, 10], // G14:J14 (Net Amount)
      [15, 1, 15, 2],  // A15:B15 (Leave Availed label)
      [16, 1, 16, 2],  // A16:B16 (Leave Credit label)
      [17, 1, 17, 2],  // A17:B17 (Signature Employer label)
      [17, 3, 17, 10]  // C17:J17 (Signature Employee label)
    ];

    activeEmployees.forEach((emp, idx) => {
      const startRow = 1 + idx * BLOCK_SIZE;

      // For idx > 0, clone formatting, cell labels, borders, and merges from template block (rows 1..18)
      if (idx > 0) {
        for (let r = 1; r <= CARD_ROWS; r++) {
          const srcRow = worksheet.getRow(r);
          const destRow = worksheet.getRow(startRow + r - 1);
          if (srcRow.height) destRow.height = srcRow.height;

          for (let c = 1; c <= 10; c++) {
            const srcCell = srcRow.getCell(c);
            const destCell = destRow.getCell(c);
            destCell.value = srcCell.value;

            if (srcCell.font) destCell.font = JSON.parse(JSON.stringify(srcCell.font));
            if (srcCell.fill) destCell.fill = JSON.parse(JSON.stringify(srcCell.fill));
            if (srcCell.border) destCell.border = JSON.parse(JSON.stringify(srcCell.border));
            if (srcCell.alignment) destCell.alignment = JSON.parse(JSON.stringify(srcCell.alignment));
            if (srcCell.numFmt) destCell.numFmt = srcCell.numFmt;
          }
        }

        // Clone Merges with row offset
        MERGE_OFFSETS.forEach(([r1, c1, r2, c2]) => {
          const rowOffset = idx * BLOCK_SIZE;
          worksheet.mergeCells(r1 + rowOffset, c1, r2 + rowOffset, c2);
        });

        // Insert subtle Keka-style spacer divider band
        const spacerRow1 = worksheet.getRow(startRow - 2);
        const spacerRow2 = worksheet.getRow(startRow - 1);
        spacerRow1.height = 14;
        spacerRow2.height = 14;
        for (let c = 1; c <= 10; c++) {
          spacerRow1.getCell(c).value = '';
          spacerRow2.getCell(c).value = '';
          spacerRow1.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          spacerRow2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      }

      // Dynamic Salary & Statutory Calculations
      const p = payslips.find(ps => DataMapper.matchesEmp(ps, emp)) || {};

      const grossComp = Number(emp.compensation_gross || emp.compensationGross || emp.ctc || 0);
      const basic = Number(p.basicSalary || emp.basicSalary || (grossComp > 0 ? Math.round((grossComp / 12) * 0.5) : 0));
      const hra = Number(p.hra || emp.hra || (basic > 0 ? Math.round(basic * 0.4) : 0));
      const allowances = Number(p.allowances || emp.allowances || (grossComp > 0 ? Math.max(0, Math.round(grossComp / 12) - (basic + hra)) : 0));
      const gross = Number(p.grossSalary || (basic + hra + allowances));
      
      const isPfEligible = emp.pf_eligible !== false && emp.pfEligible !== false && emp.pf_eligible !== 0;
      const pf = Number(p.pfDeduction || (basic > 0 && isPfEligible ? Math.round(basic * 0.12) : 0));
      
      const isPtEligible = emp.pt_eligible !== false && emp.ptEligible !== false && emp.pt_eligible !== 0;
      const pt = Number(p.ptDeduction || (gross > 15000 && isPtEligible ? 208 : 0));
      
      const totalDed = Number(p.totalDeductions || (pf + pt));
      const net = Number(p.netSalary || (gross - totalDed));

      // Establishment & Employee Header Details
      worksheet.getCell(`C${startRow + 3}`).value = [meta.companyName, meta.companyAddress].filter(Boolean).join(', ');
      worksheet.getCell(`C${startRow + 4}`).value = `${emp.name || ''} (${emp.empCode || emp.emp_code || ''})`;
      worksheet.getCell(`C${startRow + 5}`).value = emp.fatherName || emp.father_name || emp.spouseName || 'N/A';
      worksheet.getCell(`C${startRow + 6}`).value = emp.jobTitle || emp.job_title || emp.designation || 'Staff';
      worksheet.getCell(`C${startRow + 7}`).value = emp.joiningDate || emp.joining_date || emp.doj || '01-01-2026';
      worksheet.getCell(`C${startRow + 8}`).value = `From: 01 ${monthLabel}`;
      worksheet.getCell(`G${startRow + 8}`).value = `To: ${daysInMonth} ${monthLabel}`;

      // Earnings Column (Col B)
      worksheet.getCell(`B${startRow + 10}`).value = basic > 0 ? basic : 0;
      worksheet.getCell(`B${startRow + 11}`).value = hra > 0 ? hra : 0;
      worksheet.getCell(`B${startRow + 12}`).value = allowances > 0 ? allowances : 0;
      worksheet.getCell(`B${startRow + 13}`).value = gross > 0 ? gross : 0;

      // Deductions & Net Pay Column (Col G)
      worksheet.getCell(`G${startRow + 10}`).value = pf > 0 ? pf : 0;
      worksheet.getCell(`G${startRow + 11}`).value = pt > 0 ? pt : 0;
      worksheet.getCell(`G${startRow + 13}`).value = net > 0 ? net : 0;
    });

    worksheet.pageSetup = {
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }
}
