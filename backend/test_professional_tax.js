const ProfessionalTaxService = require('./src/core/utils/ProfessionalTaxService');
const { 
  ProfessionalTaxState, 
  ProfessionalTaxRule, 
  ProfessionalTaxAuditLog, 
  Employee, 
  sequelize 
} = require('./src/shared/models/index');
const PayrollEngine = require('./src/modules/payroll/services/PayrollEngine');

async function runTests() {
  console.log('===============================================================');
  console.log('       PROFESSIONAL TAX ENGINE COMPREHENSIVE TEST SUITE        ');
  console.log('===============================================================');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${testName}: ${details}`);
      failedCount++;
    }
  }

  try {
    await sequelize.sync();
    await ProfessionalTaxService.seedBaselineStates();

    // -------------------------------------------------------------
    // TEST 1: Baseline Seeded States Verification
    // -------------------------------------------------------------
    console.log('\n--- 1. Baseline Seeded States ---');
    const states = await ProfessionalTaxState.findAll({ where: { isEnabled: true } });
    assert(states.length >= 8, 'At least 8 baseline Indian states configured in database', `Count: ${states.length}`);
    const stateCodes = states.map(s => s.stateCode);
    assert(stateCodes.includes('MH'), 'Maharashtra (MH) present in database');
    assert(stateCodes.includes('KA'), 'Karnataka (KA) present in database');
    assert(stateCodes.includes('GJ'), 'Gujarat (GJ) present in database');
    assert(stateCodes.includes('WB'), 'West Bengal (WB) present in database');
    assert(stateCodes.includes('DL'), 'Delhi / Exempt (DL) present in database');

    // -------------------------------------------------------------
    // TEST 2: Maharashtra Slabs Calculation & Month Adjustment
    // -------------------------------------------------------------
    console.log('\n--- 2. Maharashtra State Slabs & Month-Specific Rules ---');
    const mhEmpMale = { ptEligible: true, ptStateCode: 'MH', gender: 'MALE', category: 'EMPLOYEE' };
    const mhEmpFemale = { ptEligible: true, ptStateCode: 'MH', gender: 'FEMALE', category: 'EMPLOYEE' };

    // Male slabs (July)
    const resMh1 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 5000, payrollDate: '2026-07-01' });
    assert(resMh1.ptAmount === 0, 'MH Male <= 7,500 Gross => ₹0 PT', `Got ₹${resMh1.ptAmount}`);

    const resMh2 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 7500, payrollDate: '2026-07-01' });
    assert(resMh2.ptAmount === 0, 'MH Male boundary ₹7,500 Gross => ₹0 PT', `Got ₹${resMh2.ptAmount}`);

    const resMh3 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 7501, payrollDate: '2026-07-01' });
    assert(resMh3.ptAmount === 175, 'MH Male boundary ₹7,501 Gross => ₹175 PT', `Got ₹${resMh3.ptAmount}`);

    const resMh4 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 10000, payrollDate: '2026-07-01' });
    assert(resMh4.ptAmount === 175, 'MH Male boundary ₹10,000 Gross => ₹175 PT', `Got ₹${resMh4.ptAmount}`);

    const resMh5 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 10001, payrollDate: '2026-07-01' });
    assert(resMh5.ptAmount === 200, 'MH Male boundary ₹10,001 Gross => ₹200 PT (Regular month)', `Got ₹${resMh5.ptAmount}`);

    const resMh6 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 50000, payrollDate: '2026-07-01' });
    assert(resMh6.ptAmount === 200, 'MH Male ₹50,000 Gross => ₹200 PT (July)', `Got ₹${resMh6.ptAmount}`);

    // Month-specific rule for February (Month 2 => ₹300)
    const resMhFeb = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpMale, grossSalary: 50000, payrollDate: '2027-02-01' });
    assert(resMhFeb.ptAmount === 300, 'MH Male ₹50,000 in February => ₹300 PT (Month-specific adjustment)', `Got ₹${resMhFeb.ptAmount}`);

    // Female exemption in Maharashtra (< 25,000 => 0)
    const resMhFem1 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpFemale, grossSalary: 20000, payrollDate: '2026-07-01' });
    assert(resMhFem1.ptAmount === 0, 'MH Female ₹20,000 Gross (below 25K exemption) => ₹0 PT', `Got ₹${resMhFem1.ptAmount}`);

    const resMhFem2 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpFemale, grossSalary: 25000, payrollDate: '2026-07-01' });
    assert(resMhFem2.ptAmount === 0, 'MH Female boundary ₹25,000 Gross => ₹0 PT', `Got ₹${resMhFem2.ptAmount}`);

    const resMhFem3 = await ProfessionalTaxService.calculateProfessionalTax({ employee: mhEmpFemale, grossSalary: 30000, payrollDate: '2026-07-01' });
    assert(resMhFem3.ptAmount === 200, 'MH Female ₹30,000 Gross (> 25K) => ₹200 PT', `Got ₹${resMhFem3.ptAmount}`);

    // -------------------------------------------------------------
    // TEST 3: Andhra Pradesh & Tamil Nadu State Calculations
    // -------------------------------------------------------------
    console.log('\n--- 3. Andhra Pradesh (AP) & Tamil Nadu (TN) Calculations ---');
    // Andhra Pradesh
    const apEmp = { ptEligible: true, ptStateCode: 'AP', gender: 'ALL' };
    const resAp1 = await ProfessionalTaxService.calculateProfessionalTax({ employee: apEmp, grossSalary: 14000, payrollDate: '2026-07-01' });
    assert(resAp1.ptAmount === 0, 'AP Salary ₹14,000 (<= 15K) => ₹0 PT', `Got ₹${resAp1.ptAmount}`);

    const resAp2 = await ProfessionalTaxService.calculateProfessionalTax({ employee: apEmp, grossSalary: 18000, payrollDate: '2026-07-01' });
    assert(resAp2.ptAmount === 150, 'AP Salary ₹18,000 (15K - 20K) => ₹150 PT', `Got ₹${resAp2.ptAmount}`);

    const resAp3 = await ProfessionalTaxService.calculateProfessionalTax({ employee: apEmp, grossSalary: 35000, payrollDate: '2026-07-01' });
    assert(resAp3.ptAmount === 200, 'AP Salary ₹35,000 (> 20K) => ₹200 PT', `Got ₹${resAp3.ptAmount}`);

    // Tamil Nadu
    const tnEmp = { ptEligible: true, ptStateCode: 'TN', gender: 'ALL' };
    const resTn1 = await ProfessionalTaxService.calculateProfessionalTax({ employee: tnEmp, grossSalary: 3000, payrollDate: '2026-07-01' });
    assert(resTn1.ptAmount === 0, 'TN Monthly Gross ₹3,000 (<= 3K) => ₹0 PT', `Got ₹${resTn1.ptAmount}`);

    const resTn2 = await ProfessionalTaxService.calculateProfessionalTax({ employee: tnEmp, grossSalary: 4500, payrollDate: '2026-07-01' });
    assert(resTn2.ptAmount === 30, 'TN Monthly Gross ₹4,500 (3K - 5K) => ₹30 PT', `Got ₹${resTn2.ptAmount}`);

    const resTn3 = await ProfessionalTaxService.calculateProfessionalTax({ employee: tnEmp, grossSalary: 6000, payrollDate: '2026-07-01' });
    assert(resTn3.ptAmount === 71, 'TN Monthly Gross ₹6,000 (5K - 8K) => ₹71 PT', `Got ₹${resTn3.ptAmount}`);

    const resTn4 = await ProfessionalTaxService.calculateProfessionalTax({ employee: tnEmp, grossSalary: 8500, payrollDate: '2026-07-01' });
    assert(resTn4.ptAmount === 155, 'TN Monthly Gross ₹8,500 (8K - 10K) => ₹155 PT', `Got ₹${resTn4.ptAmount}`);

    const resTn5 = await ProfessionalTaxService.calculateProfessionalTax({ employee: tnEmp, grossSalary: 11000, payrollDate: '2026-07-01' });
    assert(resTn5.ptAmount === 171, 'TN Monthly Gross ₹11,000 (10K - 15K) => ₹171 PT', `Got ₹${resTn5.ptAmount}`);

    const resTn6 = await ProfessionalTaxService.calculateProfessionalTax({ employee: tnEmp, grossSalary: 25000, payrollDate: '2026-07-01' });
    assert(resTn6.ptAmount === 208, 'TN Monthly Gross ₹25,000 (> 15K) => ₹208 PT', `Got ₹${resTn6.ptAmount}`);

    // -------------------------------------------------------------
    // TEST 3B: Karnataka & Gujarat Slabs
    // -------------------------------------------------------------
    console.log('\n--- 3B. Karnataka & Gujarat State Calculations ---');
    const kaEmp = { ptEligible: true, ptStateCode: 'KA', gender: 'ALL' };
    const resKa1 = await ProfessionalTaxService.calculateProfessionalTax({ employee: kaEmp, grossSalary: 14999, payrollDate: '2026-07-01' });
    assert(resKa1.ptAmount === 0, 'KA Salary ₹14,999 => ₹0 PT', `Got ₹${resKa1.ptAmount}`);

    const resKa2 = await ProfessionalTaxService.calculateProfessionalTax({ employee: kaEmp, grossSalary: 15000, payrollDate: '2026-07-01' });
    assert(resKa2.ptAmount === 200, 'KA Salary ₹15,000 => ₹200 PT', `Got ₹${resKa2.ptAmount}`);

    const gjEmp = { ptEligible: true, ptStateCode: 'GJ', gender: 'ALL' };
    const resGj1 = await ProfessionalTaxService.calculateProfessionalTax({ employee: gjEmp, grossSalary: 5999, payrollDate: '2026-07-01' });
    assert(resGj1.ptAmount === 0, 'GJ Salary ₹5,999 => ₹0 PT', `Got ₹${resGj1.ptAmount}`);

    const resGj2 = await ProfessionalTaxService.calculateProfessionalTax({ employee: gjEmp, grossSalary: 7000, payrollDate: '2026-07-01' });
    assert(resGj2.ptAmount === 80, 'GJ Salary ₹7,000 => ₹80 PT', `Got ₹${resGj2.ptAmount}`);

    const resGj3 = await ProfessionalTaxService.calculateProfessionalTax({ employee: gjEmp, grossSalary: 10000, payrollDate: '2026-07-01' });
    assert(resGj3.ptAmount === 150, 'GJ Salary ₹10,000 => ₹150 PT', `Got ₹${resGj3.ptAmount}`);

    const resGj4 = await ProfessionalTaxService.calculateProfessionalTax({ employee: gjEmp, grossSalary: 25000, payrollDate: '2026-07-01' });
    assert(resGj4.ptAmount === 200, 'GJ Salary ₹25,000 => ₹200 PT', `Got ₹${resGj4.ptAmount}`);

    // -------------------------------------------------------------
    // TEST 4: Exempt Jurisdictions (e.g. Delhi)
    // -------------------------------------------------------------
    console.log('\n--- 4. Exempt State Calculation (Delhi / Non-PT) ---');
    const dlEmp = { ptEligible: true, ptStateCode: 'DL', gender: 'ALL' };
    const resDl = await ProfessionalTaxService.calculateProfessionalTax({ employee: dlEmp, grossSalary: 100000, payrollDate: '2026-07-01' });
    assert(resDl.ptAmount === 0, 'DL Salary ₹100,000 => ₹0 PT (Exempt)', `Got ₹${resDl.ptAmount}`);

    // -------------------------------------------------------------
    // TEST 5: Employee Exemption & Ineligibility
    // -------------------------------------------------------------
    console.log('\n--- 5. Employee Exemption & Profile Flag ---');
    const exemptEmp = { ptEligible: true, ptExemption: true, ptExemptionReason: 'Disabled Employee Exemption u/s 27A', ptStateCode: 'MH' };
    const resEx = await ProfessionalTaxService.calculateProfessionalTax({ employee: exemptEmp, grossSalary: 75000, payrollDate: '2026-07-01' });
    assert(resEx.applicable === false && resEx.ptAmount === 0, 'Exempt Employee => Applicable: false, PT: 0', `Reason: ${resEx.reason}`);

    const notEligibleEmp = { ptEligible: false, ptStateCode: 'MH' };
    const resNotElig = await ProfessionalTaxService.calculateProfessionalTax({ employee: notEligibleEmp, grossSalary: 75000, payrollDate: '2026-07-01' });
    assert(resNotElig.applicable === false && resNotElig.ptAmount === 0, 'Non-eligible Employee => Applicable: false, PT: 0');

    // -------------------------------------------------------------
    // TEST 6: Annual Maximum Cap Enforcement (YTD Deduction)
    // -------------------------------------------------------------
    console.log('\n--- 6. Annual Maximum PT Cap Enforcement ---');
    // Maharashtra Annual Cap is 2500. If employee already has 2400 deducted YTD:
    const resCap1 = await ProfessionalTaxService.calculateProfessionalTax({
      employee: mhEmpMale,
      grossSalary: 50000,
      payrollDate: '2027-03-01',
      ytdPt: 2400 // only 100 remaining before reaching 2500 cap
    });
    assert(resCap1.ptAmount === 100, 'MH Normal PT is ₹200, but capped at remaining ₹100 Annual Cap (YTD: 2400 / 2500)', `Got ₹${resCap1.ptAmount}`);

    const resCap2 = await ProfessionalTaxService.calculateProfessionalTax({
      employee: mhEmpMale,
      grossSalary: 50000,
      payrollDate: '2027-03-01',
      ytdPt: 2500 // cap reached
    });
    assert(resCap2.ptAmount === 0, 'Annual Cap 2500 reached => ₹0 PT deducted', `Got ₹${resCap2.ptAmount}`);

    // -------------------------------------------------------------
    // TEST 7: Attendance Proration
    // -------------------------------------------------------------
    console.log('\n--- 7. Attendance Ratio / LOP Proration ---');
    const resProrated = await ProfessionalTaxService.calculateProfessionalTax({
      employee: mhEmpMale,
      grossSalary: 50000,
      payrollDate: '2026-07-01',
      attendanceRatio: 0.5 // Worked 15 days out of 30
    });
    assert(resProrated.ptAmount === 100, 'MH ₹200 PT at 50% attendance => ₹100 Prorated PT', `Got ₹${resProrated.ptAmount}`);

    // -------------------------------------------------------------
    // TEST 8: Safe Formula Evaluation
    // -------------------------------------------------------------
    console.log('\n--- 8. Controlled Safe Formula Expression Evaluator ---');
    const f1 = ProfessionalTaxService.evaluateFormula('gross_salary * 0.01', { gross_salary: 30000 });
    assert(f1 === 300, 'Formula "gross_salary * 0.01" with 30000 => 300', `Got ${f1}`);

    const f2 = ProfessionalTaxService.evaluateFormula('(basic_salary * 0.02) + 50', { basic_salary: 10000 });
    assert(f2 === 250, 'Formula "(basic_salary * 0.02) + 50" with 10000 => 250', `Got ${f2}`);

    // Rejection of unsafe expressions
    const fUnsafe = ProfessionalTaxService.evaluateFormula('process.exit(1)', { gross_salary: 1000 });
    assert(fUnsafe === 0, 'Unsafe formula expression safely rejected without code execution', `Got ${fUnsafe}`);

    // -------------------------------------------------------------
    // TEST 9: Slab Boundary Validation Engine (Overlap & Gap)
    // -------------------------------------------------------------
    console.log('\n--- 9. Slab Boundary Overlap & Gap Validation ---');
    const validSlabs = [
      { salaryFrom: 0, salaryTo: 7500, ptAmount: 0 },
      { salaryFrom: 7501, salaryTo: 15000, ptAmount: 175 },
      { salaryFrom: 15001, salaryTo: 999999999, ptAmount: 200 }
    ];
    const valGood = ProfessionalTaxService.validateSlabs(validSlabs);
    assert(valGood.valid === true && valGood.errors.length === 0, 'Continuous slabs validate as VALID');

    const overlappingSlabs = [
      { salaryFrom: 0, salaryTo: 10000, ptAmount: 0 },
      { salaryFrom: 8000, salaryTo: 20000, ptAmount: 200 }
    ];
    const valOverlap = ProfessionalTaxService.validateSlabs(overlappingSlabs);
    assert(valOverlap.valid === false && valOverlap.errors.some(e => e.includes('Overlapping')), 'Overlapping slabs correctly rejected with error');

    const gapSlabs = [
      { salaryFrom: 0, salaryTo: 7500, ptAmount: 0 },
      { salaryFrom: 10000, salaryTo: 20000, ptAmount: 200 }
    ];
    const valGap = ProfessionalTaxService.validateSlabs(gapSlabs);
    assert(valGap.warnings.length > 0 && valGap.warnings.some(w => w.includes('Gap detected')), 'Slab gaps correctly detected with warning message');

    // -------------------------------------------------------------
    // TEST 10: Dynamic Future State Addition & Versioning
    // -------------------------------------------------------------
    console.log('\n--- 10. Dynamic Future State Addition & Version Control ---');
    const futureStateCode = 'FS_TEST';
    // Clean up if existing
    const existingFs = await ProfessionalTaxState.findOne({ where: { stateCode: futureStateCode } });
    if (existingFs) {
      await ProfessionalTaxRule.destroy({ where: { stateId: existingFs.id } });
      await existingFs.destroy();
    }

    const futureState = await ProfessionalTaxState.create({
      stateCode: futureStateCode,
      stateName: 'Future State Test',
      countryCode: 'IN',
      taxName: 'Future State PT',
      salaryBasis: 'GROSS_SALARY',
      maxAnnualPt: 3000,
      frequency: 'MONTHLY',
      effectiveFrom: '2027-04-01', // Scheduled for next year
      isEnabled: true
    });

    await ProfessionalTaxRule.create({
      stateId: futureState.id,
      ruleName: 'Future Flat Slab',
      salaryFrom: 0,
      salaryTo: 999999999,
      ptAmount: 250,
      calculationType: 'FIXED',
      effectiveFrom: '2027-04-01',
      isActive: true,
      status: 'SCHEDULED'
    });

    const fsEmp = { ptEligible: true, ptStateCode: futureStateCode, gender: 'ALL' };

    // When calculating before effective date (2026-07):
    const resFutureBefore = await ProfessionalTaxService.calculateProfessionalTax({
      employee: fsEmp,
      grossSalary: 40000,
      payrollDate: '2026-07-01'
    });
    assert(resFutureBefore.applicable === false, 'Future state not applicable before effective date (2026-07-01)', `Reason: ${resFutureBefore.reason}`);

    // When calculating in future period (2027-05):
    const resFutureAfter = await ProfessionalTaxService.calculateProfessionalTax({
      employee: fsEmp,
      grossSalary: 40000,
      payrollDate: '2027-05-01'
    });
    assert(resFutureAfter.applicable === true && resFutureAfter.ptAmount === 250, 'Future state dynamically calculated once effective period arrived (₹250 PT)', `Got ₹${resFutureAfter.ptAmount}`);

    // Clean up test future state
    await ProfessionalTaxRule.destroy({ where: { stateId: futureState.id } });
    await futureState.destroy();

    // -------------------------------------------------------------
    // TEST 11: PayrollEngine Dynamic Integration
    // -------------------------------------------------------------
    console.log('\n--- 11. PayrollEngine Dynamic Integration ---');
    const dynamicMhPt = await PayrollEngine.calculateProfessionalTax(20000, 'MH', 'MALE', '2026-07-01');
    assert(dynamicMhPt === 200, 'PayrollEngine.calculateProfessionalTax dynamically returns ₹200 for MH', `Got ₹${dynamicMhPt}`);

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  }
}

runTests().then(() => {
  console.log('Test suite run completed successfully.');
  process.exit(0);
});
