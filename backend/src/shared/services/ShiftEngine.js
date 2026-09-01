function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const clean = timeStr.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (clean.toLowerCase().includes('pm') && hours < 12) hours += 12;
  if (clean.toLowerCase().includes('am') && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function calculateShiftMetrics(checkInStr, checkOutStr, rules = {}) {
  const defaults = {
    shiftStart: '08:30',
    shiftEnd: '18:00',
    graceMinutes: 15,
    halfDayMinutes: 240,
    fullDayMinutes: 480,
    minWorkingMinutes: 240,
    maxWorkingMinutes: 720,
    overtimeThresholdMinutes: 480,
    allowCrossDay: true
  };

  const config = { ...defaults, ...rules };

  if (!checkInStr) {
    return {
      status: 'ABSENT',
      workingMinutes: 0,
      workingHoursFormatted: '00:00',
      isLate: false,
      isEarlyLeave: false,
      isHalfDay: false,
      isOvertime: false,
      overtimeMinutes: 0,
      lateMinutes: 0
    };
  }

  const checkInMin = parseTimeToMinutes(checkInStr);
  const shiftStartMin = parseTimeToMinutes(config.shiftStart);
  const shiftEndMin = parseTimeToMinutes(config.shiftEnd);

  const lateMinutes = Math.max(0, checkInMin - (shiftStartMin + config.graceMinutes));
  const isLate = checkInMin > (shiftStartMin + config.graceMinutes);

  if (!checkOutStr) {
    return {
      status: 'MISSING_PUNCH_OUT',
      workingMinutes: 0,
      workingHoursFormatted: 'In Progress',
      isLate,
      lateMinutes,
      isEarlyLeave: false,
      isHalfDay: false,
      isOvertime: false,
      overtimeMinutes: 0
    };
  }

  let checkOutMin = parseTimeToMinutes(checkOutStr);
  if (config.allowCrossDay && checkOutMin < checkInMin) {
    checkOutMin += 24 * 60; // Add 1440 minutes for cross-day / night shift completion
  }

  let rawWorkingMinutes = Math.max(0, checkOutMin - checkInMin);
  const workingMinutes = Math.min(rawWorkingMinutes, config.maxWorkingMinutes);

  let effectiveShiftEnd = shiftEndMin;
  if (config.allowCrossDay && shiftEndMin < shiftStartMin) {
    effectiveShiftEnd += 24 * 60;
  }

  const isEarlyLeave = checkOutMin < (effectiveShiftEnd - config.graceMinutes);
  const isHalfDay = workingMinutes >= config.halfDayMinutes && workingMinutes < config.fullDayMinutes;
  const isOvertime = workingMinutes > config.overtimeThresholdMinutes;
  const overtimeMinutes = isOvertime ? workingMinutes - config.overtimeThresholdMinutes : 0;

  let status = 'PRESENT';
  if (workingMinutes < config.minWorkingMinutes) {
    status = 'INVALID_MIN_HOURS';
  } else if (isHalfDay) {
    status = 'HALF_DAY';
  }

  const hours = Math.floor(workingMinutes / 60);
  const mins = workingMinutes % 60;
  const workingHoursFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  return {
    status,
    workingMinutes,
    workingHoursFormatted,
    isLate,
    lateMinutes,
    isEarlyLeave,
    isHalfDay,
    isOvertime,
    overtimeMinutes,
    shiftStart: config.shiftStart,
    shiftEnd: config.shiftEnd
  };
}

module.exports = {
  parseTimeToMinutes,
  calculateShiftMetrics
};
