'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Pagination from '@/components/ui/Pagination';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building2,
  Users,
  BookOpen,
  Download,
  Filter,
  RefreshCw,
  Clock,
  FileCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Check
} from 'lucide-react';

interface Faculty {
  id: string;
  facultyCode: string;
  name: string;
  dean?: { name: string; email: string };
  departments: { id: string; name: string }[];
}

interface DepartmentMatrix {
  department: {
    id: string;
    name: string;
    faculty: any;
    hod?: any;
    programmesCount: number;
    coursesCount: number;
  };
  session: string;
  semester: string;
  overallDocketStatus: string;
  statistics: {
    totalStaff: number;
    totalAllocations: number;
    totalOverloadCount: number;
    totalUnderallocatedCount: number;
    totalCompliantCount: number;
    complianceRate: number;
  };
  staffMatrix: any[];
}

export default function DeanWorkloadReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/faculty/workload/review') {
      router.replace('/dashboard/faculty/workload/review');
    }
  }, [pathname, router]);

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('cmp');
  const [selectedSession, setSelectedSession] = useState<string>('2026/2027');
  const [selectedSemester, setSelectedSemester] = useState<string>('FIRST_SEMESTER');

  const [loading, setLoading] = useState<boolean>(true);
  const [deptMatrices, setDeptMatrices] = useState<DepartmentMatrix[]>([]);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  // Authorization Modal
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [targetDept, setTargetDept] = useState<DepartmentMatrix | null>(null);
  const [authAction, setAuthAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [authRemarks, setAuthRemarks] = useState<string>('');
  const [submittingAuth, setSubmittingAuth] = useState<boolean>(false);

  // Pagination for all faculty allocations
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Feedback Alerts
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Initial Load of Faculties
  useEffect(() => {
    async function loadFaculties() {
      try {
        const res = await api.get('/api/v1/academic/faculties');
        setFaculties(res.data || []);
        if (res.data?.length > 0) {
          setSelectedFacultyId(res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching faculties:', err);
      }
    }
    loadFaculties();
  }, []);

  // 2. Fetch all department matrices in the selected faculty
  const fetchFacultyDockets = async () => {
    if (!selectedFacultyId) return;
    setLoading(true);
    setFeedback(null);
    try {
      // Find all departments for this faculty
      const deptsRes = await api.get('/api/v1/academic/departments', {
        params: { facultyId: selectedFacultyId },
      });
      const depts = deptsRes.data || [];

      const matrices = await Promise.all(
        depts.map(async (d: any) => {
          try {
            const mRes = await api.get(`/api/v1/academic/workload/department/${d.id}`, {
              params: { session: selectedSession, semester: selectedSemester },
            });
            return mRes.data as DepartmentMatrix;
          } catch {
            return null;
          }
        })
      );

      const validMatrices = matrices.filter((m): m is DepartmentMatrix => m !== null);
      setDeptMatrices(validMatrices);
      if (validMatrices.length > 0 && !expandedDeptId) {
        setExpandedDeptId(validMatrices[0].department.id);
      }
    } catch (err: any) {
      console.error('Error fetching faculty dockets:', err);
      setFeedback({ type: 'error', message: 'Failed to load faculty workload review.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyDockets();
  }, [selectedFacultyId, selectedSession, selectedSemester]);

  // Open Authorize / Return Modal
  const handleOpenAuthModal = (dept: DepartmentMatrix, action: 'APPROVE' | 'REJECT') => {
    setTargetDept(dept);
    setAuthAction(action);
    setAuthRemarks(
      action === 'APPROVE'
        ? 'Reviewed and officially authorized by the Dean of Faculty.'
        : 'Workload docket returned to HOD for reallocation of overloaded cadre units.'
    );
    setShowAuthModal(true);
  };

  // Submit Authorization / Return
  const handleSubmitAuth = async () => {
    if (!targetDept) return;
    setSubmittingAuth(true);
    setFeedback(null);

    try {
      await api.put(`/api/v1/academic/workload/dockets/${targetDept.department.id}/dean-approval`, {
        session: selectedSession,
        semester: selectedSemester,
        action: authAction,
        remarks: authRemarks,
      });

      setFeedback({
        type: 'success',
        message: `Departmental docket for ${targetDept.department.name} ${
          authAction === 'APPROVE' ? 'authorized successfully' : 'returned to HOD for revision'
        }!`,
      });
      setShowAuthModal(false);
      fetchFacultyDockets();
    } catch (err: any) {
      console.error('Error authorizing docket:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to act on docket.' });
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const url = `${api.defaults.baseURL || ''}/api/v1/academic/workload/export-audit?session=${selectedSession}&semester=${selectedSemester}&format=csv`;
    window.open(url, '_blank');
  };

  // Flattened allocations across whole faculty
  const allFacultyAllocations = deptMatrices.flatMap((dm) =>
    dm.staffMatrix.flatMap((s) =>
      s.allocations.map((a: any) => ({
        ...a,
        departmentName: dm.department.name,
        departmentId: dm.department.id,
        staffName: s.staffName,
        staffId: s.staffId,
        academicRank: s.academicRank,
      }))
    )
  );

  const paginatedFacultyAllocations = allFacultyAllocations.slice((page - 1) * pageSize, page * pageSize);

  // Faculty totals
  const totalStaff = deptMatrices.reduce((acc, dm) => acc + (dm.statistics?.totalStaff || 0), 0);
  const totalAllocations = deptMatrices.reduce((acc, dm) => acc + (dm.statistics?.totalAllocations || 0), 0);
  const totalOverloads = deptMatrices.reduce((acc, dm) => acc + (dm.statistics?.totalOverloadCount || 0), 0);
  const totalUnderallocated = deptMatrices.reduce((acc, dm) => acc + (dm.statistics?.totalUnderallocatedCount || 0), 0);
  const avgCompliance =
    deptMatrices.length > 0
      ? Math.round(deptMatrices.reduce((acc, dm) => acc + (dm.statistics?.complianceRate || 0), 0) / deptMatrices.length)
      : 100;

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-indigo-200 text-xs font-bold tracking-wider uppercase border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              Dean&apos;s Workload Ratification Cockpit
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Faculty Teaching Workload &amp; Accreditation Cockpit
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
              Authoritative review of departmental course unit distributions, statutory overload caps, and maker-checker sign-off.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download NUC Audit Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Scope Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Filter className="w-4 h-4 text-indigo-600" />
            Faculty Scoping &amp; Term Selection
          </div>
          <button
            onClick={fetchFacultyDockets}
            disabled={loading}
            className="text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Cockpit
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Faculty Select */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Faculty Board
            </label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            >
              {faculties.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} ({fac.facultyCode})
                </option>
              ))}
            </select>
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            >
              <option value="2026/2027">2026/2027 Session</option>
              <option value="2025/2026">2025/2026 Session</option>
              <option value="2024/2025">2024/2025 Session</option>
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            >
              <option value="FIRST_SEMESTER">First Semester</option>
              <option value="SECOND_SEMESTER">Second Semester</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Departments</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{deptMatrices.length}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Constituent Units</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Total Staff</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalStaff}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Academic Lecturers</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Course Units</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalAllocations}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Allocated Allocations</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Overload Flags</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{totalOverloads}</div>
          <div className="text-[11px] text-rose-500 font-semibold mt-1">Exceeds cadre ceiling</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Faculty Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{avgCompliance}%</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Average compliance</div>
        </div>
      </div>

      {/* Departmental Workload Docket Cards */}
      <div className="space-y-4">
        <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          Departmental Workload Dockets &amp; Authorization Queue
        </h2>

        {loading ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading departmental dockets...</p>
          </div>
        ) : deptMatrices.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No departments found for this faculty.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deptMatrices.map((dm) => {
              const isExpanded = expandedDeptId === dm.department.id;
              const isSubmitted = dm.overallDocketStatus === 'SUBMITTED_BY_HOD';
              const isApproved = dm.overallDocketStatus === 'APPROVED_BY_DEAN' || dm.overallDocketStatus === 'RATIFIED_ACADEMIC_PLANNING';

              return (
                <div key={dm.department.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition">
                  {/* Department Summary Header */}
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-black text-slate-900">{dm.department.name}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            dm.overallDocketStatus === 'RATIFIED_ACADEMIC_PLANNING'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : dm.overallDocketStatus === 'APPROVED_BY_DEAN'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : dm.overallDocketStatus === 'SUBMITTED_BY_HOD'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {dm.overallDocketStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold">
                        HOD: {dm.department.hod?.name || 'Assigned Head of Department'} • {dm.statistics.totalStaff} Staff • {dm.statistics.totalAllocations} Course Allocations
                      </p>
                    </div>

                    {/* Action Buttons for Dean */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {isSubmitted ? (
                        <>
                          <button
                            onClick={() => handleOpenAuthModal(dm, 'REJECT')}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return to HOD
                          </button>
                          <button
                            onClick={() => handleOpenAuthModal(dm, 'APPROVE')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            Authorize Docket
                          </button>
                        </>
                      ) : isApproved ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Dean Authorized
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          Awaiting HOD Submission
                        </span>
                      )}

                      <button
                        onClick={() => setExpandedDeptId(isExpanded ? null : dm.department.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                        title={isExpanded ? 'Collapse' : 'Expand Staff Allocations'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Department Staff Table */}
                  {isExpanded && (
                    <div className="p-5 space-y-4 animate-in fade-in duration-150">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-extrabold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Lecturer</th>
                              <th className="py-2.5 px-3">Cadre Rank</th>
                              <th className="py-2.5 px-3">Assigned Courses</th>
                              <th className="py-2.5 px-3 text-center">Assigned CU</th>
                              <th className="py-2.5 px-3 text-center">Permissible Max</th>
                              <th className="py-2.5 px-3 text-center">ETE Load</th>
                              <th className="py-2.5 px-3 text-center">Contact Hrs</th>
                              <th className="py-2.5 px-3 text-center">NUC Compliance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                            {dm.staffMatrix.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-6 text-center text-slate-400 font-bold">
                                  No staff allocations in this department.
                                </td>
                              </tr>
                            ) : (
                              dm.staffMatrix.map((staff, sIdx) => {
                                const totalCU = staff.totalAssignedCreditUnits + staff.totalCourseMaterialCreditUnits;

                                return (
                                  <tr key={sIdx} className="hover:bg-slate-50/60 transition">
                                    <td className="py-2.5 px-3">
                                      <div className="font-bold text-slate-900">{staff.staffName}</div>
                                      <div className="text-[10px] text-slate-400">{staff.staffId}</div>
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-slate-600">{staff.academicRank}</td>
                                    <td className="py-2.5 px-3">
                                      <div className="flex flex-wrap gap-1 max-w-xs">
                                        {staff.allocations.map((a: any, aIdx: number) => (
                                          <span key={aIdx} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                                            {a.courseCode} ({a.assignedCreditUnits} CU)
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-black text-slate-900">{totalCU.toFixed(1)}</td>
                                    <td className="py-2.5 px-3 text-center font-semibold text-slate-500">
                                      {staff.effectivePermissibleMaxCU} CU
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-black text-emerald-700">
                                      {staff.totalEffectiveTeachingEquivalent.toFixed(1)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                      {staff.totalWeeklyContactHours.toFixed(1)}h
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                          staff.statusColor === 'emerald'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : staff.statusColor === 'red'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        {staff.statusLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Faculty Workload Audit Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Comprehensive Faculty Accreditation Audit Ledger
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Consolidated course allocations across all departments for {selectedSession} • {selectedSemester.replace('_', ' ')}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {allFacultyAllocations.length} Faculty Allocations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Course Code</th>
                <th className="py-3 px-4">Course Title</th>
                <th className="py-3 px-4">Lecturer</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">CU</th>
                <th className="py-3 px-4 text-center">Cohort</th>
                <th className="py-3 px-4 text-center">ETE</th>
                <th className="py-3 px-4 text-center">Docket Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedFacultyAllocations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-bold">
                    No active course allocations in this faculty.
                  </td>
                </tr>
              ) : (
                paginatedFacultyAllocations.map((alloc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">{alloc.departmentName}</td>
                    <td className="py-3 px-4 font-black text-slate-900">{alloc.courseCode}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{alloc.courseTitle}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{alloc.staffName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                        {alloc.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-black">{alloc.assignedCreditUnits}</td>
                    <td className="py-3 px-4 text-center">{alloc.enrolledStudentsCount}</td>
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

        {allFacultyAllocations.length > pageSize && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(allFacultyAllocations.length / pageSize)}
            totalItems={allFacultyAllocations.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Dean Authorization / Return Modal */}
      {showAuthModal && targetDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                {authAction === 'APPROVE' ? 'Authorize Departmental Docket' : 'Return Docket to HOD'}
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 font-medium">
              <p>
                Department: <strong className="text-slate-900">{targetDept.department.name}</strong> •{' '}
                {targetDept.statistics.totalAllocations} Course Allocations
              </p>

              {authAction === 'APPROVE' ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="font-black flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Formal Dean Authorization
                  </div>
                  <p className="text-[11px]">
                    Authorizing this docket signs off all departmental allocations and forwards them to the Directorate of Academic Planning (DAP) for university ratification.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
                  <div className="font-black flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Reversion to HOD
                  </div>
                  <p className="text-[11px]">
                    Returning this docket reverts allocations to <span className="font-bold">DRAFT</span> status so the HOD can adjust course unit loads and rectify overload alerts.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Dean Remarks / Comments</label>
                <textarea
                  rows={3}
                  value={authRemarks}
                  onChange={(e) => setAuthRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAuth}
                disabled={submittingAuth}
                className={`px-5 py-2.5 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2 ${
                  authAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingAuth && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {authAction === 'APPROVE' ? 'Authorize Department Docket' : 'Confirm Return to HOD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
