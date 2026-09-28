'use client';

import React, { useState, useEffect } from 'react';
import { useSocket, ActiveConferenceRoomData } from '../../context/SocketContext';
import { Video, Users, ChevronRight, X, PhoneCall, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getImageUrl } from '../../lib/api';

function formatElapsedTimer(startedAtMs: number): string {
  const elapsedSecs = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function ActiveCallBanner() {
  const {
    activeConferenceRooms,
    joinActiveCallRoom,
    activeVideoModal,
    liveMeetingAuditToast,
    dismissMissedMeetingToast
  } = useSocket();

  const [isMinimized, setIsMinimized] = useState(false);
  const [timers, setTimers] = useState<Record<string, string>>({});

  // Real-time second tick for elapsed timers
  useEffect(() => {
    if (activeConferenceRooms.length === 0) return;

    const interval = setInterval(() => {
      const newTimers: Record<string, string> = {};
      activeConferenceRooms.forEach((room) => {
        newTimers[room.roomId] = formatElapsedTimer(room.startedAt);
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeConferenceRooms]);

  // Don't show banner for a room if user is currently inside that active video modal
  const visibleRooms = activeConferenceRooms.filter(
    (r) => !activeVideoModal?.isOpen || activeVideoModal.roomName !== r.roomId
  );

  return (
    <>
      {/* ─── Active Conference Call in Progress HUD ──────────────────────────── */}
      {visibleRooms.length > 0 && (
        <div className="w-full bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 border-b border-emerald-500/40 text-white shadow-xl relative z-30 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
            {visibleRooms.map((room: ActiveConferenceRoomData) => {
              const timerStr = timers[room.roomId] || formatElapsedTimer(room.startedAt);

              if (isMinimized) {
                return (
                  <div
                    key={room.roomId}
                    className="flex items-center justify-between gap-3 py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-bold text-emerald-300 truncate">
                        Live Call: {room.title}
                      </span>
                      <span className="text-[11px] font-mono bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-200 border border-emerald-700/50">
                        {timerStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => joinActiveCallRoom(room.roomId, room.title)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition"
                      >
                        <Video size={13} />
                        <span>Join Call</span>
                      </button>
                      <button
                        onClick={() => setIsMinimized(false)}
                        className="text-emerald-400 hover:text-white text-xs underline ml-2"
                      >
                        Expand
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={room.roomId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Status & Meeting Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative p-2 bg-emerald-900/60 rounded-xl border border-emerald-500/50 shrink-0">
                      <Video size={18} className="text-emerald-300 animate-pulse" />
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                          Call in Progress
                        </span>
                        <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                          {room.title}
                        </h4>
                        <span className="text-[11px] font-mono text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-700/40">
                          ⏱️ {timerStr}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mt-0.5 truncate flex items-center gap-2">
                        <span>Host: <strong className="text-white font-semibold">{room.hostName}</strong></span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400 font-medium">Late-Join Enabled</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Participant Avatars & Join Button */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    {/* Participant Avatars */}
                    <div className="flex items-center -space-x-2 overflow-hidden py-1">
                      {room.activeParticipants.slice(0, 4).map((p, idx) => {
                        const initial = p.userName ? p.userName.charAt(0).toUpperCase() : 'U';
                        return (
                          <div
                            key={p.userId || idx}
                            title={`${p.userName} (${p.userRole || 'Participant'})`}
                            className="relative inline-block h-7 w-7 rounded-full ring-2 ring-emerald-950 bg-gradient-to-tr from-emerald-700 to-teal-600 text-white font-bold text-[11px] flex items-center justify-center shadow"
                          >
                            {p.avatarUrl ? (
                              <img
                                src={getImageUrl(p.avatarUrl)}
                                alt={p.userName}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                        );
                      })}
                      {room.activeCount > 4 && (
                        <div className="h-7 w-7 rounded-full ring-2 ring-emerald-950 bg-slate-800 text-emerald-300 font-bold text-[10px] flex items-center justify-center">
                          +{room.activeCount - 4}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 hidden md:block">
                      <span className="font-bold text-white">{room.activeCount}</span> in room
                    </div>

                    {/* Join Button */}
                    <button
                      onClick={() => joinActiveCallRoom(room.roomId, room.title)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-500/25 transition-all transform active:scale-95"
                    >
                      <Video size={14} className="stroke-[2.5]" />
                      <span>Join Call</span>
                    </button>

                    <button
                      onClick={() => setIsMinimized(true)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                      title="Minimize Banner"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Post-Call Missed Session Audit Notification Toast ────────────────── */}
      {liveMeetingAuditToast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-md w-full bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-4 text-white animate-in slide-in-from-bottom-6 duration-300 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 shrink-0 mt-0.5">
              <PhoneCall size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-600/40">
                  Missed Meeting Summary
                </span>
                <button
                  onClick={dismissMissedMeetingToast}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                >
                  <X size={14} />
                </button>
              </div>

              <h4 className="text-sm font-bold text-white mt-1 truncate">
                {liveMeetingAuditToast.roomTitle}
              </h4>

              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Meeting hosted by <strong className="text-white">{liveMeetingAuditToast.hostName}</strong> has ended.
              </p>

              <div className="mt-2.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-amber-400" /> Duration:
                  </span>
                  <span className="font-mono text-white font-bold">
                    {liveMeetingAuditToast.durationFormatted}
                  </span>
                </div>
                <div className="text-slate-400">
                  <span className="flex items-center gap-1 mb-0.5">
                    <Users size={12} className="text-emerald-400" /> Attendees ({liveMeetingAuditToast.attendeeNames.length}):
                  </span>
                  <p className="text-slate-200 truncate font-medium">
                    {liveMeetingAuditToast.attendeeNames.length > 0
                      ? liveMeetingAuditToast.attendeeNames.join(', ')
                      : 'None'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={dismissMissedMeetingToast}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
