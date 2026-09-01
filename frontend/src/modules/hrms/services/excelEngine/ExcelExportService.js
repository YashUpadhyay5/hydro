import { ExcelTemplateLoader } from './ExcelTemplateLoader.js';
import { SheetRenderer } from './SheetRenderer.js';
import { AttendanceColumnGenerator } from './AttendanceColumnGenerator.js';

export class ExcelExportService {
  /**
   * Export all forms as multi-sheet official template Excel (.xlsx) file
   */
  static async exportAllFormsToExcel(selectedMonth = new Date().toISOString().slice(0, 7), employees = [], attendance = [], leaves = [], payslips = []) {
    try {
      const workbook = await ExcelTemplateLoader.loadTemplate();

      // Render each sheet on the official template workbook
      const wsFormU = workbook.getWorksheet('Form U');
      if (wsFormU) SheetRenderer.renderFormU(wsFormU, employees, selectedMonth);

      const wsFormS = workbook.getWorksheet('Form S');
      if (wsFormS) SheetRenderer.renderFormS(wsFormS, employees, selectedMonth);

      const wsFormVMuster = workbook.getWorksheet('Form V Muster');
      if (wsFormVMuster) SheetRenderer.renderFormVMuster(wsFormVMuster, employees, attendance, leaves, selectedMonth);

      const wsFormVReg = workbook.getWorksheet('Form V Register');
      if (wsFormVReg) SheetRenderer.renderFormVRegister(wsFormVReg, employees, attendance, leaves, selectedMonth);

      const wsFormW = workbook.getWorksheet('Form W');
      if (wsFormW) SheetRenderer.renderFormW(wsFormW, employees, attendance, payslips, selectedMonth);

      const wsFormX = workbook.getWorksheet('Form X');
      if (wsFormX) SheetRenderer.renderFormX(wsFormX, employees, leaves, selectedMonth);

      const wsFormT = workbook.getWorksheet('Form T');
      if (wsFormT) SheetRenderer.renderFormT(wsFormT, employees, payslips, selectedMonth);

      // Generate binary buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3).replace(/\s+/g, '_');
      const filename = `HR_Compliance_Forms_Official_${monthLabel}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating official compliance excel:', err);
      alert('Could not generate Excel template output. Please check console logs.');
    }
  }

  /**
   * Export single form on official template workbook
   */
  static async exportSingleFormToExcel(formKey, selectedMonth = new Date().toISOString().slice(0, 7), employees = [], attendance = [], leaves = [], payslips = []) {
    try {
      const workbook = await ExcelTemplateLoader.loadTemplate();
      const targetSheet = workbook.getWorksheet(formKey);

      if (formKey === 'Form U' && targetSheet) SheetRenderer.renderFormU(targetSheet, employees, selectedMonth);
      else if (formKey === 'Form S' && targetSheet) SheetRenderer.renderFormS(targetSheet, employees, selectedMonth);
      else if (formKey === 'Form V Muster' && targetSheet) SheetRenderer.renderFormVMuster(targetSheet, employees, attendance, leaves, selectedMonth);
      else if (formKey === 'Form V Register' && targetSheet) SheetRenderer.renderFormVRegister(targetSheet, employees, attendance, leaves, selectedMonth);
      else if (formKey === 'Form W' && targetSheet) SheetRenderer.renderFormW(targetSheet, employees, attendance, payslips, selectedMonth);
      else if (formKey === 'Form X' && targetSheet) SheetRenderer.renderFormX(targetSheet, employees, leaves, selectedMonth);
      else if (formKey === 'Form T' && targetSheet) SheetRenderer.renderFormT(targetSheet, employees, payslips, selectedMonth);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const monthLabel = AttendanceColumnGenerator.getFormattedDayHeader(selectedMonth, 1).slice(3).replace(/\s+/g, '_');
      const filename = `${formKey.replace(/\s+/g, '_')}_Official_${monthLabel}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(`Error exporting ${formKey}:`, err);
      alert(`Could not export ${formKey}. Please check console logs.`);
    }
  }
}
