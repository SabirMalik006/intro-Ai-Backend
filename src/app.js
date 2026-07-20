import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { configurePassport } from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import jobRoutes from './routes/job.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import aiRoutes from './routes/ai.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import teamRoutes from './routes/team.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import messageRoutes from './routes/message.routes.js';

const app = express();

// ─── SECURITY MIDDLEWARES ───

// 1. HTTP Security Headers
app.use(helmet());

// 2. CORS
const getCorsWhitelist = () => [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.BACKEND_URL || 'http://localhost:5000',
  'https://www.smarthire.site',
];
app.use(cors({
  origin: (origin, callback) => {
    const whitelist = getCorsWhitelist();
    if (!origin || whitelist.some(w => origin.startsWith(w))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 3. Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});
app.use(globalLimiter);

// 4. NoSQL Injection Protection (custom, Express 5 compatible)
const sanitizeValue = (val) => {
  if (typeof val === 'string') {
    return val.replace(/^\$/, '\\$').replace(/\./g, '\\.');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(val)) {
      const cleanKey = key.replace(/^\$/, '\\$').replace(/\./g, '\\.');
      sanitized[cleanKey] = sanitizeValue(value);
    }
    return sanitized;
  }
  return val;
};
app.use((req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.params) {
    for (const key of Object.keys(req.params)) {
      req.params[key] = sanitizeValue(req.params[key]);
    }
  }
  next();
});

// 5. HTTP Parameter Pollution Protection
app.use(hpp({
  whitelist: [
    'jobType', 'experienceLevel', 'location', 'skills',
    'status', 'role', 'sort', 'page', 'limit',
  ],
}));

// 6. Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// 7. Auth route rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// 8. AI route rate limiter
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait before sending another request.',
  },
});
app.use('/api/v1/ai', aiLimiter);

// 9. Resume upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many upload attempts. Please try again after 15 minutes.',
  },
});
app.use('/api/v1/resume', uploadLimiter);

// ─── SESSION & PASSPORT ───
app.use(session({
  secret: process.env.SESSION_SECRET || 'smarthire_session_secret',
  resave: false,
  saveUninitialized: false,
  name: 'smarthire.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// ─── HEALTH CHECK ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SmartHire API running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── ROUTES ───
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/resume', resumeRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/messages', messageRoutes);

// ─── 404 HANDLER ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// ─── GLOBAL ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // Multer Error
  if (err.name === 'MulterError') {
    console.error('📦 Multer Error:', err.code, err.field);
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
      code: `UPLOAD_${err.code}`
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `An account with this ${field} already exists`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: errors.join('. '),
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;