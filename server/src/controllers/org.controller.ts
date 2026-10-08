import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisService } from '../services/redis.service';

export const getOrganizationStructure = async (req: Request, res: Response) => {
    const CACHE_KEY = 'org:structure';
    try {
        const cached = await redisService.get<any>(CACHE_KEY);
        if (cached) {
            return res.json(cached);
        }

        const centers = await prisma.studyCenter.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true }
        });

        const units = await prisma.unit.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, type: true, code: true }
        });

        const result = { centers, units };
        await redisService.set(CACHE_KEY, result, 86400); // 24 hours TTL

        res.json(result);
    } catch (error) {
        console.error('Get Org Structure Error:', error);
        res.status(500).json({ message: 'Failed to fetch organization structure' });
    }
};

export const getProgrammes = async (req: Request, res: Response) => {
    const CACHE_KEY = 'org:programmes';
    try {
        const cached = await redisService.get<any>(CACHE_KEY);
        if (cached) {
            return res.json(cached);
        }

        const programmes = await prisma.academicProgramme.findMany({
            orderBy: { title: 'asc' }
        });
        await redisService.set(CACHE_KEY, programmes, 86400); // 24 hours TTL

        res.json(programmes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching programmes' });
    }
};
