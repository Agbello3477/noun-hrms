import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import { setupChatSocket } from './sockets/chat.socket';
import { authenticateDocSocket, setupDocSocket } from './sockets/doc.socket';

import cookieParser from 'cookie-parser';
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
import clinicRoutes from './routes/clinic.routes';
import securityRoutes from './routes/security.routes';
import voucherRoutes from './routes/voucher.routes';
import gearRoutes from './routes/gear.routes';
import researchRoutes from './routes/research.routes';
import { authRateLimit, apiRateLimit } from './middleware/rate-limit.middleware';
import { schedulePromotionCron } from './jobs/promotionCron';
import { scheduleRetirementCron } from './jobs/retirementCron';



const app = express();
app.set('trust proxy', 2); // Trust two proxies (Cloudflare -> Render LB) to ensure req.ip is the real user IP
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cookieParser());
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
app.use('/api/clinic', clinicRoutes);
app.use('/api/security/gear', gearRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/research', researchRoutes);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'NOUN-HRMS-API', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ message: 'NOUN HRMS API is running' });
});

// Create HTTP Server
const server = http.createServer(app);

// Setup Socket.io for Chat
const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true
    }
});
setupChatSocket(io);

// Setup WebSockets for Yjs Document Collaboration
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
    // Only intercept requests for the collaboration endpoints
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
    
    if (pathname === '/api/collaboration/doc') {
        // Authenticate via token in query string
        const isAuthenticated = await authenticateDocSocket(request);
        
        if (!isAuthenticated) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else if (!pathname.startsWith('/socket.io/')) {
        // Let other upgrade requests (if any) fall through or destroy
        socket.destroy();
    }
});

wss.on('connection', setupDocSocket);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Start background scheduled jobs
    schedulePromotionCron();
    scheduleRetirementCron();
});
