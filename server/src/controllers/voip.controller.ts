import { Request, Response } from 'express';
import prisma from '../prisma';
import { Role } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { generateDynamicTurnCredentials } from '../services/turnCredential.service';

// Helper to determine the 4-digit prefix based on role
const getPrefixForRole = (role: Role): number => {
  if (role === Role.SECURITY_HEAD || role === Role.SECURITY_OFFICER) {
    return 2; // 2xxx Security
  } else if (
    role === Role.CLINIC_HEAD ||
    role === Role.CLINIC_DOCTOR ||
    role === Role.CLINIC_NURSE ||
    role === Role.CLINIC_LAB_SCIENTIST ||
    role === Role.CLINIC_PHARMACIST
  ) {
    return 3; // 3xxx Clinic Intercom
  } else if (role === Role.STUDY_CENTER_MANAGER) {
    return 4; // 4xxx Study Centers / Operations
  }
  return 1; // 1xxx Default / Academic / Admin / Registry
};

/**
 * Self-healing deduplication routine:
 * Finds any staff profiles with duplicate or missing VoIP extensions and assigns unique numbers sequentially.
 */
export const repairAndDeduplicateExtensions = async () => {
  try {
    const allProfiles = await prisma.staffProfile.findMany({
      where: { isDeleted: false },
      include: {
        user: { select: { id: true, role: true, isActive: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const usedExtensions = new Set<string>();
    const toUpdate: { id: string; role: Role; currentExt: string | null }[] = [];

    for (const profile of allProfiles) {
      const ext = profile.voipExtension;
      if (!ext || usedExtensions.has(ext) || ext.length !== 4) {
        toUpdate.push({ id: profile.id, role: profile.user?.role || Role.STAFF, currentExt: ext });
      } else {
        usedExtensions.add(ext);
      }
    }

    if (toUpdate.length > 0) {
      console.log(`[VoIP Controller] Found ${toUpdate.length} profiles requiring extension deduplication/assignment.`);

      for (const item of toUpdate) {
        const prefix = getPrefixForRole(item.role);
        let candidate = prefix * 1000 + 1;
        while (usedExtensions.has(`${candidate}`) && candidate < (prefix + 1) * 1000 - 1) {
          candidate++;
        }
        const assignedExt = `${candidate}`;
        usedExtensions.add(assignedExt);

        await prisma.staffProfile.update({
          where: { id: item.id },
          data: { voipExtension: assignedExt }
        });
      }
      console.log(`[VoIP Controller] Extension deduplication complete. All profiles have unique 4-digit extensions.`);
    }
  } catch (err) {
    console.error('[VoIP Controller] Error during extension deduplication:', err);
  }
};

// Generate next available 4-digit extension atomically
const generateVoipExtension = async (role: Role): Promise<string> => {
  const basePrefix = getPrefixForRole(role);

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
    const { query } = req.query as { query?: string };

    // Run deduplication check if needed
    await repairAndDeduplicateExtensions();

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
      take: 150,
      orderBy: { surname: 'asc' }
    });

    const formattedProfiles = profiles.map((profile) => ({
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
    }));

    res.status(200).json(formattedProfiles);
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

    const profile = await prisma.staffProfile.findFirst({
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

// GET /api/voip/ice-servers & /api/v1/webrtc/ice-servers - Returns WebRTC ICE Server configs
export const getIceServers = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous-client';
  const ttlSeconds = 12 * 3600; // 12 hours
  const iceConfig = generateDynamicTurnCredentials(userId, ttlSeconds);
  res.status(200).json(iceConfig);
};

// GET /api/voip/my-extension - Returns current authenticated user's 4-digit VoIP extension
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
      const newExt = await generateVoipExtension(user.role);
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

// ─── Phase 17: Voicemail & Voice Note Endpoints ──────────────────────────────

// POST /api/voip/voicemail - Save audio voicemail / voice note
export const saveVoicemail = async (req: any, res: Response) => {
  try {
    const callerUser = req.user;
    const { recipientExtension, durationSeconds } = req.body;
    const audioFile = req.file;

    if (!callerUser) {
      return res.status(401).json({ error: true, message: 'Authentication required' });
    }

    if (!recipientExtension) {
      return res.status(400).json({ error: true, message: 'Recipient extension is required' });
    }

    if (!audioFile) {
      return res.status(400).json({ error: true, message: 'Audio file is required' });
    }

    // Lookup recipient profile
    const recipientProfile = await prisma.staffProfile.findFirst({
      where: { voipExtension: recipientExtension, isDeleted: false },
      include: { user: { select: { id: true, name: true } } }
    });

    if (!recipientProfile || !recipientProfile.user) {
      return res.status(404).json({ error: true, message: `Extension ${recipientExtension} not found` });
    }

    // Lookup caller extension
    const callerProfile = await prisma.staffProfile.findUnique({
      where: { userId: callerUser.id },
      select: { voipExtension: true, surname: true, otherNames: true }
    });
    const callerExt = callerProfile?.voipExtension || '1000';
    const callerDisplayName = callerUser.name || `${callerProfile?.surname || ''} ${callerProfile?.otherNames || ''}`.trim() || 'Colleague';

    const audioUrl = `/uploads/${audioFile.filename}`;

    // Create Voicemail record
    const voicemail = await prisma.voicemail.create({
      data: {
        callerUserId: callerUser.id,
        recipientUserId: recipientProfile.user.id,
        callerExtension: callerExt,
        recipientExtension: recipientExtension,
        audioUrl,
        durationSeconds: parseInt(durationSeconds || '0', 10),
        isListened: false
      },
      include: {
        callerUser: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                surname: true,
                otherNames: true,
                rank: true,
                passportUrl: true
              }
            }
          }
        }
      }
    });

    // Create in-app Notification for recipient
    try {
      await prisma.notification.create({
        data: {
          userId: recipientProfile.user.id,
          title: '🎙️ New Voice Note / Voicemail',
          message: `${callerDisplayName} (Ext: ${callerExt}) left a ${durationSeconds || 'short'}s voice note for you.`,
          type: 'INFO',
          link: '/dashboard'
        }
      });
    } catch (notifErr) {
      console.warn('[VoIP Voicemail] Could not create notification record:', notifErr);
    }

    return res.status(201).json({
      message: 'Voice note saved and sent successfully',
      voicemail
    });
  } catch (error: any) {
    console.error('Error saving voicemail:', error);
    return res.status(500).json({ error: true, message: 'Failed to save voicemail' });
  }
};

// GET /api/voip/voicemails - Get all received voicemails for authenticated user
export const getVoicemails = async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: true, message: 'Authentication required' });
    }

    const voicemails = await prisma.voicemail.findMany({
      where: { recipientUserId: user.id },
      include: {
        callerUser: {
          select: {
            id: true,
            name: true,
            email: true,
            staffProfile: {
              select: {
                surname: true,
                otherNames: true,
                rank: true,
                passportUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return res.status(200).json(voicemails);
  } catch (error: any) {
    console.error('Error fetching voicemails:', error);
    return res.status(500).json({ error: true, message: 'Failed to fetch voicemails' });
  }
};

// PUT /api/voip/voicemails/:id/listened - Mark voicemail as listened
export const markVoicemailListened = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const voicemail = await prisma.voicemail.findUnique({
      where: { id }
    });

    if (!voicemail) {
      return res.status(404).json({ error: true, message: 'Voicemail not found' });
    }

    if (voicemail.recipientUserId !== user.id) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    const updated = await prisma.voicemail.update({
      where: { id },
      data: { isListened: true }
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error updating voicemail status:', error);
    return res.status(500).json({ error: true, message: 'Failed to update voicemail' });
  }
};

// DELETE /api/voip/voicemails/:id - Delete a voicemail
export const deleteVoicemail = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const voicemail = await prisma.voicemail.findUnique({
      where: { id }
    });

    if (!voicemail) {
      return res.status(404).json({ error: true, message: 'Voicemail not found' });
    }

    if (voicemail.recipientUserId !== user.id && voicemail.callerUserId !== user.id) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    // Try deleting the physical audio file
    if (voicemail.audioUrl && voicemail.audioUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../', voicemail.audioUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.voicemail.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Voicemail deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting voicemail:', error);
    return res.status(500).json({ error: true, message: 'Failed to delete voicemail' });
  }
};
