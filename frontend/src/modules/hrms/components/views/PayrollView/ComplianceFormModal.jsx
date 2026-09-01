import React, { useState, useMemo } from 'react';
import {
  getDynamicFormData,
  exportFormToExcel,
  exportFormToPDF,
  getCurrentMonthYYYYMM
} from '../../../data/complianceFormsData';

export default function ComplianceFormModal({
  formConfig,
  onClose,
  selectedMonth = getCurrentMonthYYYYMM(),
  employees = [],
  attendance = [],
  leaves = [],
  payslips = []
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const dynamicData = useMemo(() => {
    if (!formConfig) return { meta: [], headers: [], body: [] };
    return getDynamicFormData(formConfig.sheetName, selectedMonth, employees, attendance, leaves, payslips);
  }, [formConfig, selectedMonth, employees, attendance, leaves, payslips]);

  if (!formConfig) return null;

  const { meta, headers, body } = dynamicData;

  // Filter table data by search query
  const filteredBodyRows = useMemo(() => {
    if (!searchTerm.trim()) return body || [];
    const term = searchTerm.toLowerCase();
    return (body || []).filter(row =>
      row.some(cell => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(term))
    );
  }, [body, searchTerm]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    await exportFormToPDF(`compliance-form-printable-${formConfig.id}`, formConfig.title, selectedMonth);
    setDownloadingPdf(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                {formConfig.title}: {formConfig.name}
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)'
                }}
              >
                {formConfig.category}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              {formConfig.rule} &bull; Softcoded Database Sync ({filteredBodyRows.length} Records)
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '8px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body / Printable Container */}
        <div
          id={`compliance-form-printable-${formConfig.id}`}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px',
            backgroundColor: '#ffffff'
          }}
        >
          {/* Metadata Block */}
          {meta && meta.length > 0 && (
            <div
              style={{
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {meta.map((mRow, idx) => {
                  const label = mRow[0];
                  const val = mRow[2] || mRow[1];
                  if (!label) return null;
                  return (
                    <div key={idx} style={{ fontSize: '0.88rem' }}>
                      <strong style={{ color: '#475569' }}>{label}</strong>{' '}
                      <span style={{ color: '#0f172a' }}>{val || '-'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Toolbar */}
          <div
            style={{
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <input
              type="text"
              placeholder="Filter database records in form..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                width: '320px',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => exportFormToExcel(formConfig.sheetName, selectedMonth, employees, attendance, leaves, payslips)}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-file-excel" style={{ color: '#10b981' }}></i>
                Download Excel
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i>
                {downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
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
                {headers && headers.map((hRow, rIdx) => (
                  <tr key={rIdx} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                    {hRow.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderRight: cIdx < hRow.length - 1 ? '1px solid #334155' : 'none'
                        }}
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {filteredBodyRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={headers[0]?.length || 10}
                      style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}
                    >
                      No database records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBodyRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #e2e8f0'
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '10px 16px',
                            color: '#334155',
                            borderRight: cIdx < row.length - 1 ? '1px solid #f1f5f9' : 'none',
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
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(30, 41, 59, 0.8)'
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Statutory Compliance System &bull; Database Verified
          </span>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 20px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
