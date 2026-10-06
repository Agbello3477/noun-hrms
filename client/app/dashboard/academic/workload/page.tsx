'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  GraduationCap,
  Layers,
  ClipboardCheck,
  Users,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';
import LecturerTeachingWorkloadPage from '@/app/portal/my-teaching-workload/page';

export default function UnifiedWorkloadHubPage() {
  const { user } = useAuth();
  const role = user?.role;

  const isManagerOrAdmin = [
    'HR_ADMIN',
    'SUPER_USER',
    'ADMIN',
    'UNIT_HEAD',
    'UNIT_ADMIN',
    'REGISTRAR',
    'VICE_CHANCELLOR',
  ].includes(role || '');

  return (
    <div className="space-y-6">
      {/* Quick Action Navigation Cards for Academic Administrators */}
      {isManagerOrAdmin && (
        <div className="p-4 md:p-8 pb-0 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/academic/workload/allocation"
            className="group bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs hover:shadow-md hover:border-emerald-500 transition flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 rounded-xl text-[#006533] group-hover:bg-[#006533] group-hover:text-white transition">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-[#006533] transition flex items-center gap-1.5">
                  HOD Course Allocation Matrix
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#006533]" />
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Impute course assignments, ODL cohort weights, and staff capacity meters.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700" />
          </Link>

          <Link
            href="/faculty/workload/review"
            className="group bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-xs hover:shadow-md hover:border-indigo-500 transition flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700 group-hover:bg-indigo-700 group-hover:text-white transition">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition flex items-center gap-1.5">
                  Dean&apos;s Workload Ratification Cockpit
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-700" />
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Review departmental workload dockets, authorize sign-offs, and inspect NUC audits.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-700" />
          </Link>
        </div>
      )}

      {/* Embedded Personal Workload Dossier for the Academic Staff */}
      <LecturerTeachingWorkloadPage />
    </div>
  );
}
