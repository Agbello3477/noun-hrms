'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  AlertTriangle,
  MessageSquarePlus,
  Send,
  X,
  HelpCircle,
  Clock3,
  CheckCircle,
  XCircle,
  FileText
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

interface WorkloadComplaint {
  id: string;
  staffId: string;
  departmentId: string;
  allocationId?: string | null;
  courseId?: string | null;
  session: string;
  semester: string;
  complaintType: string;
  subject: string;
  details: string;
  suggestedAdjustment?: string | null;
  status: 'PENDING_HOD_REVIEW' | 'UNDER_REVIEW' | 'RESOLVED_ADJUSTED' | 'REJECTED_MAINTAINED';
  hodRemarks?: string | null;
  resolvedById?: string | null;
  resolvedBy?: { id: string; name: string; email: string };
  resolvedAt?: string | null;
  createdAt: string;
  course?: { id: string; courseCode: string; courseTitle: string; creditUnits: number };
  department?: { id: string; name: string };
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

  // Complaints State
  const [complaints, setComplaints] = useState<WorkloadComplaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState<boolean>(false);
  const [showComplaintModal, setShowComplaintModal] = useState<boolean>(false);
  const [submittingComplaint, setSubmittingComplaint] = useState<boolean>(false);
  const [complaintSuccess, setComplaintSuccess] = useState<string | null>(null);
  const [complaintError, setComplaintError] = useState<string | null>(null);

  // Form State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [complaintType, setComplaintType] = useState<string>('COURSE_MISMATCH');
  const [complaintSubject, setComplaintSubject] = useState<string>('');
  const [complaintDetails, setComplaintDetails] = useState<string>('');
  const [suggestedAdjustment, setSuggestedAdjustment] = useState<string>('');

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

  const fetchComplaints = async () => {
    setComplaintsLoading(true);
    try {
      const res = await api.get('/api/v1/academic/workload/complaints', {
        params: { session: selectedSession, semester: selectedSemester }
      });
      setComplaints(res.data || []);
    } catch (err) {
      console.error('Error fetching workload complaints:', err);
    } finally {
      setComplaintsLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
    fetchComplaints();
  }, [user, selectedSession, selectedSemester]);

  const handleOpenComplaintModal = (courseId?: string, courseCode?: string) => {
    if (courseId) {
      setSelectedCourseId(courseId);
      setComplaintSubject(`Course Allocation Review Request: ${courseCode || ''}`);
    } else {
      setSelectedCourseId('');
      setComplaintSubject('');
    }
    setComplaintType('COURSE_MISMATCH');
    setComplaintDetails('');
    setSuggestedAdjustment('');
    setComplaintError(null);
    setComplaintSuccess(null);
    setShowComplaintModal(true);
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintSubject.trim() || !complaintDetails.trim()) {
      setComplaintError('Please provide both subject and comprehensive details for your complaint.');
      return;
    }

    const deptId = dossier?.departmentId || user?.staffProfile?.unitId;
    if (!deptId) {
      setComplaintError('Academic department identifier could not be determined. Please contact admin.');
      return;
    }

    setSubmittingComplaint(true);
    setComplaintError(null);
    setComplaintSuccess(null);

    try {
      const matchingAlloc = dossier?.allocations.find(a => a.courseId === selectedCourseId);

      await api.post('/api/v1/academic/workload/complaints', {
        departmentId: deptId,
        allocationId: matchingAlloc ? matchingAlloc.courseId : null,
        courseId: selectedCourseId || null,
        session: selectedSession,
        semester: selectedSemester,
        complaintType,
        subject: complaintSubject.trim(),
        details: complaintDetails.trim(),
        suggestedAdjustment: suggestedAdjustment.trim() || null
      });

      setComplaintSuccess('Your complaint and review request have been submitted directly to your Head of Department (HOD).');
      fetchComplaints();
      setTimeout(() => {
        setShowComplaintModal(false);
        setComplaintSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting workload complaint:', err);
      setComplaintError(err?.response?.data?.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const userCadre = (user?.staffProfile?.cadre || '').toUpperCase();
  const isAcademicCadre = userCadre === 'ACADEMIC' || userCadre === 'CONUASS' || userCadre.includes('ACADEMIC');

  if (user && !isAcademicCadre) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Academic Cadre Required</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            The Teaching Workload Subsystem and NUC Course Dossier are strictly reserved for staff members appointed under the <strong>Academic Cadre</strong> (Lecturers, Professors, Readers).
          </p>
          <div className="inline-block px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
            Current Registered Cadre: <span className="text-slate-900 font-bold">{user.staffProfile?.cadre || 'Non-Academic'}</span>
          </div>
          <div className="pt-2">
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006533] text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-800 transition">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => handleOpenComplaintModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-xl text-xs font-black shadow-md transition"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Lodge Allocation Complaint / Request Review
            </button>
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
            onClick={() => { fetchDossier(); fetchComplaints(); }}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-emerald-700 bg-slate-50 rounded-xl border border-slate-200 transition"
            title="Refresh Dossier"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Complaints Status Section */}
      {complaints.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200/80 p-5 shadow-sm space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-amber-600" />
              My Lodged Allocation Complaints &amp; HOD Review Tracking ({complaints.length})
            </h3>
            <span className="text-[11px] font-bold text-amber-700">Direct HOD Recourse Subsystem</span>
          </div>

          <div className="divide-y divide-slate-100">
            {complaints.map((c) => (
              <div key={c.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{c.subject}</span>
                    {c.course && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {c.course.courseCode}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-[10px]">
                      {c.complaintType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">{c.details}</p>
                  {c.suggestedAdjustment && (
                    <p className="text-emerald-700 font-semibold text-[11px]">
                      💡 Suggested Adjustment: {c.suggestedAdjustment}
                    </p>
                  )}
                  {c.hodRemarks && (
                    <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                      💬 <strong className="text-slate-900">HOD Remarks:</strong> {c.hodRemarks}
                      {c.resolvedBy && <span className="text-slate-400"> (by {c.resolvedBy.name})</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 ${
                      c.status === 'RESOLVED_ADJUSTED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : c.status === 'REJECTED_MAINTAINED'
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : c.status === 'UNDER_REVIEW'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {c.status === 'RESOLVED_ADJUSTED' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                    {c.status === 'REJECTED_MAINTAINED' && <XCircle className="w-3.5 h-3.5 text-slate-500" />}
                    {c.status === 'UNDER_REVIEW' && <Clock3 className="w-3.5 h-3.5 text-blue-600" />}
                    {c.status === 'PENDING_HOD_REVIEW' && <Clock3 className="w-3.5 h-3.5 text-amber-600" />}
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {dossier.allocations.length} Courses
                </span>
              </div>
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
                    <th className="py-3 px-4 text-center print:hidden">Action / Recourse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {dossier.allocations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-bold">
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
                        <td className="py-3 px-4 text-center print:hidden">
                          <button
                            onClick={() => handleOpenComplaintModal(alloc.courseId, alloc.courseCode)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                            title="Lodge complaint or request allocation adjustment from HOD"
                          >
                            <MessageSquarePlus className="w-3 h-3 text-amber-600" />
                            Review Request
                          </button>
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

      {/* Lodge Complaint / Request Review Modal */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <MessageSquarePlus className="w-4 h-4" />
                Lodge Course Allocation Complaint to HOD
              </div>
              <button
                onClick={() => setShowComplaintModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="p-6 space-y-4">
              {complaintSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {complaintSuccess}
                </div>
              )}

              {complaintError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  {complaintError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Target Course (Optional / General)</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">General Workload / Overall Semester Allocation</option>
                  {dossier?.allocations.map((a) => (
                    <option key={a.courseId} value={a.courseId}>
                      {a.courseCode} — {a.courseTitle} ({a.assignedCreditUnits} CU)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Complaint / Review Reason Category</label>
                <select
                  value={complaintType}
                  onChange={(e) => setComplaintType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="COURSE_MISMATCH">Discipline / Specialization Mismatch</option>
                  <option value="CREDIT_OVERLOAD">Statutory Cadre Credit Overload</option>
                  <option value="SCHEDULING_CONFLICT">Timetable / Practical Schedule Conflict</option>
                  <option value="MATERIAL_DEFICIT">Course Study Material / ODL Module Deficit</option>
                  <option value="ADMIN_RELIEF_MISCALCULATION">Administrative Relief Not Counted</option>
                  <option value="OTHER">Other Academic / Pedagogical Reason</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Subject / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Request reassignment of CMP 312 due to curriculum specialization"
                  value={complaintSubject}
                  onChange={(e) => setComplaintSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Detailed Justification *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain why the allocated course is not suited for your current research/pedagogical domain, or provide details of any overload/scheduling conflict..."
                  value={complaintDetails}
                  onChange={(e) => setComplaintDetails(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Suggested Course or Alternative Allocation (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Would prefer CMP 421 Database Systems or reduced CU allocation"
                  value={suggestedAdjustment}
                  onChange={(e) => setSuggestedAdjustment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowComplaintModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplaint}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${submittingComplaint ? 'animate-spin' : ''}`} />
                  {submittingComplaint ? 'Submitting...' : 'Submit to HOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
