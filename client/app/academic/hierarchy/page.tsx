'use client';

import React, { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

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
  departments: {
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
    lecturersCount: number;
    lecturers: any[];
    _count?: { programmes: number; courses: number; complaints: number };
  }[];
}

export default function AcademicHierarchyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/academic/hierarchy') {
      router.replace('/dashboard/academic/hierarchy');
    }
  }, [pathname, router]);

  const [loading, setLoading] = useState<boolean>(true);
  const [faculties, setFaculties] = useState<FacultyHierarchyNode[]>([]);
  const [expandedFacultyId, setExpandedFacultyId] = useState<string | null>(null);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Officers Modal State
  const [showFacultyModal, setShowFacultyModal] = useState<boolean>(false);
  const [showDeptModal, setShowDeptModal] = useState<boolean>(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyHierarchyNode | null>(null);
  const [selectedDept, setSelectedDept] = useState<any | null>(null);
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
      setFaculties(res.data || []);
      if (res.data?.length > 0 && !expandedFacultyId) {
        setExpandedFacultyId(res.data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching academic hierarchy:', err);
      setFeedback({ type: 'error', message: 'Failed to load faculty hierarchy.' });
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
    fetchHierarchy();
    fetchUsers();
  }, []);

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

  const handleOpenDeptModal = (dept: any) => {
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

  const canManageOfficers = ['SUPER_USER', 'VICE_CHANCELLOR', 'REGISTRAR', 'HR_ADMIN', 'ADMIN'].includes(user?.role || '');

  // Filter faculties
  const filteredFaculties = faculties.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.facultyCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.departments.some((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#006533] to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-200 text-xs font-bold tracking-wider uppercase border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              University Academic Structure &amp; Governance
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Faculty &amp; Departmental Hierarchy Architecture
            </h1>
            <p className="text-emerald-100 text-xs md:text-sm max-w-2xl font-medium">
              Hierarchical governance from Dean &amp; Faculty Officers to Heads of Department (HOD), Examination Officers, Departmental Administrators, and Academic Lecturers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/academic/workload/allocation"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-md transition"
            >
              <BookOpen className="w-4 h-4" />
              HOD Allocation Desk
            </Link>
            <Link
              href="/dashboard/faculty/workload/review"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#006533] hover:bg-emerald-50 rounded-xl text-xs font-black shadow-md transition"
            >
              <Award className="w-4 h-4" />
              Dean Cockpit
            </Link>
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

      {/* Search & Actions Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search faculties, departments, or codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHierarchy}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Hierarchy
          </button>
        </div>
      </div>

      {/* Hierarchy Visual Nodes */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">Loading comprehensive faculty hierarchy...</p>
        </div>
      ) : filteredFaculties.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No faculties match your search query.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredFaculties.map((fac) => {
            const isFacExpanded = expandedFacultyId === fac.id;

            return (
              <div
                key={fac.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition"
              >
                {/* Faculty Card Header */}
                <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-emerald-300 text-xs font-black uppercase tracking-wider">
                        {fac.facultyCode}
                      </span>
                      <h2 className="text-lg md:text-xl font-black">{fac.name}</h2>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      {fac.departments.length} Academic Departments • {fac.departments.reduce((acc, d) => acc + (d.lecturersCount || 0), 0)} Total Lecturers
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {canManageOfficers && (
                      <button
                        onClick={() => handleOpenFacultyModal(fac)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-bold text-white transition"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configure Officers
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedFacultyId(isFacExpanded ? null : fac.id)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition"
                    >
                      {isFacExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Faculty Principal Officers Row */}
                <div className="p-5 bg-slate-50/70 border-b border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Dean */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start gap-3">
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
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start gap-3">
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
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start gap-3">
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

                {/* Expanded Departments Breakdown */}
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
                            className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs"
                          >
                            {/* Department Summary Row */}
                            <div className="p-4 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
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
                                  {dept.lecturersCount} Academic Lecturers • {dept._count?.courses || 0} Courses • {dept._count?.programmes || 0} Programmes
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                {canManageOfficers && (
                                  <button
                                    onClick={() => handleOpenDeptModal(dept)}
                                    className="px-2.5 py-1 text-xs font-bold text-[#006533] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                                  >
                                    Appoint Officers
                                  </button>
                                )}
                                <Link
                                  href={`/dashboard/academic/workload/allocation?departmentId=${dept.id}`}
                                  className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition inline-flex items-center gap-1"
                                >
                                  Allocation Desk
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </Link>
                                <button
                                  onClick={() => setExpandedDeptId(isDeptExpanded ? null : dept.id)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                                >
                                  {isDeptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Department Officers & Lecturers */}
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
                                  <span className="text-[10px] text-slate-500 block">{dept.examOfficer?.email || 'Exams and result verification'}</span>
                                </div>
                              </div>

                              {/* Department Admin */}
                              <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-start gap-2.5">
                                <Briefcase className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                                <div>
                                  <span className="text-[10px] font-extrabold text-purple-700 uppercase block">Departmental Admin / Secretary</span>
                                  <span className="font-bold text-slate-900 block">{dept.departmentAdmin?.name || 'Unassigned Admin'}</span>
                                  <span className="text-[10px] text-slate-500 block">{dept.departmentAdmin?.email || 'Administrative & academic secretariat'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Lecturers Roster */}
                            {isDeptExpanded && (
                              <div className="p-4 border-t border-slate-100 bg-slate-50/30 space-y-2">
                                <div className="font-extrabold text-xs text-slate-800 flex items-center justify-between">
                                  <span>Departmental Academic Staff / Lecturers ({dept.lecturers.length})</span>
                                </div>

                                {dept.lecturers.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-3">No lecturers currently assigned to this department unit.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                    {dept.lecturers.map((lect: any) => (
                                      <div
                                        key={lect.id}
                                        className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs flex items-center justify-between shadow-2xs"
                                      >
                                        <div>
                                          <div className="font-black text-slate-900">
                                            {lect.surname} {lect.otherNames}
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-semibold">
                                            {lect.staffId} • {lect.currentAcademicRank || lect.rank || 'Lecturer'}
                                          </div>
                                        </div>
                                        <Link
                                          href={`/dashboard/academic/workload/allocation?departmentId=${dept.id}&staffId=${lect.staffId}`}
                                          className="p-1.5 text-slate-400 hover:text-[#006533] transition"
                                          title="View Allocations"
                                        >
                                          <BookOpen className="w-3.5 h-3.5" />
                                        </Link>
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
          })}
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
                <p className="text-[10px] text-slate-500">Leads course allocations and departmental academic administration.</p>
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
                <p className="text-[10px] text-slate-500">Oversees departmental examinations, schedules, and question bank moderation.</p>
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
                <p className="text-[10px] text-slate-500">Coordinates student records, course files, and administrative documentation.</p>
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
