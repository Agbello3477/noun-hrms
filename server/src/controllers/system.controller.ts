import { Request, Response } from 'express';
import prisma from '../prisma';
import fs from 'fs';
import path from 'path';

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const action = req.query.action as string;
        const resource = req.query.resource as string;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (action) {
            where.action = action;
        }

        if (resource) {
            where.resource = resource;
        }

        if (search) {
            where.OR = [
                {
                    details: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    action: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    resource: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    user: {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                },
                {
                    user: {
                        email: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                }
            ];
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit
            }),
            prisma.auditLog.count({ where })
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching system audit logs:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const SETTINGS_FILE = path.join(__dirname, '../../system_settings.json');

const DEFAULT_SETTINGS = {
    institutionName: "National Open University of Nigeria",
    institutionShortName: "NOUN",
    academicSession: "2025/2026",
    semester: "1ST_SEMESTER",
    contactEmail: "registry@noun.edu.ng",
    promotionEligibilityYears: 3,
    minAperScore: 60,
    autoPromoCronEnabled: true,
    clinicConsultationFee: 0,
    dailyPatientLimit: 40,
    clinicEmergencyPhone: "+234 803 123 4567",
    securityControlRoomPhone: "+234 803 765 4321",
    rosterAutoExpireDays: 7,
    systemMode: "LIVE",
    mockEmailMode: true
};

const readSettings = () => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error("Error reading system settings file:", e);
    }
    return DEFAULT_SETTINGS;
};

const writeSettings = (settings: any) => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
        console.error("Error writing system settings file:", e);
    }
};

export const getSystemSettings = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        // Enforce RBAC guard
        const allowedRoles = ['SUPER_USER', 'HR_ADMIN', 'VICE_CHANCELLOR', 'ADMIN'];
        if (!user || !allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden: Insufficient privileges." });
        }

        const settings = readSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error in getSystemSettings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        // Enforce RBAC guard (only Super User, HR Admin, Admin can write settings)
        const allowedRoles = ['SUPER_USER', 'HR_ADMIN', 'ADMIN'];
        if (!user || !allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden: Insufficient privileges." });
        }

        const currentSettings = readSettings();
        const newSettings = { ...currentSettings, ...req.body };

        // Simple validation rules
        if (newSettings.promotionEligibilityYears < 1 || newSettings.promotionEligibilityYears > 10) {
            return res.status(400).json({ message: "Promotion eligibility years must be between 1 and 10." });
        }
        if (newSettings.minAperScore < 0 || newSettings.minAperScore > 100) {
            return res.status(400).json({ message: "Minimum APER score must be between 0 and 100." });
        }

        writeSettings(newSettings);

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'UPDATE_SYSTEM_SETTINGS',
                resource: 'SYSTEM',
                details: JSON.stringify({
                    changedFields: Object.keys(req.body),
                    ipAddress: req.ip
                })
            }
        });

        res.json({ message: "System settings updated successfully.", settings: newSettings });
    } catch (error) {
        console.error('Error in updateSystemSettings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const exportSystemAuditReport = async (req: Request, res: Response) => {
    try {
        // 1. Gather User details for access audits
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        // 2. Count Audit log events
        const totalLogs = await prisma.auditLog.count();
        const manualOverridesCount = await prisma.auditLog.count({
            where: { action: 'MANUAL_OVERRIDE' }
        });

        // 3. Count registered push token devices
        const totalPushDevices = await prisma.fcmToken.count();

        // 4. Build CSV data rows
        let csvContent = '';
        csvContent += '--- SYSTEM SECURITY ACCESS & DATA PROTECTION METRICS REPORT ---\n';
        csvContent += `Report Generated At,${new Date().toISOString()}\n`;
        csvContent += `Total System Users,${users.length}\n`;
        csvContent += `Total System Audit Log entries,${totalLogs}\n`;
        csvContent += `Total Manual Overrides Recorded,${manualOverridesCount}\n`;
        csvContent += `Total Active Push Devices (FCM),${totalPushDevices}\n\n`;

        csvContent += '--- USER LIST AND SYSTEM SECURITY ACCESS ---\n';
        csvContent += 'User ID,Email,Role,Is Active,Created At\n';
        for (const u of users) {
            csvContent += `"${u.id}","${u.email}","${u.role}",${u.isActive},"${u.createdAt.toISOString()}"\n`;
        }

        csvContent += '\n--- SYSTEM LOG FORENSICS SUMMARY ---\n';
        const overrideLogs = await prisma.auditLog.findMany({
            where: { action: 'MANUAL_OVERRIDE' },
            take: 100,
            include: { user: { select: { email: true } } }
        });
        csvContent += 'Audit ID,Admin Email,Action,Resource,Timestamp,Override Details\n';
        for (const l of overrideLogs) {
            csvContent += `"${l.id}","${l.user.email}","${l.action}","${l.resource}","${l.createdAt.toISOString()}","${(l.details || '').replace(/"/g, '""')}"\n`;
        }

        // Set response headers to force CSV download file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=noun_hrms_compliance_report.csv');
        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error exporting system audit report:', error);
        res.status(500).json({ message: 'Error compiling and exporting compliance audit spreadsheet' });
    }
};
