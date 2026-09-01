import React, { useState, useMemo } from 'react';
import {
  COMPLIANCE_FORMS_CONFIG,
  exportFormToExcel,
  exportAllFormsToExcel,
  exportFormToPDF,
  getCurrentMonthYYYYMM,
  formatMonthYearLabel
} from '../../../data/complianceFormsData';
import ComplianceFormFullView from './ComplianceFormFullView';

export default function ReportTab({
  employees = [],
  attendance = [],
  leaves = [],
  payslips = [],
  taxEmp,
  handleLoadTaxRecord,
  taxRegime,
  setTaxRegime,
  sec80C,
  setSec80C,
  sec80D,
  setSec80D,
  rentPaid,
  setRentPaid,
  handleSaveTax
}) {
  const [selectedForm, setSelectedForm] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYYYYMM());
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [activeSection, setActiveSection] = useState('compliance'); // 'compliance' | 'tax'

  const monthLabel = formatMonthYearLabel(selectedMonth);

  // Dynamic location list derived from DB employees
  const locationsList = useMemo(() => {
    const locSet = new Set(['ALL']);
    if (employees && Array.isArray(employees)) {
      employees.forEach(emp => {
        const loc = emp.location || emp.site;
        if (loc && typeof loc === 'string' && loc.trim() !== '') {
          locSet.add(loc.trim());
        }
      });
    }
    locSet.add('Headquarters');
    locSet.add('Branch Office');
    locSet.add('Field Sites');
    return Array.from(locSet);
  }, [employees]);

  // Dynamically filter employees by Location and Status
  const filteredEmployees = useMemo(() => {
    if (!employees || !Array.isArray(employees)) return [];
    return employees.filter(emp => {
      // 1. Location Filter
      if (selectedLocation !== 'ALL') {
        const empLoc = String(emp.location || emp.site || '').trim().toLowerCase();
        if (empLoc !== selectedLocation.trim().toLowerCase()) {
          return false;
        }
      }
      // 2. Status Filter
      if (selectedStatus === 'ACTIVE') {
        const st = String(emp.status || '').trim().toUpperCase();
        if (st !== 'ACTIVE') return false;
      } else if (selectedStatus === 'NOT_ACTIVE') {
        const st = String(emp.status || '').trim().toUpperCase();
        if (st === 'ACTIVE') return false;
      }
      return true;
    });
  }, [employees, selectedLocation, selectedStatus]);

  // If a form is selected, render full-page view in the same tab
  if (selectedForm) {
    return (
      <ComplianceFormFullView
        formConfig={selectedForm}
        onBack={() => setSelectedForm(null)}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        locationsList={locationsList}
        employees={filteredEmployees}
        attendance={attendance}
        leaves={leaves}
        payslips={payslips}
      />
    );
  }

  return (
    <div className="reports-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Header */}
      <div
        className="card glass"
        style={{
          padding: '24px 30px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          background: 'var(--panel-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'var(--primary-gradient)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.25rem',
                boxShadow: '0 6px 16px rgba(99, 102, 241, 0.35)'
              }}
            >
              <i className="fa-solid fa-file-invoice"></i>
            </span>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              HR Statutory & Compliance Reports
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '740px', lineHeight: '1.5' }}>
            Official statutory compliance forms (Form S, U, V Muster, V Register, X, T, W) generated dynamically for <strong>{monthLabel}</strong> using active database records.
          </p>
        </div>

        {/* Dynamic Filters Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Month Selector Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <i className="fa-regular fa-calendar" style={{ marginRight: '6px' }}></i>
              Month & Year:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none',
                fontWeight: 600
              }}
            />
          </div>

          {/* Location Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i>
              Location:
            </label>
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Locations</option>
              {locationsList.filter(l => l !== 'ALL').map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Employee Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <i className="fa-solid fa-user-check" style={{ marginRight: '6px' }}></i>
              Status:
            </label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Employees</option>
              <option value="NOT_ACTIVE">Not Active / Inactive</option>
            </select>
          </div>

          {/* Employee Count Pill */}
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              color: '#6366f1',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-users"></i>
            {filteredEmployees.length} {filteredEmployees.length === 1 ? 'Employee' : 'Employees'}
          </div>

          {/* Download All Forms */}
          <button
            onClick={() => exportAllFormsToExcel(selectedMonth, filteredEmployees, attendance, leaves, payslips)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '11px 22px',
              fontSize: '0.9rem',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
              backgroundColor: '#10b981',
              borderColor: '#10b981',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-file-excel" style={{ fontSize: '1.15rem' }}></i>
            Download All Forms ({monthLabel})
          </button>
        </div>
      </div>

      {/* Sub-Navigation Switcher */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveSection('compliance')}
          className={`btn ${activeSection === 'compliance' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '10px 22px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="fa-solid fa-folder-open"></i>
          Compliance Statutory Forms ({COMPLIANCE_FORMS_CONFIG.length})
        </button>
        <button
          onClick={() => setActiveSection('tax')}
          className={`btn ${activeSection === 'tax' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '10px 22px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="fa-solid fa-calculator"></i>
          Tax Regime & TDS Calculator
        </button>
      </div>

      {/* Compliance Forms Cards Grid */}
      {activeSection === 'compliance' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '24px'
          }}
        >
          {COMPLIANCE_FORMS_CONFIG.map(form => (
            <div
              key={form.id}
              className="card glass"
              style={{
                borderRadius: '20px',
                padding: '26px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
                background: 'var(--panel-bg)',
                backdropFilter: 'blur(20px)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: 'pointer',
                boxShadow: 'var(--card-shadow)'
              }}
              onClick={() => setSelectedForm(form)}
            >
              <div>
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: form.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '1.35rem',
                        boxShadow: `0 6px 16px ${form.color}40`
                      }}
                    >
                      <i className={`fa-solid ${form.icon}`}></i>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {form.title}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {form.category}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: `${form.color}20`,
                      color: form.color,
                      border: `1px solid ${form.color}40`
                    }}
                  >
                    {form.badge}
                  </span>
                </div>

                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {form.name}
                </h4>

                <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {form.description}
                </p>

                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    background: 'var(--input-bg)',
                    color: 'var(--text-muted)',
                    marginBottom: '20px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <i className="fa-solid fa-scale-balanced" style={{ marginRight: '6px', color: form.color }}></i>
                  {form.rule} &bull; <strong>{monthLabel}</strong>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div
                style={{
                  paddingTop: '18px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedForm(form)}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-expand"></i>
                  Full Page View
                </button>

                <button
                  onClick={() => exportFormToExcel(form.sheetName, selectedMonth, filteredEmployees, attendance, leaves, payslips)}
                  title={`Download Excel for ${monthLabel}`}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    fontSize: '0.92rem',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-file-excel"></i>
                </button>

                <button
                  onClick={() => exportFormToPDF(`printable-compliance-view-${form.id}`, form.title, selectedMonth)}
                  title={`Download PDF for ${monthLabel}`}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontSize: '0.92rem',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-file-pdf"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tax Section */}
      {activeSection === 'tax' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div className="card glass" style={{ padding: '24px', borderRadius: '16px', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>Regime Selection</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Employee Profile</label>
                <select
                  value={taxEmp}
                  onChange={e => handleLoadTaxRecord(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="">Select Employee...</option>
                  {filteredEmployees?.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              {taxEmp && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Regime Option</label>
                    <select
                      value={taxRegime}
                      onChange={e => setTaxRegime(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="NEW">New Tax Regime (Section 115BAC)</option>
                      <option value="OLD">Old Tax Regime (With Deductions)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>80C Declarations (₹)</label>
                    <input
                      type="number"
                      value={sec80C}
                      onChange={e => setSec80C(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>80D Declarations (₹)</label>
                    <input
                      type="number"
                      value={sec80D}
                      onChange={e => setSec80D(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Annual Rent Paid for HRA (₹)</label>
                    <input
                      type="number"
                      value={rentPaid}
                      onChange={e => setRentPaid(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={handleSaveTax} style={{ marginTop: '8px' }}>Save & Project TDS</button>
                </>
              )}
            </div>
          </div>

          <div className="card glass" style={{ padding: '28px', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>HRA, Regime & TDS Calculator Overview</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Selecting <strong>New Regime</strong> gives a flat slab structure with standard deduction of ₹75,000. Selecting <strong>Old Regime</strong> allows claiming HRA exemptions (least of rent excess over 10% basic, actual HRA, or 50% basic) and deductions under Section 80C (up to ₹1,50,000) and 80D (up to ₹25,000). The taxation engine runs monthly projections and divides annual tax liabilities into equal monthly TDS cuts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
