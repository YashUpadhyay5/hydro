import LoadingSpinner from '../LoadingSpinner';
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function LeavesView({ employees = [] }) {
    const adminUser = (() => {
        try {
            return JSON.parse(localStorage.getItem('adminUser'));
        } catch {
            return null;
        }
    })();
    const isTrackingManager = ['TRACKING_MANAGER', 'FIELD_INVOICE_MANAGER'].includes(String(adminUser?.role || 'ADMIN').toUpperCase());

    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    
    // Search & Filter States
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
    const [searchQuery, setSearchQuery] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Helper to resolve up-to-date employee ID (empCode) and Employee Name
    const getEmployeeDisplayInfo = (leave) => {
        if (!leave) return { empCode: '-', empName: 'Unknown' };
        const emp = (employees || []).find(e => 
            (e.id && String(e.id).toLowerCase() === String(leave.userId || '').toLowerCase()) ||
            (e.empCode && String(e.empCode).toLowerCase() === String(leave.userId || '').toLowerCase()) ||
            (e.empCode && String(e.empCode).toLowerCase() === String(leave.empCode || '').toLowerCase()) ||
            (e.name && String(e.name).toLowerCase() === String(leave.userName || '').toLowerCase())
        );
        const empCode = emp?.empCode || leave.empCode || leave.userId || '-';
        const empName = emp?.name || leave.userName || 'Unknown';
        return { empCode, empName };
    };

    const fetchLeaves = async () => {
        setLoading(true);
        try {
            const data = await api.getLeaves();
            setLeaves(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load leaves:', err);
            setError(true);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    useEffect(() => {
        fetchLeaves();
    }, []);

    // Reset pagination when filter or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchQuery, fromDate, toDate]);

    const handleUpdateStatus = async (id, status) => {
        if (!confirm(`Are you sure you want to ${status} this leave request?`)) return;
        try {
            await api.updateLeaveStatus(id, status);
            fetchLeaves();
        } catch (err) {
            alert('Failed to update leave status: ' + (err.response?.data?.error || err.message));
        }
    };

    // Filter leaves
    let filteredLeaves = leaves.filter(leave => {
        const s = String(leave.status || '').toLowerCase().trim();
        if (filter === 'pending') return s === 'pending';
        if (filter === 'approved') return s === 'approved';
        if (filter === 'rejected') return s === 'rejected';
        return true;
    });

    // Apply Date Range Filter if set (comparing against leave.startDate or leave.appliedAt)
    if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        filteredLeaves = filteredLeaves.filter(leave => {
            if (!leave.startDate) return false;
            const leaveDate = new Date(leave.startDate);
            if (isNaN(leaveDate.getTime()) && !isNaN(Number(leave.startDate))) {
                return new Date(Number(leave.startDate)) >= from;
            }
            return leaveDate >= from;
        });
    }
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filteredLeaves = filteredLeaves.filter(leave => {
            if (!leave.startDate) return false;
            const leaveDate = new Date(leave.startDate);
            if (isNaN(leaveDate.getTime()) && !isNaN(Number(leave.startDate))) {
                return new Date(Number(leave.startDate)) <= to;
            }
            return leaveDate <= to;
        });
    }

    // Apply Search Query (by Employee Name, Employee ID, or Reason)
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filteredLeaves = filteredLeaves.filter(leave => {
            const { empCode, empName } = getEmployeeDisplayInfo(leave);
            const nameMatch = empName && empName.toLowerCase().includes(query);
            const codeMatch = empCode && empCode.toLowerCase().includes(query);
            const reasonMatch = leave.reason && leave.reason.toLowerCase().includes(query);
            return nameMatch || codeMatch || reasonMatch;
        });
    }

    // Paginated leaves
    const totalItems = filteredLeaves.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedLeaves = filteredLeaves.slice(startIndex, endIndex);

    return (
        <div id="leaves-view" className="view active" style={{ height: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            {/* Toolbar: Filters & Search */}
            <div className="glass" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <button 
                        className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} 
                        onClick={() => setFilter('all')}
                        style={{ height: '38px', padding: '0 16px', borderRadius: '6px', fontSize: '0.875rem', background: filter !== 'all' ? 'var(--input-bg, #f3f4f6)' : undefined, color: filter !== 'all' ? 'var(--text-primary, #374151)' : undefined }}
                    >
                        All Requests
                    </button>
                    <button 
                        className={`btn ${filter === 'pending' ? 'btn-primary' : ''}`} 
                        onClick={() => setFilter('pending')}
                        style={{ 
                            height: '38px',
                            padding: '0 16px',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            background: filter === 'pending' ? undefined : 'var(--input-bg, #f3f4f6)', 
                            color: filter === 'pending' ? undefined : 'var(--text-primary, #374151)',
                            border: filter === 'pending' ? undefined : '1px solid var(--border-glass, #d1d5db)'
                        }}
                    >
                        Pending
                    </button>
                    <button 
                        className={`btn ${filter === 'approved' ? 'btn-primary' : ''}`} 
                        onClick={() => setFilter('approved')}
                        style={{ 
                            height: '38px',
                            padding: '0 16px',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            background: filter === 'approved' ? '#10b981' : 'var(--input-bg, #f3f4f6)', 
                            color: filter === 'approved' ? 'white' : 'var(--text-primary, #374151)',
                            border: filter === 'approved' ? undefined : '1px solid var(--border-glass, #d1d5db)'
                        }}
                    >
                        Approved
                    </button>
                    <button 
                        className={`btn ${filter === 'rejected' ? 'btn-primary' : ''}`} 
                        onClick={() => setFilter('rejected')}
                        style={{ 
                            height: '38px',
                            padding: '0 16px',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            background: filter === 'rejected' ? '#ef4444' : 'var(--input-bg, #f3f4f6)', 
                            color: filter === 'rejected' ? 'white' : 'var(--text-primary, #374151)',
                            border: filter === 'rejected' ? undefined : '1px solid var(--border-glass, #d1d5db)'
                        }}
                    >
                        Rejected
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary, #4b5563)' }}>From Date</span>
                            <input 
                                type="date" 
                                value={fromDate} 
                                onChange={(e) => setFromDate(e.target.value)}
                                style={{
                                    height: '38px',
                                    padding: '0 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-glass, #e5e7eb)',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    background: 'var(--input-bg, #ffffff)',
                                    color: 'var(--text-primary, #111827)'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary, #4b5563)' }}>To Date</span>
                            <input 
                                type="date" 
                                value={toDate} 
                                onChange={(e) => setToDate(e.target.value)}
                                style={{
                                    height: '38px',
                                    padding: '0 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-glass, #e5e7eb)',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    background: 'var(--input-bg, #ffffff)',
                                    color: 'var(--text-primary, #111827)'
                                }}
                            />
                        </div>
                        {(fromDate || toDate) && (
                            <button 
                                className="btn"
                                onClick={() => { setFromDate(''); setToDate(''); }}
                                style={{ background: '#ef4444', color: 'white', padding: '0 12px', borderRadius: '6px', cursor: 'pointer', height: '38px', fontSize: '0.85rem' }}
                            >
                                Clear Range
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '260px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary, #4b5563)' }}>Search Requests</span>
                        <input 
                            type="text" 
                            placeholder="Search by Employee Name, ID, or Reason..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                height: '38px',
                                padding: '0 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-glass, #e5e7eb)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                background: 'var(--input-bg, #ffffff)',
                                color: 'var(--text-primary, #111827)'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="table-container glass custom-scrollbar" style={{ padding: 0, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', borderRadius: '16px' }}>
                <table id="leaves-table">
                    <thead>
                        <tr>
                            <th>Date Applied</th>
                            <th>Employee</th>
                            <th>Duration</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ padding: "40px 0" }}><LoadingSpinner message="Fetching Leave Requests..." minHeight="220px" /></td></tr>
                        ) : error ? (
                            <tr><td colSpan="6" className="error-text" style={{ textAlign: 'center', padding: '30px' }}>Failed to load leaves</td></tr>
                        ) : paginatedLeaves.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>No leave requests found.</td></tr>
                        ) : (
                            paginatedLeaves.map(leave => {
                                const { empCode, empName } = getEmployeeDisplayInfo(leave);
                                return (
                                    <tr key={leave.id}>
                                        <td>{formatDate(leave.appliedAt)}</td>
                                        <td>
                                            <strong style={{ color: '#4f46e5', display: 'block' }}>{empName}</strong>
                                            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>{empCode}</span>
                                        </td>
                                        <td>{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</td>
                                        <td>{leave.reason}</td>
                                        <td><span className={`badge-status badge-${String(leave.status || '').toLowerCase()}`}>{String(leave.status || '').toUpperCase()}</span></td>
                                        <td>
                                            {String(leave.status || '').toLowerCase() === 'pending' && !isTrackingManager ? (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn btn-success" title="Approve" onClick={() => handleUpdateStatus(leave.id, 'approved')}>
                                                        <i className="fa-solid fa-check"></i>
                                                    </button>
                                                    <button className="btn btn-danger" title="Reject" onClick={() => handleUpdateStatus(leave.id, 'rejected')}>
                                                        <i className="fa-solid fa-xmark"></i>
                                                    </button>
                                                </div>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination Footer */}
                {totalItems > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        padding: '14px 24px',
                        borderTop: '1px solid #e5e7eb',
                        gap: '20px',
                        fontSize: '0.875rem',
                        color: '#4b5563'
                    }}>
                        <span>
                            {startIndex + 1}–{endIndex} of {totalItems}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    border: '1px solid #e5e7eb',
                                    background: 'white',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: currentPage === 1 ? 0.5 : 1,
                                    fontWeight: 'bold'
                                }}
                            >
                                &lt;
                            </button>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    border: '1px solid #e5e7eb',
                                    background: 'white',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    opacity: currentPage === totalPages ? 0.5 : 1,
                                    fontWeight: 'bold'
                                }}
                            >
                                &gt;
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
