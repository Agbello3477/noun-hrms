import { Request, Response } from 'express';
import prisma from '../prisma';
import { Role } from '@prisma/client';

// Generate or assign 4-digit extension based on staff role/department if missing
const generateVoipExtension = async (role: Role, departmentName?: string | null): Promise<string> => {
  let basePrefix = 1; // 1xxx Default / Admin / Registry
  if (role === Role.SECURITY_HEAD || role === Role.SECURITY_OFFICER) {
    basePrefix = 2; // 2xxx Security
  } else if (
    role === Role.CLINIC_HEAD ||
    role === Role.CLINIC_DOCTOR ||
    role === Role.CLINIC_NURSE ||
    role === Role.CLINIC_LAB_SCIENTIST ||
    role === Role.CLINIC_PHARMACIST
  ) {
    basePrefix = 3; // 3xxx Clinic Intercom
  } else if (role === Role.STUDY_CENTER_MANAGER) {
    basePrefix = 4; // 4xxx Study Centers / Operations
  }

  // Find existing extensions with this prefix to get next number
  const existingProfiles = await prisma.staffProfile.findMany({
    where: {
      voipExtension: {
        startsWith: `${basePrefix}`
      }
    },
    select: { voipExtension: true }
  });

  const usedNumbers = new Set(
    existingProfiles
      .map((p) => (p.voipExtension ? parseInt(p.voipExtension, 10) : 0))
      .filter((n) => !isNaN(n) && n >= basePrefix * 1000 && n < (basePrefix + 1) * 1000)
  );

  let extNumber = basePrefix * 1000 + 1;
  while (usedNumbers.has(extNumber) && extNumber < (basePrefix + 1) * 1000 - 1) {
    extNumber++;
  }

  return `${extNumber}`;
};

// GET /api/voip/directory - Returns 4-digit extension directory
export const getVoipDirectory = async (req: Request, res: Response) => {
  try {
    const { query, department } = req.query as { query?: string; department?: string };

    const whereClause: any = {
      isDeleted: false,
      user: {
        isActive: true
      }
    };

    if (query) {
      whereClause.OR = [
        { surname: { contains: query, mode: 'insensitive' } },
        { otherNames: { contains: query, mode: 'insensitive' } },
        { voipExtension: { contains: query } },
        { staffId: { contains: query, mode: 'insensitive' } },
        { user: { name: { contains: query, mode: 'insensitive' } } }
      ];
    }

    const profiles = await prisma.staffProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        unit: {
          select: { name: true }
        },
        studyCenter: {
          select: { name: true }
        }
      },
      take: 100,
      orderBy: { surname: 'asc' }
    });

    // Auto-assign extensions to any profile missing a voipExtension
    const updatedProfiles = await Promise.all(
      profiles.map(async (profile) => {
        if (!profile.voipExtension) {
          const newExt = await generateVoipExtension(profile.user.role, profile.unit?.name);
          try {
            const updated = await prisma.staffProfile.update({
              where: { id: profile.id },
              data: { voipExtension: newExt }
            });
            profile.voipExtension = updated.voipExtension;
          } catch {
            // In case of race condition, ignore and keep unassigned
          }
        }

        return {
          id: profile.id,
          userId: profile.userId,
          name: profile.user.name || `${profile.surname || ''} ${profile.otherNames || ''}`.trim(),
          email: profile.user.email,
          role: profile.user.role,
          rank: profile.rank || 'Staff',
          extension: profile.voipExtension || '1000',
          department: profile.unit?.name || profile.studyCenter?.name || 'Main Campus',
          status: profile.status || 'ACTIVE',
          passportUrl: profile.passportUrl
        };
      })
    );

    res.status(200).json(updatedProfiles);
  } catch (error: any) {
    console.error('Error fetching VoIP directory:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch VoIP directory' });
  }
};

// GET /api/voip/lookup/:extension - Look up single extension details
export const lookupExtension = async (req: Request, res: Response) => {
  try {
    const { extension } = req.params;

    if (!extension || extension.length < 3) {
      return res.status(400).json({ error: true, message: 'Invalid extension number' });
    }

    let profile = await prisma.staffProfile.findFirst({
      where: {
        voipExtension: extension,
        isDeleted: false
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true
          }
        },
        unit: { select: { name: true } }
      }
    });

    if (!profile) {
      return res.status(404).json({ error: true, message: `Extension ${extension} not found` });
    }

    if (!profile.user.isActive || profile.status === 'RETIRED') {
      return res.status(403).json({ error: true, message: `Extension ${extension} is not currently active on duty` });
    }

    res.status(200).json({
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name || `${profile.surname || ''} ${profile.otherNames || ''}`.trim(),
      email: profile.user.email,
      role: profile.user.role,
      rank: profile.rank || 'Staff',
      extension: profile.voipExtension,
      department: profile.unit?.name || 'Main Campus',
      status: profile.status || 'ACTIVE'
    });
  } catch (error: any) {
    console.error('Error looking up extension:', error);
    res.status(500).json({ error: true, message: 'Failed to lookup extension' });
  }
};

// GET /api/voip/ice-servers - Returns WebRTC ICE Server configs
export const getIceServers = async (req: Request, res: Response) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  if (process.env.TURN_SERVER_URL) {
    iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      // @ts-ignore
      username: process.env.TURN_SERVER_USERNAME || '',
      credential: process.env.TURN_SERVER_PASSWORD || ''
    });
  }

  res.status(200).json({ iceServers });
};

// GET /api/voip/my-extension - Returns current authenticated user's 4-digit VoIP extension (auto-assigns if missing)
export const getMyExtension = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: true, message: 'Unauthorized' });
    }

    let profile = await prisma.staffProfile.findUnique({
      where: { userId: user.id },
      include: {
        unit: { select: { name: true } },
        studyCenter: { select: { name: true } }
      }
    });

    if (!profile) {
      return res.status(404).json({ error: true, message: 'Staff profile not found' });
    }

    if (!profile.voipExtension) {
      const newExt = await generateVoipExtension(user.role, profile.unit?.name);
      profile = await prisma.staffProfile.update({
        where: { id: profile.id },
        data: { voipExtension: newExt },
        include: {
          unit: { select: { name: true } },
          studyCenter: { select: { name: true } }
        }
      });
    }

    res.status(200).json({
      extension: profile.voipExtension,
      name: user.name,
      rank: profile.rank || 'Staff',
      department: profile.unit?.name || profile.studyCenter?.name || 'Main Campus'
    });
  } catch (error: any) {
    console.error('Error fetching my extension:', error);
    res.status(500).json({ error: true, message: 'Failed to fetch extension' });
  }
};
