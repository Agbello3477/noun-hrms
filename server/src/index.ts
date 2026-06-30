
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth.routes';
import staffRoutes from './routes/staff.routes';
import { attendanceRouter, payrollRouter } from './routes/hr.routes';
import registryRoutes from './routes/registry.routes';
import workflowRoutes from './routes/workflow.routes';
import leaveRoutes from './routes/leave.routes';
import orgRoutes from './routes/org.routes';
import documentRoutes from './routes/document.routes';
import analyticsRoutes from './routes/analytics.routes';
import fileRequestRoutes from './routes/file-request.routes';
import queryRoutes from './routes/query.routes';
import academicRoutes from './routes/academic.routes';
import notificationRoutes from './routes/notification.routes';
import aperRoutes from './routes/aper.routes';
import memoRoutes from './routes/memo.routes';
import systemRoutes from './routes/system.routes';
import { authRateLimit, apiRateLimit } from './middleware/rate-limit.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-archive-code']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads (Local Mock)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes (Authenticated & Rate Limited)
app.use('/api/auth', authRateLimit, authRoutes);

// General API rate limit applied to all other endpoints
app.use('/api', apiRateLimit);

app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/registry', registryRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/file-requests', fileRequestRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/aper', aperRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/system', systemRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'NOUN HRMS API is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
