
import { Router } from 'express';
import { clockIn, clockOut, getAttendanceLogs } from '../controllers/attendance.controller';
import { runPayroll, getMyPayslips, getPayrollStats, approvePayrollRun, getPayrollRecords, exportIPPISData, getPendingPayroll } from '../controllers/payroll.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const attendanceRouter = Router();
const payrollRouter = Router();

// Attendance (Protected: All authenticated users)
attendanceRouter.use(verifyToken);
attendanceRouter.post('/clock-in', clockIn); // Any staff can clock in
attendanceRouter.post('/clock-out', clockOut);
attendanceRouter.get('/logs', getAttendanceLogs);

// Payroll (Mixed routes)
payrollRouter.use(verifyToken);
// Staff can view their own
payrollRouter.get('/me', getMyPayslips);

// Phase 3 Accounts Permissions
// Generate: Bursary Payroll Officer, Super User, Admin
const payrollGenRoles = [Role.BURSARY, Role.SUPER_USER, Role.ADMIN]; // Simplification for BURSARY_PAYROLL department users who have BURSARY role

payrollRouter.post('/run', requireRole(payrollGenRoles), runPayroll);
payrollRouter.post('/export-ippis', requireRole(payrollGenRoles), exportIPPISData);
payrollRouter.get('/stats', requireRole(payrollGenRoles), getPayrollStats);
payrollRouter.get('/records', requireRole(payrollGenRoles), getPayrollRecords);
const auditRoles = [Role.AUDIT, Role.SUPER_USER, Role.ADMIN];

payrollRouter.get('/pending', requireRole(auditRoles), getPendingPayroll);

// Audit Workflow
// Pending/Approve: Audit, Super User
payrollRouter.post('/approve', requireRole(auditRoles), approvePayrollRun);
// payrollRouter.post('/finalize', requireRole(auditRoles), finalizePayroll); // Removed for now

export { attendanceRouter, payrollRouter };
