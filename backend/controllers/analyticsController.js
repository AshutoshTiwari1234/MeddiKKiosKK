const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditService');
const { resolveDayRange } = require('../utils/dateRange');

const MINUTE_MS = 60 * 1000;
const STATUSES = ['waiting', 'called', 'in_consultation', 'done'];

function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Waiting time = check-in (createdAt) until the patient is first called to a cabin.
const waitMinutesExpr = {
  $cond: [
    { $and: [{ $ne: [{ $ifNull: ['$calledAt', null] }, null] }, { $gte: ['$calledAt', '$createdAt'] }] },
    { $divide: [{ $subtract: ['$calledAt', '$createdAt'] }, MINUTE_MS] },
    null,
  ],
};

const consultMinutesExpr = {
  $cond: [
    {
      $and: [
        { $ne: [{ $ifNull: ['$consultationStartedAt', null] }, null] },
        { $ne: [{ $ifNull: ['$consultationEndedAt', null] }, null] },
        { $gte: ['$consultationEndedAt', '$consultationStartedAt'] },
      ],
    },
    { $divide: [{ $subtract: ['$consultationEndedAt', '$consultationStartedAt'] }, MINUTE_MS] },
    null,
  ],
};

function statusCounters() {
  return Object.fromEntries(STATUSES.map((status) => [status, { $sum: { $cond: [{ $eq: ['$callStatus', status] }, 1, 0] } }]));
}

function formatStatus(row) {
  return Object.fromEntries(STATUSES.map((status) => [status, row?.[status] || 0]));
}

function parseDepartment(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 100) throw new AppError('The department filter must be a short text value.', 400);
  return value.trim();
}

async function getOpdAnalytics(request, response) {
  const department = parseDepartment(request.query.department);
  const range = resolveDayRange(request.query, { maxDays: 366 });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const match = { createdAt: { $gte: range.start, $lt: range.end } };
  if (department) match.department = department;

  const [result] = await Patient.aggregate([
    { $match: match },
    { $project: { department: 1, callStatus: 1, caseStatus: 1, 'clinicalReview.status': 1, createdAt: 1, waitMinutes: waitMinutesExpr, consultMinutes: consultMinutesExpr } },
    {
      $facet: {
        overview: [{
          $group: {
            _id: null,
            totalPatients: { $sum: 1 },
            patientsCalled: { $sum: { $cond: [{ $ne: ['$waitMinutes', null] }, 1, 0] } },
            averageWaitMinutes: { $avg: '$waitMinutes' },
            maxWaitMinutes: { $max: '$waitMinutes' },
            averageConsultationMinutes: { $avg: '$consultMinutes' },
            casesCompleted: { $sum: { $cond: [{ $eq: ['$caseStatus', 'completed'] }, 1, 0] } },
            reviewsApproved: { $sum: { $cond: [{ $eq: ['$clinicalReview.status', 'approved'] }, 1, 0] } },
            ...statusCounters(),
          },
        }],
        departments: [
          {
            $group: {
              _id: { $ifNull: ['$department', 'General Medicine'] },
              totalPatients: { $sum: 1 },
              averageWaitMinutes: { $avg: '$waitMinutes' },
              averageConsultationMinutes: { $avg: '$consultMinutes' },
              ...statusCounters(),
            },
          },
          { $sort: { totalPatients: -1, _id: 1 } },
        ],
        hourly: [
          { $group: { _id: { $hour: { date: '$createdAt', timezone } }, patients: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        daily: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } },
              patients: { $sum: 1 },
              averageWaitMinutes: { $avg: '$waitMinutes' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const overview = result.overview[0] || {};
  const total = overview.totalPatients || 0;
  const peak = result.hourly.reduce((best, row) => (!best || row.patients > best.patients ? row : best), null);

  await recordAudit(request, { action: 'analytics.opd.view', resourceType: 'analytics' });
  response.json({
    range: { from: range.from, to: range.to, days: range.days, timezone },
    filters: { department },
    overview: {
      totalPatients: total,
      patientsCalled: overview.patientsCalled || 0,
      averageWaitMinutes: round(overview.averageWaitMinutes),
      maxWaitMinutes: round(overview.maxWaitMinutes),
      averageConsultationMinutes: round(overview.averageConsultationMinutes),
      casesCompleted: overview.casesCompleted || 0,
      reviewsApproved: overview.reviewsApproved || 0,
      byStatus: formatStatus(overview),
      peakHour: peak ? { hour: peak._id, patients: peak.patients } : null,
    },
    departments: result.departments.map((row) => ({
      department: row._id,
      totalPatients: row.totalPatients,
      sharePercent: total ? round((row.totalPatients / total) * 100) : 0,
      averageWaitMinutes: round(row.averageWaitMinutes),
      averageConsultationMinutes: round(row.averageConsultationMinutes),
      byStatus: formatStatus(row),
    })),
    hourly: result.hourly.map((row) => ({ hour: row._id, patients: row.patients })),
    daily: result.daily.map((row) => ({ date: row._id, patients: row.patients, averageWaitMinutes: round(row.averageWaitMinutes) })),
  });
}

module.exports = { getOpdAnalytics };
