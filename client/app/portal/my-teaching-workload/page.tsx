'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  GraduationCap,
  BookOpen,
  Clock,
  Users,
  ShieldCheck,
  Printer,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Award,
  FileCheck2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface WorkloadDossier {
  staffProfileId: string;
  staffName: string;
  staffId: string;
  academicRank: string;
  departmentId?: string;
  departmentName?: string;
  facultyId?: string;
  facultyName?: string;
  session: string;
  semester: string;
  cadreMinCU: number;
  cadreMaxCU: number;
  cadreMaxContactHours: number;
  administrativeRole?: string;
  administrativeRebateCU: number;
  effectiveRequiredMinCU: number;
  effectivePermissibleMaxCU: number;
  totalBaseCreditUnits: number;
  totalAssignedCreditUnits: number;
  totalCourseMaterialCreditUnits: number;
  totalEffectiveTeachingEquivalent: number;
  totalWeeklyContactHours: number;
  totalEnrolledStudents: number;
  coursesCount: number;
  complianceStatus: 'NORMAL_LOAD' | 'WORKLOAD_OVERLOAD_WARNING' | 'UNDER_ALLOCATED';
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'red';
  statusRemarks: string;
  allocations: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    baseCreditUnits: number;
    assignedCreditUnits: number;
    enrolledStudentsCount: number;
    lectureHours: number;
    tutorialHours: number;
    practicalHours: number;
    effectiveContactHoursWeekly: number;
    effectiveTeachingEquivalent: number;
    courseMaterialCreditUnits: number;
    role: string;
    semester: string;
    session: string;
    status: string;
  }[];
}

export default function LecturerTeachingWorkloadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/portal/my-teaching-workload') {
      router.replace('/dashboard/portal/my-teaching-workload');
    }
  }, [pathname, router]);

  const [selectedSession, setSelectedSession] = useState<string>('2026/2027');
  const [selectedSemester, setSelectedSemester] = useState<string>('FIRST_SEMESTER');

  const [loading, setLoading] = useState<boolean>(true);
  const [dossier, setDossier] = useState<WorkloadDossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDossier = async () => {
    setLoading(true);
    setError(null);
    try {
      const profileId = user?.staffProfile?.id;
      if (!profileId) {
        // Fetch current user's profile ID
        const meRes = await api.get('/api/auth/me');
        const pId = meRes.data?.user?.staffProfile?.id;
        if (!pId) {
          setError('Staff profile record not found for logged in user.');
          setLoading(false);
          return;
        }
        const res = await api.get(`/api/v1/academic/workload/staff/${pId}`, {
          params: { session: selectedSession, semester: selectedSemester },
        });
        setDossier(res.data);
      } else {
        const res = await api.get(`/api/v1/academic/workload/staff/${profileId}`, {
          params: { session: selectedSession, semester: selectedSemester },
        });
        setDossier(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching teaching dossier:', err);
      setError(err?.response?.data?.message || 'Failed to fetch teaching workload dossier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
  }, [user, selectedSession, selectedSemester]);

  const handlePrint = () => {
    window.print();
  };

  const totalAssignedCU = (dossier?.totalAssignedCreditUnits || 0) + (dossier?.totalCourseMaterialCreditUnits || 0);
  const maxPermissibleCU = dossier?.effectivePermissibleMaxCU || 10;
  const progressPercent = Math.min(100, Math.round((totalAssignedCU / (maxPermissibleCU || 1)) * 100));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto print:p-0 print:max-w-none">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#006533] to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden print:bg-white print:text-black print:border print:border-black print:rounded-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-200 text-xs font-bold tracking-wider uppercase border border-white/20 print:hidden">
              <GraduationCap className="w-3.5 h-3.5" />
              Official NUC Teaching Workload Record
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white print:text-black">
              Personal Teaching Workload Dossier
            </h1>
            <p className="text-emerald-100 text-xs md:text-sm font-medium print:text-slate-600">
              National Open University of Nigeria • Directorate of Academic Planning &amp; Registry
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-md transition"
            >
              <Printer className="w-4 h-4" />
              Print Official Transcript
            </button>
          </div>
        </div>
      </div>

      {/* Scope Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Calendar className="w-4 h-4 text-[#006533]" />
          Academic Term Filter
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="2026/2027">2026/2027 Session</option>
            <option value="2025/2026">2025/2026 Session</option>
            <option value="2024/2025">2024/2025 Session</option>
          </select>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="FIRST_SEMESTER">First Semester</option>
            <option value="SECOND_SEMESTER">Second Semester</option>
          </select>

          <button
            onClick={fetchDossier}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-emerald-700 bg-slate-50 rounded-xl border border-slate-200 transition"
            title="Refresh Dossier"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">Loading your verified teaching workload records...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-sm font-bold text-amber-900">{error}</p>
        </div>
      ) : !dossier ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No teaching allocations on record for this term.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cadre & Lecturer Profile Header */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">{dossier.staffName}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#006533] text-xs font-extrabold">
                  {dossier.academicRank}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                Staff ID: <span className="font-bold text-slate-700">{dossier.staffId}</span> • {dossier.departmentName || 'Academic Department'} • {dossier.session} ({dossier.semester.replace('_', ' ')})
              </p>
            </div>

            {dossier.administrativeRole && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-bold">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>
                  {dossier.administrativeRole} • <strong className="text-indigo-700">{dossier.administrativeRebateCU} CU</strong> Relief Applied
                </span>
              </div>
            )}
          </div>

          {/* Cadre Capacity & Compliance Meter */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#006533]" />
                  Statutory Workload Compliance Meter
                </h3>
                <p className="text-xs text-slate-400 font-medium">{dossier.statusRemarks}</p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-black self-start sm:self-auto ${
                  dossier.statusColor === 'emerald'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : dossier.statusColor === 'red'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {dossier.statusLabel}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>
                  Current Teaching Load: <strong>{totalAssignedCU.toFixed(1)} CU</strong>
                </span>
                <span>
                  Permissible Band: <strong>{dossier.effectiveRequiredMinCU} – {maxPermissibleCU} CU</strong>
                </span>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    dossier.statusColor === 'emerald'
                      ? 'bg-emerald-500'
                      : dossier.statusColor === 'red'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Assigned Credits</div>
              <div className="text-2xl font-black text-slate-900">{totalAssignedCU.toFixed(1)} CU</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                {dossier.coursesCount} course units allocated
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Effective Teaching Eq.</div>
              <div className="text-2xl font-black text-emerald-700">
                {dossier.totalEffectiveTeachingEquivalent.toFixed(1)} ETE
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">ODL Cohort Weighted</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Weekly Contact</div>
              <div className="text-2xl font-black text-slate-900">
                {dossier.totalWeeklyContactHours.toFixed(1)} hrs
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Cadre Max: {dossier.cadreMaxContactHours} hrs/wk
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Enrolled Cohort</div>
              <div className="text-2xl font-black text-blue-700">{dossier.totalEnrolledStudents}</div>
              <div className="text-[11px] text-blue-600 font-semibold mt-1">Distance Learners</div>
            </div>
          </div>

          {/* Course Allocations Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#006533]" />
                Assigned Course Units &amp; Moderation Responsibilities
              </h3>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {dossier.allocations.length} Courses
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">Course Code</th>
                    <th className="py-3 px-4">Course Title</th>
                    <th className="py-3 px-4">Teaching Role</th>
                    <th className="py-3 px-4 text-center">Base CU</th>
                    <th className="py-3 px-4 text-center">Assigned CU</th>
                    <th className="py-3 px-4 text-center">Cohort Size</th>
                    <th className="py-3 px-4 text-center">Weekly Contact</th>
                    <th className="py-3 px-4 text-center">ETE Value</th>
                    <th className="py-3 px-4 text-center">Ratification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {dossier.allocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">
                        No courses allocated for this semester yet.
                      </td>
                    </tr>
                  ) : (
                    dossier.allocations.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-black text-slate-900">{alloc.courseCode}</td>
                        <td className="py-3 px-4 max-w-xs truncate">{alloc.courseTitle}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                            {alloc.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{alloc.baseCreditUnits}</td>
                        <td className="py-3 px-4 text-center font-black text-slate-900">{alloc.assignedCreditUnits}</td>
                        <td className="py-3 px-4 text-center font-semibold">{alloc.enrolledStudentsCount}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{alloc.effectiveContactHoursWeekly}h</td>
                        <td className="py-3 px-4 text-center font-black text-emerald-700">{alloc.effectiveTeachingEquivalent}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              alloc.status === 'RATIFIED_ACADEMIC_PLANNING'
                                ? 'bg-purple-100 text-purple-800'
                                : alloc.status === 'APPROVED_BY_DEAN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : alloc.status === 'SUBMITTED_BY_HOD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {alloc.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Institutional Sign-off Block for Print Layout */}
          <div className="hidden print:block pt-12 space-y-6 text-xs text-black border-t border-slate-300 mt-8">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="border-b border-black pb-1 mb-1 font-bold">_________________________</div>
                <div>Head of Department (HOD)</div>
                <div className="text-[10px] text-slate-500">Date &amp; Stamp</div>
              </div>
              <div>
                <div className="border-b border-black pb-1 mb-1 font-bold">_________________________</div>
                <div>Dean of Faculty</div>
                <div className="text-[10px] text-slate-500">Date &amp; Stamp</div>
              </div>
              <div>
                <div className="border-b border-black pb-1 mb-1 font-bold">_________________________</div>
                <div>Director of Academic Planning</div>
                <div className="text-[10px] text-slate-500">Date &amp; Stamp</div>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-500 pt-4">
              Generated securely from the NOUN Unified HRMS Academic Affairs Subsystem. Document Ref: NOUN/AP/WL/{dossier.session.replace('/', '-')}/{dossier.staffId}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
