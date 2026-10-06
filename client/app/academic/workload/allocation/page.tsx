'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Pagination from '@/components/ui/Pagination';
import {
  BookOpen,
  Users,
  GraduationCap,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Download,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  FileCheck,
  ChevronRight,
  Info,
  X
} from 'lucide-react';

interface Faculty {
  id: string;
  facultyCode: string;
  name: string;
  departments: { id: string; name: string }[];
}

interface Department {
  id: string;
  name: string;
  facultyId: string;
  faculty: { id: string; name: string };
  hod?: { name: string; staffProfile?: { staffId: string; surname: string; otherNames: string } };
  _count?: { programmes: number; courses: number };
}

interface AcademicProgramme {
  id: string;
  programmeCode: string;
  name: string;
  degreeTitle: string;
  departmentId: string;
  facultyId: string;
  level: string;
}

interface AcademicCourse {
  id: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  programmeId: string;
  departmentId: string;
  semester: string;
  session: string;
  level: number;
}

interface AllocationItem {
  id?: string;
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
}

interface StaffMatrixItem {
  staffProfileId: string;
  staffName: string;
  staffId: string;
  academicRank: string;
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
  overloadDeltaCU: number;
  underloadDeltaCU: number;
  allocations: AllocationItem[];
}

export default function CourseAllocationMatrixPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/academic/workload/allocation') {
      router.replace('/dashboard/academic/workload/allocation');
    }
  }, [pathname, router]);

  // State Filters
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<AcademicProgramme[]>([]);
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string>('cmp');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('CSI');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<string>('2026/2027');
  const [selectedSemester, setSelectedSemester] = useState<string>('FIRST_SEMESTER');

  // Matrix Data & Status
  const [loading, setLoading] = useState<boolean>(true);
  const [matrixData, setMatrixData] = useState<{
    department?: any;
    overallDocketStatus?: string;
    statistics?: any;
    staffMatrix: StaffMatrixItem[];
  }>({ staffMatrix: [] });

  // Pagination for Allocations Ledger
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal states
  const [showAllocateModal, setShowAllocateModal] = useState<boolean>(false);
  const [modalStaff, setModalStaff] = useState<StaffMatrixItem | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [assignedRole, setAssignedRole] = useState<string>('COURSE_COORDINATOR');
  const [assignedCU, setAssignedCU] = useState<number>(3);
  const [enrolledStudents, setEnrolledStudents] = useState<number>(150);
  const [courseMaterialCU, setCourseMaterialCU] = useState<number>(0);
  const [submittingAlloc, setSubmittingAlloc] = useState<boolean>(false);

  // Submit Docket Modal
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [docketRemarks, setDocketRemarks] = useState<string>('');
  const [submittingDocket, setSubmittingDocket] = useState<boolean>(false);

  // Success/Error Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Initial Load of Faculties & Structure
  useEffect(() => {
    async function loadStructure() {
      try {
        const [facRes, deptRes, progRes, courseRes] = await Promise.all([
          api.get('/api/v1/academic/faculties'),
          api.get('/api/v1/academic/departments'),
          api.get('/api/v1/academic/programmes'),
          api.get('/api/v1/academic/courses'),
        ]);

        setFaculties(facRes.data || []);
        setDepartments(deptRes.data || []);
        setProgrammes(progRes.data || []);
        setCourses(courseRes.data || []);

        if (deptRes.data?.length > 0) {
          const firstDept = deptRes.data.find((d: any) => d.facultyId === 'cmp') || deptRes.data[0];
          setSelectedDepartment(firstDept.id);
          setSelectedFaculty(firstDept.facultyId);
        }
      } catch (err) {
        console.error('Failed to load academic taxonomy:', err);
      }
    }
    loadStructure();
  }, []);

  // 2. Fetch Departmental Workload Matrix
  const fetchMatrix = async () => {
    if (!selectedDepartment) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.get(`/api/v1/academic/workload/department/${selectedDepartment}`, {
        params: { session: selectedSession, semester: selectedSemester },
      });
      setMatrixData(res.data || { staffMatrix: [] });
    } catch (err: any) {
      console.error('Error fetching workload matrix:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to fetch departmental workload matrix.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [selectedDepartment, selectedSession, selectedSemester]);

  // Handle Faculty Switch
  const handleFacultyChange = (facId: string) => {
    setSelectedFaculty(facId);
    const deptInFac = departments.filter((d) => d.facultyId === facId);
    if (deptInFac.length > 0) {
      setSelectedDepartment(deptInFac[0].id);
    }
  };

  // Open Allocation Modal for a Staff
  const handleOpenAllocateModal = (staff: StaffMatrixItem) => {
    setModalStaff(staff);
    const deptCourses = courses.filter((c) => c.departmentId === selectedDepartment && c.semester === selectedSemester);
    if (deptCourses.length > 0) {
      setSelectedCourseId(deptCourses[0].id);
      setAssignedCU(deptCourses[0].creditUnits);
    } else if (courses.length > 0) {
      setSelectedCourseId(courses[0].id);
      setAssignedCU(courses[0].creditUnits);
    }
    setEnrolledStudents(250);
    setCourseMaterialCU(0);
    setAssignedRole('COURSE_COORDINATOR');
    setShowAllocateModal(true);
  };

  // Submit Course Allocation
  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStaff || !selectedCourseId) return;

    setSubmittingAlloc(true);
    setFeedback(null);

    try {
      await api.post('/api/v1/academic/workload/allocate', {
        courseId: selectedCourseId,
        academicStaffId: modalStaff.staffProfileId,
        academicSession: selectedSession,
        semester: selectedSemester,
        role: assignedRole,
        assignedCreditUnits: assignedCU,
        enrolledStudentsCount: enrolledStudents,
        courseMaterialCreditUnits: courseMaterialCU,
      });

      setFeedback({ type: 'success', message: 'Course successfully allocated with updated ETE!' });
      setShowAllocateModal(false);
      fetchMatrix();
    } catch (err: any) {
      console.error('Error allocating course:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to save course allocation.' });
    } finally {
      setSubmittingAlloc(false);
    }
  };

  // Delete Allocation
  const handleDeleteAllocation = async (allocId: string, courseCode: string) => {
    if (!confirm(`Are you sure you want to revoke allocation for course ${courseCode}?`)) return;
    try {
      await api.delete(`/api/v1/academic/workload/allocation/${allocId}`);
      setFeedback({ type: 'success', message: `Allocation for ${courseCode} revoked successfully.` });
      fetchMatrix();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to revoke allocation.' });
    }
  };

  // Submit Docket to Dean
  const handleSubmitDocket = async () => {
    setSubmittingDocket(true);
    setFeedback(null);
    try {
      await api.put(`/api/v1/academic/workload/dockets/${selectedDepartment}/submit`, {
        session: selectedSession,
        semester: selectedSemester,
        remarks: docketRemarks,
      });
      setFeedback({ type: 'success', message: 'Departmental docket successfully submitted to Dean for authorization.' });
      setShowSubmitModal(false);
      fetchMatrix();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to submit docket to Dean.' });
    } finally {
      setSubmittingDocket(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const url = `${api.defaults.baseURL || ''}/api/v1/academic/workload/export-audit?session=${selectedSession}&semester=${selectedSemester}&format=csv`;
    window.open(url, '_blank');
  };

  // Filtered Programmes for the current department
  const filteredProgrammes = programmes.filter((p) => p.departmentId === selectedDepartment);

  // Flattened active allocations for table
  const allDepartmentAllocations = matrixData.staffMatrix.flatMap((staff) =>
    staff.allocations.map((a) => ({
      ...a,
      staffName: staff.staffName,
      staffId: staff.staffId,
      academicRank: staff.academicRank,
      staffProfileId: staff.staffProfileId,
    }))
  );

  const paginatedAllocations = allDepartmentAllocations.slice((page - 1) * pageSize, page * pageSize);

  // Selected Course details for modal preview
  const currentModalCourse = courses.find((c) => c.id === selectedCourseId);
  const previewETE = currentModalCourse
    ? Number((assignedCU + (enrolledStudents > 200 ? ((enrolledStudents - 200) / 500) * 0.5 : 0) + Number(courseMaterialCU || 0)).toFixed(2))
    : assignedCU;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-[#006533] to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-200 text-xs font-bold tracking-wider uppercase border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              NUC Benchmark Workload Allocation Subsystem
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              HOD Course Allocation &amp; Staff Capacity Matrix
            </h1>
            <p className="text-emerald-100 text-xs md:text-sm max-w-2xl font-medium">
              Statutory credit unit budgeting, ODL student cohort weighting, and maker-checker departmental workload ratification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export NUC Audit
            </button>
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={allDepartmentAllocations.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Submit Docket to Dean
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

      {/* Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Filter className="w-4 h-4 text-[#006533]" />
            Academic Taxonomy &amp; Term Scoping
          </div>
          <button
            onClick={fetchMatrix}
            disabled={loading}
            className="text-xs font-bold text-slate-600 hover:text-[#006533] flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Matrix
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Faculty Select */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Faculty
            </label>
            <select
              value={selectedFaculty}
              onChange={(e) => handleFacultyChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            >
              {faculties.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} ({fac.facultyCode})
                </option>
              ))}
            </select>
          </div>

          {/* Department Select */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            >
              {departments
                .filter((d) => d.facultyId === selectedFaculty)
                .map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.id})
                  </option>
                ))}
            </select>
          </div>

          {/* Programme Filter */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Programme Filter
            </label>
            <select
              value={selectedProgramme}
              onChange={(e) => setSelectedProgramme(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            >
              <option value="ALL">All Programmes ({filteredProgrammes.length})</option>
              {filteredProgrammes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.degreeTitle} {p.name}
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            >
              <option value="FIRST_SEMESTER">First Semester</option>
              <option value="SECOND_SEMESTER">Second Semester</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      {matrixData.statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Department Staff</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{matrixData.statistics.totalStaff}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">Academic Cadre Personnel</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Allocated Courses</span>
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{matrixData.statistics.totalAllocations}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">Active Course Units</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Overload Alerts</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600">{matrixData.statistics.totalOverloadCount}</div>
            <div className="text-[11px] text-rose-500 font-semibold mt-1">Exceeds cadre ceiling</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>NUC Compliance</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{matrixData.statistics.complianceRate}%</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              {matrixData.statistics.totalCompliantCount} of {matrixData.statistics.totalStaff} within norms
            </div>
          </div>
        </div>
      )}

      {/* Staff Capacity Cards & Meters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#006533]" />
            Academic Cadre Capacity &amp; Allocation Ledger
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {matrixData.staffMatrix.length} Academic Staff Registered
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Evaluating departmental workload metrics...</p>
          </div>
        ) : matrixData.staffMatrix.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No academic staff members found in this department.</p>
            <p className="text-xs text-slate-400 mt-1">Select another department or add academic staff.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matrixData.staffMatrix.map((staff) => {
              const maxCU = staff.effectivePermissibleMaxCU || 10;
              const totalCU = staff.totalAssignedCreditUnits + staff.totalCourseMaterialCreditUnits;
              const percentage = Math.min(100, Math.round((totalCU / (maxCU || 1)) * 100));

              return (
                <div
                  key={staff.staffProfileId}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight">{staff.staffName}</h3>
                        <p className="text-[11px] font-bold text-slate-400">{staff.staffId}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wide">
                        {staff.academicRank}
                      </span>
                    </div>

                    {staff.administrativeRole && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                        <Info className="w-3 h-3" />
                        {staff.administrativeRole} ({staff.administrativeRebateCU} CU Relief)
                      </div>
                    )}

                    {/* Capacity Progress Meter */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-600">
                          {totalCU.toFixed(1)} / {maxCU} CU
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            staff.statusColor === 'emerald'
                              ? 'bg-emerald-100 text-emerald-800'
                              : staff.statusColor === 'red'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {staff.statusLabel}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            staff.statusColor === 'emerald'
                              ? 'bg-emerald-500'
                              : staff.statusColor === 'red'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                        <span>Min: {staff.effectiveRequiredMinCU} CU</span>
                        <span>Max: {maxCU} CU</span>
                      </div>
                    </div>

                    {/* Weekly Contact & ETE Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 font-bold block">Contact Hours</span>
                        <span className="text-slate-800 font-black">
                          {staff.totalWeeklyContactHours.toFixed(1)} hrs/wk (Max {staff.cadreMaxContactHours})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Effective Teaching Eq.</span>
                        <span className="text-emerald-700 font-black">{staff.totalEffectiveTeachingEquivalent.toFixed(1)} ETE</span>
                      </div>
                    </div>
                  </div>

                  {/* Allocate Action */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenAllocateModal(staff)}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#006533] rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Allocate Course Unit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Allocations Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#006533]" />
              Allocated Courses &amp; Teaching Schedule Breakdown
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Verified allocation docket for {selectedSession} • {selectedSemester.replace('_', ' ')}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            Total {allDepartmentAllocations.length} Allocations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">Course Code</th>
                <th className="py-3 px-4">Course Title</th>
                <th className="py-3 px-4">Lecturer</th>
                <th className="py-3 px-4">Cadre</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">CU</th>
                <th className="py-3 px-4 text-center">Cohort</th>
                <th className="py-3 px-4 text-center">Contact Hrs</th>
                <th className="py-3 px-4 text-center">ETE</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedAllocations.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 font-bold">
                    No course allocations recorded for this semester yet.
                  </td>
                </tr>
              ) : (
                paginatedAllocations.map((alloc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-black text-slate-900">{alloc.courseCode}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{alloc.courseTitle}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{alloc.staffName}</td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 font-semibold">{alloc.academicRank}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                        {alloc.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-black">{alloc.assignedCreditUnits}</td>
                    <td className="py-3 px-4 text-center">{alloc.enrolledStudentsCount}</td>
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
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => alloc.id && handleDeleteAllocation(alloc.id, alloc.courseCode)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50"
                        title="Revoke Allocation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {allDepartmentAllocations.length > pageSize && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(allDepartmentAllocations.length / pageSize)}
            totalItems={allDepartmentAllocations.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Course Allocation Modal */}
      {showAllocateModal && modalStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Allocate Academic Course Unit</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Lecturer: <span className="text-[#006533]">{modalStaff.staffName}</span> ({modalStaff.academicRank})
                </p>
              </div>
              <button onClick={() => setShowAllocateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAllocation} className="space-y-4">
              {/* Course Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Select Course Unit</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    const selected = courses.find((c) => c.id === e.target.value);
                    if (selected) setAssignedCU(selected.creditUnits);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                >
                  {courses
                    .filter((c) => c.departmentId === selectedDepartment)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.courseCode} - {c.courseTitle} ({c.creditUnits} CU)
                      </option>
                    ))}
                </select>
              </div>

              {/* Allocation Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Teaching Role</label>
                  <select
                    value={assignedRole}
                    onChange={(e) => setAssignedRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="COURSE_COORDINATOR">Course Coordinator</option>
                    <option value="LEAD_LECTURER">Lead Lecturer</option>
                    <option value="CO_LECTURER">Co-Lecturer</option>
                    <option value="PRACTICAL_INSTRUCTOR">Practical Instructor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Assigned Credit Units</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    step="0.5"
                    value={assignedCU}
                    onChange={(e) => setAssignedCU(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Enrolled Students & Course Material Bonus */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Enrolled Students (ODL Cohort)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={enrolledStudents}
                    onChange={(e) => setEnrolledStudents(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Bonus kicks in for cohorts &gt; 200</span>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Course Material Dev Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    step="1"
                    value={courseMaterialCU}
                    onChange={(e) => setCourseMaterialCU(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400">+3.0 CU if written/reviewed</span>
                </div>
              </div>

              {/* Real-time ETE Computation Preview */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950">Calculated Effective Teaching Eq. (ETE)</span>
                  <span className="text-base font-black text-emerald-700">{previewETE} ETE</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                  Formula: Base ({assignedCU} CU) + Cohort Scaling ({enrolledStudents > 200 ? (((enrolledStudents - 200) / 500) * 0.5).toFixed(2) : 0} CU) + Course Material ({courseMaterialCU} CU).
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAlloc}
                  className="px-5 py-2 bg-[#006533] hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingAlloc && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Docket Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
                <FileCheck className="w-5 h-5 text-[#006533]" />
                Submit Departmental Workload Docket
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 font-medium">
              <p>
                You are about to officially submit the <strong>{selectedSession} ({selectedSemester.replace('_', ' ')})</strong> teaching workload docket for{' '}
                <strong>{matrixData.department?.name || selectedDepartment}</strong> to the Faculty Dean for formal authorization.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <div className="font-black flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Maker-Checker Protocol Notice
                </div>
                <p className="text-[11px]">
                  Allocations will transition to <span className="font-bold">SUBMITTED_BY_HOD</span> and lock from further direct edits until approved or returned by the Dean.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">HOD Remarks / Justification</label>
                <textarea
                  rows={3}
                  value={docketRemarks}
                  onChange={(e) => setDocketRemarks(e.target.value)}
                  placeholder="Enter any notes on staffing ratios, laboratory supervision, or overload waivers..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitDocket}
                disabled={submittingDocket}
                className="px-5 py-2.5 bg-[#006533] hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                {submittingDocket && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Submit Docket to Dean
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
