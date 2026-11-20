const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('./config/loadEnv');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const userRoutes = require('./routes/userRoutes');
const alertRoutes = require('./routes/alertRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const clinicSessionRoutes = require('./routes/clinicSessionRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const departmentDirectoryRoutes = require('./routes/departmentDirectoryRoutes');
const { connectDatabase } = require('./config/database');
const AppError = require('./utils/AppError');
const { jwtSecret } = require('./utils/auth');

const app = express();
const port = Number(process.env.PORT) || 5000;

app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new AppError('This origin is not allowed to access the API.', 403));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
morgan.token('safe-path', (request) => new URL(request.originalUrl, 'http://localhost').pathname
  .replace(/^\/api\/patients\/[^/]+\/documents\/[^/]+/, '/api/patients/:record/documents/:document')
  .replace(/^\/api\/patients\/[^/]+/, '/api/patients/:record')
  .replace(/^\/api\/users\/[^/]+/, '/api/users/:user')
  .replace(/^\/api\/sessions\/(?!cabins$)[^/]+/, '/api/sessions/:session')
  .replace(/^\/api\/appointments\/(?!availability$)[^/]+/, '/api/appointments/:appointment'));
app.use(morgan(':method :safe-path :status :response-time ms'));

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'MediKiosk API',
    message: 'The API is running. Use the health endpoint to check service status.',
    health: '/api/health',
  });
});

app.get('/api/health', (_request, response) => {
  const connected = mongoose.connection.readyState === 1;
  response.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    service: 'medikiosk-api',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sessions', clinicSessionRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/departments', departmentDirectoryRoutes);

app.use('/api', (_request, response) => {
  response.status(404).json({ error: { message: 'API route not found.' } });
});

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode || (error.code === 'LIMIT_FILE_SIZE' ? 413 : error.name === 'MulterError' || error.type === 'entity.parse.failed' ? 400 : 500);
  if (statusCode >= 500) console.error(error);
  response.status(statusCode).json({
    error: { message: statusCode >= 500 ? 'An unexpected server error occurred.' : error.message },
  });
});

if (require.main === module) {
  try {
    jwtSecret();
    connectDatabase();
    app.listen(port, () => console.log(`MediKiosk API listening on http://localhost:${port}`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = app;
