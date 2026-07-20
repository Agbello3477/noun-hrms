import { Request, Response, NextFunction } from 'express';
import { z, ZodError, AnyZodObject } from 'zod';
import { Role, LeaveType } from '@prisma/client';

// ----------------------------------------------------
// XSS Sanitization Helper
// ----------------------------------------------------
export const stripHtml = (val: string): string => {
    if (typeof val !== 'string') return val;
    // Strip HTML tags completely using regex
    return val.replace(/<[^>]*>/g, '').trim();
};

export const sanitizeHtml = (val: string): string => {
    if (typeof val !== 'string') return val;
    // Remove potentially malicious script/style tags and execute commands but preserve safe formatting
    let cleaned = val.replace(/<(script|style|iframe|object|embed)[^>]*>([\s\S]*?)<\/\1>/gi, '');
    cleaned = cleaned.replace(/on\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '');
    cleaned = cleaned.replace(/href\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, '');
    return cleaned.trim();
};

// ----------------------------------------------------
// Validation Middleware Helper
// ----------------------------------------------------
export const validate = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            // Update request fields with cleaned/validated/transformed values
            req.body = parsed.body || req.body;
            req.query = parsed.query || req.query;
            req.params = parsed.params || req.params;
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map(err => ({
                    field: err.path.slice(1).join('.'), // Removes parent context like 'body'
                    message: err.message
                }));
                return res.status(400).json({
                    message: 'Validation failed',
                    errors: formattedErrors
                });
            }
            return res.status(500).json({ message: 'Internal validation error' });
        }
    };
};

// ----------------------------------------------------
// Zod Schemas
// ----------------------------------------------------

// 1. Auth Validation Schemas
export const registerSchema = z.object({
    body: z.object({
        email: z.preprocess((val) => typeof val === 'string' ? val.trim().toLowerCase() : val, z.string().email('Invalid email address format')),
        password: z.string().min(8, 'Password must be at least 8 characters long'),
        name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters').transform(stripHtml),
        role: z.nativeEnum(Role).optional(),
        surname: z.string().min(2, 'Surname must be at least 2 characters').max(50).optional().transform(val => val ? stripHtml(val) : undefined),
        otherNames: z.string().min(2, 'Other names must be at least 2 characters').max(50).optional().transform(val => val ? stripHtml(val) : undefined),
        title: z.string().max(20).optional().transform(val => val ? stripHtml(val) : undefined),
        staffId: z.string().regex(/^NOU\d+$/i, 'Staff ID must match pattern NOU followed by digits (e.g. NOU12345)').optional().transform(val => val ? stripHtml(val) : undefined),
        phone: z.string().regex(/^\+?[\d\s-]{8,20}$/, 'Invalid phone number format').optional(),
        stateOfOrigin: z.string().max(50).optional().transform(val => val ? stripHtml(val) : undefined),
        lga: z.string().max(50).optional().transform(val => val ? stripHtml(val) : undefined),
        address: z.string().max(200).optional().transform(val => val ? stripHtml(val) : undefined),
        level: z.string().max(20).optional().transform(val => val ? stripHtml(val) : undefined),
        step: z.string().max(10).optional().transform(val => val ? stripHtml(val) : undefined),
        cadre: z.enum(['ADMINISTRATIVE', 'ACADEMIC', 'TECHNICAL']).optional(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
        centerId: z.string().uuid('Invalid study center ID format').optional(),
        unitId: z.string().uuid('Invalid unit ID format').optional(),
        programmeId: z.string().uuid('Invalid academic programme ID format').optional(),
        facilitatorInfo: z.any().optional(),
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().min(1, 'Email or Staff ID is required'),
        password: z.string().min(1, 'Password is required')
    })
});

export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string()
            .min(8, 'New password must be at least 8 characters long')
            .refine(val => val !== '123456789', {
                message: 'New password cannot be the default password'
            })
    })
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.preprocess((val) => typeof val === 'string' ? val.trim().toLowerCase() : val, z.string().email('Invalid email address format'))
    })
});

// 2. Leave Request Validation Schemas
export const leaveApplySchema = z.object({
    body: z.object({
        type: z.nativeEnum(LeaveType),
        startDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid start date format'),
        endDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid end date format'),
        durationDays: z.number().int().min(1).optional(),
        reason: z.string().min(5, 'Reason must be at least 5 characters').max(5000, 'Reason must not exceed 5000 characters').transform(sanitizeHtml)
    })
});

// 3. Disciplinary Query Schemas
export const queryIssueSchema = z.object({
    body: z.object({
        staffId: z.string().min(1, 'Staff ID is required'),
        title: z.string().min(3, 'Query title must be at least 3 characters').max(100).transform(stripHtml),
        content: z.string().min(5, 'Query content must be at least 5 characters').max(10000, 'Content must not exceed 10000 characters').transform(sanitizeHtml)
    })
});

export const queryRespondSchema = z.object({
    body: z.object({
        queryId: z.string().optional(),
        responseText: z.string().optional(),
        content: z.string().optional()
    })
});

// 4. Memo Schemas
export const memoCreateSchema = z.object({
    body: z.object({
        title: z.string().min(3, 'Memo title must be at least 3 characters').max(100).transform(stripHtml),
        content: z.string().min(10, 'Memo content must be at least 10 characters').max(10000, 'Content must not exceed 10000 characters').transform(sanitizeHtml),
        recipientId: z.string().uuid('Invalid recipient ID format').optional().nullable(),
        allowResponses: z.preprocess(val => {
            if (val === 'true' || val === true) return true;
            if (val === 'false' || val === false) return false;
            return val;
        }, z.boolean().optional())
    })
});
