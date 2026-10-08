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
} from 'lucide-react';
import api from '../../../../lib/api';
import { AperSession } from '../../../../types/aper';
import { OfficialLeaveBooklet } from '../../../../types/leaveBooklet';
import AperClosingBanner from '../../../../components/aper/AperClosingBanner';
import OfficialLeaveBookletModal from '../../../../components/leaves/OfficialLeaveBookletModal';
import Pagination from '../../../../components/ui/Pagination';
import { useAuth } from '../../../../hooks/useAuth';

export default function HRAperAndLeaveDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'aper' | 'leave-booklets'>('leave-booklets');

  // APER Sessions State
  const [sessions, setSessions] = useState<AperSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Form State for APER Session
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
  });

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/api/aper/hr/sessions');
      setSessions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBooklets = async () => {
    setLoadingBooklets(true);
    try {
      // Fetch leave applications and map them to official 26-point booklet structure
      const res = await api.get('/api/v1/leave/all-leaves', {
        params: { limit: 100 },
      }).catch(() => ({ data: [] }));

      const leaves = res.data?.leaves || res.data || [];
      const mappedBooklets: OfficialLeaveBooklet[] = leaves.map((lv: any) => {
        const startD = lv.startDate ? new Date(lv.startDate).toISOString().split('T')[0] : '';
        const endD = lv.endDate ? new Date(lv.endDate).toISOString().split('T')[0] : '';
        const yr = lv.startDate ? new Date(lv.startDate).getFullYear() : new Date().getFullYear();

        // Calculate resumption date
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
    fetchSessions();
    fetchLeaveBooklets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/aper/hr/sessions', formData);
      setIsCreating(false);
      fetchSessions();
      alert('Session created successfully');
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

  const paginatedSessions = sessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sessions.length / pageSize) || 1;

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
            Annual Performance Evaluation Reports (APER) &amp; 26-Point Official Statutory Leave Booklets
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'aper' ? (
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

      {/* Dual Tab Switcher */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-200/80 max-w-xl">
        <button
          onClick={() => setActiveTab('leave-booklets')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'leave-booklets'
              ? 'bg-white text-[#006533] shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen size={16} /> Statutory Leave Booklets (26-Point)
        </button>
        <button
          onClick={() => setActiveTab('aper')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            activeTab === 'aper'
              ? 'bg-white text-[#006533] shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck size={16} /> Performance (APER) Sessions
        </button>
      </div>

      {/* ── SUB-MODULE 1: STATUTORY LEAVE BOOKLETS ── */}
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

      {/* ── SUB-MODULE 2: APER SESSIONS ── */}
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
