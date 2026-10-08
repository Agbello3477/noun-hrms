'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Users,
  GraduationCap,
  Award,
  UserCheck,
  Briefcase,
  FileCheck,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  RefreshCw,
  Plus,
  BookOpen,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  ExternalLink,
  Download,
  BarChart3,
  TrendingUp,
  Clock,
  Check,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

interface CourseAllocationInfo {
  id: string;
  courseId: string;
  assignedCreditUnits?: number | null;
  role: string;
  allocationStatus: string;
  enrolledStudentsCount?: number;
  academicStaff?: {
    id: string;
    staffId: string;
    surname?: string;
    otherNames?: string;
    title?: string;
    rank?: string;
    currentAcademicRank?: string;
    user?: { id: string; name: string; email: string };
  };
  course?: {
    courseCode: string;
    courseTitle: string;
    creditUnits: number;
  };
}

interface CourseInfo {
  id: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  lectureHours?: number;
  tutorialHours?: number;
  practicalHours?: number;
  programme?: { id: string; name: string; code?: string };
  allocations: CourseAllocationInfo[];
}

interface LecturerInfo {
  id: string;
  userId: string;
  staffId: string;
  surname: string;
  otherNames: string;
  title?: string;
  rank?: string;
  currentAcademicRank?: string;
  totalAllocatedCredits?: number;
  allocationsCount?: number;
  courseAllocations?: CourseAllocationInfo[];
  user?: { id: string; name: string; email: string; role: string };
}

interface DepartmentNode {
  id: string;
  code?: string | null;
  name: string;
  facultyId: string;
  hodId?: string | null;
  hod?: { id: string; name: string; email: string; role: string; staffProfile?: any } | null;
  examOfficerId?: string | null;
  examOfficer?: { id: string; name: string; email: string; role: string; staffProfile?: any } | null;
  departmentAdminId?: string | null;
  departmentAdmin?: { id: string; name: string; email: string; role: string; staffProfile?: any } | null;
  programmes?: { id: string; name: string; code?: string; degreeType?: string }[];
  courses?: CourseInfo[];
  lecturersCount: number;
  lecturers: LecturerInfo[];
  _count?: { programmes: number; courses: number; complaints: number };
}

interface FacultyHierarchyNode {
  id: string;
  facultyCode: string;
  name: string;
  deanId?: string | null;
  dean?: { id: string; name: string; email: string; role: string; staffProfile?: any } | null;
  facultyOfficerId?: string | null;
  facultyOfficer?: { id: string; name: string; email: string; role: string; staffProfile?: any } | null;
  facultySecretaryId?: string | null;
  facultySecretary?: { id: string; name: string; email: string; role: string; staffProfile?: any } | null;
  departments: DepartmentNode[];
}

const AUTHORIZED_ROLES = [
  'REGISTRAR',
  'DEPUTY_REGISTRAR',
  'REGISTRY_ADMIN',
  'HR_ADMIN',
  'VICE_CHANCELLOR',
  'SUPER_USER',
  'ADMIN'
];

export default function AcademicHierarchyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthorized = user && AUTHORIZED_ROLES.includes(user.role);

  useEffect(() => {
    if (pathname === '/academic/hierarchy') {
      router.replace('/dashboard/academic/hierarchy');
    }
  }, [pathname, router]);

  useEffect(() => {
    if (user && !AUTHORIZED_ROLES.includes(user.role)) {
      router.push('/dashboard/access-denied');
    }
  }, [user, router]);

  const [loading, setLoading] = useState<boolean>(true);
  const [faculties, setFaculties] = useState<FacultyHierarchyNode[]>([]);
  const [expandedFacultyId, setExpandedFacultyId] = useState<string | null>(null);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facultyFilter, setFacultyFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'GOVERNANCE' | 'ALLOCATIONS' | 'PROMOTION_KPI'>('GOVERNANCE');

  // Officers Modal State
  const [showFacultyModal, setShowFacultyModal] = useState<boolean>(false);
  const [showDeptModal, setShowDeptModal] = useState<boolean>(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyHierarchyNode | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentNode | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Faculty form values
  const [editDeanId, setEditDeanId] = useState<string>('');
  const [editFacultyOfficerId, setEditFacultyOfficerId] = useState<string>('');
  const [editFacultySecretaryId, setEditFacultySecretaryId] = useState<string>('');

  // Department form values
  const [editHodId, setEditHodId] = useState<string>('');
  const [editExamOfficerId, setEditExamOfficerId] = useState<string>('');
  const [editDeptAdminId, setEditDeptAdminId] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchHierarchy = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.get('/api/v1/academic/faculties/hierarchy');
      const data: FacultyHierarchyNode[] = Array.isArray(res.data) ? res.data : [];
      setFaculties(data);
      if (data.length > 0 && !expandedFacultyId) {
        setExpandedFacultyId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching academic hierarchy:', err);
      setFeedback({ type: 'error', message: 'Failed to load faculty hierarchy. Access restricted.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setAllUsers(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchHierarchy();
      fetchUsers();
    }
  }, [isAuthorized]);

  const handleOpenFacultyModal = (fac: FacultyHierarchyNode) => {
    setSelectedFaculty(fac);
    setEditDeanId(fac.dean?.id || '');
    setEditFacultyOfficerId(fac.facultyOfficer?.id || '');
    setEditFacultySecretaryId(fac.facultySecretary?.id || '');
    setShowFacultyModal(true);
  };

  const handleSaveFacultyOfficers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setSubmitting(true);
    try {
      await api.put(`/api/v1/academic/faculties/${selectedFaculty.id}/officers`, {
        deanId: editDeanId || null,
        facultyOfficerId: editFacultyOfficerId || null,
        facultySecretaryId: editFacultySecretaryId || null,
      });
      setFeedback({ type: 'success', message: `Faculty Officers updated for ${selectedFaculty.name}!` });
      setShowFacultyModal(false);
      fetchHierarchy();
    } catch (err: any) {
      console.error('Error updating faculty officers:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to update faculty officers.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeptModal = (dept: DepartmentNode) => {
    setSelectedDept(dept);
    setEditHodId(dept.hod?.id || '');
    setEditExamOfficerId(dept.examOfficer?.id || '');
    setEditDeptAdminId(dept.departmentAdmin?.id || '');
    setShowDeptModal(true);
  };

  const handleSaveDeptOfficers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    setSubmitting(true);
    try {
      await api.put(`/api/v1/academic/departments/${selectedDept.id}/officers`, {
        hodId: editHodId || null,
        examOfficerId: editExamOfficerId || null,
        departmentAdminId: editDeptAdminId || null,
      });
      setFeedback({ type: 'success', message: `Department Officers updated for ${selectedDept.name}!` });
      setShowDeptModal(false);
      fetchHierarchy();
    } catch (err: any) {
      console.error('Error updating department officers:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to update department officers.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregated KPI Metrics
  const totalFaculties = faculties.length;
  const totalDepartments = faculties.reduce((acc, f) => acc + f.departments.length, 0);
  const totalLecturers = faculties.reduce((acc, f) => acc + f.departments.reduce((dAcc, d) => dAcc + (d.lecturersCount || 0), 0), 0);
  
  // All courses and allocations flat list
  const allCoursesFlat = useMemo(() => {
    const list: {
      faculty: FacultyHierarchyNode;
      department: DepartmentNode;
      course: CourseInfo;
      allocation?: CourseAllocationInfo;
    }[] = [];

    faculties.forEach(f => {
      f.departments.forEach(d => {
        (d.courses || []).forEach(c => {
          if (!c.allocations || c.allocations.length === 0) {
            list.push({ faculty: f, department: d, course: c });
          } else {
            c.allocations.forEach(a => {
              list.push({ faculty: f, department: d, course: c, allocation: a });
            });
          }
        });
      });
    });
    return list;
  }, [faculties]);

  // All lecturers flat list for KPI & Promotion
  const allLecturersFlat = useMemo(() => {
    const list: {
      faculty: FacultyHierarchyNode;
      department: DepartmentNode;
      lecturer: LecturerInfo;
    }[] = [];

    faculties.forEach(f => {
      f.departments.forEach(d => {
        (d.lecturers || []).forEach(l => {
          list.push({ faculty: f, department: d, lecturer: l });
        });
      });
    });
    return list;
  }, [faculties]);

  const totalAllocations = allCoursesFlat.filter(c => c.allocation).length;
  const approvedByDeanCount = allCoursesFlat.filter(c => c.allocation?.allocationStatus === 'APPROVED_BY_DEAN' || c.allocation?.allocationStatus === 'RATIFIED_ACADEMIC_PLANNING').length;

  // Filter faculties by query and dropdown
  const filteredFaculties = faculties.filter((f) => {
    const matchesFacultyFilter = facultyFilter === 'ALL' || f.id === facultyFilter;
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      f.name.toLowerCase().includes(term) ||
      f.facultyCode.toLowerCase().includes(term) ||
      f.departments.some((d) => 
        d.name.toLowerCase().includes(term) ||
        (d.code || '').toLowerCase().includes(term) ||
        (d.hod?.name || '').toLowerCase().includes(term) ||
        (d.lecturers || []).some(l => `${l.surname} ${l.otherNames} ${l.staffId}`.toLowerCase().includes(term))
      );
    return matchesFacultyFilter && matchesSearch;
  });

  // Filter courses flat
  const filteredCourses = allCoursesFlat.filter(item => {
    const matchesFaculty = facultyFilter === 'ALL' || item.faculty.id === facultyFilter;
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      item.course.courseCode.toLowerCase().includes(term) ||
      item.course.courseTitle.toLowerCase().includes(term) ||
      item.department.name.toLowerCase().includes(term) ||
      item.faculty.name.toLowerCase().includes(term) ||
      (item.allocation?.academicStaff?.surname || '').toLowerCase().includes(term) ||
      (item.allocation?.academicStaff?.otherNames || '').toLowerCase().includes(term) ||
      (item.allocation?.academicStaff?.staffId || '').toLowerCase().includes(term);
    return matchesFaculty && matchesSearch;
  });

  // Filter lecturers flat
  const filteredLecturers = allLecturersFlat.filter(item => {
    const matchesFaculty = facultyFilter === 'ALL' || item.faculty.id === facultyFilter;
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      item.lecturer.surname.toLowerCase().includes(term) ||
      item.lecturer.otherNames.toLowerCase().includes(term) ||
      item.lecturer.staffId.toLowerCase().includes(term) ||
      (item.lecturer.currentAcademicRank || item.lecturer.rank || '').toLowerCase().includes(term) ||
      item.department.name.toLowerCase().includes(term) ||
      item.faculty.name.toLowerCase().includes(term);
    return matchesFaculty && matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = [
      'Faculty Code',
      'Faculty Name',
      'Dean',
      'Faculty Officer',
      'Department',
      'HOD',
      'Exam Officer',
      'Staff ID',
      'Lecturer Name',
      'Academic Rank',
      'Allocated Credits',
      'Courses Count'
    ];

    const rows: string[][] = [];

    faculties.forEach(f => {
      f.departments.forEach(d => {
        if (d.lecturers.length === 0) {
          rows.push([
            `"${f.facultyCode}"`,
            `"${f.name}"`,
            `"${f.dean?.name || 'Unassigned'}"`,
            `"${f.facultyOfficer?.name || 'Unassigned'}"`,
            `"${d.name}"`,
            `"${d.hod?.name || 'Unassigned'}"`,
            `"${d.examOfficer?.name || 'Unassigned'}"`,
            `"N/A"`,
            `"No Lecturers Assigned"`,
            `"N/A"`,
            `"0"`,
            `"0"`
          ]);
        } else {
          d.lecturers.forEach(l => {
            rows.push([
              `"${f.facultyCode}"`,
              `"${f.name}"`,
              `"${f.dean?.name || 'Unassigned'}"`,
              `"${f.facultyOfficer?.name || 'Unassigned'}"`,
              `"${d.name}"`,
              `"${d.hod?.name || 'Unassigned'}"`,
              `"${d.examOfficer?.name || 'Unassigned'}"`,
              `"${l.staffId}"`,
              `"${l.surname} ${l.otherNames}"`,
              `"${l.currentAcademicRank || l.rank || 'Lecturer'}"`,
              `"${l.totalAllocatedCredits || 0}"`,
              `"${l.allocationsCount || 0}"`
            ]);
          });
        }
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NOUN_Faculty_Hierarchy_Workload_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-3xl mx-auto my-12 bg-white rounded-3xl border border-rose-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Access Restricted &bull; Executive Academic Governance</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Faculty Hierarchy, Departmental Allocations, and Hierarchical Governance records are strictly restricted to the University Vice-Chancellor, Registrar, and Registry Administration.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Executive Command Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-[#006533] to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.04] bg-[size:24px_24px] pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wider uppercase border border-emerald-400/30 backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Executive Oversight &bull; VC &bull; Registrar &bull; Registry Administration
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Faculty Hierarchy &amp; Academic Governance Cockpit
            </h1>
            <p className="text-emerald-100/90 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              University-wide hierarchical governance from Deans &amp; Faculty Officers to Heads of Department (HOD), Examination Officers, Departmental Administrators, and Academic Lecturers for statutory decision making, promotions, and staff KPI evaluation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-black shadow-md transition backdrop-blur-xs"
            >
              <Download className="w-4 h-4" />
              Export Audit CSV
            </button>
            <button
              onClick={fetchHierarchy}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Roster
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Faculties</span>
            <Building2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalFaculties}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Instituted Faculties</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Departments</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalDepartments}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Academic Units</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Academic Staff</span>
            <Users className="w-4 h-4 text-[#006533]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalLecturers}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active Lecturers</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Allocations Ratified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">{approvedByDeanCount} / {totalAllocations}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dean Approved Courses</div>
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

      {/* Navigation Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 pt-3 rounded-t-2xl shadow-2xs">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('GOVERNANCE')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'GOVERNANCE'
                ? 'border-[#006533] text-[#006533] bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Faculty &amp; Department Governance Tree</span>
          </button>

          <button
            onClick={() => setActiveTab('ALLOCATIONS')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'ALLOCATIONS'
                ? 'border-[#006533] text-[#006533] bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>All Department Course Allocations Matrix</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              {allCoursesFlat.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PROMOTION_KPI')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'PROMOTION_KPI'
                ? 'border-[#006533] text-[#006533] bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Academic Staff KPI &amp; Promotion Audit</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800">
              {totalLecturers}
            </span>
          </button>
        </div>

        {/* Search & Faculty Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pb-2">
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty, HOD, course, lecturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select
            value={facultyFilter}
            onChange={(e) => setFacultyFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="ALL">All Faculties ({faculties.length})</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.facultyCode} - {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-24 text-center bg-white rounded-b-2xl border border-t-0 border-slate-200/80 shadow-xs">
          <RefreshCw className="w-8 h-8 text-[#006533] animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">Compiling complete institutional faculty hierarchy...</p>
        </div>
      ) : activeTab === 'GOVERNANCE' ? (
        /* TAB 1: FACULTY & DEPARTMENT GOVERNANCE TREE */
        <div className="space-y-6">
          {filteredFaculties.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No faculties found matching criteria.</p>
            </div>
          ) : (
            filteredFaculties.map((fac) => {
              const isFacExpanded = expandedFacultyId === fac.id;

              return (
                <div
                  key={fac.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition"
                >
                  {/* Faculty Card Header */}
                  <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-emerald-300 text-xs font-black uppercase tracking-wider">
                          {fac.facultyCode}
                        </span>
                        <h2 className="text-lg md:text-xl font-black">{fac.name}</h2>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        {fac.departments.length} Academic Departments &bull; {fac.departments.reduce((acc, d) => acc + (d.lecturersCount || 0), 0)} Total Lecturers
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        onClick={() => handleOpenFacultyModal(fac)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-bold text-white transition"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configure Officers
                      </button>
                      <button
                        onClick={() => setExpandedFacultyId(isFacExpanded ? null : fac.id)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition"
                      >
                        {isFacExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Faculty Principal Officers Tier */}
                  <div className="p-5 bg-slate-50/70 border-b border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Dean */}
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-black shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider">Dean of Faculty</div>
                        <div className="font-black text-slate-900">{fac.dean?.name || 'Unassigned Dean'}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{fac.dean?.email || 'Executive head of the faculty'}</div>
                      </div>
                    </div>

                    {/* Faculty Officer */}
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#006533] text-white flex items-center justify-center font-black shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold text-[#006533] uppercase tracking-wider">Faculty Officer (Head of Admin)</div>
                        <div className="font-black text-slate-900">{fac.facultyOfficer?.name || 'Unassigned Faculty Officer'}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{fac.facultyOfficer?.email || 'Principal administrative officer'}</div>
                      </div>
                    </div>

                    {/* Faculty Secretary */}
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">Faculty Secretary</div>
                        <div className="font-black text-slate-900">{fac.facultySecretary?.name || 'Unassigned Secretary'}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{fac.facultySecretary?.email || 'Faculty secretariat records'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Departments Breakdown */}
                  {isFacExpanded && (
                    <div className="p-6 space-y-4">
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#006533]" />
                        Constituent Academic Departments ({fac.departments.length})
                      </h3>

                      <div className="grid grid-cols-1 gap-4">
                        {fac.departments.map((dept) => {
                          const isDeptExpanded = expandedDeptId === dept.id;

                          return (
                            <div
                              key={dept.id}
                              className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs"
                            >
                              {/* Department Summary Header */}
                              <div className="p-4 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-sm text-slate-900">{dept.name}</span>
                                    {dept.code && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[#006533] text-[10px] font-black">
                                        {dept.code}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium">
                                    {dept.lecturersCount} Academic Lecturers &bull; {dept._count?.courses || (dept.courses?.length || 0)} Courses &bull; {dept._count?.programmes || (dept.programmes?.length || 0)} Programmes
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                  <button
                                    onClick={() => handleOpenDeptModal(dept)}
                                    className="px-2.5 py-1 text-xs font-bold text-[#006533] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                                  >
                                    Appoint Officers
                                  </button>
                                  <button
                                    onClick={() => setExpandedDeptId(isDeptExpanded ? null : dept.id)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                                  >
                                    {isDeptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>

                              {/* Department Officers Tier */}
                              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-white">
                                {/* HOD */}
                                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5">
                                  <Award className="w-4 h-4 text-[#006533] mt-0.5 shrink-0" />
                                  <div>
                                    <span className="text-[10px] font-extrabold text-[#006533] uppercase block">Head of Department (HOD)</span>
                                    <span className="font-bold text-slate-900 block">{dept.hod?.name || 'Unassigned HOD'}</span>
                                    <span className="text-[10px] text-slate-500 block">{dept.hod?.email || 'Conducts course allocations'}</span>
                                  </div>
                                </div>

                                {/* Exam Officer */}
                                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-2.5">
                                  <FileCheck className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="text-[10px] font-extrabold text-blue-700 uppercase block">Examination Officer</span>
                                    <span className="font-bold text-slate-900 block">{dept.examOfficer?.name || 'Unassigned Exam Officer'}</span>
                                    <span className="text-[10px] text-slate-500 block">{dept.examOfficer?.email || 'Exams and grading audit'}</span>
                                  </div>
                                </div>

                                {/* Department Admin */}
                                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-start gap-2.5">
                                  <Briefcase className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="text-[10px] font-extrabold text-purple-700 uppercase block">Departmental Admin</span>
                                    <span className="font-bold text-slate-900 block">{dept.departmentAdmin?.name || 'Unassigned Admin'}</span>
                                    <span className="text-[10px] text-slate-500 block">{dept.departmentAdmin?.email || 'Departmental secretariat'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Department Lecturers Roster */}
                              {isDeptExpanded && (
                                <div className="p-4 border-t border-slate-100 bg-slate-50/40 space-y-3">
                                  <div className="font-extrabold text-xs text-slate-800 flex items-center justify-between">
                                    <span>Departmental Academic Lecturers ({dept.lecturers.length})</span>
                                  </div>

                                  {dept.lecturers.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-3">No lecturers currently assigned to this department.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                      {dept.lecturers.map((lect) => (
                                        <div
                                          key={lect.id}
                                          className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs space-y-1.5"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="font-black text-slate-900">
                                                {lect.title ? `${lect.title} ` : ''}{lect.surname} {lect.otherNames}
                                              </div>
                                              <div className="text-[10px] text-slate-500 font-semibold font-mono">
                                                {lect.staffId}
                                              </div>
                                            </div>
                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                                              {lect.currentAcademicRank || lect.rank || 'Lecturer'}
                                            </span>
                                          </div>
                                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                                            <span>Allocated: <strong>{lect.totalAllocatedCredits || 0} CU</strong> ({lect.allocationsCount || 0} Courses)</span>
                                            <span className="text-[#006533] font-bold">Active</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === 'ALLOCATIONS' ? (
        /* TAB 2: ALL DEPARTMENTS COURSE ALLOCATIONS MATRIX */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">All Departments Course Allocation Matrix</h3>
              <p className="text-xs text-slate-500">Statutory teaching workload and Dean approval status across all faculties.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-[#006533] font-black text-xs rounded-full border border-emerald-200 self-start sm:self-auto">
              {filteredCourses.length} Courses
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Faculty / Department</th>
                  <th className="px-4 py-3">Assigned Lecturer</th>
                  <th className="px-4 py-3 text-center">Credit Units</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No course allocations found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((item, idx) => {
                    const status = item.allocation?.allocationStatus || 'UNALLOCATED';
                    const isApproved = status === 'APPROVED_BY_DEAN' || status === 'RATIFIED_ACADEMIC_PLANNING';
                    const isSubmitted = status === 'SUBMITTED_BY_HOD';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold">
                          <div className="font-mono font-black text-slate-900">{item.course.courseCode}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{item.course.courseTitle}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{item.department.name}</div>
                          <div className="text-[10px] text-slate-400">{item.faculty.facultyCode}</div>
                        </td>
                        <td className="px-4 py-3">
                          {item.allocation?.academicStaff ? (
                            <div>
                              <div className="font-bold text-slate-900">
                                {item.allocation.academicStaff.surname} {item.allocation.academicStaff.otherNames}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.allocation.academicStaff.staffId} &bull; {item.allocation.academicStaff.currentAcademicRank || item.allocation.academicStaff.rank || 'Lecturer'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">
                              Unallocated
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {item.allocation?.assignedCreditUnits || item.course.creditUnits} CU
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.allocation?.role || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" /> Dean Approved
                            </span>
                          ) : isSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                              <Clock className="w-3 h-3" /> Submitted to Dean
                            </span>
                          ) : status === 'DRAFT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                              HOD Draft
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
                              Unassigned
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 3: ACADEMIC STAFF KPI & PROMOTION AUDIT */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Academic Staff KPI &amp; Promotion Maturity Audit</h3>
              <p className="text-xs text-slate-500">Statutory teaching workload volume, rank distribution, and promotion eligibility metrics.</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-800 font-black text-xs rounded-full border border-slate-200 self-start sm:self-auto">
              {filteredLecturers.length} Academic Personnel
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Academic Personnel</th>
                  <th className="px-4 py-3">Faculty / Department</th>
                  <th className="px-4 py-3">Substantive Rank</th>
                  <th className="px-4 py-3 text-center">Allocated Courses</th>
                  <th className="px-4 py-3 text-center">Assigned Credits</th>
                  <th className="px-4 py-3 text-center">Workload KPI Compliance</th>
                  <th className="px-4 py-3 text-center">Promotion Waiting Cycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLecturers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No academic personnel found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLecturers.map((item, idx) => {
                    const credits = item.lecturer.totalAllocatedCredits || 0;
                    const courses = item.lecturer.allocationsCount || 0;

                    let kpiBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        Standard (9–12 CU)
                      </span>
                    );
                    if (credits < 6) {
                      kpiBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                          Under-Allocated (&lt;6 CU)
                        </span>
                      );
                    } else if (credits > 15) {
                      kpiBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                          High Workload (&gt;15 CU)
                        </span>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {item.lecturer.title ? `${item.lecturer.title} ` : ''}{item.lecturer.surname} {item.lecturer.otherNames}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.lecturer.staffId}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{item.department.name}</div>
                          <div className="text-[10px] text-slate-400">{item.faculty.name}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {item.lecturer.currentAcademicRank || item.lecturer.rank || 'Lecturer'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {courses}
                        </td>
                        <td className="px-4 py-3 text-center font-black text-slate-900">
                          {credits} CU
                        </td>
                        <td className="px-4 py-3 text-center">
                          {kpiBadge}
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] font-bold text-slate-600">
                          Academic (3 Years &bull; Oct 1)
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

      {/* Faculty Officers Modal */}
      {showFacultyModal && selectedFaculty && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Settings className="w-5 h-5 text-indigo-600" />
                Configure Faculty Officers
              </div>
              <button onClick={() => setShowFacultyModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFacultyOfficers} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-extrabold text-slate-900">{selectedFaculty.name}</div>
                <div className="text-slate-500 text-[11px]">Faculty Code: {selectedFaculty.facultyCode}</div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Dean of Faculty</label>
                <select
                  value={editDeanId}
                  onChange={(e) => setEditDeanId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- No Designated Dean --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Faculty Officer (Head of Administration)</label>
                <select
                  value={editFacultyOfficerId}
                  onChange={(e) => setEditFacultyOfficerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- No Designated Faculty Officer --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Faculty Secretary</label>
                <select
                  value={editFacultySecretaryId}
                  onChange={(e) => setEditFacultySecretaryId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- No Designated Faculty Secretary --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFacultyModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Appointments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Officers Modal */}
      {showDeptModal && selectedDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Settings className="w-5 h-5 text-[#006533]" />
                Appoint Department Officers
              </div>
              <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDeptOfficers} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-extrabold text-slate-900">{selectedDept.name}</div>
                <div className="text-slate-500 text-[11px]">Department ID: {selectedDept.id}</div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Head of Department (HOD)</label>
                <select
                  value={editHodId}
                  onChange={(e) => setEditHodId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- No Designated HOD --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">Conducts course allocations and departmental academic administration.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Examination Officer</label>
                <select
                  value={editExamOfficerId}
                  onChange={(e) => setEditExamOfficerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- No Designated Exam Officer --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">Oversees departmental examinations and grading audit.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800">Departmental Administrative Officer</label>
                <select
                  value={editDeptAdminId}
                  onChange={(e) => setEditDeptAdminId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- No Designated Departmental Admin --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">Coordinates departmental student files and administrative documentation.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#006533] hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Appointments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
