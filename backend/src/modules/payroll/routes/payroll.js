const express = require('express');
const router = express.Router();
const { 
  PayrollRun, 
  PayrollItem, 
  Employee, 
  Loan, 
  LoanRepayment, 
  Reimbursement, 
  TaxRecord, 
  SalaryStructure, 
  SalaryComponent, 
  EmployeeSalaryComponent,
  Payslip,
  Document
} = require('../../../shared/models/index');
const PayrollEngine = require('../services/PayrollEngine');
const PayrollQueue = require('../services/PayrollQueue');
const PayslipGenerator = require('../services/PayslipGenerator');
const ProfessionalTaxService = require('../../../core/utils/ProfessionalTaxService');
const professionalTaxRoutes = require('./professionalTax');
const { Op } = require('sequelize');

// Mount Professional Tax configuration & calculation routes
router.use('/professional-tax', professionalTaxRoutes);

// --- DASHBOARD ---
router.get('/dashboard', async (req, res) => {
  try {
    const runs = await PayrollRun.findAll({ order: [['month', 'DESC']], limit: 6 });
    
    // Compute total cost and net disbursed from actual processed runs
    const stats = await PayrollRun.findOne({
      attributes: [
        [PayrollRun.sequelize.fn('SUM', PayrollRun.sequelize.col('total_gross')), 'totalGross'],
        [PayrollRun.sequelize.fn('SUM', PayrollRun.sequelize.col('total_net')), 'totalNet']
      ],
      where: { status: 'PAID' }
    });

    const pendingCount = await PayrollRun.count({
      where: { status: { [Op.or]: ['DRAFT', 'PROCESSING', 'APPROVED'] } }
    });

    // Dynamic database fallback calculation: sum monthly compensation of all active employees
    const employees = await Employee.findAll({ where: { status: 'ACTIVE' } });
    const totalBaseSalary = employees.reduce((sum, emp) => {
      const rawAnnual = Number(emp.compensationGross || 0);
      return sum + (rawAnnual > 0 ? Math.round(rawAnnual / 12) : 0);
    }, 0);

    let totalGrossCost = stats ? (Number(stats.getDataValue('totalGross')) || 0) : 0;
    let totalNetDisbursed = stats ? (Number(stats.getDataValue('totalNet')) || 0) : 0;

    // If database totals are 0 but paid runs exist, fallback to base salaries
    const hasPaidRun = await PayrollRun.findOne({ where: { status: 'PAID' } });
    if (hasPaidRun && totalGrossCost === 0) {
      totalGrossCost = totalBaseSalary;
      totalNetDisbursed = Math.round(totalBaseSalary * 0.85);
    }

    // Fetch alerts: items that failed in the last run
    const latestRun = await PayrollRun.findOne({ order: [['createdAt', 'DESC']] });
    let alerts = [];
    if (latestRun) {
      const failedItems = await PayrollItem.findAll({
        where: { payrollRunId: latestRun.id, status: 'FAILED' },
        include: [{ model: Employee, as: 'employee', attributes: ['id', 'name'] }]
      });
      alerts = failedItems.map(item => ({
        employeeId: item.employeeId,
        name: item.employee ? item.employee.name : 'Unknown',
        error: item.errorLog || 'Calculations mismatch or negative net pay limit reached.'
      }));
    }

    return res.status(200).json({
      totalGrossCost,
      totalNetDisbursed,
      pendingRuns: pendingCount,
      alerts,
      runsTrend: runs.reverse()
    });
  } catch (error) {
    console.error('Dashboard stats fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// --- PAY RUNS ---

// --- DEACTIVATED EMPLOYEES PRE-FLIGHT CHECK ---
router.get('/deactivated-check', async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const m = parseInt(monthStr);

    let prevYear = year;
    let prevMonth = m - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    // Find all deactivated employees (status: PAST) whose exit month matches the immediately preceding month
    const allPast = await Employee.findAll({
      where: {
        status: 'PAST'
      }
    });

    const exitedEmployees = allPast.filter(emp => {
      const rawDate = emp.exitDate || emp.updatedAt;
      if (!rawDate) return false;
      const exitMonth = String(rawDate).substring(0, 7);
      return exitMonth === prevMonthStr;
    });

    const results = [];
    for (const emp of exitedEmployees) {
      // Calculate provisional salary based on their attendance / working days
      const monthlyCTC = emp.compensationGross ? Math.round(emp.compensationGross / 12) : 30000;
      results.push({
        id: emp.id,
        empCode: emp.empCode || emp.id,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        exitDate: emp.exitDate || prevMonthStr,
        exitReason: emp.exitReason || 'Exited in previous month',
        monthlyCTC,
        estimatedSalary: Math.round(monthlyCTC * 0.85)
      });
    }

    return res.status(200).json({
      activeCycleMonth: month,
      previousMonth: prevMonthStr,
      deactivatedCount: results.length,
      deactivatedEmployees: results
    });
  } catch (error) {
    console.error('Deactivated check error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    const runs = await PayrollRun.findAll({ order: [['month', 'DESC']] });
    return res.status(200).json(runs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/run', async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });

    // Check duplicate
    const existing = await PayrollRun.findOne({ where: { month } });
    if (existing) return res.status(400).json({ error: `A payroll run for ${month} already exists.` });

    const newRun = await PayrollRun.create({
      month,
      status: 'DRAFT',
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0
    });

    return res.status(201).json(newRun);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE a specific payroll run and its child records
router.delete('/run/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const run = await PayrollRun.findByPk(id);
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found.' });
    }

    const items = await PayrollItem.findAll({ where: { payrollRunId: id } });
    const itemIds = items.map(item => item.id);

    if (itemIds.length > 0) {
      await Payslip.destroy({
        where: {
          [Op.or]: [
            { payrollItemId: { [Op.in]: itemIds } },
            { month: run.month }
          ]
        }
      });
      await LoanRepayment.destroy({
        where: { payrollItemId: { [Op.in]: itemIds } }
      });
    } else {
      await Payslip.destroy({ where: { month: run.month } });
    }

    await PayrollItem.destroy({ where: { payrollRunId: id } });
    await run.destroy();

    return res.status(200).json({ message: `Payroll run for ${run.month} deleted successfully.` });
  } catch (error) {
    console.error('Delete payroll run error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Clear all payroll runs and linked items
router.delete('/runs/clear-all', async (req, res) => {
  try {
    await Payslip.destroy({ where: {} });
    await LoanRepayment.destroy({ where: { payrollItemId: { [Op.ne]: null } } });
    await PayrollItem.destroy({ where: {} });
    await PayrollRun.destroy({ where: {} });
    return res.status(200).json({ message: 'All payroll runs and related records cleared.' });
  } catch (error) {
    console.error('Clear all runs error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// --- WIZARD SESSION STATE & LOP PERSISTENCE (Multi-System Synchronization) ---

// 1. Get saved wizard session state for a payroll run
router.get('/run/:id/state', async (req, res) => {
  try {
    const { id } = req.params;
    const run = await PayrollRun.findByPk(id);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    const rawState = run.wizardState || {};
    return res.status(200).json({
      success: true,
      runId: run.id,
      month: run.month,
      status: run.status,
      wizardState: typeof rawState === 'string' ? JSON.parse(rawState) : rawState
    });
  } catch (error) {
    console.error('Error fetching wizard state:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. Save / Update wizard session state for a payroll run
router.put('/run/:id/state', async (req, res) => {
  try {
    const { id } = req.params;
    const run = await PayrollRun.findByPk(id);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    const currentRaw = run.wizardState || {};
    const currentState = typeof currentRaw === 'string' ? JSON.parse(currentRaw) : currentRaw;
    const incomingState = req.body || {};

    const incomingLop = incomingState.editedLop && typeof incomingState.editedLop === 'object' ? incomingState.editedLop : {};
    const currentLop = currentState.editedLop && typeof currentState.editedLop === 'object' ? currentState.editedLop : {};
    const mergedLop = {
      ...currentLop,
      ...incomingLop
    };

    const mergedState = {
      ...currentState,
      ...incomingState,
      editedLop: mergedLop,
      updatedAt: new Date().toISOString()
    };

    run.wizardState = mergedState;
    await run.save();

    return res.status(200).json({
      success: true,
      message: 'Wizard state successfully persisted in database.',
      wizardState: mergedState
    });
  } catch (error) {
    console.error('Error saving wizard state:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Direct LOP save endpoint for single employee (persists without requiring prior run processing)
router.put('/run/:id/lop', async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, lopDays } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required.' });

    const run = await PayrollRun.findByPk(id);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    const currentRaw = run.wizardState || {};
    const currentState = typeof currentRaw === 'string' ? JSON.parse(currentRaw) : currentRaw;
    const currentEditedLop = currentState.editedLop || {};

    currentEditedLop[employeeId] = Number(lopDays || 0);
    currentState.editedLop = currentEditedLop;
    currentState.updatedAt = new Date().toISOString();

    run.wizardState = currentState;
    await run.save();

    // If an item already exists in payroll_items for this employee, update it too
    const item = await PayrollItem.findOne({ where: { payrollRunId: id, employeeId } });
    if (item) {
      item.lopDays = Number(lopDays || 0);
      item.workedDays = Math.max(30 - Number(lopDays || 0), 0);
      await item.save();
    }

    return res.status(200).json({
      success: true,
      message: `LOP of ${lopDays} days saved successfully for employee.`,
      employeeId,
      lopDays: Number(lopDays || 0),
      wizardState: currentState
    });
  } catch (error) {
    console.error('Error saving LOP:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/process', async (req, res) => {
  try {
    const { payrollRunId } = req.body;
    if (!payrollRunId) return res.status(400).json({ error: 'payrollRunId is required.' });

    const run = await PayrollRun.findByPk(payrollRunId);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    if (run.status === 'PROCESSING') {
      return res.status(400).json({ error: 'Payroll run is already processing.' });
    }

    const { includedExitedEmployeeIds, skippedExitedEmployeeIds } = req.body;
    const jobId = await PayrollQueue.enqueuePayRun(payrollRunId, { includedExitedEmployeeIds, skippedExitedEmployeeIds });
    return res.status(202).json({ message: 'Payroll processing started in background.', jobId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/job/:jobId', (req, res) => {
  const status = PayrollQueue.getJobStatus(req.params.jobId);
  return res.status(200).json(status);
});

router.post('/approve', async (req, res) => {
  try {
    const { payrollRunId } = req.body;
    const run = await PayrollRun.findByPk(payrollRunId);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    run.status = 'APPROVED';
    await run.save();
    return res.status(200).json(run);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/disburse', async (req, res) => {
  try {
    const { payrollRunId } = req.body;
    const run = await PayrollRun.findByPk(payrollRunId);
    if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

    // Check if PayrollItems already exist for this run
    const existingItems = await PayrollItem.findAll({ where: { payrollRunId } });

    // If wizard was used (no backend items created), auto-create items from active & checked exited employees
    if (existingItems.length === 0) {
      const { includedExitedEmployeeIds = [], skippedExitedEmployees = [] } = req.body;
      const includedSet = new Set((includedExitedEmployeeIds || []).map(String));

      // Fetch active + selected exited employees
      const employees = await Employee.findAll({
        where: {
          [Op.or]: [
            { status: 'ACTIVE' },
            { id: { [Op.in]: Array.from(includedSet) } }
          ]
        }
      });

      for (const emp of employees) {
        const monthlyCTC = emp.compensationGross
          ? Math.round(emp.compensationGross / 12)
          : 30000; // fallback default

        const basic = Math.round(monthlyCTC * 0.50);
        const hra = Math.round(monthlyCTC * 0.30);
        const other = Math.max(0, monthlyCTC - basic - hra);
        const pfWage = basic + other;
        const grossEarned = basic + hra + other;

        let pfEE = 0;
        if (emp.pfEligible !== false) {
          if (emp.pfAmount && Number(emp.pfAmount) > 0) {
            pfEE = Number(emp.pfAmount);
          } else {
            pfEE = pfWage < 15000 ? Math.round(pfWage * 0.12) : 1800;
          }
        }

        const vpfEE = (emp.vpfEligible && Number(emp.vpfAmount) > 0) ? Number(emp.vpfAmount) : 0;
        const esi = (emp.esiEligible !== false && grossEarned <= 21000) ? Math.round(grossEarned * 0.0075) : 0;
        let pt = 0;
        try {
          const ptResult = await ProfessionalTaxService.calculateProfessionalTax({
            employee: emp,
            grossSalary: grossEarned,
            basicSalary: basic,
            taxableSalary: grossEarned - (pfEE + vpfEE + esi),
            totalEarnings: grossEarned,
            payrollDate: run.month ? `${run.month}-01` : new Date().toISOString().split('T')[0],
            attendanceRatio: 1
          });
          pt = ptResult.ptAmount || 0;
        } catch (ptErr) {
          console.warn('Dynamic PT calculation error, fallback to 0:', ptErr.message);
          pt = 0;
        }
        const lwf = emp.lwfEligible !== false ? Math.round((Number(emp.lwfAmount) || 60) / 12) : 0;
        const tds = 0;
        const totalDeductions = pfEE + vpfEE + esi + pt + lwf + tds;
        const netSalary = Math.max(0, grossEarned - totalDeductions);

        // Skip if duplicate exists
        const exists = await PayrollItem.findOne({ where: { payrollRunId, employeeId: emp.id } });
        if (exists) continue;

        await PayrollItem.create({
          payrollRunId,
          employeeId: emp.id,
          workedDays: 30,
          lopDays: 0,
          grossEarned,
          totalDeductions,
          netSalary,
          status: 'COMPLETED',
          earningsBreakdown: { BASIC: basic, HRA: hra, OTHER_ALLOWANCE: other },
          deductionsBreakdown: { PF_EE: pfEE, VPF_EE: vpfEE, ESI_EE: esi, PT: pt, LWF_EE: lwf, TDS: tds }
        });
      }
    } else {
      // Mark existing items COMPLETED
      await PayrollItem.update(
        { status: 'COMPLETED' },
        { where: { payrollRunId } }
      );
    }

    // Create SKIPPED_EXIT items for unchecked exited employees if provided
    const { skippedExitedEmployees = [] } = req.body;
    for (const skipped of skippedExitedEmployees) {
      const exists = await PayrollItem.findOne({ where: { payrollRunId, employeeId: skipped.id } });
      if (!exists) {
        await PayrollItem.create({
          payrollRunId,
          employeeId: skipped.id,
          workedDays: skipped.payableDays || 0,
          lopDays: skipped.lopDays || 0,
          grossEarned: skipped.calculatedSalary || 0,
          totalDeductions: 0,
          netSalary: skipped.calculatedSalary || 0,
          status: 'SKIPPED_EXIT',
          errorLog: `Deactivated employee (${skipped.exitDate || 'Previous month'}) - skipped by admin selection`,
          earningsBreakdown: { BASIC: skipped.calculatedSalary || 0 },
          deductionsBreakdown: {}
        });
      }
    }

    // Transition run status to PAID
    run.status = 'PAID';
    await run.save();

    // Generate payslips for every completed item in this run
    let payslips = [];
    try {
      payslips = await PayslipGenerator.bulkGenerate(payrollRunId);
    } catch (genErr) {
      console.error('Payslip generation error:', genErr.message, genErr.stack);
    }

    return res.status(200).json({
      run,
      payslipsGenerated: payslips.length,
      message: `Payroll disbursed. ${payslips.length} payslip(s) generated.`
    });
  } catch (error) {
    console.error('Disburse error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/runs/:id/items', async (req, res) => {
  try {
    const items = await PayrollItem.findAll({
      where: { payrollRunId: req.params.id },
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'name', 'department', 'designation', 'bankAccountNo'] }]
    });
    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- PAYSLIPS ---
router.get('/payslip/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query; // YYYY-MM
    
    const query = { employeeId };
    if (month) query.month = month;

    const payslip = await Payslip.findOne({
      where: query,
      order: [['month', 'DESC']]
    });

    if (!payslip) return res.status(404).json({ error: 'Payslip not found.' });
    return res.status(200).json(payslip);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/payslips', async (req, res) => {
  try {
    const payslips = await Payslip.findAll({
      include: [
        { model: Employee, as: 'employee', attributes: ['name', 'department', 'designation'] },
        { model: PayrollItem, as: 'payrollItem', attributes: ['netSalary', 'grossEarned', 'totalDeductions', 'workedDays', 'lopDays'] }
      ],
      order: [['month', 'DESC']]
    });
    return res.status(200).json(payslips);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- UPLOAD CUSTOM PAYSLIP ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const payslipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../../uploads/payslips');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `payslip-${uniqueSuffix}${ext}`);
  }
});
const uploadPayslipFile = multer({ storage: payslipStorage });

router.post('/payslips/upload', uploadPayslipFile.single('file'), async (req, res) => {
  try {
    const { employeeId, month, netPay } = req.body;
    if (!employeeId || !month) {
      return res.status(400).json({ error: 'employeeId and month (YYYY-MM) are required.' });
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    let fileUrl = null;
    let filePath = null;
    if (req.file) {
      const protocol = req.protocol;
      const host = req.get('host');
      fileUrl = `${protocol}://${host}/static/uploads/payslips/${req.file.filename}`;
      filePath = req.file.path;
    }

    // Create or update payslip record
    const payslip = await Payslip.create({
      employeeId: String(employeeId),
      month: month,
      filePath: fileUrl || filePath || '/static/uploads/payslips/custom.pdf',
      emailSentStatus: true
    });

    // Share to Employee Documents
    if (fileUrl || filePath) {
      await Document.create({
        title: `Uploaded Payslip - ${month}`,
        filePath: fileUrl || filePath,
        uploaderId: (req.user && req.user.id) || 'ADMIN',
        uploaderName: (req.user && req.user.name) || 'System Admin',
        targetType: 'INDIVIDUAL',
        targetUserId: String(employeeId),
        targetUserName: employee.name,
        fileType: 'pdf',
        fileSize: req.file ? req.file.size : 1024,
        uploadedAt: Date.now()
      });
    }

    return res.status(201).json({
      success: true,
      message: `Payslip for ${employee.name} (${month}) uploaded successfully.`,
      payslip
    });
  } catch (error) {
    console.error('Error uploading custom payslip:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/dispatch-payslips', async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'month is required' });

    const payslips = await Payslip.findAll({
      where: { month },
      include: [{ model: Employee, as: 'employee' }]
    });

    let dispatchCount = 0;

    for (const ps of payslips) {
      if (!ps.employee) continue;

      // Mark email as sent
      ps.emailSentStatus = true;
      await ps.save();

      // Share document to employee app
      if (ps.filePath) {
        await Document.create({
          title: `Payslip - ${month}`,
          filePath: ps.filePath,
          uploaderId: (req.user && req.user.id) || 'ADMIN',
          uploaderName: (req.user && req.user.name) || 'System Admin',
          targetType: 'INDIVIDUAL',
          targetUserId: ps.employee.id,
          targetUserName: ps.employee.name,
          fileType: 'pdf', // payslip generated is html, but assuming pdf handling
          fileSize: 1024,
          uploadedAt: Date.now()
        });
      }

      console.log(`[Email Service Mock] Sent Payslip for ${month} to ${ps.employee.email}`);
      dispatchCount++;
    }

    return res.status(200).json({ message: `Successfully dispatched ${dispatchCount} payslips.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- LOANS & ADVANCS ---
router.post('/loans', async (req, res) => {
  try {
    const { employeeId, principalAmount, tenureMonths, interestRate } = req.body;
    if (!employeeId || !principalAmount || !tenureMonths) {
      return res.status(400).json({ error: 'employeeId, principalAmount and tenureMonths are required.' });
    }

    const principal = Number(principalAmount);
    const months = Number(tenureMonths);
    const emi = Math.round(principal / months);

    const loan = await Loan.create({
      employeeId,
      principalAmount: principal,
      interestRate: Number(interestRate) || 0,
      tenureMonths: months,
      emiAmount: emi,
      remainingBalance: principal,
      status: 'ACTIVE'
    });

    return res.status(201).json(loan);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/loans', async (req, res) => {
  try {
    const loans = await Loan.findAll({
      include: [
        { model: Employee, as: 'employee', attributes: ['name'] },
        { model: LoanRepayment, as: 'repayments' }
      ]
    });
    return res.status(200).json(loans);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- REIMBURSEMENTS ---
router.post('/reimbursements', async (req, res) => {
  try {
    const { employeeId, title, category, amount, receiptUrl } = req.body;
    if (!employeeId || !title || !amount) {
      return res.status(400).json({ error: 'employeeId, title and amount are required.' });
    }

    const claim = await Reimbursement.create({
      employeeId,
      title,
      category: category || 'OTHER',
      amount: Number(amount),
      receiptUrl,
      status: 'PENDING'
    });

    return res.status(201).json(claim);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reimbursements', async (req, res) => {
  try {
    const claims = await Reimbursement.findAll({
      include: [{ model: Employee, as: 'employee', attributes: ['name'] }]
    });
    return res.status(200).json(claims);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/reimbursements/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const claim = await Reimbursement.findByPk(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found.' });

    claim.status = status;
    await claim.save();

    return res.status(200).json(claim);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- SALARY STRUCTURES ---
router.post('/structures', async (req, res) => {
  try {
    const { employeeId, ctc, grossSalary, effectiveFrom } = req.body;
    if (!employeeId || !ctc || !grossSalary || !effectiveFrom) {
      return res.status(400).json({ error: 'employeeId, ctc, grossSalary and effectiveFrom are required.' });
    }

    // Set any existing structures for employee to INACTIVE
    await SalaryStructure.update(
      { status: 'INACTIVE', effectiveTo: effectiveFrom },
      { where: { employeeId, status: 'ACTIVE' } }
    );

    const structure = await SalaryStructure.create({
      employeeId,
      ctc: Number(ctc),
      grossSalary: Number(grossSalary),
      effectiveFrom,
      status: 'ACTIVE',
      version: 1
    });

    return res.status(201).json(structure);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/structures/:employeeId', async (req, res) => {
  try {
    const structure = await SalaryStructure.findOne({
      where: { employeeId: req.params.employeeId, status: 'ACTIVE' }
    });
    if (!structure) return res.status(404).json({ error: 'No active structure found.' });
    return res.status(200).json(structure);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- COMPONENTS ---
router.post('/components', async (req, res) => {
  try {
    const { id, name, type, calculationType, formula, isStatutory, isTaxable } = req.body;
    if (!id || !name || !type || !calculationType) {
      return res.status(400).json({ error: 'id, name, type and calculationType are required.' });
    }

    const component = await SalaryComponent.create({
      id,
      name,
      type,
      calculationType,
      formula,
      isStatutory: !!isStatutory,
      isTaxable: isTaxable !== false
    });

    return res.status(201).json(component);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/components', async (req, res) => {
  try {
    const components = await SalaryComponent.findAll();
    return res.status(200).json(components);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- TAX SELF SERVICE ---
router.get('/tax/:employeeId', async (req, res) => {
  try {
    const record = await TaxRecord.findOne({
      where: { employeeId: req.params.employeeId },
      order: [['createdAt', 'DESC']]
    });
    return res.status(200).json(record || {});
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/tax/:employeeId', async (req, res) => {
  try {
    const { regime, investmentDeclarations, financialYear } = req.body;
    const { employeeId } = req.params;

    let record = await TaxRecord.findOne({
      where: { employeeId, financialYear: financialYear || '2026-2027' }
    });

    if (record) {
      if (regime) record.regime = regime;
      if (investmentDeclarations) record.investmentDeclarations = investmentDeclarations;
      await record.save();
    } else {
      record = await TaxRecord.create({
        employeeId,
        regime: regime || 'NEW',
        investmentDeclarations: investmentDeclarations || {},
        financialYear: financialYear || '2026-2027'
      });
    }

    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// --- UPDATE PAYROLL ITEM (e.g. for LOP manual edit) ---
router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lopDays } = req.body;
    
    const item = await PayrollItem.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Payroll item not found.' });

    if (lopDays !== undefined) {
      item.lopDays = Number(lopDays);
      
      const employee = await Employee.findByPk(item.employeeId);
      const structure = await SalaryStructure.findOne({ where: { employeeId: item.employeeId, status: 'ACTIVE' } });
      
      if (structure && employee) {
        const totalDays = 30;
        const workedDays = Math.max(totalDays - item.lopDays, 0);
        const prorationFactor = workedDays / totalDays;
        
        item.workedDays = workedDays;
        item.grossEarned = Math.round(structure.grossSalary * prorationFactor);
        
        const epf = employee.pfEligible !== false ? Math.round((structure.grossSalary * 0.50) * prorationFactor * 0.12) : 0;
        const net = item.grossEarned - epf;
        
        item.deductionsBreakdown = JSON.stringify({ EPF_EE: epf });
        item.netSalary = Math.max(net, 0);
      }
    }
    
    await item.save();
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
