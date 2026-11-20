const AppError = require('./AppError');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Parses a YYYY-MM-DD string as a local calendar day, matching how the
// rest of the API computes "today" with setHours(0, 0, 0, 0).
function parseLocalDate(value, label = 'date') {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new AppError(`Use YYYY-MM-DD for ${label}.`, 400);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new AppError(`${label} is not a valid calendar date.`, 400);
  }
  return date;
}

function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatLocalDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Returns a half-open [start, end) range covering whole local days.
// Defaults to today when neither bound is given.
function resolveDayRange({ from, to } = {}, { maxDays = 366 } = {}) {
  const start = from ? parseLocalDate(from, 'from') : startOfDay();
  const lastDay = to ? parseLocalDate(to, 'to') : start;
  if (lastDay < start) throw new AppError('The "to" date must be on or after the "from" date.', 400);
  const end = addDays(lastDay, 1);
  const days = Math.round((end - start) / DAY_MS);
  if (days > maxDays) throw new AppError(`Date range cannot exceed ${maxDays} days.`, 400);
  return { start, end, days, from: formatLocalDate(start), to: formatLocalDate(lastDay) };
}

module.exports = { addDays, formatLocalDate, parseLocalDate, resolveDayRange, startOfDay };
