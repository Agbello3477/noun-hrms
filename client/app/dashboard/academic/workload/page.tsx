'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import CourseAllocationMatrixPage from '@/app/academic/workload/allocation/page';
import LecturerTeachingWorkloadPage from '@/app/portal/my-teaching-workload/page';
import { Layers, UserCheck, RefreshCw } from 'lucide-react';

export default function UnifiedWorkloadHubPage() {
  const { user } = useAuth();
  const [userScope, setUserScope] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'allocation' | 'personal'>('allocation');

  useEffect(() => {
    async function checkScope() {
      try {
        const res = await api.get('/api/v1/academic/my-scope').catch(() => ({ data: null }));
        const scope = res.data;
        setUserScope(scope);

        // If user is not HOD/Dean/Executive (i.e. pure lecturer), default to personal dossier
        if (scope && !scope.isExecutive && !scope.isHod && !scope.isDean) {
          setActiveView('personal');
        } else {
          setActiveView('allocation');
        }
      } catch (err) {
        console.error('Error fetching user scope in Workload Hub:', err);
      } finally {
        setLoading(false);
      }
    }
    checkScope();
  }, []);

  const isManagerOrAdmin =
    userScope?.isExecutive ||
    userScope?.isHod ||
    userScope?.isDean ||
    ['SUPER_USER', 'ADMIN', 'HR_ADMIN', 'REGISTRAR', 'VICE_CHANCELLOR', 'UNIT_HEAD'].includes(user?.role || '');

  if (loading) {
    return (
      <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
        <RefreshCw className="w-8 h-8 text-[#006533] animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-500">Loading Academic Workload Subsystem...</p>
      </div>
    );
  }

  // If user has HOD, Dean, or Admin privileges, show the quick switcher bar
  return (
    <div className="space-y-6">
      {isManagerOrAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('allocation')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                activeView === 'allocation'
                  ? 'bg-[#006533] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              Department Course Allocation Engine (HOD / Dean Desk)
            </button>
            <button
              onClick={() => setActiveView('personal')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                activeView === 'personal'
                  ? 'bg-[#006533] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              My Personal Teaching Dossier
            </button>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Role Scope: {userScope?.isHod ? `HOD (${userScope?.hodDepartment?.name})` : userScope?.isDean ? `Dean (${userScope?.deanFaculty?.name})` : 'Academic Governance'}
          </span>
        </div>
      )}

      {/* Render Active View */}
      {activeView === 'allocation' && isManagerOrAdmin ? (
        <CourseAllocationMatrixPage />
      ) : (
        <LecturerTeachingWorkloadPage />
      )}
    </div>
  );
}
