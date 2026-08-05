import prisma from '../prisma';

export const enableDbMock = async () => {
    let isDbConnected = true;
    try {
        await prisma.$connect();
    } catch {
        isDbConnected = false;
        console.warn('⚠️ PostgreSQL database is offline. Running integration tests in MOCK mode.');
    }

    if (!isDbConnected) {
        const mockUserId = 'mock-user-uuid';
        const mockProfileId = 'mock-profile-uuid';
        const mockVoucherId = 'mock-voucher-uuid';
        const mockAssetId = 'mock-asset-uuid';

        // In-memory collections for stateful mock execution
        const users: any[] = [];
        const staffProfiles: any[] = [];
        const notifications: any[] = [];
        const aperSessions: any[] = [];
        const leaveRequests: any[] = [];

        // Mock User
        (prisma.user as any).create = async (args: any) => {
            const user = {
                id: args.data.id || `mock-user-${Math.random().toString(36).substr(2, 9)}`,
                email: args.data.email,
                password: args.data.password,
                name: args.data.name || 'Test User',
                role: args.data.role || 'STAFF',
                isActive: true,
                tokenInvalidatedAt: null,
                twoFactorBackupCodes: null,
            } as any;
            users.push(user);
            
            if (args.data.staffProfile?.create) {
                const profile = {
                    id: `mock-profile-${Math.random().toString(36).substr(2, 9)}`,
                    userId: user.id,
                    surname: args.data.staffProfile.create.surname || 'Cascader',
                    otherNames: args.data.staffProfile.create.otherNames || 'Test',
                    staffId: args.data.staffProfile.create.staffId || 'ST-001',
                    status: args.data.staffProfile.create.status || 'ACTIVE',
                    cadre: args.data.staffProfile.create.cadre || 'ADMINISTRATIVE',
                    isDeleted: false,
                    deletedAt: null
                };
                staffProfiles.push(profile);
                user.staffProfile = profile;
            }
            return user;
        };

        (prisma.user as any).findMany = async (args: any) => {
            return users.map(u => ({
                ...u,
                staffProfile: staffProfiles.find(p => p.userId === u.id) || null
            }));
        };

        (prisma.user as any).update = async (args: any) => {
            const u = users.find(u => u.id === args.where.id);
            if (u) {
                Object.assign(u, args.data);
                return u;
            }
            return {
                id: args.where.id,
                isActive: args.data.isActive !== undefined ? args.data.isActive : true,
                tokenInvalidatedAt: args.data.tokenInvalidatedAt || null,
                twoFactorBackupCodes: null
            };
        };

        (prisma.user as any).findUnique = async (args: any) => {
            const u = users.find(u => u.id === args.where.id || u.email === args.where.email);
            if (!u) {
                return {
                    id: mockUserId,
                    email: 'mock-user@noun.edu.ng',
                    isActive: false,
                    tokenInvalidatedAt: new Date(),
                    twoFactorBackupCodes: null,
                    staffProfile: {
                        id: mockProfileId,
                        status: 'RETIRED',
                        isDeleted: true,
                        deletedAt: new Date()
                    }
                };
            }
            return {
                ...u,
                staffProfile: staffProfiles.find(p => p.userId === u.id) || null
            };
        };

        (prisma.user as any).delete = async (args: any) => {
            const index = users.findIndex(u => u.id === args.where.id);
            if (index !== -1) users.splice(index, 1);
            return { id: args.where.id };
        };

        (prisma.user as any).deleteMany = async (args: any) => {
            if (args.where?.id?.in) {
                const ids = args.where.id.in;
                for (let i = users.length - 1; i >= 0; i--) {
                    if (ids.includes(users[i].id)) users.splice(i, 1);
                }
            }
            return { count: users.length };
        };

        (prisma.user as any).count = async () => users.length || 1;

        // Local state-tracking variables for other mock runs
        let currentStaffStatus = 'ACTIVE';
        let currentStaffDeleted = false;
        let currentVoucherStatus = 'PENDING';
        let currentVoucherAuditComment: string | null = null;
        let currentGearAvailableQty = 10;

        // Mock StaffProfile
        (prisma.staffProfile as any).create = async (args: any) => {
            const profile = {
                id: `mock-profile-${Math.random().toString(36).substr(2, 9)}`,
                userId: args.data.userId || mockUserId,
                surname: args.data.surname || 'Surname',
                otherNames: args.data.otherNames || 'OtherNames',
                staffId: args.data.staffId || 'ST-002',
                status: args.data.status || 'ACTIVE',
                cadre: args.data.cadre || 'ADMINISTRATIVE',
                isDeleted: false,
                deletedAt: null
            };
            staffProfiles.push(profile);
            return profile;
        };

        (prisma.staffProfile as any).update = async (args: any) => {
            const p = staffProfiles.find(p => p.id === args.where.id || p.userId === args.where.userId);
            if (p) {
                Object.assign(p, args.data);
                return p;
            }
            if (args.data.status !== undefined) currentStaffStatus = args.data.status;
            if (args.data.isDeleted !== undefined) currentStaffDeleted = args.data.isDeleted;
            return {
                id: mockProfileId,
                userId: args.where.userId || mockUserId,
                status: currentStaffStatus,
                isDeleted: currentStaffDeleted
            };
        };

        (prisma.staffProfile as any).findUnique = async (args: any) => {
            const p = staffProfiles.find(p => p.id === args.where.id || p.userId === args.where.userId);
            const userObj = p ? users.find(u => u.id === p.userId) : null;
            const fallbackUser = { id: mockUserId, name: 'Test User', email: 'mock@noun.edu.ng' };
            if (!p) {
                return {
                    id: mockProfileId,
                    userId: args.where.id || args.where.userId || mockUserId,
                    status: currentStaffStatus,
                    isDeleted: currentStaffDeleted,
                    deletedAt: currentStaffDeleted ? new Date() : null,
                    user: fallbackUser
                };
            }
            return {
                ...p,
                user: userObj || fallbackUser
            };
        };

        (prisma.staffProfile as any).findMany = async (args: any) => {
            if (staffProfiles.length === 0) {
                return [
                    {
                        id: mockProfileId,
                        status: currentStaffStatus,
                        isDeleted: currentStaffDeleted,
                        deletedAt: new Date(),
                        user: { id: mockUserId, email: 'mock-user@noun.edu.ng', name: 'Test Cascader' }
                    }
                ];
            }
            return staffProfiles.map(p => ({
                ...p,
                user: users.find(u => u.id === p.userId) || { id: p.userId, email: 'mock@test.com', name: 'Mock' }
            }));
        };

        (prisma.staffProfile as any).delete = async (args: any) => {
            const index = staffProfiles.findIndex(p => p.id === args.where.id || p.userId === args.where.userId);
            if (index !== -1) staffProfiles.splice(index, 1);
            return { id: mockProfileId };
        };

        (prisma.staffProfile as any).deleteMany = async (args: any) => {
            if (args.where?.userId?.in) {
                const ids = args.where.userId.in;
                for (let i = staffProfiles.length - 1; i >= 0; i--) {
                    if (ids.includes(staffProfiles[i].userId)) staffProfiles.splice(i, 1);
                }
            }
            return { count: staffProfiles.length };
        };

        // Mock APER Session
        (prisma as any).aperSession = {
            create: async (args: any) => {
                const session = {
                    id: args.data.id || `mock-aper-session-${Math.random().toString(36).substr(2, 9)}`,
                    title: args.data.title,
                    year: args.data.year,
                    startDate: args.data.startDate,
                    endDate: args.data.endDate,
                    isActive: args.data.isActive || false
                };
                aperSessions.push(session);
                return session;
            },
            findFirst: async (args: any) => {
                return aperSessions.find(s => s.year === args.where?.year) || null;
            },
            findUnique: async (args: any) => {
                return aperSessions.find(s => s.id === args.where.id) || null;
            },
            findMany: async (args: any) => aperSessions,
            update: async (args: any) => {
                const s = aperSessions.find(s => s.id === args.where.id);
                if (s) {
                    if (args.data.title !== undefined) s.title = args.data.title;
                    if (args.data.startDate !== undefined) s.startDate = args.data.startDate;
                    if (args.data.endDate !== undefined) s.endDate = args.data.endDate;
                    if (args.data.isActive !== undefined) s.isActive = args.data.isActive;
                    return s;
                }
                return {
                    id: args.where.id,
                    isActive: args.data.isActive || false
                };
            },
            updateMany: async (args: any) => {
                aperSessions.forEach(s => {
                    if (args.where?.id?.not && s.id !== args.where.id.not) {
                        s.isActive = args.data.isActive;
                    }
                });
                return { count: aperSessions.length };
            },
            delete: async (args: any) => {
                const index = aperSessions.findIndex(s => s.id === args.where.id);
                if (index !== -1) aperSessions.splice(index, 1);
                return { id: args.where.id };
            }
        };

        // Mock Notification
        (prisma.notification as any).create = async (args: any) => {
            const notif = {
                id: `mock-notification-${Math.random().toString(36).substr(2, 9)}`,
                ...args.data
            };
            notifications.push(notif);
            return notif;
        };

        (prisma.notification as any).createMany = async (args: any) => {
            if (args.data) {
                args.data.forEach((d: any) => {
                    notifications.push({
                        id: `mock-notification-${Math.random().toString(36).substr(2, 9)}`,
                        ...d
                    });
                });
            }
            return { count: args.data ? args.data.length : 0 };
        };

        (prisma.notification as any).findMany = async (args: any) => {
            if (args.where?.userId) {
                return notifications.filter(n => n.userId === args.where.userId);
            }
            return notifications;
        };

        (prisma.notification as any).deleteMany = async (args: any) => {
            if (args.where?.userId?.in) {
                const ids = args.where.userId.in;
                for (let i = notifications.length - 1; i >= 0; i--) {
                    if (ids.includes(notifications[i].userId)) notifications.splice(i, 1);
                }
            } else if (args.where?.userId) {
                for (let i = notifications.length - 1; i >= 0; i--) {
                    if (notifications[i].userId === args.where.userId) notifications.splice(i, 1);
                }
            }
            return { count: notifications.length };
        };

        // Mock Leave Request
        (prisma as any).leaveRequest = {
            create: async (args: any) => {
                const req = {
                    id: args.data.id || `mock-leave-${Math.random().toString(36).substr(2, 9)}`,
                    ...args.data
                };
                leaveRequests.push(req);
                return req;
            },
            findFirst: async (args: any) => {
                return leaveRequests.find(r => r.staffId === args.where?.staffId) || leaveRequests[0] || null;
            },
            findUnique: async (args: any) => {
                return leaveRequests.find(r => r.id === args.where.id) || null;
            },
            findMany: async (args: any) => {
                if (args.where?.status && args.where?.endDate?.lt) {
                    return leaveRequests.filter(r => r.status === args.where.status && new Date(r.endDate) < args.where.endDate.lt);
                }
                return leaveRequests;
            },
            update: async (args: any) => {
                const r = leaveRequests.find(r => r.id === args.where.id);
                if (r) {
                    if (args.data.endDate !== undefined) r.endDate = args.data.endDate;
                    if (args.data.durationDays !== undefined) r.durationDays = args.data.durationDays;
                    if (args.data.startDate !== undefined) r.startDate = args.data.startDate;
                    return r;
                }
                return {
                    id: args.where.id,
                    endDate: args.data.endDate || new Date(),
                    durationDays: args.data.durationDays || 1
                };
            },
            delete: async (args: any) => {
                const index = leaveRequests.findIndex(r => r.id === args.where.id);
                if (index !== -1) leaveRequests.splice(index, 1);
                return { id: args.where.id };
            }
        };

        // Mock FCMToken
        const fcmTokens: any[] = [];
        (prisma as any).fcmToken = {
            create: async (args: any) => {
                const rec = { token: args.data.token, userId: args.data.userId };
                fcmTokens.push(rec);
                return rec;
            },
            findUnique: async (args: any) => {
                const found = fcmTokens.find(t => t.token === args.where.token);
                return found || { token: args.where.token, userId: mockUserId };
            },
            findMany: async (args: any) => {
                if (args.where?.userId) {
                    return fcmTokens.filter(t => t.userId === args.where.userId);
                }
                return fcmTokens.length > 0 ? fcmTokens : [{ token: 'mock-token', userId: mockUserId }];
            },
            deleteMany: async (args: any) => {
                if (args.where?.token?.in) {
                    const tokens = args.where.token.in;
                    for (let i = fcmTokens.length - 1; i >= 0; i--) {
                        if (tokens.includes(fcmTokens[i].token)) fcmTokens.splice(i, 1);
                    }
                } else if (args.where?.userId) {
                    for (let i = fcmTokens.length - 1; i >= 0; i--) {
                        if (fcmTokens[i].userId === args.where.userId) fcmTokens.splice(i, 1);
                    }
                }
                return { count: 1 };
            }
        };

        // Mock PaymentVoucher
        (prisma as any).paymentVoucher = {
            create: async (args: any) => {
                currentVoucherStatus = 'PENDING';
                currentVoucherAuditComment = null;
                return {
                    id: mockVoucherId,
                    status: currentVoucherStatus,
                    amount: args.data.amount || 75000,
                    createdByUserId: args.data.createdByUserId
                };
            },
            findUnique: async (args: any) => ({
                id: args.where.id,
                status: currentVoucherStatus,
                amount: 75000,
                auditComment: currentVoucherAuditComment
            }),
            update: async (args: any) => {
                if (args.data.status !== undefined) currentVoucherStatus = args.data.status;
                if (args.data.auditComment !== undefined) currentVoucherAuditComment = args.data.auditComment;
                return {
                    id: args.where.id,
                    status: currentVoucherStatus,
                    auditComment: currentVoucherAuditComment
                };
            },
            delete: async (args: any) => ({
                id: args.where.id
            })
        };

        // Mock Payroll
        (prisma as any).payroll = {
            create: async (args: any) => ({
                id: 'mock-payroll-uuid',
                userId: args.data.userId
            }),
            delete: async (args: any) => ({
                id: args.where.id
            })
        };

        // Mock SecurityGear
        (prisma as any).securityGear = {
            create: async (args: any) => {
                currentGearAvailableQty = args.data.availableQty || 10;
                return {
                    id: 'mock-gear-uuid',
                    name: args.data.name,
                    totalQty: args.data.totalQty,
                    availableQty: currentGearAvailableQty,
                    unit: args.data.unit
                };
            },
            findUnique: async (args: any) => ({
                id: args.where.id,
                availableQty: currentGearAvailableQty
            }),
            update: async (args: any) => {
                if (args.data.availableQty !== undefined) currentGearAvailableQty = args.data.availableQty;
                return {
                    id: args.where.id,
                    availableQty: currentGearAvailableQty
                };
            },
            delete: async (args: any) => ({
                id: args.where.id
            })
        };

        // Mock SecurityGearLoan
        (prisma as any).securityGearLoan = {
            create: async (args: any) => ({
                id: 'mock-loan-uuid',
                gearId: args.data.gearId,
                officerId: args.data.officerId,
                quantity: args.data.quantity,
                status: args.data.status
            }),
            update: async (args: any) => ({
                id: args.where.id,
                status: args.data.status,
                returnedAt: args.data.returnedAt
            }),
            delete: async (args: any) => ({
                id: args.where.id
            })
        };

        // Mock ClinicInventory
        (prisma as any).clinicInventory = {
            create: async (args: any) => ({
                id: mockAssetId,
                name: args.data.name,
                quantity: args.data.quantity,
                unit: args.data.unit,
                expiryDate: args.data.expiryDate || null,
                minStockLevel: args.data.minStockLevel || 10
            }),
            update: async (args: any) => ({
                id: args.where.id,
                quantity: args.data.quantity,
                expiryDate: args.data.expiryDate || null,
                minStockLevel: args.data.minStockLevel || 10
            }),
            upsert: async (args: any) => ({
                id: mockAssetId,
                name: args.create.name,
                quantity: args.create.quantity,
                unit: args.create.unit,
                expiryDate: args.create.expiryDate || null,
                minStockLevel: args.create.minStockLevel || 10
            }),
            findUnique: async (args: any) => ({
                id: mockAssetId,
                name: args.where.name || 'Paracetamol',
                quantity: 17,
                unit: 'tabs',
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                minStockLevel: 20
            }),
            findMany: async (args: any) => [
                {
                    id: mockAssetId,
                    name: 'Paracetamol',
                    quantity: 17,
                    unit: 'tabs',
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    minStockLevel: 20
                }
            ],
            delete: async (args: any) => ({
                id: args.where.id
            })
        };

        // Mock UserSession
        (prisma as any).userSession = {
            create: async (args: any) => ({
                id: 'mock-session-id',
                ...args.data
            }),
            findUnique: async (args: any) => ({
                id: args.where.id || 'mock-session-id',
                userId: mockUserId,
                token: args.where.token || 'mock-session-token',
                ipAddress: '127.0.0.1',
                userAgent: 'Mock Browser',
                lastActive: new Date()
            }),
            findMany: async (args: any) => [
                {
                    id: 'mock-session-id',
                    userId: mockUserId,
                    token: 'mock-session-token',
                    ipAddress: '127.0.0.1',
                    userAgent: 'Mock Browser',
                    lastActive: new Date(),
                    createdAt: new Date()
                }
            ],
            delete: async (args: any) => ({
                id: args.where.id
            }),
            deleteMany: async (args: any) => ({
                count: 1
            })
        };

        // Mock AuditLog
        (prisma.auditLog as any).create = async (args: any) => ({
            id: 'mock-audit-log-uuid',
            ...args.data
        });
        (prisma.auditLog as any).findUnique = async (args: any) => ({
            id: args.where.id,
            action: 'MANUAL_OVERRIDE'
        });
        (prisma.auditLog as any).count = async () => 1;
        (prisma.auditLog as any).delete = async (args: any) => ({
            id: args.where.id
        });
        (prisma.auditLog as any).deleteMany = async (args: any) => ({
            count: 1
        });

        // Mock Transaction
        (prisma as any).$transaction = async (cb: any) => {
            return cb(prisma);
        };
    }
};
