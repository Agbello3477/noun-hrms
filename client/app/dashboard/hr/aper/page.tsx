'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Edit,
  Loader2,
  BookOpen,
  ClipboardCheck,
  Search,
  Filter,
  FileText,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  User,
  ExternalLink,
  ChevronRight,
  Trash2,
  BellRing,
  AlertCircle,
} from 'lucide-react';
import api from '../../../../lib/api';
import { AperSession } from '../../../../types/aper';
import { LeaveSession } from '../../../../types/leaveSession';
import { OfficialLeaveBooklet } from '../../../../types/leaveBooklet';
import AperClosingBanner from '../../../../components/aper/AperClosingBanner';
import OfficialLeaveBookletModal from '../../../../components/leaves/OfficialLeaveBookletModal';
import Pagination from '../../../../components/ui/Pagination';
import { useAuth } from '../../../../hooks/useAuth';

export default function HRAperAndLeaveDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'leave-sessions' | 'leave-booklets' | 'aper'>('leave-sessions');

  // Leave Sessions State (Registry Annual Exercise)
  const [leaveSessions, setLeaveSessions] = useState<LeaveSession[]>([]);
  const [loadingLeaveSessions, setLoadingLeaveSessions] = useState(true);
  const [isCreatingLeaveSession, setIsCreatingLeaveSession] = useState(false);
  const [leaveSessionPage, setLeaveSessionPage] = useState(1);
  const [leaveSessionPageSize, setLeaveSessionPageSize] = useState(10);
  const [leaveSessionFormData, setLeaveSessionFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
  });

  // APER Sessions State
  const [sessions, setSessions] = useState<AperSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
  });

  // Leave Booklets State
  const [leaveBooklets, setLeaveBooklets] = useState<OfficialLeaveBooklet[]>([]);
  const [loadingBooklets, setLoadingBooklets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedBooklet, setSelectedBooklet] = useState<OfficialLeaveBooklet | null>(null);
  const [isBookletModalOpen, setIsBookletModalOpen] = useState(false);
  const [bookletReviewMode, setBookletReviewMode] = useState<
    'STAFF_APPLY' | 'HOD_REVIEW' | 'DEAN_REVIEW' | 'HR_REVIEW' | 'REGISTRAR_REVIEW' | 'VIEW_ONLY'
  >('VIEW_ONLY');

  // Fetch Leave Sessions
  const fetchLeaveSessions = async () => {
    setLoadingLeaveSessions(true);
    try {
      const { data } = await api.get('/api/v1/leave/sessions');
      setLeaveSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch leave sessions:', error);
    } finally {
      setLoadingLeaveSessions(false);
    }
  };

  // Fetch APER Sessions
  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/api/aper/hr/sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Leave Booklets
  const fetchLeaveBooklets = async () => {
    setLoadingBooklets(true);
    try {
      const res = await api.get('/api/v1/leave/all-leaves', {
        params: { limit: 100 },
      }).catch(() => ({ data: [] }));

      const leaves = res.data?.leaves || res.data || [];
      const mappedBooklets: OfficialLeaveBooklet[] = leaves.map((lv: any) => {
        const startD = lv.startDate ? new Date(lv.startDate).toISOString().split('T')[0] : '';
        const endD = lv.endDate ? new Date(lv.endDate).toISOString().split('T')[0] : '';
        const yr = lv.startDate ? new Date(lv.startDate).getFullYear() : new Date().getFullYear();

        let resumptionD = '';
        if (lv.endDate) {
          const d = new Date(lv.endDate);
          d.setDate(d.getDate() + 1);
          if (d.getDay() === 0) d.setDate(d.getDate() + 1);
          if (d.getDay() === 6) d.setDate(d.getDate() + 2);
          resumptionD = d.toISOString().split('T')[0];
        }

        const profile = lv.staff || {};
        const userObj = profile.user || {};

        return {
          id: lv.id,
          leaveApplicationId: lv.id,
          referenceNo: `NOUN/LVB/${yr}/${profile.staffId || '00000'}`,
          leaveYear: yr,
          staffNo: profile.staffId || userObj.email?.split('@')[0] || 'NOUN/STAFF/001',
          fullName: profile.surname ? `${profile.surname}, ${profile.otherNames || ''}` : userObj.name || 'Staff Member',
          surname: profile.surname || '',
          otherNames: profile.otherNames || '',
          designation: profile.rank || profile.designation || 'Staff',
          salaryScale: profile.salaryScale || (profile.level ? `CONTISS ${profile.level}` : 'CONUASS 04'),
          dateOfAppointment: profile.dateOfFirstAppointment ? new Date(profile.dateOfFirstAppointment).toISOString().split('T')[0] : '2020-01-15',
          facultyDeptStudyCenter: profile.department || profile.unit?.name || profile.studyCenter?.name || 'NOUN HQ',
          location: profile.studyCenter?.name || profile.location || 'Abuja HQ',
          phoneNo: profile.phoneNumber || userObj.phoneNumber || '—',
          officialEmail: profile.officialEmail || userObj.email || '—',
          dateResumedPreviousLeave: lv.dateResumedPreviousLeave || '',
          dateProceedingOnLeave: startD,
          dateLeaveEnds: endD,
          dateOfResumption: resumptionD,
          staffSignature: lv.staffSignature || '',
          staffSignatureDate: startD,
          reliefOfficerName: lv.reliefStaff ? `${lv.reliefStaff.surname || ''}, ${lv.reliefStaff.otherNames || ''}` : 'Not Assigned',
          reliefOfficerStaffId: lv.reliefStaff?.staffId || '',
          reliefOfficerRank: lv.reliefStaff?.rank || '',

          supervisorComment: lv.hodApprovalRemarks || '',
          supervisorName: lv.hodApprovedBy?.name || 'Head of Department',
          supervisorSignature: lv.hodApprovedBy ? '' : '',
          supervisorSignatureDate: lv.hodApprovedAt ? new Date(lv.hodApprovedAt).toISOString().split('T')[0] : '',

          deanDirectorComment: lv.deanApprovalRemarks || '',
          deanDirectorName: lv.deanApprovedBy?.name || 'Faculty Dean / Director',
          deanDirectorSignatureDate: lv.deanApprovedAt ? new Date(lv.deanApprovedAt).toISOString().split('T')[0] : '',

          directorHrComment: lv.registryApprovalRemarks || '',
          directorHrName: lv.registryApprovedBy?.name || 'Director (Human Resources)',
          directorHrSignatureDate: lv.registryApprovedAt ? new Date(lv.registryApprovedAt).toISOString().split('T')[0] : '',

          registrarComment: lv.registrarApprovalRemarks || 'Approved by Executive Authority',
          registrarName: 'University Registrar',
          registrarSignatureDate: lv.registryApprovedAt ? new Date(lv.registryApprovedAt).toISOString().split('T')[0] : '',

          status: lv.status === 'APPROVED' ? 'APPROVED' : lv.status === 'REJECTED' ? 'REJECTED' : 'PENDING_HR_DIRECTOR',
          workingDays: lv.workingDaysCount || 30,
          leaveType: lv.leaveType || 'ANNUAL',
        };
      });

      setLeaveBooklets(mappedBooklets);
    } catch (err) {
      console.error('Failed to load leave booklets:', err);
    } finally {
      setLoadingBooklets(false);
    }
  };

  useEffect(() => {
    fetchLeaveSessions();
    fetchSessions();
    fetchLeaveBooklets();
  }, []);

  // Handle Create Leave Session
  const handleCreateLeaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/leave/sessions', leaveSessionFormData);
      setIsCreatingLeaveSession(false);
      setLeaveSessionFormData({
        title: '',
        year: new Date().getFullYear() + 1,
        startDate: '',
        endDate: '',
      });
      fetchLeaveSessions();
      alert('Leave session created successfully (in Draft/Inactive mode). Toggle it ON whenever you are ready to open applications to all staff.');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create leave session.');
    }
  };

  // Toggle Leave Session Active / Inactive
  const toggleLeaveSessionActive = async (session: LeaveSession) => {
    const isActivating = !session.isActive;
    const formattedStart = new Date(session.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedEnd = new Date(session.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const confirmMessage = isActivating
      ? `Are you sure you want to ACTIVATE the "${session.title}" (${session.year}) Leave Session?\n\n📢 IMPORTANT: Activating this session will immediately broadcast in-app and push notifications to all university staff that the Registry Leave Application is open from ${formattedStart} to ${formattedEnd}.`
      : `Are you sure you want to DEACTIVATE the "${session.title}" (${session.year}) Leave Session?\n\nStaff will no longer see this as the active application window.`;

    if (!confirm(confirmMessage)) return;

    try {
      await api.put(`/api/v1/leave/sessions/${session.id}`, {
        isActive: isActivating,
      });
      fetchLeaveSessions();
      if (isActivating) {
        alert(`✅ "${session.title}" is now ACTIVE!\n\nAll university staff have been notified that leave applications are open.`);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update leave session status.');
    }
  };

  // Delete Leave Session
  const handleDeleteLeaveSession = async (session: LeaveSession) => {
    if (!confirm(`Are you sure you want to permanently delete the "${session.title}" (${session.year}) session?`)) return;

    try {
      await api.delete(`/api/v1/leave/sessions/${session.id}`);
      fetchLeaveSessions();
      alert('Leave session deleted successfully.');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete leave session.');
    }
  };

  // APER Session Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/aper/hr/sessions', formData);
      setIsCreating(false);
      fetchSessions();
      alert('APER Session created successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create session');
    }
  };

  const toggleActive = async (session: AperSession) => {
    if (!confirm(`Are you sure you want to ${session.isActive ? 'DEACTIVATE' : 'ACTIVATE'} this session?`)) return;

    try {
      await api.put(`/api/aper/hr/sessions/${session.id}`, {
        isActive: !session.isActive,
      });
      fetchSessions();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleOpenBooklet = (
    booklet: OfficialLeaveBooklet,
    mode: 'VIEW_ONLY' | 'HR_REVIEW' | 'REGISTRAR_REVIEW'
  ) => {
    setSelectedBooklet(booklet);
    setBookletReviewMode(mode);
    setIsBookletModalOpen(true);
  };

  const handleCreateNewBooklet = () => {
    const sp = (user?.staffProfile || {}) as any;
    const freshBooklet: OfficialLeaveBooklet = {
      leaveYear: new Date().getFullYear(),
      staffNo: sp.staffId || '00000',
      fullName: user?.name || 'Staff Member',
      surname: sp.surname || '',
      otherNames: sp.otherNames || '',
      designation: sp.rank || 'Staff',
      salaryScale: sp.salaryScale || 'CONUASS 04',
      dateOfAppointment: '2020-01-15',
      facultyDeptStudyCenter: sp.department || sp.unit?.name || 'NOUN HQ',
      location: 'Abuja Headquarters',
      phoneNo: sp.phoneNumber || (user as any)?.phoneNumber || '',
      officialEmail: user?.email || '',
      dateResumedPreviousLeave: '',
      dateProceedingOnLeave: '',
      dateLeaveEnds: '',
      dateOfResumption: '',
      staffSignature: '',
      staffSignatureDate: new Date().toISOString().split('T')[0],
      status: 'DRAFT',
    };
    setSelectedBooklet(freshBooklet);
    setBookletReviewMode('STAFF_APPLY');
    setIsBookletModalOpen(true);
  };

  // Filter Leave Booklets
  const filteredBooklets = leaveBooklets.filter((b) => {
    const matchesSearch =
      searchQuery === '' ||
      b.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.staffNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.facultyDeptStudyCenter.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesYear = filterYear === 'ALL' || b.leaveYear.toString() === filterYear;
    const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;

    return matchesSearch && matchesYear && matchesStatus;
  });

  const paginatedLeaveSessions = leaveSessions.slice(
    (leaveSessionPage - 1) * leaveSessionPageSize,
    leaveSessionPage * leaveSessionPageSize
  );
  const totalLeaveSessionPages = Math.ceil(leaveSessions.length / leaveSessionPageSize) || 1;

  const paginatedSessions = sessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sessions.length / pageSize) || 1;

  const activeLeaveSession = leaveSessions.find((s) => s.isActive);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <AperClosingBanner userRole="HR_ADMIN" />

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#006533] uppercase tracking-wider">
            <ShieldCheck size={16} /> Registry Directorate of Human Resources
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            APER &amp; Leave Management Subsystem
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Registry Annual Leave Exercise Sessions, 26-Point Statutory Leave Booklets &amp; Performance APER Appraisals
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'leave-sessions' ? (
            <button
              onClick={() => setIsCreatingLeaveSession(true)}
              className="bg-[#006533] hover:bg-emerald-800 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} /> New Annual Leave Session
            </button>
          ) : activeTab === 'aper' ? (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-[#006533] hover:bg-emerald-800 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} /> New APER Session
            </button>
          ) : (
            <button
              onClick={handleCreateNewBooklet}
              className="bg-[#006533] hover:bg-emerald-800 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-sm"
            >
              <Plus size={16} /> Issue / Fill Leave Booklet
            </button>
          )}
        </div>
      </div>

      {/* Triple Tab Switcher */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap items-center gap-2 border border-slate-200/80 max-w-2xl">
        <button
          onClick={() => setActiveTab('leave-sessions')}
          className={`flex-1 min-w-[170px] py-2.5 px-3.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'leave-sessions'
              ? 'bg-white text-[#006533] shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar size={15} /> Leave Sessions (Exercise)
        </button>
        <button
          onClick={() => setActiveTab('leave-booklets')}
          className={`flex-1 min-w-[170px] py-2.5 px-3.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'leave-booklets'
              ? 'bg-white text-[#006533] shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen size={15} /> Leave Booklets (26-Point)
        </button>
        <button
          onClick={() => setActiveTab('aper')}
          className={`flex-1 min-w-[170px] py-2.5 px-3.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'aper'
              ? 'bg-white text-[#006533] shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck size={15} /> APER Appraisals
        </button>
      </div>

      {/* ── SUB-MODULE 1: STATUTORY LEAVE SESSIONS (REGISTRY ANNUAL EXERCISE) ── */}
      {activeTab === 'leave-sessions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Active Session Highlight Banner */}
          {activeLeaveSession ? (
            <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-300 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#006533] text-white flex items-center justify-center shadow-sm flex-shrink-0">
                  <BellRing size={20} className="animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                      Active Leave Exercise
                    </span>
                    <span className="text-xs font-bold text-slate-500">Year: {activeLeaveSession.year}</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {activeLeaveSession.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Application Window: <strong className="text-slate-900">{new Date(activeLeaveSession.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> to <strong className="text-slate-900">{new Date(activeLeaveSession.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleLeaveSessionActive(activeLeaveSession)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 transition shadow-2xs flex items-center gap-1.5"
                >
                  <ToggleRight size={18} className="text-emerald-700" />
                  <span>Deactivate Exercise</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900 font-medium">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
              <div>
                <strong>No Active Leave Exercise Session:</strong> The Registry has not currently toggled any annual leave session ON. Create an exercise window below and toggle it ON to notify all university staff.
              </div>
            </div>
          )}

          {/* Create Leave Session Form */}
          {isCreatingLeaveSession && (
            <div className="p-6 bg-white rounded-2xl border border-emerald-300 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Create New Annual Leave Session</h3>
                  <p className="text-xs text-slate-500">
                    Define the statutory leave application window for the year. Toggling it ON will broadcast notifications to all staff.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateLeaveSession} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Session Title</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-[#006533] bg-slate-50 focus:bg-white"
                    placeholder="e.g. 2026 Registry Annual Statutory Leave Exercise"
                    value={leaveSessionFormData.title}
                    onChange={(e) => setLeaveSessionFormData({ ...leaveSessionFormData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Leave Year</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2040}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-[#006533] bg-slate-50 focus:bg-white"
                    value={leaveSessionFormData.year}
                    onChange={(e) => setLeaveSessionFormData({ ...leaveSessionFormData, year: parseInt(e.target.value, 10) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Application Opening Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-[#006533] bg-slate-50 focus:bg-white"
                    value={leaveSessionFormData.startDate}
                    onChange={(e) => setLeaveSessionFormData({ ...leaveSessionFormData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Application Closing Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-[#006533] bg-slate-50 focus:bg-white"
                    value={leaveSessionFormData.endDate}
                    onChange={(e) => setLeaveSessionFormData({ ...leaveSessionFormData, endDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingLeaveSession(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#006533] text-white rounded-xl text-xs font-bold hover:bg-emerald-800 shadow-sm"
                  >
                    Create Leave Session (Draft)
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Leave Sessions Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Registry Annual Leave Sessions Ledger
                </h3>
                <p className="text-xs text-slate-500">
                  Toggle session status ON to notify all university staff that applications are open
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5 text-left">Leave Session Title</th>
                    <th className="px-6 py-3.5 text-left">Leave Year</th>
                    <th className="px-6 py-3.5 text-left">Application Window</th>
                    <th className="px-6 py-3.5 text-left">Exercise Status</th>
                    <th className="px-6 py-3.5 text-right">Toggle &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {loadingLeaveSessions ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-[#006533] mb-2" />
                        Loading Registry Leave Sessions...
                      </td>
                    </tr>
                  ) : leaveSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                        No leave sessions found. Click &quot;New Annual Leave Session&quot; to create one.
                      </td>
                    </tr>
                  ) : (
                    paginatedLeaveSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{session.title}</div>
                          <div className="text-[11px] text-slate-400">Created: {new Date(session.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-black text-[#006533]">
                          {session.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-slate-400" />
                            <span>
                              {new Date(session.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} &ndash;{' '}
                              {new Date(session.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase ${
                              session.isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {session.isActive ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                                Active (Open)
                              </>
                            ) : (
                              'Inactive (Closed)'
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => toggleLeaveSessionActive(session)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                session.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                              }`}
                              title={session.isActive ? 'Deactivate session' : 'Activate session and broadcast to all staff'}
                            >
                              {session.isActive ? (
                                <>
                                  <ToggleRight size={20} className="text-emerald-700" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft size={20} className="text-slate-400" />
                                  <span>Activate</span>
                                </>
                              )}
                            </button>

                            {!session.isActive && (
                              <button
                                onClick={() => handleDeleteLeaveSession(session)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                                title="Delete session"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={leaveSessionPage}
              totalPages={totalLeaveSessionPages}
              totalItems={leaveSessions.length}
              pageSize={leaveSessionPageSize}
              onPageChange={setLeaveSessionPage}
              onPageSizeChange={setLeaveSessionPageSize}
            />
          </div>
        </div>
      )}

      {/* ── SUB-MODULE 2: STATUTORY LEAVE BOOKLETS ── */}
      {activeTab === 'leave-booklets' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Staff Name, Staff No, or Department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-semibold pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#006533]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span>Leave Year:</span>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-[#006533]"
                >
                  <option value="ALL">All Years</option>
                  <option value="2027">2027</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span>Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-[#006533]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING_HR_DIRECTOR">Pending HR / Registry</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Booklets Ledger Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Official Leave Booklets Docket (Form NOUN/HR/LV-26)
                </h3>
                <p className="text-xs text-slate-500">
                  {filteredBooklets.length} statutory leave dossiers on record
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Ref &amp; Year</th>
                    <th className="px-5 py-3 text-left">Staff Particulars</th>
                    <th className="px-5 py-3 text-left">Faculty / Dept / Center</th>
                    <th className="px-5 py-3 text-left">Leave Schedule (Start – Resumption)</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loadingBooklets ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-[#006533] mb-2" />
                        Loading Official Leave Booklets...
                      </td>
                    </tr>
                  ) : filteredBooklets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No official leave booklets found for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBooklets.map((booklet) => (
                      <tr key={booklet.id || booklet.referenceNo} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-[#006533]">{booklet.referenceNo}</div>
                          <span className="text-[10px] font-bold text-slate-400">Year: {booklet.leaveYear}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-black text-slate-900 uppercase">{booklet.fullName}</div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            ID: {booklet.staffNo} • {booklet.designation}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-medium">
                          {booklet.facultyDeptStudyCenter}
                          <div className="text-[10px] text-slate-400">{booklet.location}</div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {booklet.dateProceedingOnLeave} → {booklet.dateLeaveEnds}
                          </div>
                          <div className="text-[11px] text-[#006533] font-bold flex items-center gap-1">
                            <Clock size={12} /> Resumes: {booklet.dateOfResumption || '—'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                              booklet.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : booklet.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {booklet.status === 'APPROVED' && <CheckCircle2 size={12} />}
                            {booklet.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => handleOpenBooklet(booklet, 'VIEW_ONLY')}
                            className="text-xs font-bold text-[#006533] hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition inline-flex items-center gap-1.5"
                          >
                            <Printer size={13} /> View / Print
                          </button>
                          {['HR_ADMIN', 'REGISTRAR', 'SUPER_USER'].includes(user?.role || '') && (
                            <button
                              onClick={() => handleOpenBooklet(booklet, 'HR_REVIEW')}
                              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1"
                            >
                              <Edit size={13} /> Endorse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-MODULE 3: APER SESSIONS ── */}
      {activeTab === 'aper' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Create Manual Modal/Form Area */}
          {isCreating && (
            <div className="p-6 bg-white rounded-2xl border border-emerald-200 shadow-sm animate-in fade-in slide-in-from-top-2">
              <h3 className="font-bold text-lg mb-4 text-slate-800">Create New Appraisal Session</h3>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-xl p-2.5 text-xs font-bold"
                    placeholder="e.g. 2026 Annual Staff Appraisal"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    className="w-full border rounded-xl p-2.5 text-xs font-bold"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-xl p-2.5 text-xs font-bold"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-xl p-2.5 text-xs font-bold"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#006533] text-white rounded-xl text-xs font-bold hover:bg-emerald-800"
                  >
                    Create Session
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 text-left">Session</th>
                  <th className="px-6 py-3.5 text-left">Year</th>
                  <th className="px-6 py-3.5 text-left">Duration</th>
                  <th className="px-6 py-3.5 text-left">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-[#006533]" />
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No APER sessions found. Create one to start.
                    </td>
                  </tr>
                ) : (
                  paginatedSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{session.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold">{session.year}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(session.startDate).toLocaleDateString()} –{' '}
                          {new Date(session.endDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                            session.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {session.isActive ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium flex justify-end gap-3">
                        <button
                          onClick={() => toggleActive(session)}
                          className={`${
                            session.isActive ? 'text-emerald-600' : 'text-slate-400'
                          } hover:text-emerald-800`}
                          title="Toggle Status"
                        >
                          {session.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sessions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {/* Official Leave Booklet Modal (Viewer & Form) */}
      {selectedBooklet && (
        <OfficialLeaveBookletModal
          isOpen={isBookletModalOpen}
          onClose={() => {
            setIsBookletModalOpen(false);
            setSelectedBooklet(null);
          }}
          booklet={selectedBooklet}
          profile={user?.staffProfile}
          userRole={user?.role}
          reviewMode={bookletReviewMode}
          initialViewMode={bookletReviewMode === 'STAFF_APPLY' ? 'FORM' : 'VIEW'}
          onSave={async (data, isDraft) => {
            try {
              await api.post('/api/v1/leave/apply', {
                leaveType: 'ANNUAL',
                startDate: data.dateProceedingOnLeave,
                endDate: data.dateLeaveEnds,
                reason: 'Statutory Annual Leave (Form NOUN/HR/LV-26)',
                reliefStaffId: data.reliefOfficerStaffId,
              });
              alert(isDraft ? 'Leave Booklet draft saved.' : 'Official Leave Booklet submitted successfully!');
              fetchLeaveBooklets();
            } catch (err: any) {
              alert(err?.response?.data?.message || 'Failed to submit Leave Booklet.');
            }
          }}
        />
      )}
    </div>
  );
}
