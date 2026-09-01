import React, { useEffect, useState } from 'react';
import { api } from './services/api';

// Components
import Login from './components/Login';
import Sidebar from './components/Sidebar';

// Views
import DashboardView from './components/views/DashboardView';
import EmployeesView from './components/views/EmployeesView';
import AttendanceView from './components/views/AttendanceView';
import LeavesView from './components/views/LeavesView';
import ExpensesView from './components/views/ExpensesView';
import PayrollView from './components/views/PayrollView/index.jsx';
import LiveTrackingView from './components/views/LiveTrackingView';
import RouteReplayView from './components/views/RouteReplayView';
import GeofenceView from './components/views/GeofenceView';
import DocumentsView from './components/views/DocumentsView';
import MediaView from './components/views/MediaView';
import EmployeeTrackingView from './components/views/EmployeeTrackingView';
import NotificationCenter from './components/views/NotificationCenter/NotificationCenter';
import SiteInfoView from './components/views/SiteInfoView';
import SettingsView from './components/views/SettingsView';
import WhatsAppNotificationSettingsView from './components/views/WhatsAppNotificationSettingsView';
import LoadingSpinner from './components/LoadingSpinner';

import './index.css';

const getInitialView = () => {
    const path = window.location.pathname;
    if (path === '/hrms/employees/addemp' || path === '/employees/addemp') return 'add-employee-view';
    if (path === '/hrms/employees' || path === '/employees') return 'employees-view';
    if (path === '/hrms/attendance' || path === '/hrms/attendence' || path === '/attendance' || path === '/attendence') return 'attendance-view';
    if (path === '/hrms/leaves' || path === '/leaves') return 'leaves-view';
    if (path === '/hrms/expenses' || path === '/expenses') return 'expenses-view';
    if (path === '/hrms/payroll' || path === '/payroll') return 'payroll-view';
    if (path === '/hrms/live-tracking' || path === '/live-tracking') return 'live-tracking-view';
    if (path === '/hrms/route-replay' || path === '/route-replay') return 'route-replay-view';
    if (path === '/hrms/geofence' || path === '/geofence') return 'geofence-view';
    if (path === '/hrms/documents' || path === '/documents') return 'documents-view';
    if (path === '/hrms/media' || path === '/media') return 'media-view';
    if (path.includes('/attendance/tracking') || path.includes('/employees/tracking') || path === '/hrms/employee-tracking' || path === '/employee-tracking') return 'employee-tracking-view';
    if (path === '/hrms/notifications' || path === '/notifications') return 'notifications-view';
    if (path === '/hrms/whatsapp-settings' || path === '/whatsapp-settings') return 'whatsapp-settings-view';
    if (path === '/hrms/site-info' || path === '/site-info') return 'site-info-view';
    if (path === '/hrms/settings' || path === '/settings') return 'settings-view';
    
    // Fallback to last active view in localStorage if path is /hrms or /
    const savedView = localStorage.getItem('activeHrmsView');
    return savedView || 'dashboard-view';
};

const getPathForView = (view, employeeId, employeeName = '', origin = null) => {
    if (view === 'add-employee-view') return '/hrms/employees/addemp';
    if (view === 'employees-view') return '/hrms/employees';
    if (view === 'attendance-view') return '/hrms/attendance';
    if (view === 'leaves-view') return '/hrms/leaves';
    if (view === 'expenses-view') return '/hrms/expenses';
    if (view === 'payroll-view') return '/hrms/payroll';
    if (view === 'live-tracking-view') return '/hrms/live-tracking';
    if (view === 'route-replay-view') return '/hrms/route-replay';
    if (view === 'geofence-view') return '/hrms/geofence';
    if (view === 'documents-view') return '/hrms/documents';
    if (view === 'media-view') return '/hrms/media';
    if (view === 'employee-tracking-view') {
        const activeOrigin = origin || sessionStorage.getItem('trackingOrigin') || (window.location.pathname.includes('/attendance') ? 'attendance-view' : 'employees-view');
        const activeName = employeeName || sessionStorage.getItem('trackingName') || '';
        const nameQuery = activeName ? `&name=${encodeURIComponent(activeName)}` : '';
        const originQuery = `&origin=${activeOrigin}`;
        const basePath = activeOrigin === 'attendance-view' ? '/hrms/attendance/tracking' : '/hrms/employees/tracking';
        return `${basePath}?id=${employeeId || ''}${nameQuery}${originQuery}`;
    }
    if (view === 'notifications-view') return '/hrms/notifications';
    if (view === 'whatsapp-settings-view') return '/hrms/whatsapp-settings';
    if (view === 'site-info-view') return '/hrms/site-info';
    if (view === 'settings-view') return '/hrms/settings';
    return '/hrms';
};

function App() {
    const [adminUser, setAdminUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('adminUser'));
        } catch {
            return null;
        }
    });
    const [token, setToken] = useState(() => localStorage.getItem('adminToken'));
    const [currentView, setCurrentView] = useState(getInitialView);
    const [employees, setEmployees] = useState([]);
    
    // Employee deep-dive tracking state with F5 page refresh persistence
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || sessionStorage.getItem('trackingId') || null;
    });
    const [selectedEmployeeName, setSelectedEmployeeName] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('name') || sessionStorage.getItem('trackingName') || '';
    });
    const [trackingOrigin, setTrackingOrigin] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('origin');
        if (fromQuery) return fromQuery;
        if (window.location.pathname.includes('/attendance')) return 'attendance-view';
        return sessionStorage.getItem('trackingOrigin') || 'attendance-view';
    });

    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('isSidebarCollapsed') === 'true');

    useEffect(() => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const navigateToView = (view, employeeId = null, employeeName = '', origin = null) => {
        const path = getPathForView(view, employeeId, employeeName, origin);
        window.history.pushState(null, '', path);
        localStorage.setItem('activeHrmsView', view);
        setCurrentView(view);
    };

    const handleLoginSuccess = (user, jwtToken) => {
        setAdminUser(user);
        setToken(jwtToken);
        const initial = getInitialView();
        setCurrentView(initial);
        
        let employeeId = null;
        if (initial === 'employee-tracking-view') {
            const params = new URLSearchParams(window.location.search);
            employeeId = params.get('id');
        }
        const path = getPathForView(initial, employeeId);
        window.history.replaceState(null, '', path);
    };

    const handleLogout = () => {
        localStorage.removeItem('adminUser');
        localStorage.removeItem('adminToken');
        sessionStorage.removeItem('trackingOrigin');
        sessionStorage.removeItem('trackingName');
        sessionStorage.removeItem('trackingId');
        setAdminUser(null);
        setToken(null);
        setEmployees([]);
        window.history.replaceState(null, '', '/');
    };

    // Load and refresh employees list
    const refreshEmployees = async () => {
        try {
            const data = await api.getEmployees({ limit: 1000 });
            const list = Array.isArray(data) ? data : (data && data.data ? data.data : []);
            setEmployees(list);
            return list;
        } catch (err) {
            console.error('Failed to refresh employees:', err);
            return [];
        }
    };

    useEffect(() => {
        if (adminUser && token) {
            refreshEmployees();
        }
    }, [adminUser, token]);

    // Handle back/forward popstate
    useEffect(() => {
        const handlePopState = () => {
            const initial = getInitialView();
            setCurrentView(initial);
            const params = new URLSearchParams(window.location.search);
            if (initial === 'employee-tracking-view') {
                setSelectedEmployeeId(params.get('id') || sessionStorage.getItem('trackingId'));
                setSelectedEmployeeName(params.get('name') || sessionStorage.getItem('trackingName') || '');
                setTrackingOrigin(params.get('origin') || sessionStorage.getItem('trackingOrigin') || (window.location.pathname.includes('/attendance') ? 'attendance-view' : 'employees-view'));
            } else {
                setSelectedEmployeeId(null);
                setSelectedEmployeeName('');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Sync employee name if list is fetched and id is present
    useEffect(() => {
        if (selectedEmployeeId && employees.length > 0 && !selectedEmployeeName) {
            const emp = employees.find(e => String(e._id || e.id || e.employeeId) === String(selectedEmployeeId));
            if (emp) {
                setSelectedEmployeeName(emp.name);
                sessionStorage.setItem('trackingName', emp.name);
            }
        }
    }, [selectedEmployeeId, employees, selectedEmployeeName]);

    // Format current view title
    const getViewTitle = () => {
        if (currentView === 'employee-tracking-view') return 'Employee Tracking Details';
        const titleMap = {
            'dashboard-view': 'Overview',
            'employees-view': 'Employees',
            'attendance-view': 'Attendance Logs',
            'leaves-view': 'Leave Management',
            'expenses-view': 'Expenses & Claims',
            'payroll-view': 'Payroll & Salary Management',
            'live-tracking-view': 'Live Employee Tracking',
            'route-replay-view': 'Historical Route Replay',
            'geofence-view': 'Office Geofence Configuration',
            'documents-view': 'Document Center',
            'media-view': 'Photos & Media',
            'notifications-view': 'Notification Center',
            'whatsapp-settings-view': 'WhatsApp Attendance Summary Notifications',
            'site-info-view': 'Site Info & GPS Geofence Analytics',
            'settings-view': 'System Settings & Legal Audit Log'
        };
        return titleMap[currentView] || 'Overview';
    };

    const handleSelectEmployee = (id, name) => {
        const origin = currentView === 'attendance-view' ? 'attendance-view' : 'employees-view';
        setTrackingOrigin(origin);
        setSelectedEmployeeId(id);
        setSelectedEmployeeName(name || '');
        sessionStorage.setItem('trackingOrigin', origin);
        sessionStorage.setItem('trackingName', name || '');
        sessionStorage.setItem('trackingId', id || '');
        navigateToView('employee-tracking-view', id, name, origin);
        setIsSidebarOpen(false);
    };

    const handleBackToEmployees = () => {
        setSelectedEmployeeId(null);
        setSelectedEmployeeName('');
        const target = trackingOrigin || sessionStorage.getItem('trackingOrigin') || 'attendance-view';
        sessionStorage.removeItem('trackingOrigin');
        sessionStorage.removeItem('trackingName');
        sessionStorage.removeItem('trackingId');
        navigateToView(target);
    };

    if (!adminUser || !token) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    const isFullViewportView = currentView === 'live-tracking-view' || currentView === 'route-replay-view';

    return (
        <div id="dashboard-screen" className={isSidebarCollapsed ? 'sidebar-collapsed' : ''}>
            <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
            <Sidebar 
                adminUser={adminUser} 
                currentView={currentView}
                trackingOrigin={trackingOrigin}
                onViewChange={(view) => {
                    navigateToView(view);
                    setIsSidebarOpen(false);
                }}
                onLogout={handleLogout}
                isSidebarOpen={isSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => {
                    setIsSidebarCollapsed(prev => {
                        const next = !prev;
                        localStorage.setItem('isSidebarCollapsed', String(next));
                        return next;
                    });
                }}
            />
            <main className="main-content" style={{ overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <header className="top-header glass" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', top: 0, zIndex: 100, background: 'var(--panel-bg)', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', margin: '0 0 10px 0', borderRadius: '10px', padding: '6px 14px', minHeight: '46px' }}>
                    <div className="header-left">
                        <h1 id="current-view-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{getViewTitle()}</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button 
                            onClick={toggleTheme}
                            style={{
                                background: 'var(--bg-dark)',
                                border: '1px solid var(--border-glass)',
                                color: 'var(--text-primary)',
                                padding: '5px 12px',
                                height: '32px',
                                borderRadius: '7px',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
                        </button>
                        <div className="admin-profile-compact" onClick={() => navigateToView('dashboard-view')}>
                            <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                                <i className="fa-solid fa-user-tie"></i>
                            </div>
                            <div className="info">
                                <span className="name" style={{ fontSize: '12px', fontWeight: 600 }}>{adminUser?.name || 'Admin'}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content-wrapper custom-scrollbar" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '12px' }}>
                    {currentView === 'dashboard-view' && (
                        <DashboardView 
                            totalEmployees={employees.length} 
                            onViewChange={navigateToView}
                        />
                    )}
                    {currentView === 'employees-view' && (
                        <EmployeesView 
                            employees={employees} 
                            onSelectEmployee={handleSelectEmployee}
                            refreshEmployees={refreshEmployees}
                            navigateToView={navigateToView}
                        />
                    )}
                    {currentView === 'add-employee-view' && (
                        <EmployeesView 
                            employees={employees} 
                            onSelectEmployee={handleSelectEmployee}
                            refreshEmployees={refreshEmployees}
                            initialAddMode={true}
                            navigateToView={navigateToView}
                        />
                    )}
                    {currentView === 'attendance-view' && <AttendanceView employees={employees} onSelectEmployee={handleSelectEmployee} />}
                    {currentView === 'leaves-view' && <LeavesView employees={employees} />}
                    {currentView === 'expenses-view' && <ExpensesView employees={employees} />}
                    {currentView === 'payroll-view' && <PayrollView employees={employees} adminUser={adminUser} />}
                    {currentView === 'live-tracking-view' && <LiveTrackingView employees={employees} />}
                    {currentView === 'route-replay-view' && <RouteReplayView employees={employees} />}
                    {currentView === 'geofence-view' && <GeofenceView />}
                    {currentView === 'documents-view' && (
                        <DocumentsView 
                            employees={employees} 
                            adminUser={adminUser}
                        />
                    )}
                    {currentView === 'media-view' && <MediaView employees={employees} />}
                    {currentView === 'employee-tracking-view' && (
                        <EmployeeTrackingView 
                            userId={selectedEmployeeId}
                            userName={selectedEmployeeName}
                            employees={employees}
                            onBack={handleBackToEmployees}
                            backText={trackingOrigin === 'attendance-view' ? 'Back to Attendance' : 'Back to Employees'}
                        />
                    )}
                    {currentView === 'notifications-view' && <NotificationCenter />}
                    {currentView === 'whatsapp-settings-view' && <WhatsAppNotificationSettingsView />}
                    {currentView === 'site-info-view' && <SiteInfoView employees={employees} />}
                    {currentView === 'settings-view' && <SettingsView />}
                </div>
            </main>
        </div>
    );
}

export default App;
