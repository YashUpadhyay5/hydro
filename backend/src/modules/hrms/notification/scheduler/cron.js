const cron = require('node-cron');
const NotificationService = require('../services/NotificationService');
const { Notification } = require('../../../../shared/models');
const { Op } = require('sequelize');

class NotificationScheduler {
  start() {
    // Clock-in Reminder - 9:00 AM everyday
    cron.schedule('0 9 * * *', async () => {
      console.log('Running scheduled task: Clock-in Reminder');
      await NotificationService.sendToAll(
        'Clock-in Reminder',
        'Please remember to clock in for your shift today.',
        { type: 'CLOCK_IN_REMINDER' }
      );
    });

    // Clock-out Reminder - 6:00 PM everyday
    cron.schedule('0 18 * * *', async () => {
      console.log('Running scheduled task: Clock-out Reminder');
      await NotificationService.sendToAll(
        'Clock-out Reminder',
        'Please remember to clock out before you leave.',
        { type: 'CLOCK_OUT_REMINDER' }
      );
    });

    // Process generic pending scheduled notifications every minute
    cron.schedule('* * * * *', async () => {
      try {
        const pendingNotifications = await Notification.findAll({
          where: {
            status: 'PENDING',
            scheduleAt: {
              [Op.lte]: new Date()
            }
          }
        });

        for (const notification of pendingNotifications) {
          let payload = {};
          try { payload = JSON.parse(notification.payload); } catch (e) {}

          if (notification.target === 'EMPLOYEE') {
            await NotificationService.sendToEmployee(notification.targetId, notification.title, notification.body, payload, notification.createdBy);
          } else if (notification.target === 'DEPARTMENT') {
            await NotificationService.sendToDepartment(notification.targetId, notification.title, notification.body, payload, notification.createdBy);
          } else if (notification.target === 'EMPLOYEES') {
            await NotificationService.sendToAll(notification.title, notification.body, payload, notification.createdBy);
          }
          
          notification.status = 'PROCESSED';
          await notification.save();
        }
      } catch (error) {
        console.error('Error processing scheduled notifications:', error);
      }
    });

    console.log('Notification cron scheduler started');
  }
}

module.exports = new NotificationScheduler();
