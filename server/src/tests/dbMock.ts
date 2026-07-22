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

        // Mock User
        (prisma.user as any).create = async (args: any) => ({
            id: mockUserId,
            email: args.data.email,
            password: args.data.password,
            name: args.data.name || 'Test User',
            role: args.data.role || 'STAFF',
            isActive: true,
            tokenInvalidatedAt: null,
            staffProfile: args.data.staffProfile ? {
                id: mockProfileId,
                surname: args.data.staffProfile.create.surname || 'Cascader',
                otherNames: args.data.staffProfile.create.otherNames || 'Test',
                status: args.data.staffProfile.create.status || 'ACTIVE',
                isDeleted: false
            } : null
        });
        (prisma.user as any).update = async (args: any) => ({
            id: args.where.id,
            isActive: args.data.isActive !== undefined ? args.data.isActive : true,
            tokenInvalidatedAt: args.data.tokenInvalidatedAt || null
        });
        (prisma.user as any).findUnique = async (args: any) => ({
            id: args.where.id,
            email: 'mock-user@noun.edu.ng',
            isActive: false,
            tokenInvalidatedAt: new Date(),
            staffProfile: {
                id: mockProfileId,
                status: 'RETIRED',
                isDeleted: true,
                deletedAt: new Date()
            }
        });
        (prisma.user as any).delete = async (args: any) => ({
            id: args.where.id
        });
        (prisma.user as any).count = async () => 1;

        // Local state-tracking variables for mock runs
        let currentStaffStatus = 'ACTIVE';
        let currentStaffDeleted = false;
        let currentVoucherStatus = 'PENDING';
        let currentVoucherAuditComment: string | null = null;
        let currentGearAvailableQty = 10;

        // Mock StaffProfile
        (prisma.staffProfile as any).update = async (args: any) => {
            if (args.data.status !== undefined) currentStaffStatus = args.data.status;
            if (args.data.isDeleted !== undefined) currentStaffDeleted = args.data.isDeleted;
            return {
                id: mockProfileId,
                userId: args.where.userId || mockUserId,
                status: currentStaffStatus,
                isDeleted: currentStaffDeleted
            };
        };
        (prisma.staffProfile as any).findUnique = async (args: any) => ({
            id: mockProfileId,
            userId: args.where.id || args.where.userId || mockUserId,
            status: currentStaffStatus,
            isDeleted: currentStaffDeleted,
            deletedAt: currentStaffDeleted ? new Date() : null
        });
        (prisma.staffProfile as any).findMany = async (args: any) => ([
            {
                id: mockProfileId,
                status: currentStaffStatus,
                isDeleted: currentStaffDeleted,
                deletedAt: new Date(),
                user: { id: mockUserId, email: 'mock-user@noun.edu.ng', name: 'Test Cascader' }
            }
        ]);
        (prisma.staffProfile as any).delete = async (args: any) => ({
            id: mockProfileId
        });

        // Mock FCMToken
        (prisma as any).fcmToken = {
            create: async (args: any) => ({
                token: args.data.token,
                userId: args.data.userId
            }),
            findUnique: async (args: any) => ({
                token: args.where.token,
                userId: mockUserId
            }),
            findMany: async (args: any) => ([
                { token: 'mock-token', userId: mockUserId }
            ]),
            deleteMany: async (args: any) => ({
                count: 1
            })
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
                unit: args.data.unit
            }),
            update: async (args: any) => ({
                id: args.where.id,
                quantity: args.data.quantity
            }),
            delete: async (args: any) => ({
                id: args.where.id
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

        // Mock Transaction
        (prisma as any).$transaction = async (cb: any) => {
            return cb(prisma);
        };
    }
};
