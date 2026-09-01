import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Core
import Login from './core/authentication/Login';
import Dashboard from './core/layouts/Dashboard';

// HRMS Module
import HrmsModule from './modules/hrms/HrmsModule';

// Invoice Module
import InvoiceLayout from './modules/invoice/components/Layout';
import UploadPage from './modules/invoice/pages/UploadPage';
import ValidationPage from './modules/invoice/pages/ValidationPage';
import ArchivePage from './modules/invoice/pages/ArchivePage';
import AnalyticsPage from './modules/invoice/pages/AnalyticsPage';
import SettingsPage from './modules/invoice/pages/SettingsPage';

// Import style sheets
import './modules/invoice/styles/dashboard.css';

// Helper component for Route Protection
function ProtectedRoute({ children, allowedRoles }) {
    const token = localStorage.getItem('adminToken');
    const userJson = localStorage.getItem('adminUser');
    
    if (!token || !userJson) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles) {
        try {
            const user = JSON.parse(userJson);
            const userRole = user.role?.toUpperCase();
            if (userRole !== 'ADMIN' && !allowedRoles.includes(userRole)) {
                return <Navigate to="/" replace />;
            }
        } catch (e) {
            return <Navigate to="/login" replace />;
        }
    }

    return children;
}

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Auth Route */}
                <Route path="/login" element={<Login />} />

                {/* Platform Hub Dashboard */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />

                {/* HRMS Module Routes */}
                <Route path="/hrms/*" element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'TRACKING_MANAGER', 'FIELD_INVOICE_MANAGER']}>
                        <HrmsModule />
                    </ProtectedRoute>
                } />

                {/* Invoice Extractor Module Routes */}
                <Route path="/invoice" element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'FINANCE', 'FIELD_INVOICE_MANAGER']}>
                        <InvoiceLayout />
                    </ProtectedRoute>
                }>
                    <Route index element={<Navigate to="uploads" replace />} />
                    <Route path="uploads" element={<UploadPage />} />
                    <Route path="validation" element={<ValidationPage />} />
                    <Route path="archive" element={<ArchivePage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Fallback redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
