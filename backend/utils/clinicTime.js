const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Standard OPD shifts. Sessions may also use custom start and end times.
const SHIFT_PRESETS = {
  morning: { startTime: '09:00', endTime: '13:00' },
  afternoon: { startTime: '14:00', endTime: '17:00' },
  evening: { startTime: '17:00', endTime: '20:00' },
};

function timeToMinutes(value) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(minutes) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function atMinutes(day, minutes) {
  const date = new Date(day);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

module.exports = { SHIFT_PRESETS, TIME_PATTERN, atMinutes, minutesToTime, rangesOverlap, timeToMinutes };
