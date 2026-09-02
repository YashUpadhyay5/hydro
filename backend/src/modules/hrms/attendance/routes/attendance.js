const express = require('express');
const router = express.Router();
const Attendance = require('../../../../shared/models/Attendance');
const Employee = require('../../../../shared/models/Employee');
const sequelize = require('../../../../config/database');
const { Op } = require('sequelize');
const { getAddressFromCoords } = require('../../../../core/utils/geocoder');

const LEGACY_ALIASES = {
  'emp0128': 'HMPL39',
  'mandeep': 'HMPL39',
  'mandeep singh': 'HMPL39'
};

// Helper to find employee by id, emp_code, or name
async function findEmployee(identifier, name) {
  if (!identifier && !name) return null;
  let emp = null;
  const rawSearchTerms = [identifier, name].filter(Boolean).map(s => String(s).trim().toLowerCase());
  const searchTerms = [];
  rawSearchTerms.forEach(t => {
    searchTerms.push(t);
    if (LEGACY_ALIASES[t]) searchTerms.push(LEGACY_ALIASES[t].toLowerCase());
  });

  for (const term of searchTerms) {
    if (!term) continue;
    emp = await Employee.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('lower', sequelize.col('id')), term),
          sequelize.where(sequelize.fn('lower', sequelize.col('emp_code')), term),
          sequelize.where(sequelize.fn('lower', sequelize.col('name')), term)
        ]
      }
    });
    if (emp) break;
  }
  return emp;
}

router.get('/', async (req, res) => {
  try {
    const { userId, date, page, limit, chunked } = req.query;
    const whereClause = {};
    if (date) {
      let altDate = date;
      if (date.includes('-')) {
        const parts = date.split('-');
        if (parts.length === 3) {
          altDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      whereClause.date = { [Op.or]: [date, altDate] };
    }

    // Fetch employee mapping for enrichment
    const employees = await Employee.findAll();
    const empMap = new Map();
    employees.forEach(emp => {
      if (emp.id) empMap.set(String(emp.id).toLowerCase(), emp);
      if (emp.empCode) empMap.set(String(emp.empCode).toLowerCase(), emp);
      if (emp.emp_code) empMap.set(String(emp.emp_code).toLowerCase(), emp);
      if (emp.name) empMap.set(String(emp.name).toLowerCase(), emp);
    });

    if (userId) {
      const rawUserStr = String(userId).trim();
      const emp = empMap.get(rawUserStr.toLowerCase());
      const rawIds = [rawUserStr];
      if (emp) {
        if (emp.id) rawIds.push(emp.id);
        if (emp.empCode) rawIds.push(emp.empCode);
        if (emp.emp_code) rawIds.push(emp.emp_code);
        if (emp.name) rawIds.push(emp.name);
      }
      const possibleIds = new Set();
      rawIds.forEach(id => {
        if (id) {
          possibleIds.add(String(id));
          possibleIds.add(String(id).toUpperCase());
          possibleIds.add(String(id).toLowerCase());
        }
      });
      const idArray = Array.from(possibleIds);
      whereClause[Op.or] = [
        { userId: { [Op.in]: idArray } },
        { userName: { [Op.in]: idArray } }
      ];
    }

    const enrichRecord = (rec) => {
      const plain = rec.toJSON ? rec.toJSON() : rec;
      const emp = empMap.get(String(plain.userId || '').toLowerCase()) || 
                  empMap.get(String(plain.userName || '').toLowerCase());
      if (emp) {
        plain.userId = emp.empCode || emp.emp_code || emp.id;
        plain.empCode = emp.empCode || emp.emp_code || emp.id;
        plain.userName = emp.name || plain.userName;
      } else {
        plain.empCode = plain.userId;
      }
      return plain;
    };

    if (chunked === 'true' || (page && !date)) {
      const p = Math.max(1, parseInt(page || 1, 10));
      const l = Math.min(500, Math.max(1, parseInt(limit || 20, 10)));
      const offset = (p - 1) * l;

      const { count, rows } = await Attendance.findAndCountAll({
        where: whereClause,
        limit: l,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        data: rows.map(enrichRecord),
        page: p,
        limit: l,
        totalRecords: count,
        totalPages: Math.ceil(count / l),
        hasMore: p * l < count
      });
    }

    const history = await Attendance.findAll({ 
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: limit ? parseInt(limit, 10) : undefined
    });
    return res.status(200).json(history.map(enrichRecord));
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, userName, date, checkIn, checkOut, workingHours, coords, workMode } = req.body;
    const rawUserId = userId || (req.user && req.user.id);
    const emp = await findEmployee(rawUserId, userName);
    const activeUserId = emp ? (emp.empCode || emp.emp_code || emp.id) : rawUserId;
    const activeUserName = emp ? emp.name : (userName || 'Employee');
    const possibleUserIds = emp ? [emp.id, emp.empCode, emp.emp_code, rawUserId].filter(Boolean) : [rawUserId].filter(Boolean);
    
    // Parse coordinates safely
    let parsedCoords = null;
    if (coords) {
      try {
        parsedCoords = typeof coords === 'string' ? JSON.parse(coords) : coords;
      } catch (e) {
        parsedCoords = coords;
      }
    }
    const latVal = parsedCoords ? (parsedCoords.lat != null ? parsedCoords.lat : parsedCoords.latitude) : null;
    const lonVal = parsedCoords ? (parsedCoords.lon != null ? parsedCoords.lon : (parsedCoords.lng != null ? parsedCoords.lng : parsedCoords.longitude)) : null;

    const todayDate = date || new Date().toISOString().split('T')[0];

    // Safeguard 0: Auto-close any dangling unclosed sessions from previous dates for this employee
    await Attendance.update(
      { checkOut: '19:00:00', workingHours: '08:00' },
      {
        where: {
          userId: { [Op.in]: possibleUserIds },
          date: { [Op.ne]: todayDate },
          checkOut: null
        }
      }
    ).catch(err => console.warn('[Auto-Close Past Sessions Warning]:', err.message));

    // Check if this is a clock-out update (since checkOut is provided)
    if (checkOut) {
      const activeRecord = await Attendance.findOne({
        where: {
          userId: { [Op.in]: possibleUserIds },
          checkOut: null
        },
        order: [['createdAt', 'DESC']]
      });

      if (activeRecord) {
        activeRecord.userId = activeUserId;
        activeRecord.userName = activeUserName;
        activeRecord.checkOut = checkOut;
        activeRecord.workingHours = workingHours;
        if (coords) activeRecord.coords = typeof coords === 'string' ? coords : JSON.stringify(coords);
        await activeRecord.save();

        if (latVal != null && lonVal != null) {
          getAddressFromCoords(parseFloat(latVal), parseFloat(lonVal)).then(async (addr) => {
            if (addr) {
              activeRecord.address = addr;
              await activeRecord.save();
            }
          }).catch(err => console.warn(err.message));
        }

        console.log(`[Attendance Clock-Out] Updated active session ${activeRecord.id} to clocked-out.`);
        return res.status(200).json(activeRecord);
      }
    }

    // Verify clock-in daily limit

    const dailyCount = await Attendance.count({
      where: {
        userId: { [Op.in]: possibleUserIds },
        date: todayDate
      }
    });

    if (dailyCount >= 3) {
      // Check for Admin Override Permission
      if (!emp || !emp.clockInBypassApproved) {
        return res.status(403).json({
          error: 'CLOCK_IN_LIMIT_EXCEEDED',
          message: 'You have reached the maximum daily limit of 3 clock-ins. Please contact your Admin for override permission.'
        });
      }
      
      // Override approved: Consume flag
      emp.clockInBypassApproved = false;
      await emp.save();
      console.log(`[Clock-In Override] Allowed clock-in for user ${activeUserId} via Admin override.`);
    }

    // Debounce Safeguard: Prevent rapid double-tap duplicate sessions within 15 seconds
    const existingActive = await Attendance.findOne({
      where: {
        userId: { [Op.in]: possibleUserIds },
        date: todayDate,
        checkOut: null
      },
      order: [['createdAt', 'DESC']]
    });

    if (existingActive && existingActive.createdAt) {
      const timeSinceCreated = Date.now() - new Date(existingActive.createdAt).getTime();
      if (timeSinceCreated < 15000) {
        console.log(`[Attendance Clock-In Debounce] Returned existing active session ${existingActive.id} created ${timeSinceCreated}ms ago.`);
        return res.status(200).json(existingActive);
      }
    }

    // Otherwise, create a new record (normal Clock In)
    const newRecord = await Attendance.create({ 
      userId: activeUserId, 
      userName: activeUserName, 
      date: date || todayDate, 
      checkIn, 
      checkOut: checkOut || null, 
      workingHours: workingHours || null, 
      coords: coords ? (typeof coords === 'string' ? coords : JSON.stringify(coords)) : null,
      workMode: workMode || 'office',
      isSwitched: false
    });

    if (latVal != null && lonVal != null) {
      // Create strict Pin #1 Clock-In GPS Start Anchor Footprint
      try {
        const Footprint = require('../../../../shared/models/Footprint');
        const clockInTs = checkIn ? new Date(checkIn).getTime() : Date.now();
        const targetDate = date || new Date(clockInTs).toISOString().split('T')[0];
        
        await Footprint.create({
          userId: String(activeUserId),
          latitude: parseFloat(latVal),
          longitude: parseFloat(lonVal),
          timestamp: !isNaN(clockInTs) ? clockInTs : Date.now(),
          date: targetDate,
          trackingMethod: 'GPS', // Strictly Hardware GPS for Pin #1
          accuracy: 10,
          reason: 'CLOCK_IN_START_ANCHOR',
          locationEnabled: true,
          isMockLocation: false
        });
        console.log(`[Clock-In GPS Anchor] Created strict Pin #1 GPS footprint anchor for user ${activeUserId}`);
      } catch (fpErr) {
        console.warn("[Clock-In GPS Anchor Error]:", fpErr.message);
      }

      getAddressFromCoords(parseFloat(latVal), parseFloat(lonVal)).then(async (addr) => {
        if (addr) {
          newRecord.address = addr;
          await newRecord.save();
          console.log(`[Attendance Geocode] Geocoded record ${newRecord.id} to: ${addr}`);
        }
      }).catch(err => {
        console.warn("[Attendance Geocode Error] Failed to resolve address:", err.message);
      });
    }

    return res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error creating/updating attendance:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /switch-mode : Switch active work mode mid-shift to field
router.post('/switch-mode', async (req, res) => {
  try {
    const userId = req.body.userId || (req.user && req.user.id);
    if (!userId) {
      return res.status(400).json({ error: 'User context or userId parameter required.' });
    }

    const activeSession = await Attendance.findOne({
      where: {
        userId,
        checkOut: null
      },
      order: [['createdAt', 'DESC']]
    });

    if (!activeSession) {
      return res.status(404).json({ error: 'No active clock-in session found to switch.' });
    }

    if (activeSession.workMode === 'field') {
      return res.status(400).json({ error: 'Session is already in Field Work mode.' });
    }

    activeSession.workMode = 'field';
    activeSession.isSwitched = true;
    await activeSession.save();

    console.log(`[Shift Switch] Switched active session ${activeSession.id} to Field mode for user ${userId}`);
    return res.status(200).json({ message: 'Switched to Field Work mode successfully.', session: activeSession });
  } catch (error) {
    console.error('Error switching work mode:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Heartbeat Recovery
router.post('/heartbeat', async (req, res) => {
  try {
    const userId = req.user.id;
    const HeartbeatMonitorService = require('../../../../shared/services/HeartbeatMonitorService');
    const session = await HeartbeatMonitorService.registerHeartbeat(userId, req.body);
    if (!session) {
      return res.status(404).json({ error: 'No active session found to register heartbeat.' });
    }
    return res.status(200).json({ message: 'Heartbeat registered successfully.', session });
  } catch (error) {
    console.error('Error handling heartbeat endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const HeartbeatMonitorService = require('../../../../shared/services/HeartbeatMonitorService');
    const report = await HeartbeatMonitorService.getAnalyticsReport();
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error compiling analytics:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const interrupted = await Attendance.findAll({
      where: {
        checkOut: null,
        trackingStatus: ['INTERRUPTED', 'MISSING', 'WARNING']
      }
    });
    return res.status(200).json({
      status: interrupted.length > 0 ? 'WARNING' : 'HEALTHY',
      interruptedSessionsCount: interrupted.length,
      sessions: interrupted
    });
  } catch (error) {
    console.error('Error checking tracking health:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/status/:sessionId', async (req, res) => {
  try {
    const session = await Attendance.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    return res.status(200).json({
      status: session.trackingStatus,
      lastHeartbeat: session.lastHeartbeat,
      missedCount: session.missedHeartbeatCount
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/recovery/:sessionId', async (req, res) => {
  try {
    const session = await Attendance.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    return res.status(200).json({
      recoveryTime: session.recoveryTime,
      interruptedDurationSeconds: session.trackingInterruptedDuration
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/notifications/:sessionId', async (req, res) => {
  try {
    const session = await Attendance.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    return res.status(200).json({
      notificationCount: session.notificationCount,
      lastNotificationTime: session.lastNotificationTime
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:sessionId', async (req, res) => {
  try {
    const session = await Attendance.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    return res.status(200).json(session);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    await Attendance.destroy({ where: {}, truncate: true });
    return res.status(200).json({ message: 'Attendance history cleared.' });
  } catch (error) {
    console.error('Error clearing attendance:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
