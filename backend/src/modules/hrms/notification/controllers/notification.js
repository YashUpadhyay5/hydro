const { v4: uuidv4 } = require('uuid');
const NotificationService = require('../services/NotificationService');
const { DeviceToken, Notification, NotificationLog, Employee } = require('../../../../shared/models');
const { Op } = require('sequelize');

exports.registerDevice = async (req, res) => {
  try {
    const { token, deviceType, platform } = req.body;
    const employeeId = req.user?.id || req.body.employeeId;

    if (!token || !employeeId) {
      return res.status(400).json({ success: false, message: 'Token and employeeId are required' });
    }

    let deviceToken = await DeviceToken.findOne({ where: { token } });
    if (deviceToken) {
      deviceToken.employeeId = employeeId;
      deviceToken.lastActive = new Date();
      await deviceToken.save();
    } else {
      await DeviceToken.create({
        id: uuidv4(),
        employeeId,
        token,
        deviceType,
        platform,
        lastActive: new Date()
      });
    }

    // Sync to Employee.fcmToken
    const employee = await Employee.findByPk(employeeId);
    if (employee) {
      employee.fcmToken = token;
      await employee.save();
    }

    res.json({ success: true, message: 'Device registered successfully' });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const { employeeId, title, body, payload } = req.body;
    const createdBy = req.user?.id || 'ADMIN';
    const result = await NotificationService.sendToEmployee(employeeId, title, body, payload, createdBy);
    res.json(result);
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.sendAll = async (req, res) => {
  try {
    const { title, body, payload } = req.body;
    const createdBy = req.user?.id || 'ADMIN';
    const result = await NotificationService.sendToAll(title, body, payload, createdBy);
    res.json(result);
  } catch (error) {
    console.error('Error sending to all:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.testNotification = async (req, res) => {
  try {
    const { token, title, body } = req.body;
    const result = await NotificationService.sendPushNotification([token], title || 'Test Title', body || 'Test Body', { type: 'TEST' });
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error in test notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.scheduleNotification = async (req, res) => {
  try {
    const { target, targetId, title, body, scheduleAt, payload } = req.body;
    const createdBy = req.user?.id || 'ADMIN';
    const result = await NotificationService.scheduleNotification(target, targetId, title, body, scheduleAt, payload, createdBy);
    res.json(result);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const notifications = await Notification.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [{ model: NotificationLog, as: 'logs' }]
    });

    const formattedRows = notifications.rows.map(n => {
      const logs = n.logs || [];
      let payloadObj = {};
      try { payloadObj = JSON.parse(n.payload || '{}'); } catch(e) {}

      const successLogs = logs.filter(l => l.status === 'SENT');
      const failureLogs = logs.filter(l => l.status === 'FAILED');
      const totalRecipients = logs.length > 0 ? logs.length : 1;
      
      const isSent = n.status === 'SENT' || successLogs.length > 0;

      return {
        ...n.toJSON(),
        status: isSent ? 'SENT' : n.status,
        channel: payloadObj.channel || 'Attendance Push',
        recipientCount: totalRecipients,
        successCount: isSent ? (successLogs.length > 0 ? successLogs.length : totalRecipients) : 0,
        failureCount: isSent ? 0 : (failureLogs.length > 0 ? failureLogs.length : totalRecipients),
        sentTime: n.updatedAt || n.createdAt
      };
    });

    res.json({ success: true, data: formattedRows, total: notifications.count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const { notificationId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = notificationId ? { notificationId } : {};
    
    const logs = await NotificationLog.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({ success: true, data: logs.rows, total: logs.count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const totalNotifications = await Notification.count();
    const sentNotifications = await Notification.count({ where: { status: 'SENT' } });
    const failedNotifications = await Notification.count({ where: { status: 'FAILED' } });
    const pendingNotifications = await Notification.count({ where: { status: 'PENDING' } });
    
    const totalDevices = await DeviceToken.count();
    
    res.json({
      success: true,
      data: {
        totalNotifications,
        sentNotifications,
        failedNotifications,
        pendingNotifications,
        totalDevices
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;
    if (!userId) return res.json({ success: true, data: [] });

    const emp = await Employee.findOne({
      where: {
        [Op.or]: [
          { id: userId },
          { empCode: userId }
        ]
      }
    });

    const possibleIds = [String(userId)];
    if (emp) {
      if (emp.id) possibleIds.push(String(emp.id));
      if (emp.empCode) possibleIds.push(String(emp.empCode));
    }

    const notifs = await Notification.findAll({
      where: {
        [Op.or]: [
          { target: 'ALL' },
          { targetId: { [Op.in]: possibleIds } },
          { target: 'EMPLOYEE', targetId: { [Op.in]: possibleIds } }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    return res.json({ success: true, data: notifs });
  } catch (error) {
    console.error('Error in getMyNotifications:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

