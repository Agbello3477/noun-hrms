import prisma from '../prisma';
import { CallType, CallSessionStatus, CallParticipationStatus, CallParticipantRole, CallNotificationType } from '@prisma/client';

export interface ConferenceParticipant {
  userId: string;
  socketId: string;
  userName: string;
  userRole?: string;
  avatarUrl?: string;
  joinedAt: string;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface ConferenceRoom {
  roomId: string;
  callSessionId: string;
  title: string;
  callType: CallType;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  departmentId?: string;
  targetUserIds: string[];
  activeParticipants: Map<string, ConferenceParticipant>; // userId -> ConferenceParticipant
  invitedUserIds: Set<string>;
  startedAt: number;
  status: 'ACTIVE' | 'ENDED';
}

export interface ConferenceRoomSummary {
  roomId: string;
  callSessionId: string;
  title: string;
  callType: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  departmentId?: string;
  activeCount: number;
  activeParticipants: {
    userId: string;
    userName: string;
    userRole?: string;
    avatarUrl?: string;
  }[];
  startedAt: number;
  durationSeconds?: number;
}

export function formatCallDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec${seconds === 1 ? '' : 's'}`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  if (remSecs === 0) {
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  return `${mins} min${mins === 1 ? '' : 's'} ${remSecs} sec${remSecs === 1 ? '' : 's'}`;
}

class ConferenceRoomManager {
  private rooms: Map<string, ConferenceRoom> = new Map();

  /**
   * Create or retrieve an active conference room and sync with Prisma DB
   */
  public async createOrGetRoom(params: {
    roomId: string;
    title?: string;
    callType?: CallType | string;
    hostUser: { id: string; name?: string; role?: string; avatarUrl?: string };
    targetUserIds?: string[];
    departmentId?: string;
  }): Promise<ConferenceRoom> {
    const { roomId, title, hostUser, targetUserIds = [], departmentId } = params;
    
    // Check if room is already active in memory
    const existing = this.rooms.get(roomId);
    if (existing && existing.status === 'ACTIVE') {
      return existing;
    }

    const assignedCallType = (params.callType as CallType) || (targetUserIds.length === 1 ? CallType.ONE_TO_ONE : CallType.GROUP_DEPARTMENT);
    const roomTitle = title || `Video Conference Meeting (${assignedCallType.replace('_', ' ')})`;

    // Check or create DB record for CallSession
    let session = await prisma.callSession.findUnique({
      where: { roomId }
    });

    if (!session || session.status === CallSessionStatus.ENDED) {
      session = await prisma.callSession.create({
        data: {
          roomId,
          title: roomTitle,
          callType: assignedCallType,
          hostId: hostUser.id,
          departmentId: departmentId || null,
          status: CallSessionStatus.ACTIVE,
          startedAt: new Date()
        }
      });

      // Register host participant in DB
      await prisma.callParticipant.upsert({
        where: {
          callSessionId_userId: {
            callSessionId: session.id,
            userId: hostUser.id
          }
        },
        create: {
          callSessionId: session.id,
          userId: hostUser.id,
          role: CallParticipantRole.HOST,
          participationStatus: CallParticipationStatus.CONNECTED,
          joinedAt: new Date()
        },
        update: {
          role: CallParticipantRole.HOST,
          participationStatus: CallParticipationStatus.CONNECTED,
          joinedAt: new Date(),
          leftAt: null
        }
      });

      // Register invited participants in DB
      if (targetUserIds.length > 0) {
        const invitePromises = targetUserIds
          .filter((uid) => uid !== hostUser.id)
          .map((uid) =>
            prisma.callParticipant.upsert({
              where: {
                callSessionId_userId: {
                  callSessionId: session.id,
                  userId: uid
                }
              },
              create: {
                callSessionId: session.id,
                userId: uid,
                role: CallParticipantRole.PARTICIPANT,
                participationStatus: CallParticipationStatus.INVITED,
                invitedAt: new Date()
              },
              update: {
                participationStatus: CallParticipationStatus.INVITED,
                invitedAt: new Date(),
                joinedAt: null,
                leftAt: null
              }
            })
          );
        await Promise.all(invitePromises);
      }
    }

    const newRoom: ConferenceRoom = {
      roomId,
      callSessionId: session.id,
      title: session.title || roomTitle,
      callType: session.callType,
      hostId: hostUser.id,
      hostName: hostUser.name || 'Host Colleague',
      hostAvatar: hostUser.avatarUrl,
      departmentId: session.departmentId || undefined,
      targetUserIds,
      activeParticipants: new Map(),
      invitedUserIds: new Set(targetUserIds),
      startedAt: session.startedAt.getTime(),
      status: 'ACTIVE'
    };

    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  /**
   * Handle user joining an active conference room (initial join or late join)
   */
  public async joinRoom(
    roomId: string,
    user: { id: string; name?: string; role?: string; avatarUrl?: string },
    socketId: string
  ): Promise<{ room: ConferenceRoom; isLateJoin: boolean; participant: ConferenceParticipant }> {
    let room = this.rooms.get(roomId);
    let isLateJoin = false;

    if (!room || room.status !== 'ACTIVE') {
      // Rehydrate from DB if active session exists
      const session = await prisma.callSession.findUnique({
        where: { roomId },
        include: { host: true, participants: true }
      });

      if (session && session.status === CallSessionStatus.ACTIVE) {
        room = {
          roomId: session.roomId,
          callSessionId: session.id,
          title: session.title || 'Live Video Conference',
          callType: session.callType,
          hostId: session.hostId,
          hostName: session.host.name || 'Host Colleague',
          hostAvatar: undefined,
          departmentId: session.departmentId || undefined,
          targetUserIds: session.participants.map((p) => p.userId),
          activeParticipants: new Map(),
          invitedUserIds: new Set(session.participants.map((p) => p.userId)),
          startedAt: session.startedAt.getTime(),
          status: 'ACTIVE'
        };
        this.rooms.set(roomId, room);
      } else {
        // Create new room instance on the fly for open room join
        room = await this.createOrGetRoom({
          roomId,
          hostUser: user,
          title: `Video Conference (${roomId})`
        });
      }
    }

    isLateJoin = room.activeParticipants.size > 0 && !room.activeParticipants.has(user.id);

    const participant: ConferenceParticipant = {
      userId: user.id,
      socketId,
      userName: user.name || 'Staff Colleague',
      userRole: user.role || 'Staff',
      avatarUrl: user.avatarUrl,
      joinedAt: new Date().toISOString()
    };

    room.activeParticipants.set(user.id, participant);

    // Update participant status in DB
    try {
      await prisma.callParticipant.upsert({
        where: {
          callSessionId_userId: {
            callSessionId: room.callSessionId,
            userId: user.id
          }
        },
        create: {
          callSessionId: room.callSessionId,
          userId: user.id,
          role: user.id === room.hostId ? CallParticipantRole.HOST : CallParticipantRole.PARTICIPANT,
          participationStatus: CallParticipationStatus.CONNECTED,
          joinedAt: new Date()
        },
        update: {
          participationStatus: CallParticipationStatus.CONNECTED,
          joinedAt: new Date(),
          leftAt: null
        }
      });
    } catch (dbErr) {
      console.error('[ConferenceRoomManager] Error updating participant in DB:', dbErr);
    }

    return { room, isLateJoin, participant };
  }

  /**
   * Handle user leaving a room
   */
  public async leaveRoom(
    roomId: string,
    userId: string
  ): Promise<{ room: ConferenceRoom | null; wasLastParticipant: boolean; leftParticipant?: ConferenceParticipant }> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { room: null, wasLastParticipant: false };
    }

    const leftParticipant = room.activeParticipants.get(userId);
    room.activeParticipants.delete(userId);

    // Update DB record
    try {
      await prisma.callParticipant.updateMany({
        where: {
          callSessionId: room.callSessionId,
          userId: userId,
          participationStatus: CallParticipationStatus.CONNECTED
        },
        data: {
          participationStatus: CallParticipationStatus.LEFT,
          leftAt: new Date()
        }
      });
    } catch (err) {
      console.error('[ConferenceRoomManager] Error updating leave in DB:', err);
    }

    const wasLastParticipant = room.activeParticipants.size === 0;
    return { room, wasLastParticipant, leftParticipant };
  }

  /**
   * End conference session and run Missed Call Audit Worker
   */
  public async endRoom(
    roomId: string,
    endedByUserId?: string
  ): Promise<{
    durationSeconds: number;
    durationFormatted: string;
    attendeeNames: string[];
    missedUserIds: string[];
    roomTitle: string;
    hostName: string;
  } | null> {
    const room = this.rooms.get(roomId);
    const now = new Date();

    let sessionId = room?.callSessionId;
    let roomTitle = room?.title || 'Video Conference';
    let hostName = room?.hostName || 'Host';
    let startedAt = room ? new Date(room.startedAt) : now;

    if (!sessionId) {
      const dbSession = await prisma.callSession.findUnique({
        where: { roomId }
      });
      if (dbSession) {
        sessionId = dbSession.id;
        roomTitle = dbSession.title || roomTitle;
        startedAt = dbSession.startedAt;
      }
    }

    if (!sessionId) {
      this.rooms.delete(roomId);
      return null;
    }

    const durationSeconds = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
    const durationFormatted = formatCallDuration(durationSeconds);

    // 1. Mark CallSession as ENDED in DB
    try {
      await prisma.callSession.update({
        where: { id: sessionId },
        data: {
          status: CallSessionStatus.ENDED,
          endedAt: now,
          durationSeconds
        }
      });
    } catch (e) {
      console.error('[ConferenceRoomManager] Error ending call session:', e);
    }

    // 2. Fetch all participants of this session to determine who attended and who missed
    const allParticipants = await prisma.callParticipant.findMany({
      where: { callSessionId: sessionId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const attendedParticipants = allParticipants.filter(
      (p) => p.joinedAt !== null || p.participationStatus === CallParticipationStatus.CONNECTED || p.participationStatus === CallParticipationStatus.LEFT
    );
    const attendeeNames = attendedParticipants.map((p) => p.user.name || p.user.email.split('@')[0]);

    // 3. Mark unjoined participants as MISSED
    const missedParticipants = allParticipants.filter(
      (p) => p.joinedAt === null && p.participationStatus !== CallParticipationStatus.DECLINED && p.role !== CallParticipantRole.HOST
    );

    const missedUserIds = missedParticipants.map((p) => p.userId);

    if (missedUserIds.length > 0) {
      await prisma.callParticipant.updateMany({
        where: {
          callSessionId: sessionId,
          userId: { in: missedUserIds }
        },
        data: {
          participationStatus: CallParticipationStatus.MISSED
        }
      });

      // 4. Post-Call Missed Session Notification Worker
      // Persist structured CallNotification and Notification for each missed user
      for (const missedUser of missedParticipants) {
        try {
          const notifMetadata = {
            durationFormatted,
            durationSeconds,
            attendeeNames,
            hostName,
            roomTitle,
            roomId,
            endedAt: now.toISOString()
          };

          await prisma.callNotification.create({
            data: {
              recipientId: missedUser.userId,
              callSessionId: sessionId,
              type: CallNotificationType.MISSED_CALL_SUMMARY,
              metadata: notifMetadata,
              isRead: false
            }
          });

          const attendeesStr = attendeeNames.length > 0 ? attendeeNames.join(', ') : 'No other attendees';
          await prisma.notification.create({
            data: {
              userId: missedUser.userId,
              title: `📞 Missed Meeting: ${roomTitle}`,
              message: `You missed a ${durationFormatted} conference meeting hosted by ${hostName}. Attendees: ${attendeesStr}`,
              type: 'WARNING',
              link: '/dashboard'
            }
          });
        } catch (notifErr) {
          console.error('[ConferenceRoomManager] Error creating missed call notification:', notifErr);
        }
      }
    }

    if (room) {
      room.status = 'ENDED';
    }
    this.rooms.delete(roomId);

    return {
      durationSeconds,
      durationFormatted,
      attendeeNames,
      missedUserIds,
      roomTitle,
      hostName
    };
  }

  /**
   * Get summaries of all active rooms for real-time banner HUD and API discovery
   */
  public getActiveRooms(): ConferenceRoomSummary[] {
    const summaries: ConferenceRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.status === 'ACTIVE' && room.activeParticipants.size > 0) {
        summaries.push({
          roomId: room.roomId,
          callSessionId: room.callSessionId,
          title: room.title,
          callType: room.callType,
          hostId: room.hostId,
          hostName: room.hostName,
          hostAvatar: room.hostAvatar,
          departmentId: room.departmentId,
          activeCount: room.activeParticipants.size,
          activeParticipants: Array.from(room.activeParticipants.values()).map((p) => ({
            userId: p.userId,
            userName: p.userName,
            userRole: p.userRole,
            avatarUrl: p.avatarUrl
          })),
          startedAt: room.startedAt,
          durationSeconds: Math.round((Date.now() - room.startedAt) / 1000)
        });
      }
    }
    return summaries;
  }

  /**
   * Get single room details
   */
  public getRoom(roomId: string): ConferenceRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Cleanup any user socket on disconnect across all active rooms
   */
  public async handleSocketDisconnect(socketId: string, userId: string): Promise<{ roomId: string; wasLastParticipant: boolean; leftParticipant?: ConferenceParticipant }[]> {
    const leftRooms: { roomId: string; wasLastParticipant: boolean; leftParticipant?: ConferenceParticipant }[] = [];
    for (const [roomId, room] of this.rooms.entries()) {
      const participant = room.activeParticipants.get(userId);
      if (participant && participant.socketId === socketId) {
        const result = await this.leaveRoom(roomId, userId);
        leftRooms.push({
          roomId,
          wasLastParticipant: result.wasLastParticipant,
          leftParticipant: result.leftParticipant
        });
      }
    }
    return leftRooms;
  }
}

export const conferenceRoomManager = new ConferenceRoomManager();
export default conferenceRoomManager;
