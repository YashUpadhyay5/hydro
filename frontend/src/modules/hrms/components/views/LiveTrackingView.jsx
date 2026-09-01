import LoadingSpinner from '../LoadingSpinner';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function LiveTrackingView({ employees }) {
    const [loading, setLoading] = useState(true);
    const [selectedEmp, setSelectedEmp] = useState('all');
    const [workMode, setWorkMode] = useState('ALL');
    const [selectedState, setSelectedState] = useState('ALL');
    const [liveLogs, setLiveLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const layerGroupRef = useRef(null);
    const markersRef = useRef({});

    const getLiveMarkerIcon = (f) => {
        let color = f.trackingMethod === 'CELLULAR' ? '#f59e0b' : '#2563eb';
        let iconClass = f.trackingMethod === 'CELLULAR' ? 'fa-tower-cell' : 'fa-satellite-dish';
        let size = 26;

        return window.L.divIcon({
            className: 'custom-tracking-marker',
            html: `<div style="position: relative; background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">
                <i class="fa-solid ${iconClass}" style="font-size: 11px;"></i>
            </div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    };

    const fetchLiveTracking = async () => {
        if (!mapInstance.current || !layerGroupRef.current) return;
        layerGroupRef.current.clearLayers();
        setLiveLogs([]);
        markersRef.current = {};

        try {
            const todayDate = new Date().toISOString().split('T')[0];
            const [footprints, todayAttendance] = await Promise.all([
                api.getLatestAllFootprints(),
                api.getAttendance ? api.getAttendance({ date: todayDate, limit: 500 }).catch(() => []) : Promise.resolve([])
            ]);
            
            // Build set of User IDs for employees who are currently actively clocked in today (checkIn present, no checkOut)
            const clockedInUserIds = new Set();
            (todayAttendance || []).forEach(att => {
                if (att && att.checkIn && (!att.checkOut || String(att.checkOut).trim() === '')) {
                    if (att.userId) clockedInUserIds.add(String(att.userId).trim().toLowerCase());
                    if (att.userName) clockedInUserIds.add(String(att.userName).trim().toLowerCase());
                    if (att.empCode) clockedInUserIds.add(String(att.empCode).trim().toLowerCase());

                    // Cross-reference with roster to add all aliases
                    const emp = (employees || []).find(e => {
                        const rId = String(att.userId || '').trim().toLowerCase();
                        const rName = String(att.userName || '').trim().toLowerCase();
                        const rCode = String(att.empCode || '').trim().toLowerCase();
                        return (e.id && (String(e.id).trim().toLowerCase() === rId || String(e.id).trim().toLowerCase() === rCode)) ||
                               (e.empCode && (String(e.empCode).trim().toLowerCase() === rId || String(e.empCode).trim().toLowerCase() === rCode)) ||
                               (e.emp_code && (String(e.emp_code).trim().toLowerCase() === rId || String(e.emp_code).trim().toLowerCase() === rCode)) ||
                               (e.name && String(e.name).trim().toLowerCase() === rName);
                    });

                    if (emp) {
                        if (emp.id) clockedInUserIds.add(String(emp.id).trim().toLowerCase());
                        if (emp.empCode) clockedInUserIds.add(String(emp.empCode).trim().toLowerCase());
                        if (emp.emp_code) clockedInUserIds.add(String(emp.emp_code).trim().toLowerCase());
                        if (emp.name) clockedInUserIds.add(String(emp.name).trim().toLowerCase());
                    }
                }
            });

            // Build active employee ID set
            const activeEmpIds = new Set(
                (employees || []).flatMap(e => [
                    e.id ? String(e.id).trim().toLowerCase() : null,
                    e.empId ? String(e.empId).trim().toLowerCase() : null,
                    e.employeeId ? String(e.employeeId).trim().toLowerCase() : null,
                    e.emp_id ? String(e.emp_id).trim().toLowerCase() : null,
                    e.empCode ? String(e.empCode).trim().toLowerCase() : null,
                    e.emp_code ? String(e.emp_code).trim().toLowerCase() : null,
                    e.code ? String(e.code).trim().toLowerCase() : null,
                    e.userId ? String(e.userId).trim().toLowerCase() : null,
                    e.name ? String(e.name).trim().toLowerCase() : null
                ].filter(Boolean))
            );

            // Keep footprints belonging ONLY to employees who strictly clocked in today and are currently active
            let activeFootprints = (footprints || []).filter(f => {
                if (!f || !f.userId) return false;
                const uid = String(f.userId).trim().toLowerCase();

                // Match active employee roster
                const isRosterActive = activeEmpIds.has(uid) || (f.userName && activeEmpIds.has(String(f.userName).trim().toLowerCase()));
                if (!isRosterActive) return false;

                // Match today's active attendance clock-in record
                const empObj = (employees || []).find(e => 
                    (e.id && String(e.id).trim().toLowerCase() === uid) ||
                    (e.empId && String(e.empId).trim().toLowerCase() === uid) ||
                    (e.employeeId && String(e.employeeId).trim().toLowerCase() === uid) ||
                    (e.empCode && String(e.empCode).trim().toLowerCase() === uid) ||
                    (e.emp_code && String(e.emp_code).trim().toLowerCase() === uid) ||
                    (e.code && String(e.code).trim().toLowerCase() === uid) ||
                    (e.userId && String(e.userId).trim().toLowerCase() === uid)
                );
                const empName = empObj ? String(empObj.name).trim().toLowerCase() : (f.userName ? String(f.userName).trim().toLowerCase() : '');
                
                const hasClockedIn = clockedInUserIds.has(uid) || (empName && clockedInUserIds.has(empName));
                if (!hasClockedIn) return false;

                return true;
            });

            let filteredFootprints = activeFootprints.filter(f => {
                const uid = String(f.userId || '').trim().toLowerCase();
                const emp = (employees || []).find(e => 
                    (e.id && String(e.id).trim().toLowerCase() === uid) ||
                    (e.empId && String(e.empId).trim().toLowerCase() === uid) ||
                    (e.employeeId && String(e.employeeId).trim().toLowerCase() === uid) ||
                    (e.empCode && String(e.empCode).trim().toLowerCase() === uid) ||
                    (e.emp_code && String(e.emp_code).trim().toLowerCase() === uid) ||
                    (e.userId && String(e.userId).trim().toLowerCase() === uid) ||
                    (f.userName && e.name && String(e.name).trim().toLowerCase() === String(f.userName).trim().toLowerCase())
                );
                if (!emp) return false;

                // 1. Work Mode Filter
                const rawMode = (f.workMode || emp.workMode || emp.roleType || emp.employeeType || emp.designation || 'OFFICE').toUpperCase();
                const matchesMode = workMode === 'ALL' || rawMode.includes(workMode);
                if (!matchesMode) return false;

                // 2. State Filter
                if (selectedState !== 'ALL') {
                    const empState = resolveEmpOnboardingState(emp).toLowerCase();
                    const targetState = selectedState.toLowerCase();
                    if (!empState.includes(targetState) && !targetState.includes(empState)) {
                        return false;
                    }
                }

                // 3. Individual Employee Filter
                if (selectedEmp !== 'all' && selectedEmp !== 'all_field' && selectedEmp !== 'all_office') {
                    return String(f.userId) === String(selectedEmp) || String(emp.id) === String(selectedEmp);
                }

                return true;
            });

            // Group by coordinates to detect overlaps and add a tiny jitter/offset to make them distinct
            const coordMap = {};
            const processedFootprints = filteredFootprints.map(f => {
                if (!f.latitude || !f.longitude) return f;
                
                let lat = parseFloat(f.latitude);
                let lng = parseFloat(f.longitude);
                const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
                
                if (coordMap[coordKey]) {
                    const count = coordMap[coordKey];
                    // Distribute overlapping markers in a circle around the original coordinate
                    const angle = count * (2 * Math.PI / 8); 
                    const radius = 0.00025 * (1 + Math.floor(count / 8)); 
                    lat += radius * Math.sin(angle);
                    lng += radius * Math.cos(angle);
                    coordMap[coordKey]++;
                } else {
                    coordMap[coordKey] = 1;
                }
                
                return {
                    ...f,
                    latJittered: lat,
                    lngJittered: lng
                };
            });

            // Save to state for left panel
            setLiveLogs(processedFootprints);
            setTimeout(() => setLoading(false), 300);

            if (!window.L) return;

            // Initialize bounds using global L
            const bounds = window.L.latLngBounds();
            let markerCount = 0;

            processedFootprints.forEach(f => {
                if (f.latJittered && f.lngJittered) {
                    const emp = employees ? employees.find(e => {
                        if (!e || !f.userId) return false;
                        const target = String(f.userId).trim().toLowerCase();
                        if (loading) return <LoadingSpinner message="Initializing Live GPS Telemetry Map..." minHeight="400px" />;

    return (
                            (e.id && String(e.id).trim().toLowerCase() === target) ||
                            (e.empId && String(e.empId).trim().toLowerCase() === target) ||
                            (e.employeeId && String(e.employeeId).trim().toLowerCase() === target) ||
                            (e.emp_id && String(e.emp_id).trim().toLowerCase() === target) ||
                            (e.code && String(e.code).trim().toLowerCase() === target) ||
                            (e.userId && String(e.userId).trim().toLowerCase() === target) ||
                            (e.name && String(e.name).trim().toLowerCase() === target)
                        );
                    }) : null;
                    const name = emp?.name || emp?.employeeName || f.userName || f.name || f.userId || f.user_id || 'Employee';
                    const level = f.batteryLevel !== null ? (Number(f.batteryLevel) > 1.0 ? Number(f.batteryLevel) / 100 : Number(f.batteryLevel)) : null;
                    const batInfo = level !== null ? `${Math.round(level * 100)}%` : 'Unknown';
                    const addressInfo = f.address || 'Address Unknown';
                    
                    const tooltipContent = `
                        <div style="
                            font-family: system-ui, -apple-system, sans-serif;
                            font-weight: 700;
                            font-size: 0.85rem;
                            color: var(--text-primary);
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            padding: 2px 4px;
                        ">
                            <span style="color: #2563eb; font-size: 1.1rem; line-height: 0.8;">•</span>
                            <span>${name}</span>
                            <span style="color: var(--text-secondary); font-weight: 500; font-size: 0.75rem;">(${batInfo})</span>
                        </div>
                    `;

                    const popupContent = `
                        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px;">
                            <b style="font-size: 0.95rem; color: var(--text-primary);">${name}</b><br>
                            <span style="color: var(--text-secondary); font-size: 0.8rem;">Last seen: ${formatDate(f.timestamp, true)}</span><br>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">🔋 Battery: ${batInfo}</span><br>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">📍 Address: ${addressInfo}</span>
                        </div>
                    `;
                    
                    const markerIcon = getLiveMarkerIcon(f);
                    const marker = window.L.marker([f.latJittered, f.lngJittered], { icon: markerIcon })
                        .addTo(layerGroupRef.current)
                        .bindTooltip(tooltipContent, {
                            permanent: true,
                            direction: 'top',
                            offset: [0, -10],
                            opacity: 0.95
                        })
                        .bindPopup(popupContent);

                    markersRef.current[f.userId] = marker;
                    bounds.extend(marker.getLatLng());
                    markerCount++;
                }
            });

            if (markerCount > 0) {
                mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
            }
        } catch (err) {
            console.error("Live track error", err);
        }
    };

    useEffect(() => {
        // Initialize Leaflet Map using global window.L loaded in index.html
        if (!mapInstance.current && mapRef.current && window.L) {
            mapInstance.current = window.L.map(mapRef.current).setView([28.6692, 77.4538], 12);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance.current);
            layerGroupRef.current = window.L.layerGroup().addTo(mapInstance.current);
        }

        const timer = setTimeout(() => {
            if (mapInstance.current) {
                mapInstance.current.invalidateSize();
                fetchLiveTracking();
            }
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [selectedEmp, workMode, selectedState, employees]);

    const handleLogClick = (userId, lat, lng) => {
        if (!mapInstance.current || !lat || !lng) return;
        mapInstance.current.setView([lat, lng], 16);
        const marker = markersRef.current[userId];
        if (marker) {
            marker.openPopup();
        }
    };

    // Resolve clean single official onboarding state for employees (Enterprise Production Standard)
    const resolveEmpOnboardingState = (emp) => {
        if (!emp) return 'Uttar Pradesh';
        if (emp.state && typeof emp.state === 'string' && isNaN(Number(emp.state))) {
            return emp.state.trim();
        }

        const text = (String(emp.location || '') + ' ' + String(emp.address || '') + ' ' + String(emp.department || '')).toLowerCase();

        if (text.includes('madhya pradesh') || text.includes('bhopal') || text.includes('indore')) return 'Madhya Pradesh';
        if (text.includes('himachal') || text.includes('sirmaur') || text.includes('solan') || text.includes('shimla') || text.includes('paonta') || text.includes('renuka') || text.includes('rajana')) return 'Himachal Pradesh';
        if (text.includes('punjab') || text.includes('amritsar') || text.includes('tarn taran') || text.includes('ludhiana')) return 'Punjab';
        if (text.includes('tamil nadu') || text.includes('chennai')) return 'Tamil Nadu';
        if (text.includes('noida') || text.includes('ghaziabad') || text.includes('uttar pradesh') || text.includes('up')) return 'Uttar Pradesh';
        if (text.includes('delhi')) return 'Delhi / NCR';

        const empId = String(emp.id || emp.employeeId || '');
        if (['EMP0129', 'EMP0125', 'EMP0130'].includes(empId)) return 'Himachal Pradesh';
        if (['EMP0126', 'EMP0127', 'EMP0128', 'EMP0131', 'EMP0132', 'EMP0133', 'EMP0134', 'EMP0135', 'EMP0136'].includes(empId)) return 'Punjab';
        if (['EMP0010', 'EMP0022', 'HMPL65'].includes(empId)) return 'Tamil Nadu';
        if (['EMP0124', 'EMP0018', 'EMP0019', 'hmpl001', 'EMP0021', 'EMP0020'].includes(empId)) return 'Uttar Pradesh';

        return 'Uttar Pradesh';
    };

    const availableStates = Array.from(new Set(
        (employees || []).map(resolveEmpOnboardingState).filter(Boolean)
    )).sort();

    const filteredEmployees = (employees || []).filter(emp => {
        const matchesMode = (emp.designation || 'OFFICE').toUpperCase() === workMode;
        const isNotAdmin = emp.role !== 'ADMIN';
        if (!matchesMode || !isNotAdmin) return false;

        if (selectedState === 'ALL') return true;

        const targetState = selectedState.toLowerCase();
        const empState = resolveEmpOnboardingState(emp).toLowerCase();

        return empState.includes(targetState) || targetState.includes(empState);
    });

    // Filter live logs by search query (employee name)
    const filteredLogs = liveLogs.filter(log => {
        const emp = employees.find(e => e.id === log.userId);
        const name = emp ? emp.name.toLowerCase() : log.userId.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    return (
        <div id="live-tracking-view" className="view active" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflow: 'hidden' }}>
            {/* Input Selection Header (Fixed) */}
            <div className="glass" style={{ padding: '14px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    
                    {/* Work Mode Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Work Mode</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '39px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                <input type="radio" name="liveWorkMode" value="OFFICE" checked={workMode === 'OFFICE'} onChange={() => { setWorkMode('OFFICE'); setSelectedEmp('all'); }} style={{ accentColor: '#2563eb' }} />
                                Office Person
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                <input type="radio" name="liveWorkMode" value="FIELD" checked={workMode === 'FIELD'} onChange={() => { setWorkMode('FIELD'); setSelectedEmp('all'); }} style={{ accentColor: '#2563eb' }} />
                                Field Person
                            </label>
                        </div>
                    </div>

                    {/* Filter by State */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Filter by State</label>
                        <select 
                            value={selectedState} 
                            onChange={(e) => { setSelectedState(e.target.value); setSelectedEmp('all'); }} 
                            style={{ width: '180px', height: '39px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                            <option value="ALL">All States ({availableStates.length})</option>
                            {availableStates.map(st => (
                                <option key={st} value={st}>📍 {st}</option>
                            ))}
                        </select>
                    </div>

                    {/* Cascading Select Employee */}
                    <div style={{ flex: '0 1 320px', margin: 0 }}>
                        <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Select Employee</label>
                        <select 
                            id="live-emp-select"
                            value={selectedEmp}
                            onChange={(e) => setSelectedEmp(e.target.value)}
                            style={{ width: '100%', height: '39px', padding: '0 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                            <option value="all">
                                {selectedState === 'ALL' 
                                    ? `All ${workMode === 'FIELD' ? 'Field' : 'Office'} Employees (Recent Locations)` 
                                    : `📍 All ${selectedState} ${workMode === 'FIELD' ? 'Field' : 'Office'} Staff (Live Locations)`}
                            </option>
                            {filteredEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.empCode || emp.employeeId || emp.id})</option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Map Button */}
                    <div style={{ flex: '0 0 auto', margin: 0 }}>
                        <button 
                            className="btn btn-primary" 
                            id="btn-refresh-live" 
                            onClick={fetchLiveTracking} 
                            style={{ 
                                padding: '9px 20px', 
                                height: '39px', 
                                width: 'auto', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontSize: '0.85rem', 
                                fontWeight: 600,
                                borderRadius: '8px',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer'
                            }}
                        >
                            <i className="fa-solid fa-arrows-rotate"></i>
                            <span>Refresh Map</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Split Screen Container (Flex 1) */}
            <div className="view-content" style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0, overflow: 'hidden' }}>
                {/* Left Side Panel: Active Employees & Details (Only this list scrolls!) */}
                <div className="glass panel-left" style={{ flex: 1, minWidth: '280px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
                    <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', flexShrink: 0 }}>
                        <h3 style={{ margin: 0, marginBottom: '8px' }}>Active Employees</h3>
                        <input 
                            type="text" 
                            placeholder="Filter by employee name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb',
                                fontSize: '0.85rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                        {filteredLogs.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '50px' }}>
                                No active employee logs found matching the filter.
                            </div>
                        ) : (
                            filteredLogs.map((log, index) => {
                                const emp = employees ? employees.find(e => {
                                    if (!e || !log.userId) return false;
                                    const target = String(log.userId).trim().toLowerCase();
                                    return (
                                        (e.id && String(e.id).trim().toLowerCase() === target) ||
                                        (e.empId && String(e.empId).trim().toLowerCase() === target) ||
                                        (e.employeeId && String(e.employeeId).trim().toLowerCase() === target) ||
                                        (e.emp_id && String(e.emp_id).trim().toLowerCase() === target) ||
                                        (e.code && String(e.code).trim().toLowerCase() === target) ||
                                        (e.userId && String(e.userId).trim().toLowerCase() === target) ||
                                        (e.name && String(e.name).trim().toLowerCase() === target)
                                    );
                                }) : null;
                                const name = emp?.name || emp?.employeeName || log.userName || log.name || log.userId || log.user_id || 'Employee';
                                return (
                                    <div 
                                        key={log.id || index}
                                        onClick={() => handleLogClick(log.userId, log.latJittered, log.lngJittered)}
                                        style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            fontSize: '0.85rem',
                                            backgroundColor: 'var(--input-bg)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease-in-out'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                            e.currentTarget.style.borderColor = '#2563eb';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                            <span style={{ color: 'var(--text-primary)' }}>👤 {name}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                🔋 {(() => {
                                                    if (log.batteryLevel === null) return 'N/A';
                                                    let val = Number(log.batteryLevel);
                                                    if (val > 1.0) val = val / 100;
                                                    return Math.round(val * 100) + '%';
                                                })()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            <span><b>Lat:</b> {parseFloat(log.latitude).toFixed(6)}</span>
                                            <span><b>Lng:</b> {parseFloat(log.longitude).toFixed(6)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            <b>Last Seen:</b> {formatDate(log.timestamp, true)}
                                        </div>
                                        {log.address && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-glass)', paddingTop: '4px' }}>
                                                {log.address}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Side Panel: Leaflet Map (Fills remaining height) */}
                <div className="glass panel-map" style={{ flex: 2, minWidth: '280px', padding: '10px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div ref={mapRef} id="live-map" style={{ width: '100%', height: '100%', borderRadius: '8px', zIndex: 1 }}></div>
                </div>
            </div>
        </div>
    );
}
