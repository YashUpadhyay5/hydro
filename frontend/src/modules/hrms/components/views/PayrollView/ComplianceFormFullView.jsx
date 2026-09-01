import React, { useState, useMemo } from 'react';
import {
  getDynamicFormData,
  exportFormToExcel,
  exportFormToPDF,
  formatMonthYearLabel,
  getCurrentMonthYYYYMM
} from '../../../data/complianceFormsData';

export default function ComplianceFormFullView({
  formConfig,
  onBack,
  selectedMonth = getCurrentMonthYYYYMM(),
  setSelectedMonth,
  selectedLocation,
  setSelectedLocation,
  selectedStatus,
  setSelectedStatus,
  locationsList = [],
  employees = [],
  attendance = [],
  leaves = [],
  payslips = []
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Compute dynamic form data strictly from DB state & selected month & filtered employees
  const { meta, headers, body } = useMemo(() => {
    return getDynamicFormData(formConfig.sheetName, selectedMonth, employees, attendance, leaves, payslips);
  }, [formConfig, selectedMonth, employees, attendance, leaves, payslips]);

  // Filter rows by search query
  const filteredBody = useMemo(() => {
    if (!searchTerm.trim()) return body;
    const q = searchTerm.toLowerCase();
    return body.filter(row =>
      row.some(cell => cell && String(cell).toLowerCase().includes(q))
    );
  }, [body, searchTerm]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    await exportFormToPDF(`printable-compliance-view-${formConfig.id}`, formConfig.title, selectedMonth);
    setDownloadingPdf(false);
  };

  const monthLabel = formatMonthYearLabel(selectedMonth);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        animation: 'fadeIn 0.3s ease-in-out'
      }}
    >
      {/* Top Header Controls Bar */}
      <div
        className="card glass"
        style={{
          padding: '20px 28px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBack}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Compliance Reports
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: formConfig.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '1.35rem',
                boxShadow: `0 8px 20px ${formConfig.color}40`
              }}
            >
              <i className={`fa-solid ${formConfig.icon}`}></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formConfig.title} &mdash; {formConfig.name}
                </h2>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: `${formConfig.color}20`,
                    color: formConfig.color,
                    border: `1px solid ${formConfig.color}40`
                  }}
                >
                  {formConfig.category}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {formConfig.rule} &bull; Loaded from Database ({filteredBody.length} records)
              </p>
            </div>
          </div>
        </div>

        {/* Right Toolbar Controls: Month Selector, Location, Status & Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Month Selector Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <i className="fa-regular fa-calendar" style={{ marginRight: '6px' }}></i>
              Month & Year:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth && setSelectedMonth(e.target.value)}
              style={{
                padding: '8px 14px',
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

          {/* Location Filter Control */}
          {selectedLocation !== undefined && setSelectedLocation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i>
                Location:
              </label>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                style={{
                  padding: '8px 14px',
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
                {locationsList && locationsList.filter(l => l !== 'ALL').map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}

          {/* Employee Status Filter Control */}
          {selectedStatus !== undefined && setSelectedStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <i className="fa-solid fa-user-check" style={{ marginRight: '6px' }}></i>
                Status:
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                style={{
                  padding: '8px 14px',
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
                <option value="ACTIVE">Active</option>
                <option value="NOT_ACTIVE">Not Active</option>
              </select>
            </div>
          )}

          <button
            onClick={() => exportFormToExcel(formConfig.sheetName, selectedMonth, employees, attendance, leaves, payslips)}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderColor: '#10b981',
              color: '#10b981',
              fontWeight: 600,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-file-excel" style={{ fontSize: '1.1rem' }}></i>
            Download Excel
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderColor: '#ef4444',
              color: '#ef4444',
              fontWeight: 600,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <i className={`fa-solid ${downloadingPdf ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} style={{ fontSize: '1.1rem' }}></i>
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Main Full-Page Document Container */}
      <div
        className="card glass"
        style={{
          borderRadius: '20px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          background: 'var(--panel-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        {/* Search Bar & DB Live Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ position: 'relative', width: '400px', maxWidth: '100%' }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}
            ></i>
            <input
              type="text"
              placeholder="Search by employee name, ID, designation..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}
            >
              <i className="fa-solid fa-database" style={{ marginRight: '8px' }}></i>
              Active Database Records ({monthLabel})
            </span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Showing {filteredBody.length} of {body.length} entries
            </span>
          </div>
        </div>

        {/* Printable & Premium Form Layout */}
        <div
          id={`printable-compliance-view-${formConfig.id}`}
          style={{
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            borderRadius: '16px',
            padding: '36px',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              textAlign: 'center',
              borderBottom: '2px solid var(--border-subtle)',
              paddingBottom: '24px',
              marginBottom: '28px'
            }}
          >
            <h1
              style={{
                margin: '0 0 8px 0',
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '0.5px'
              }}
            >
              {formConfig.title} &mdash; {formConfig.name.toUpperCase()}
            </h1>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {formConfig.rule} &bull; Wage Period: {monthLabel}
            </p>
          </div>

          {/* Spacious Metadata Card Grid */}
          {meta.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                marginBottom: '32px',
                padding: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '14px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {meta.map((mRow, idx) => {
                const label = mRow[0] || '';
                const val = mRow.slice(1).filter(Boolean).join(' ') || mRow[2] || mRow[3] || '-';
                if (!label.trim()) return null;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {label.replace(':', '')}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Premium Data Table */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.88rem',
                textAlign: 'left'
              }}
            >
              <thead>
                {headers.map((hRow, rIdx) => (
                  <tr key={rIdx} style={{ background: 'var(--primary-gradient)', color: '#ffffff' }}>
                    {hRow.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        style={{
                          padding: '16px 18px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          letterSpacing: '0.4px',
                          borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {cell || ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {filteredBody.length === 0 ? (
                  <tr>
                    <td
                      colSpan={headers[0]?.length || 10}
                      style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.92rem' }}
                    >
                      No active database records found for this month query.
                    </td>
                  </tr>
                ) : (
                  filteredBody.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '14px 18px',
                            color: 'var(--text-primary)',
                            fontWeight: cIdx === 1 ? 600 : 400,
                            borderRight: '1px solid var(--border-subtle)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {cell !== null && cell !== undefined ? String(cell) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Form Footer Stamp */}
          <div
            style={{
              marginTop: '32px',
              paddingTop: '24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: 'var(--text-muted)'
            }}
          >
            <span>HRMS Statutory Compliance System &bull; Database Verified</span>
            <span>Generated for Month: {monthLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
