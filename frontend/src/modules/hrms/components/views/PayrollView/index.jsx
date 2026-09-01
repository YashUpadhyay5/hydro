import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

// Tab Subcomponents
import DashboardTab from './DashboardTab';
import PayRunsTab from './PayRunsTab';
import PayrollAdminTab from './PayrollAdminTab';
import ApprovalsTab from './ApprovalsTab';
import LoansTab from './LoansTab';
import BenefitsTab from './BenefitsTab';
import ReportTab from './ReportTab';
import SettingsTab from './SettingsTab';
import ProfessionalTaxTab from './ProfessionalTaxTab';
import RunItemsModal from './RunItemsModal';

export default function PayrollView({ employees = [], adminUser }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState({
    totalGrossCost: 0,
    totalNetDisbursed: 0,
    pendingRuns: 0,
    alerts: [],
    runsTrend: []
  });

  // State management for different sections
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runItems, setRunItems] = useState([]);
  const [showRunItemsModal, setShowRunItemsModal] = useState(false);

  const [loans, setLoans] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [components, setComponents] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fetchedEmployees, setFetchedEmployees] = useState([]);

  // Structure edit state
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [ctcInput, setCtcInput] = useState('');
  const [grossInput, setGrossInput] = useState('');
  const [effectiveFromInput, setEffectiveFromInput] = useState('2026-04-01');

  // Loan/Claim form states
  const [loanEmp, setLoanEmp] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTenure, setLoanTenure] = useState('');

  const [claimEmp, setClaimEmp] = useState('');
  const [claimTitle, setClaimTitle] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimCategory, setClaimCategory] = useState('TRAVEL');

  // Tax form states
  const [taxEmp, setTaxEmp] = useState('');
  const [taxRegime, setTaxRegime] = useState('NEW');
  const [sec80C, setSec80C] = useState('0');
  const [sec80D, setSec80D] = useState('0');
  const [rentPaid, setRentPaid] = useState('0');

  // New pay run state
  const [newRunMonth, setNewRunMonth] = useState('2026-07');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [latestRunItems, setLatestRunItems] = useState([]);

  // Fetch initial dashboard and data
  useEffect(() => {
    fetchDashboard();
    fetchTabRelatedData();
  }, [activeTab]);

  const fetchDashboard = async () => {
    try {
      const data = await api.getPayrollDashboard();
      setDashboardData(data);
      
      const leavesData = await api.getLeaves();
      setLeaves(leavesData || []);
      
      // Get the latest paid or processed run's items to calculate distributions
      if (data.runsTrend && data.runsTrend.length > 0) {
        const sortedTrend = [...data.runsTrend].sort((a, b) => b.month.localeCompare(a.month));
        const latestRun = sortedTrend[0];
        const items = await api.getPayrollRunItems(latestRun.id);
        setLatestRunItems(items || []);
      } else {
        setLatestRunItems([]);
      }
    } catch (err) {
      console.error(err);
      setLatestRunItems([]);
    }
  };

  const fetchTabRelatedData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'runs') {
        const data = await api.getPayrollRuns();
        setRuns(data);
      } else if (activeTab === 'loans') {
        const data = await api.getLoans();
        setLoans(data);
      } else if (activeTab === 'benefits') {
        const data = await api.getReimbursements();
        setReimbursements(data);
      } else if (activeTab === 'approvals') {
        const data = await api.getSalaryComponents();
        setComponents(data);
      } else if (activeTab === 'payslips') {
        const data = await api.getPayslips();
        setPayslips(data);
      } else if (activeTab === 'report') {
        const [psData, attData, leavesData, empData] = await Promise.all([
          api.getPayslips().catch(() => []),
          api.getAttendance().catch(() => []),
          api.getLeaves().catch(() => []),
          (!employees || employees.length === 0) ? api.getEmployees().catch(() => []) : Promise.resolve([])
        ]);
        if (psData) setPayslips(psData);
        if (attData) setAttendance(attData);
        if (leavesData) setLeaves(leavesData);
        if (empData && empData.length > 0) setFetchedEmployees(empData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleCreateRun = async () => {
    try {
      await api.createPayrollRun(newRunMonth);
      setMessage(`Pay run initialized for ${newRunMonth} successfully.`);
      fetchTabRelatedData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleDeleteRun = async (runId) => {
    if (!window.confirm('Are you sure you want to permanently delete this pay run, calculated items, and payslips from the database?')) {
      return;
    }
    try {
      setLoading(true);
      await api.deletePayrollRun(runId);
      localStorage.removeItem(`payroll_wizard_draft_${runId}`);
      setMessage('Pay run deleted successfully.');
      const updatedRuns = await api.getPayrollRuns();
      setRuns(updatedRuns || []);
      if (selectedRun && selectedRun.id === runId) {
        setSelectedRun(updatedRuns && updatedRuns.length > 0 ? updatedRuns[0] : null);
      }
      fetchDashboard();
    } catch (err) {
      setMessage(`Error deleting run: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRun = async (runId, options = {}) => {
    try {
      setLoading(true);
      const res = await api.processPayroll(runId, options);
      setMessage('Processing payroll initiated. Retrying in background...');
      
      // Simulating simple poll check for job completion
      setTimeout(async () => {
        const check = await api.getPayrollRuns();
        setRuns(check);
        setMessage('Payroll calculations updated successfully.');
      }, 3000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRun = async (runId) => {
    try {
      await api.approvePayroll(runId);
      setMessage('Payroll calculations approved.');
      fetchTabRelatedData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleDisburseRun = async (runId, options = {}) => {
    try {
      const result = await api.disbursePayroll(runId, options);
      const count = result?.payslipsGenerated ?? 0;
      setMessage(`Payroll disbursed. ${count} payslip${count !== 1 ? 's' : ''} saved — check the Payslips tab.`);
      // Immediately reload payslips list and switch to that tab
      const payslipData = await api.getPayslips();
      setPayslips(payslipData);
      setActiveTab('payslips');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleViewItems = async (run) => {
    try {
      const items = await api.getPayrollRunItems(run.id);
      setSelectedRun(run);
      setRunItems(items);
      setShowRunItemsModal(true);
    } catch (err) {
      alert(`Error fetching items: ${err.message}`);
    }
  };

  const handleCreateStructure = async () => {
    try {
      await api.createSalaryStructure({
        employeeId: selectedEmployee,
        ctc: Number(ctcInput),
        grossSalary: Number(grossInput),
        effectiveFrom: effectiveFromInput
      });
      setMessage('Salary Structure revision configured successfully.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleCreateLoan = async () => {
    try {
      await api.createLoan({
        employeeId: loanEmp,
        principalAmount: Number(loanAmount),
        tenureMonths: Number(loanTenure)
      });
      setMessage('Personal Loan request registered.');
      setLoanAmount('');
      setLoanTenure('');
      fetchTabRelatedData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleCreateClaim = async () => {
    try {
      await api.createReimbursement({
        employeeId: claimEmp,
        title: claimTitle,
        amount: Number(claimAmount),
        category: claimCategory
      });
      setMessage('Reimbursement claim logged.');
      setClaimTitle('');
      setClaimAmount('');
      fetchTabRelatedData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleUpdateClaim = async (id, status) => {
    try {
      await api.updateReimbursementStatus(id, status);
      setMessage(`Claim status updated to ${status}.`);
      fetchTabRelatedData();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleLoadTaxRecord = async (empId) => {
    setTaxEmp(empId);
    try {
      const record = await api.getTaxRecord(empId);
      if (record && record.regime) {
        setTaxRegime(record.regime);
        setSec80C(record.investmentDeclarations.sec80C || '0');
        setSec80D(record.investmentDeclarations.sec80D || '0');
        setRentPaid(record.investmentDeclarations.hraRentPaid || '0');
      } else {
        setTaxRegime('NEW');
        setSec80C('0');
        setSec80D('0');
        setRentPaid('0');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTax = async () => {
    try {
      await api.saveTaxRecord(taxEmp, {
        regime: taxRegime,
        investmentDeclarations: {
          sec80C: Number(sec80C),
          sec80D: Number(sec80D),
          hraRentPaid: Number(rentPaid)
        }
      });
      setMessage('Tax regime and investment declarations saved.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="payroll-view-container" style={{ height: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tabs Sidebar/Bar */}
      <div className="tabs-header glass" style={{ display: 'flex', gap: '8px', padding: '12px', borderRadius: '12px', marginBottom: '16px', overflowX: 'auto', flexShrink: 0 }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
          { id: 'runs', label: 'Pay Runs', icon: 'fa-play' },
          { id: 'payroll-admin', label: 'Payroll Admin', icon: 'fa-user-gear' },
          { id: 'professional-tax', label: 'Professional Tax', icon: 'fa-landmark' },
          { id: 'approvals', label: 'Approvals', icon: 'fa-circle-check' },
          { id: 'loans', label: 'Loans', icon: 'fa-handshake' },
          { id: 'benefits', label: 'Benefits', icon: 'fa-hand-holding-heart' },
          { id: 'report', label: 'Report', icon: 'fa-chart-bar' },
          { id: 'payslips', label: 'Payslips', icon: 'fa-receipt' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setMessage(''); }}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="glass alert" style={{ padding: '12px 20px', borderRadius: '8px', marginBottom: '16px', background: 'rgba(79, 70, 229, 0.15)', color: 'var(--text-primary)', borderLeft: '4px solid var(--accent-primary)', fontSize: '0.9rem', flexShrink: 0 }}>
          <i className="fa-solid fa-circle-info" style={{ marginRight: '8px' }}></i>
          {message}
        </div>
      )}

      {/* Tab views */}
      <div className="custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {activeTab === 'dashboard' && (
        <DashboardTab dashboardData={dashboardData} employees={employees} onTabChange={setActiveTab} latestRunItems={latestRunItems} leaves={leaves} />
      )}

      {activeTab === 'runs' && (
        <PayRunsTab
          runs={runs}
          employees={employees}
          adminUser={adminUser}
          reimbursements={reimbursements}
          newRunMonth={newRunMonth}
          setNewRunMonth={setNewRunMonth}
          handleCreateRun={handleCreateRun}
          handleDeleteRun={handleDeleteRun}
          handleProcessRun={handleProcessRun}
          handleDisburseRun={handleDisburseRun}
          handleViewItems={handleViewItems}
        />
      )}

      {activeTab === 'payroll-admin' && (
        <PayrollAdminTab
          employees={employees}
          selectedEmployee={selectedEmployee}
          setSelectedEmployee={setSelectedEmployee}
          ctcInput={ctcInput}
          setCtcInput={setCtcInput}
          grossInput={grossInput}
          setGrossInput={setGrossInput}
          effectiveFromInput={effectiveFromInput}
          setEffectiveFromInput={setEffectiveFromInput}
          handleCreateStructure={handleCreateStructure}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'professional-tax' && (
        <ProfessionalTaxTab adminUser={adminUser} />
      )}

      {activeTab === 'approvals' && (
        <ApprovalsTab components={components} />
      )}

      {activeTab === 'loans' && (
        <LoansTab
          employees={employees}
          loans={loans}
          loanEmp={loanEmp}
          setLoanEmp={setLoanEmp}
          loanAmount={loanAmount}
          setLoanAmount={setLoanAmount}
          loanTenure={loanTenure}
          setLoanTenure={setLoanTenure}
          handleCreateLoan={handleCreateLoan}
        />
      )}

      {activeTab === 'benefits' && (
        <BenefitsTab
          employees={employees}
          reimbursements={reimbursements}
          claimEmp={claimEmp}
          setClaimEmp={setClaimEmp}
          claimCategory={claimCategory}
          setClaimCategory={setClaimCategory}
          claimTitle={claimTitle}
          setClaimTitle={setClaimTitle}
          claimAmount={claimAmount}
          setClaimAmount={setClaimAmount}
          handleCreateClaim={handleCreateClaim}
          handleUpdateClaim={handleUpdateClaim}
        />
      )}

      {activeTab === 'report' && (
        <ReportTab
          employees={employees && employees.length > 0 ? employees : fetchedEmployees}
          attendance={attendance}
          leaves={leaves}
          payslips={payslips}
          taxEmp={taxEmp}
          handleLoadTaxRecord={handleLoadTaxRecord}
          taxRegime={taxRegime}
          setTaxRegime={setTaxRegime}
          sec80C={sec80C}
          setSec80C={setSec80C}
          sec80D={sec80D}
          setSec80D={setSec80D}
          rentPaid={rentPaid}
          setRentPaid={setRentPaid}
          handleSaveTax={handleSaveTax}
        />
      )}

      {activeTab === 'payslips' && (
        <SettingsTab
          payslips={payslips}
          employees={employees}
          onReload={async () => {
            try {
              const data = await api.getPayslips();
              setPayslips(data);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}
      </div>

      {/* Run Items breakdown details modal */}
      <RunItemsModal
        show={showRunItemsModal}
        onClose={() => setShowRunItemsModal(false)}
        selectedRun={selectedRun}
        runItems={runItems}
      />
    </div>
  );
}
