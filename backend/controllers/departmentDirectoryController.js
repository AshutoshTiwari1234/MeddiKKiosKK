const ClinicSession = require('../models/ClinicSession');
const User = require('../models/User');
const { serializeSession } = require('./clinicSessionController');
const { resolveDayRange } = require('../utils/dateRange');
const AppError = require('../utils/AppError');

function addDepartmentDoctor(departments, department, doctor) {
  const doctorId = String(doctor._id);
  if (!departments.has(department)) departments.set(department, new Map());
  const roster = departments.get(department);
  if (!roster.has(doctorId)) {
    roster.set(doctorId, { doctorId, name: doctor.name, available: false, sessions: [] });
  }
  return roster.get(doctorId);
}

async function getDepartmentDirectory(request, response) {
  const { date } = request.query;
  if (date === '') throw new AppError('Use YYYY-MM-DD for date.', 400);
  const day = resolveDayRange({ from: date, to: date }, { maxDays: 1 });

  const doctors = await User.find({ role: 'doctor', active: true, approvalStatus: 'approved' })
    .select('name department').lean();
  const doctorsById = new Map(doctors.map((doctor) => [String(doctor._id), doctor]));
  const sessions = await ClinicSession.find({
    doctor: { $in: doctors.map((doctor) => doctor._id) },
    date: { $gte: day.start, $lt: day.end },
    status: { $ne: 'cancelled' },
  }).select('doctor department date shift startMinute endMinute cabin status')
    .sort({ startMinute: 1, cabinKey: 1, _id: 1 }).lean();

  const departments = new Map();
  for (const doctor of doctors) {
    if (doctor.department) addDepartmentDoctor(departments, doctor.department, doctor);
  }

  for (const session of sessions) {
    const doctor = doctorsById.get(String(session.doctor));
    const entry = addDepartmentDoctor(departments, session.department, doctor);
    const { _id, shift, startTime, endTime, cabin, status } = serializeSession(session);
    entry.sessions.push({ _id, shift, startTime, endTime, cabin, status });
    entry.available ||= status === 'scheduled' || status === 'active';
  }

  const directory = [...departments]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([department, roster]) => ({
      department,
      doctors: [...roster.values()].sort((first, second) =>
        first.name.localeCompare(second.name) || first.doctorId.localeCompare(second.doctorId)),
    }));

  response.json({ date: day.from, departments: directory });
}

module.exports = { getDepartmentDirectory };
