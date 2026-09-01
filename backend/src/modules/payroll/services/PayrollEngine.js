const { 
  Employee, 
  SalaryStructure, 
  SalaryComponent, 
  EmployeeSalaryComponent, 
  PayrollItem, 
  Loan, 
  LoanRepayment, 
  Reimbursement, 
  TaxRecord, 
  Leave, 
  Attendance 
} = require('../../../shared/models/index');
const { Op } = require('sequelize');
const ProfessionalTaxService = require('../../../core/utils/ProfessionalTaxService');

class PayrollEngine {
  /**
   * Helper to get total days in a month
   */
  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Calculates statutory Professional Tax dynamically using ProfessionalTaxService (No hardcoding)
   */
  async calculateProfessionalTax(gross, stateCode = 'TN', gender = 'ALL', date = new Date().toISOString().split('T')[0]) {
    const dummyEmp = { ptEligible: true, ptStateCode: stateCode, gender };
    const res = await ProfessionalTaxService.calculateProfessionalTax({
      employee: dummyEmp,
      grossSalary: gross,
      payrollDate: date
    });
    return res.ptAmount || 0;
  }

  /**
   * Calculates statutory Provident Fund (EPF)
   */
  calculateEPF(basic, enforceCap = true) {
    const pfBasis = enforceCap ? Math.min(basic, 15000) : basic;
    return Math.round(pfBasis * 0.12); // Employee share is 12%
  }

  /**
   * Calculates Employee State Insurance (ESIC)
   */
  calculateESI(gross) {
    if (gross > 21000) return 0; // Only applicable for gross <= 21,000
    return Math.round(gross * 0.0075); // Employee share is 0.75%
  }

  /**
   * Projects annual tax under the Old vs New Regime and computes monthly TDS
   */
  projectAndCalculateTDS(grossAnnual, regime, declarations = {}) {
    const isOld = regime === 'OLD';
    const stdDeduction = isOld ? 50000 : 75000;
    
    // 1. Calculate Gross Taxable Income
    let taxableIncome = grossAnnual - stdDeduction;

    if (isOld) {
      // Apply deductions for Old Regime
      const sec80C = Math.min(declarations.sec80C || 0, 150000);
      const sec80D = Math.min(declarations.sec80D || 0, 25000);
      
      // HRA Exemption calculation
      // rent paid - 10% basic
      const basicAnnual = declarations.basicAnnual || (grossAnnual * 0.40);
      const rentPaid = declarations.rentPaid || 0;
      const actualHra = declarations.actualHra || (grossAnnual * 0.20);
      const rentExcessBasic = Math.max(rentPaid - (basicAnnual * 0.10), 0);
      const metroCap = basicAnnual * 0.50; // assuming metro cap
      
      const hraExemption = Math.min(actualHra, rentExcessBasic, metroCap);
      
      taxableIncome = taxableIncome - sec80C - sec80D - hraExemption;
    }

    taxableIncome = Math.max(taxableIncome, 0);

    // 2. Slab calculation
    let tax = 0;
    if (isOld) {
      // Old Regime Slabs (FY 2024-25 / 2025-26)
      // 0 - 2.5L: Nil
      // 2.5L - 5L: 5%
      // 5L - 10L: 20%
      // Above 10L: 30%
      if (taxableIncome <= 250000) {
        tax = 0;
      } else if (taxableIncome <= 500000) {
        tax = (taxableIncome - 250000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        tax = 12500 + (taxableIncome - 500000) * 0.20;
      } else {
        tax = 112500 + (taxableIncome - 1000000) * 0.30;
      }

      // Rebate under section 87A for Old Regime: if taxable income is <= 5L, tax is 0
      if (taxableIncome <= 500000) {
        tax = 0;
      }
    } else {
      // New Regime Slabs (Section 115BAC)
      // 0 - 3L: Nil
      // 3L - 6L: 5%
      // 6L - 9L: 10%
      // 9L - 12L: 15%
      // 12L - 15L: 20%
      // Above 15L: 30%
      if (taxableIncome <= 300000) {
        tax = 0;
      } else if (taxableIncome <= 600000) {
        tax = (taxableIncome - 300000) * 0.05;
      } else if (taxableIncome <= 900000) {
        tax = 15000 + (taxableIncome - 600000) * 0.10;
      } else if (taxableIncome <= 1200000) {
        tax = 45000 + (taxableIncome - 900000) * 0.15;
      } else if (taxableIncome <= 1500000) {
        tax = 90000 + (taxableIncome - 1200000) * 0.20;
      } else {
        tax = 150000 + (taxableIncome - 1500000) * 0.30;
      }

      // Rebate under section 87A for New Regime: if taxable income is <= 7L, tax is 0
      if (taxableIncome <= 700000) {
        tax = 0;
      }
    }

    // Apply Health & Education Cess (4%)
    const cess = tax * 0.04;
    const totalAnnualTax = tax + cess;
    
    // Monthly projection (assuming 12 months)
    const monthlyTds = Math.round(totalAnnualTax / 12);

    return {
      projectedAnnualTax: Math.round(totalAnnualTax),
      monthlyTds: Math.max(monthlyTds, 0)
    };
  }

  /**
   * Main processing execution engine
   */
  async processEmployeePayroll(employeeId, year, month, payrollRunId, transaction = null) {
    const errorLogs = [];
    
    try {
      // 1. Fetch Employee Profile
      const employee = await Employee.findByPk(employeeId, { transaction });
      if (!employee) {
        throw new Error(`Employee ${employeeId} not found.`);
      }

      if (employee.status === 'PAST' && employee.exitDate && !employee.exitDate.startsWith(`${year}-${month}`)) {
        // Only process past employees if they exited in this processing month (FNF settlement)
        return null;
      }

      // 2. Fetch Active Salary Structure
      const salaryStructure = await SalaryStructure.findOne({
        where: {
          employeeId,
          status: 'ACTIVE'
        },
        transaction
      });

      if (!salaryStructure) {
        errorLogs.push('No active salary structure found.');
        return await PayrollItem.create({
          payrollRunId,
          employeeId,
          workedDays: 0,
          lopDays: 0,
          grossEarned: 0,
          totalDeductions: 0,
          netSalary: 0,
          status: 'FAILED',
          errorLog: errorLogs.join(' | ')
        }, { transaction });
      }

      // 3. Determine Days in Month and Proration
      const totalDays = this.getDaysInMonth(parseInt(year), parseInt(month));
      let proratedDays = totalDays;

      const parseDateParts = (dStr) => {
        if (!dStr) return null;
        const clean = String(dStr).trim();
        if (clean === 'null' || clean === 'undefined' || clean === '') return null;
        if (clean.includes('/')) {
          const parts = clean.split('/');
          return { day: parseInt(parts[0]), month: parseInt(parts[1]), year: parseInt(parts[2]) };
        } else if (clean.includes('-')) {
          const parts = clean.split('T')[0].split('-');
          return { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
        }
        return null;
      };

      const joinParts = parseDateParts(employee.joiningDate);
      const exitParts = parseDateParts(employee.exitDate);

      const targetYear = parseInt(year);
      const targetMonth = parseInt(month);

      if (joinParts && !isNaN(joinParts.year) && !isNaN(joinParts.month)) {
        if (joinParts.year === targetYear && joinParts.month === targetMonth) {
          // Mid-month joining in this cycle
          const joinDay = Math.min(Math.max(1, joinParts.day || 1), totalDays);
          proratedDays = totalDays - joinDay + 1;
        } else if (joinParts.year > targetYear || (joinParts.year === targetYear && joinParts.month > targetMonth)) {
          // Joined in a future month after this cycle
          proratedDays = 0;
        }
      }

      if (exitParts && !isNaN(exitParts.year) && !isNaN(exitParts.month) && employee.status === 'PAST') {
        if (exitParts.year === targetYear && exitParts.month === targetMonth) {
          // Mid-month exit in this cycle
          const exitDay = Math.min(Math.max(1, exitParts.day || 1), totalDays);
          if (joinParts && joinParts.year === targetYear && joinParts.month === targetMonth) {
            proratedDays = Math.max(0, exitDay - (joinParts.day || 1) + 1);
          } else {
            proratedDays = Math.min(proratedDays, exitDay);
          }
        }
      }

      // 4. Fetch Attendance & Leaves for LOP
      // Fetch leave applications approved for LOP
      const leaves = await Leave.findAll({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { [Op.like]: `${year}-${month}%` }
        },
        transaction
      });
      
      let lopDays = 0;
      leaves.forEach(l => {
        // If leave type is LOP (Loss Of Pay) or unpaid leave
        if (l.leaveType === 'LOP' || l.leaveType === 'UNPAID') {
          lopDays += l.lop_days || l.total_days || 1;
        }
      });

      // Clamp paid days
      const workedDays = Math.max(proratedDays - lopDays, 0);
      const prorationFactor = workedDays / totalDays;

      // 5. Fetch Salary Components & Override Configurations
      const globalComponents = await SalaryComponent.findAll({ where: { status: 'ACTIVE' }, transaction });
      const customOverrides = await EmployeeSalaryComponent.findAll({ where: { employeeId }, transaction });
      
      const componentMap = {};
      globalComponents.forEach(c => {
        componentMap[c.id] = c;
      });

      // Build components object
      const earnings = {};
      const deductions = {};

      const baseGross = salaryStructure.grossSalary;
      const proratedGross = baseGross * prorationFactor;

      // Basic Salary: standard 50% or 40% of Gross
      let basicSalary = baseGross * 0.50; // Default 50%
      let hra = basicSalary * 0.40; // HRA is 40% of Basic
      let specialAllowance = Math.max(baseGross - basicSalary - hra, 0);

      // Custom Overrides check
      customOverrides.forEach(override => {
        if (override.componentId === 'BASIC') basicSalary = Number(override.value);
        if (override.componentId === 'HRA') hra = Number(override.value);
      });

      // Apply proration
      const paidBasic = Math.round(basicSalary * prorationFactor);
      const paidHra = Math.round(hra * prorationFactor);
      const paidSpecial = Math.round(specialAllowance * prorationFactor);

      earnings['BASIC'] = paidBasic;
      earnings['HRA'] = paidHra;
      earnings['SPECIAL_ALLOWANCE'] = paidSpecial;

      // Overtime calculation
      let overtimeHours = 0;
      let overtimePay = 0;
      // Fetch overtime details if enabled
      if (employee.overtime && employee.overtime !== 'Disabled') {
        // Mock query to fetch overtime records from attendance logs or setting
        // Let's assume standard overtime calculation
        overtimeHours = 5; // standard dummy or check attendance settings
        const hourlyRate = baseGross / (240); // 30 days * 8 hours
        overtimePay = Math.round(hourlyRate * 1.5 * overtimeHours);
        earnings['OVERTIME'] = overtimePay;
      }

      // Sum gross earnings
      const totalEarnedGross = Object.values(earnings).reduce((a, b) => a + b, 0);

      // 6. Statutory Deductions (India)
      // PF Deduction
      const pfEnforced = employee.pfEligible !== false;
      const defaultPf = this.calculateEPF(paidBasic, true);
      const pfAmount = pfEnforced ? (employee.pfAmount !== null && employee.pfAmount !== undefined && Number(employee.pfAmount) >= 0 ? Number(employee.pfAmount) : defaultPf) : 0;
      if (pfAmount > 0) {
        deductions['EPF_EE'] = pfAmount;
      }

      // VPF (Voluntary Provident Fund) Deduction
      const vpfEnforced = employee.vpfEligible === true;
      const vpfAmount = vpfEnforced && employee.vpfAmount ? (Number(employee.vpfAmount) || 0) : 0;
      if (vpfAmount > 0) {
        deductions['VPF_EE'] = vpfAmount;
      }

      // ESI Deduction
      const esiEnforced = employee.esiEligible !== false;
      const esiAmount = esiEnforced ? this.calculateESI(totalEarnedGross) : 0;
      if (esiAmount > 0) {
        deductions['ESI_EE'] = esiAmount;
      }

      // Professional Tax (PT) - Evaluated on Monthly Base Gross Salary (Standard Statutory Rules)
      let ptAmount = 0;
      let ptRecordMeta = null;
      try {
        const ptResult = await ProfessionalTaxService.calculateProfessionalTax({
          employee,
          grossSalary: baseGross || totalEarnedGross,
          basicSalary: basicSalary,
          taxableSalary: Math.max(0, (baseGross || totalEarnedGross) - (pfAmount + (deductions['ESI_EE'] || 0))),
          totalEarnings: baseGross || totalEarnedGross,
          payrollDate: `${year}-${String(month).padStart(2, '0')}-01`,
          attendanceRatio: 1
        });
        ptAmount = ptResult.ptAmount || 0;
        ptRecordMeta = ptResult;
      } catch (ptErr) {
        console.warn('PayrollEngine PT calculation error, fallback to 0:', ptErr.message);
        ptAmount = 0;
      }
      if (ptAmount > 0) {
        deductions['PT'] = ptAmount;
      }

      // Labour Welfare Fund (LWF)
      const lwfAmount = employee.lwfEligible !== false ? 10 : 0;
      if (lwfAmount > 0) {
        deductions['LWF'] = lwfAmount;
      }

      // 7. Calculate TDS (Income Tax projection)
      let tdsAmount = 0;
      const taxRecord = await TaxRecord.findOne({
        where: { employeeId, financialYear: `${year}-${year + 1}` },
        transaction
      });

      const regime = taxRecord ? taxRecord.regime : (employee.taxRegime && employee.taxRegime.includes('Old') ? 'OLD' : 'NEW');
      const declarations = taxRecord ? taxRecord.investmentDeclarations : {};
      
      // Project annual gross
      const annualGrossProjected = totalEarnedGross * 12;
      declarations.basicAnnual = paidBasic * 12;
      declarations.actualHra = paidHra * 12;
      
      const taxProjection = this.projectAndCalculateTDS(annualGrossProjected, regime, declarations);
      tdsAmount = taxProjection.monthlyTds;
      if (tdsAmount > 0) {
        deductions['TDS'] = tdsAmount;
      }

      // Save/Update Tax Record projections
      if (taxRecord) {
        taxRecord.projectedAnnualTax = taxProjection.projectedAnnualTax;
        taxRecord.monthlyTds = taxProjection.monthlyTds;
        await taxRecord.save({ transaction });
      } else {
        await TaxRecord.create({
          employeeId,
          financialYear: `${year}-${year + 1}`,
          regime,
          investmentDeclarations: declarations,
          projectedAnnualTax: taxProjection.projectedAnnualTax,
          monthlyTds: taxProjection.monthlyTds
        }, { transaction });
      }

      // 8. Deduct Loans & EMI
      let emiDeduction = 0;
      const activeLoan = await Loan.findOne({
        where: { employeeId, status: 'ACTIVE' },
        transaction
      });

      if (activeLoan) {
        // EMI is capped at outstanding balance
        emiDeduction = Math.min(activeLoan.emiAmount, activeLoan.remainingBalance);
      }

      // 9. Add Reimbursements
      const approvedClaims = await Reimbursement.findAll({
        where: {
          employeeId,
          status: 'APPROVED',
          processedInRunId: null
        },
        transaction
      });

      const totalReimbursements = approvedClaims.reduce((sum, claim) => sum + claim.amount, 0);

      // 10. Net Pay Calculations and Edge Case Rules
      const totalDeductionsSum = Object.values(deductions).reduce((a, b) => a + b, 0) + emiDeduction;
      let netSalary = totalEarnedGross - totalDeductionsSum + totalReimbursements;

      // Handle Negative Salary Prevention
      if (netSalary < 0) {
        errorLogs.push('Net salary calculated to be negative. Loan EMI or tax deductions adjusted to prevent recovery.');
        // Adjust Loan EMI first
        if (emiDeduction > 0) {
          const excess = Math.abs(netSalary);
          const adjustment = Math.min(excess, emiDeduction);
          emiDeduction -= adjustment;
          netSalary += adjustment;
        }
        // If still negative, adjust TDS
        if (netSalary < 0 && deductions['TDS']) {
          const excess = Math.abs(netSalary);
          const adjustment = Math.min(excess, deductions['TDS']);
          deductions['TDS'] -= adjustment;
          netSalary += adjustment;
        }
      }

      // Validate missing bank details
      if (!employee.bankAccountNo || !employee.bankIfscCode) {
        errorLogs.push('Missing bank details. Disbursement will fail.');
      }

      // 11. Create and return PayrollItem
      const payrollItem = await PayrollItem.create({
        payrollRunId,
        employeeId,
        workedDays,
        lopDays,
        overtimeHours,
        earningsBreakdown: earnings,
        deductionsBreakdown: { ...deductions, ...(emiDeduction > 0 ? { LOAN_EMI: emiDeduction } : {}) },
        grossEarned: totalEarnedGross,
        totalDeductions: Object.values(deductions).reduce((a, b) => a + b, 0) + emiDeduction,
        netSalary,
        reimbursements: totalReimbursements,
        professionalTaxAmount: ptAmount,
        professionalTaxRuleId: ptRecordMeta?.ruleId || null,
        professionalTaxStateId: ptRecordMeta?.stateId || null,
        professionalTaxSalaryBasis: ptRecordMeta?.salaryBasis || 'GROSS_SALARY',
        professionalTaxCalculationDate: `${year}-${String(month).padStart(2, '0')}-01`,
        status: errorLogs.length > 0 ? 'FAILED' : 'COMPLETED',
        errorLog: errorLogs.join(' | ')
      }, { transaction });

      // Link processed claims to this payroll run if completed
      if (payrollItem.status === 'COMPLETED') {
        for (const claim of approvedClaims) {
          claim.processedInRunId = payrollRunId;
          await claim.save({ transaction });
        }
        
        // Repay loan if EMI deducted
        if (activeLoan && emiDeduction > 0) {
          await LoanRepayment.create({
            loanId: activeLoan.id,
            payrollItemId: payrollItem.id,
            amountPaid: emiDeduction,
            source: 'PAYROLL'
          }, { transaction });

          activeLoan.remainingBalance = activeLoan.remainingBalance - emiDeduction;
          if (activeLoan.remainingBalance <= 0) {
            activeLoan.status = 'CLOSED';
          }
          await activeLoan.save({ transaction });
        }
      }

      return payrollItem;

    } catch (err) {
      console.error(`Error processing payroll for employee ${employeeId}:`, err);
      return await PayrollItem.create({
        payrollRunId,
        employeeId,
        workedDays: 0,
        lopDays: 0,
        grossEarned: 0,
        totalDeductions: 0,
        netSalary: 0,
        status: 'FAILED',
        errorLog: err.message
      }, { transaction });
    }
  }

  /**
   * Execute complete payroll processing run
   */
  async executePayRun(payrollRunId, options = {}) {
    const run = await PayrollRun.findByPk(payrollRunId);
    if (!run) throw new Error('Payroll run not found.');

    run.status = 'PROCESSING';
    await run.save();

    // Lock attendance inputs for this month
    run.attendanceLocked = true;
    await run.save();

    const [yearStr, monthStr] = run.month.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    // Calculate previous month string (e.g. for 2026-08, previous is 2026-07)
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    // 1. Fetch Active Employees
    const activeEmployees = await Employee.findAll({
      where: { status: 'ACTIVE' }
    });

    // 2. Fetch Deactivated Employees from the Immediately Preceding Month (prevMonthStr)
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

    const includedExitedSet = new Set((options.includedExitedEmployeeIds || []).map(String));

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let runFailed = false;

    // Process Active Employees
    for (const emp of activeEmployees) {
      const item = await this.processEmployeePayroll(emp.id, year, month, run.id);
      if (item) {
        if (item.status === 'FAILED') runFailed = true;
        totalGross += item.grossEarned || 0;
        totalDeductions += item.totalDeductions || 0;
        totalNet += item.netSalary || 0;
      }
    }

    // Process Exited Employees based on user checkbox selection
    for (const emp of exitedEmployees) {
      const empIdStr = String(emp.id);
      const isIncluded = includedExitedSet.has(empIdStr);

      if (isIncluded) {
        // Checked by admin: Process full salary settlement
        const item = await this.processEmployeePayroll(emp.id, year, month, run.id);
        if (item) {
          if (item.status === 'FAILED') runFailed = true;
          totalGross += item.grossEarned || 0;
          totalDeductions += item.totalDeductions || 0;
          totalNet += item.netSalary || 0;
        }
      } else {
        // Unchecked: Record calculated attendance/salary under SKIPPED_EXIT for audit tracking without disbursing
        const calculatedItem = await this.processEmployeePayroll(emp.id, year, month, run.id);
        if (calculatedItem) {
          calculatedItem.status = 'SKIPPED_EXIT';
          calculatedItem.errorLog = `Deactivated in ${emp.exitDate || prevMonthStr} - skipped from salary disbursement by admin selection`;
          await calculatedItem.save();
        }
      }
    }

    run.totalGross = totalGross;
    run.totalDeductions = totalDeductions;
    run.totalNet = totalNet;
    run.status = runFailed ? 'FAILED' : 'APPROVED';
    await run.save();

    return run;
  }
}

module.exports = new PayrollEngine();
