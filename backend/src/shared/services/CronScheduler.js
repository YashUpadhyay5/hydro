const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const HeartbeatMonitorService = require('./HeartbeatMonitorService');

class CronScheduler {
  static start() {
    console.log('[CronScheduler] Initializing zero-dependency cron scheduler...');
    
    let last9AMFiredDate = null;
    let last6PMFiredDate = null;

    setInterval(async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const HH = now.getHours();
        const MM = now.getMinutes();

        // 1. 9:00 AM Clock-In Reminder (Trigger within the first 5 minutes of the 9:00 AM hour)
        if (HH === 9 && MM >= 0 && MM < 5 && last9AMFiredDate !== todayStr) {
          last9AMFiredDate = todayStr;
          await this.trigger9AMReminders(todayStr);
        }

        // 2. 6:00 PM Clock-Out Alert (Trigger within the first 5 minutes of the 6:00 PM hour)
        if (HH === 18 && MM >= 0 && MM < 5 && last6PMFiredDate !== todayStr) {
          last6PMFiredDate = todayStr;
          await this.trigger6PMAlarms(todayStr);
        }

        // 3. Monthly Leave Auto-Increment (+1 allowed leaves on the 1st of every month)
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const dayOfMonth = now.getDate();
        if (dayOfMonth === 1) {
          const stateFilePath = path.join(__dirname, '..', '..', '..', 'storage', 'cron_state.json');
          let cronState = {};
          if (fs.existsSync(stateFilePath)) {
            try {
              cronState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
            } catch (e) {
              cronState = {};
            }
          }
          if (cronState.lastMonthlyLeaveIncrementMonth !== currentMonthStr) {
            cronState.lastMonthlyLeaveIncrementMonth = currentMonthStr;
            const storageDir = path.dirname(stateFilePath);
            if (!fs.existsSync(storageDir)) {
              fs.mkdirSync(storageDir, { recursive: true });
            }
            fs.writeFileSync(stateFilePath, JSON.stringify(cronState, null, 2), 'utf8');
            await this.incrementMonthlyLeaves();
          }
        }
      } catch (err) {
        console.error('[CronScheduler Error]:', err.message);
      }
    }, 300000); // Check every 5 minutes (300,000 ms)
  }

  static async trigger9AMReminders(dateStr) {
    console.log(`[CronScheduler] Triggering 9:00 AM clock-in verification for date: ${dateStr}...`);
    try {
      // Find all employees who have clocked in today
      const clockedInSessions = await Attendance.findAll({
        where: { date: dateStr },
        attributes: ['userId']
      });
      const clockedInUserIds = clockedInSessions.map(s => s.userId);

      // Find all active employees who haven't clocked in
      const missingEmployees = await Employee.findAll({
        where: {
          status: 'ACTIVE',
          role: 'EMPLOYEE',
          id: { [Op.notIn]: clockedInUserIds.length > 0 ? clockedInUserIds : [''] }
        }
      });

      console.log(`[CronScheduler] Found ${missingEmployees.length} employees missing clock-in for today.`);

      for (const emp of missingEmployees) {
        if (emp.fcmToken) {
          const success = await HeartbeatMonitorService.sendPush(
            emp.fcmToken,
            'Action Required',
            "You haven't clocked in yet. Please clock in now.",
            { action: 'open_attendance' }
          );
          if (success) {
            console.log(`[CronScheduler] Sent 9:00 AM clock-in reminder to user: ${emp.id}`);
          }
        }
      }
    } catch (err) {
      console.error('[CronScheduler] Failed running 9:00 AM job:', err.message);
    }
  }

  static async trigger6PMAlarms(dateStr) {
    console.log(`[CronScheduler] Triggering 6:00 PM clock-out alarm for date: ${dateStr}...`);
    try {
      // Find all active check-in sessions that are in 'office' mode
      // Strict rule: skip active field workers!
      const activeOfficeSessions = await Attendance.findAll({
        where: {
          checkOut: null,
          workMode: 'office'
        }
      });

      console.log(`[CronScheduler] Found ${activeOfficeSessions.length} active office sessions to notify.`);

      for (const session of activeOfficeSessions) {
        const emp = await Employee.findByPk(session.userId);
        if (emp && emp.fcmToken) {
          const success = await HeartbeatMonitorService.sendPush(
            emp.fcmToken,
            'Shift Ended',
            'Your working hours are complete. Please clock-out.',
            {
              triggerAlarm: true,
              sessionId: session.id,
              action: 'clock_out'
            }
          );
          if (success) {
            console.log(`[CronScheduler] Sent 6:00 PM clock-out alarm notification to user: ${emp.id}`);
          }
        }
      }
    } catch (err) {
      console.error('[CronScheduler] Failed running 6:00 PM job:', err.message);
    }
  }

  static async incrementMonthlyLeaves() {
    console.log('[CronScheduler] Triggering monthly leave auto-increment (+1 allowed leaves)...');
    try {
      // Safely increment allowedLeaves for all active employees by +1 using Sequelize built-in increment helper
      const affected = await Employee.increment('allowedLeaves', {
        by: 1,
        where: {
          status: 'ACTIVE',
          role: 'EMPLOYEE'
        }
      });
      console.log('[CronScheduler] Successfully auto-incremented allowed leaves for active employees.');
    } catch (err) {
      console.error('[CronScheduler] Failed running monthly leave increment job:', err.message);
    }
  }
}

module.exports = CronScheduler;
