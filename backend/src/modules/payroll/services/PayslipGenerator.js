const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Payslip, Employee, PayrollItem, PayrollRun } = require('../../../shared/models/index');

/**
 * Converts numbers into Indian Rupee words (INR)
 */
function numberToWordsINR(num) {
    if (!num || isNaN(num)) return 'Zero Rupees Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
        if ((n = n.toString()).length > 9) return 'overflow';
        let n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n_array) return '';
        let str = '';
        str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
        str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
        str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
        str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
        str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
        return str;
    }
    const val = Math.round(num);
    const words = inWords(val);
    return `Rupees ${words.trim()} Only`;
}

class PayslipGenerator {
  /**
   * Generates a premium enterprise HTML payslip template
   */
  generateHtmlTemplate(employee, run, item) {
    const earningsObj = item.earningsBreakdown || {};
    const deductionsObj = item.deductionsBreakdown || {};

    const earningLabels = {
      BASIC: 'Basic Salary',
      HRA: 'House Rent Allowance (HRA)',
      SPECIAL_ALLOWANCE: 'Special Allowance',
      OVERTIME: 'Overtime Allowance'
    };

    const deductionLabels = {
      PT: 'Professional Tax (PT)',
      EPF_EE: 'Provident Fund (EPF)',
      ESI_EE: 'Employee State Insurance (ESIC)',
      TDS: 'Income Tax (TDS)',
      LWF: 'Labour Welfare Fund (LWF)',
      LOAN_EMI: 'Loan Repayment (EMI)'
    };

    const earningsRows = Object.entries(earningsObj)
      .map(([k, v]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">${earningLabels[k] || k.replace(/_/g, ' ').toUpperCase()}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">₹${Number(v).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

    const deductionsRows = Object.entries(deductionsObj)
      .map(([k, v]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">${deductionLabels[k] || k.replace(/_/g, ' ').toUpperCase()}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #991b1b; text-align: right; font-weight: 600;">₹${Number(v).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

    const netPayWords = numberToWordsINR(item.netSalary);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payslip - ${run.month} - ${employee.name}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; margin: 0; padding: 20px; background-color: #f8fafc; }
        .payslip-card { max-width: 800px; margin: auto; padding: 36px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
        .company-name { font-size: 22px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
        .company-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
        .payslip-title-badge { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; text-align: right; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 28px; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { padding: 5px 0; font-size: 13px; }
        .info-table td.label { color: #64748b; font-weight: 600; width: 42%; }
        .info-table td.val { color: #0f172a; font-weight: 700; }

        .financial-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
        .financial-col { vertical-align: top; }
        .col-header { background: #f1f5f9; padding: 10px 14px; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #334155; border-bottom: 1px solid #cbd5e1; }
        
        .totals-bar { display: flex; justify-content: space-between; padding: 12px 14px; background: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 14px; font-weight: 800; }
        .tot-earn { color: #15803d; }
        .tot-ded { color: #b91c1c; }

        .net-pay-card { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 20px 24px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
        .net-label { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }
        .net-words { font-size: 12px; margin-top: 4px; font-style: italic; opacity: 0.85; }
        .net-amount { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }

        .sig-section { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
        .sig-box { width: 220px; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 12px; font-weight: 700; color: #475569; }

        .footer-note { margin-top: 36px; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="payslip-card">
        <!-- Header -->
        <div class="header-bar">
          <div>
            <div class="company-name">HYDROMATERIALS</div>
            <div class="company-sub">Registered Corporate Entity | HR & Workforce Operations</div>
          </div>
          <div class="payslip-title-badge">
            Payslip for ${run.month}
          </div>
        </div>

        <!-- Employee & Statutory Details -->
        <div class="info-grid">
          <table class="info-table">
            <tr><td class="label">Employee Name:</td><td class="val">${employee.name}</td></tr>
            <tr><td class="label">Employee Code:</td><td class="val">${employee.id}</td></tr>
            <tr><td class="label">Designation:</td><td class="val">${employee.designation || 'Staff'}</td></tr>
            <tr><td class="label">Department:</td><td class="val">${employee.department || 'Operations'}</td></tr>
            <tr><td class="label">Joining Date:</td><td class="val">${employee.joiningDate || 'N/A'}</td></tr>
          </table>

          <table class="info-table">
            <tr><td class="label">Bank Name:</td><td class="val">${employee.bankName || 'HDFC Bank'}</td></tr>
            <tr><td class="label">Bank Account:</td><td class="val">${employee.bankAccountNo || 'XXXXXXXX1234'}</td></tr>
            <tr><td class="label">PF / UAN No:</td><td class="val">${employee.pfNumber || '101928374650'}</td></tr>
            <tr><td class="label">ESIC Number:</td><td class="val">${employee.esicNumber || '3102938475'}</td></tr>
            <tr><td class="label">Worked / LOP:</td><td class="val">${item.workedDays} Days / ${item.lopDays} LOP</td></tr>
          </table>
        </div>

        <!-- Financial Breakdown Table -->
        <div class="financial-grid">
          <!-- Earnings Column -->
          <div class="financial-col" style="border-right: 1px solid #cbd5e1;">
            <div class="col-header">Earnings</div>
            <table style="width: 100%; border-collapse: collapse;">
              ${earningsRows}
            </table>
            <div class="totals-bar">
              <span>Gross Earnings</span>
              <span class="tot-earn">₹${Number(item.grossEarned).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <!-- Deductions Column -->
          <div class="financial-col">
            <div class="col-header">Deductions</div>
            <table style="width: 100%; border-collapse: collapse;">
              ${deductionsRows}
            </table>
            <div class="totals-bar">
              <span>Total Deductions</span>
              <span class="tot-ded">₹${Number(item.totalDeductions).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <!-- Net Salary Summary Banner -->
        <div class="net-pay-card">
          <div>
            <div class="net-label">Net Salary Payable</div>
            <div class="net-words">${netPayWords}</div>
          </div>
          <div class="net-amount">
            ₹${Number(item.netSalary).toLocaleString('en-IN')}
          </div>
        </div>

        <!-- Dual Signature Section -->
        <div class="sig-section">
          <div class="sig-box">Employee Signature</div>
          <div class="sig-box">Authorized Signatory / Seal</div>
        </div>

        <!-- Verification Footer -->
        <div class="footer-note">
          This is a computer-generated document. No physical signature is required.<br/>
          Security Hash: ${crypto.createHash('sha256').update(`${employee.id}-${run.month}-${item.netSalary}`).digest('hex')}
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generates payslip files for a run
   */
  async generatePayslipForEmployee(payrollItemId) {
    const item = await PayrollItem.findByPk(payrollItemId, {
      include: [
        { model: Employee, as: 'employee' },
        { model: PayrollRun, as: 'payrollRun' }
      ]
    });

    if (!item || !item.employee || !item.payrollRun) {
      throw new Error('Payroll item dependencies not resolved.');
    }

    const htmlContent = this.generateHtmlTemplate(item.employee, item.payrollRun, item);

    // Save locally
    const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', '..', '..', 'storage');
    const folder = path.join(STORAGE_PATH, 'payslips');
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const fileName = `payslip_${item.employee.id}_${item.payrollRun.month}.html`;
    const fullPath = path.join(folder, fileName);
    fs.writeFileSync(fullPath, htmlContent);

    const relativePath = `payslips/${fileName}`;
    const secureHash = crypto.createHash('sha256').update(htmlContent).digest('hex');

    // Save payslip record
    const payslip = await Payslip.create({
      payrollItemId: item.id,
      employeeId: item.employee.id,
      month: item.payrollRun.month,
      filePath: relativePath,
      secureHash,
      emailSentStatus: true
    });

    return payslip;
  }

  /**
   * Bulk generation
   */
  async bulkGenerate(payrollRunId) {
    const items = await PayrollItem.findAll({
      where: { payrollRunId, status: 'COMPLETED' }
    });

    const payslips = [];
    for (const item of items) {
      const ps = await this.generatePayslipForEmployee(item.id);
      payslips.push(ps);
    }
    return payslips;
  }
}

module.exports = new PayslipGenerator();
