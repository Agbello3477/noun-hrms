'use client';

import { useEffect, useState, useMemo } from 'react';
import api from '../../../../lib/api';
import { 
    AlertTriangle, 
    Plus, 
    CheckCircle, 
    Eye, 
    Paperclip, 
    X, 
    Printer, 
    ShieldAlert, 
    AlertCircle, 
    Clock, 
    FileText, 
    FolderLock, 
    CheckCircle2, 
    XCircle,
    Building2,
    Calendar,
    Send
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import dynamic from 'next/dynamic';
import Pagination from '../../../../components/ui/Pagination';

const RichTextEditor = dynamic(() => import('../../../../components/dashboard/RichTextEditor'), {
    ssr: false,
    loading: () => <div className="h-[220px] bg-slate-50 border rounded-xl animate-pulse flex items-center justify-center text-xs text-gray-400 font-medium">Loading editor...</div>
}) as any;

interface Query {
    id: string;
    description?: string;
    content?: string;
    title?: string;
    severity?: string;
    actionType?: 'QUERY' | 'OFFICIAL_WARNING';
    isQuery?: boolean;
    isWarning?: boolean;
    stipulatedHours?: number;
    responseDeadline?: string | null;
    slaBreached?: boolean;
    warningAcknowledged?: boolean;
    warningAcknowledgedAt?: string | null;
    breachLoggedToFolio?: boolean;
    resolutionStatus?: string;
    status: string;
    createdAt: string;
    staffId: string;
    staff: { 
        id?: string;
        staffId?: string;
        rank?: string;
        unit?: { name: string };
        user: { name: string; email: string };
    };
    issuedBy?: { 
        name?: string; 
        role?: string; 
        staffProfile?: { rank?: string; signatureUrl?: string | null };
    };
    response?: string;
    responseAttachmentUrl?: string;
    copyHR?: boolean;
}

const getIssuerDisplayName = (issuedBy?: any) => {
    if (!issuedBy) return 'Central Registry';
    const role = issuedBy.role;
    if (['HR_ADMIN', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR', 'REGISTRAR'].includes(role)) {
        return 'Central Registry Directorate';
    }
    if (['UNIT_HEAD', 'UNIT_ADMIN', 'DIRECTOR', 'DEAN'].includes(role)) {
        return 'Director / Unit Head';
    }
    if (role === 'STUDY_CENTER_MANAGER') {
        return 'Study Center Director';
    }
    return 'Central Registry';
};

export default function RegistryQueriesPage() {
    const { user } = useAuth();
    const isHrAdmin = ['HR_ADMIN', 'SUPER_USER', 'ADMIN', 'REGISTRAR', 'VICE_CHANCELLOR'].includes(user?.role || '');
    const isCenterManager = user?.role === 'STUDY_CENTER_MANAGER';
    const isUnitHead = user?.role === 'UNIT_HEAD' || user?.role === 'UNIT_ADMIN';

    const [queries, setQueries] = useState<Query[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewQuery, setViewQuery] = useState<Query | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    
    // Filtering states
    const [filterActionType, setFilterActionType] = useState<'ALL' | 'QUERY' | 'OFFICIAL_WARNING'>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Initial Data
    interface OrganizationData {
        centers: { id: string; name: string; }[];
        units: { id: string; name: string; type: string }[];
    }
    interface StaffBasic {
        id: string; // User ID
        name: string;
        email?: string;
        staffProfile?: {
            id: string; // Profile ID
            staffId?: string;
            centerId?: string;
            unitId?: string;
            surname?: string;
            otherNames?: string;
            rank?: string;
        };
    }
    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [staffList, setStaffList] = useState<StaffBasic[]>([]);

    // Form State (Unified Disciplinary Dispatch)
    const [actionType, setActionType] = useState<'QUERY' | 'OFFICIAL_WARNING'>('QUERY');
    const [targetType, setTargetType] = useState('CENTER'); // CENTER | UNIT
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [selectedStaffProfileId, setSelectedStaffProfileId] = useState('');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [subjectTitle, setSubjectTitle] = useState('');
    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState('MINOR');
    const [stipulatedHours, setStipulatedHours] = useState('48');
    const [copyHR, setCopyHR] = useState(true);

    const fetchAllData = async () => {
        try {
            const [qRes, orgRes, staffRes] = await Promise.all([
                api.get('/api/queries'),
                api.get('/api/org/structure'),
                api.get('/api/staff')
            ]);
            setQueries(qRes.data || []);
            setOrgData(orgRes.data || { centers: [], units: [] });
            setStaffList(staffRes.data || []);
        } catch (error) {
            console.error('Error fetching disciplinary data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Auto-scope selectors for Center Managers and Unit Heads
    useEffect(() => {
        if (user) {
            if (user.role === 'STUDY_CENTER_MANAGER') {
                setTargetType('CENTER');
                setSelectedOrgId(user.staffProfile?.centerId || '');
            } else if (user.role === 'UNIT_HEAD' || user.role === 'UNIT_ADMIN') {
                setTargetType('UNIT');
                setSelectedOrgId(user.staffProfile?.unitId || '');
            }
        }
    }, [user]);

    // Filter staff based on location
    const filteredStaff = staffList.filter(s => {
        if (!selectedOrgId) return false;
        if (!s.staffProfile) return false;
        if (targetType === 'CENTER') return s.staffProfile.centerId === selectedOrgId;
        return s.staffProfile.unitId === selectedOrgId;
    });

    const selectedStaffObj = staffList.find(s => s.staffProfile?.id === selectedStaffProfileId);

    // Filtered Query list
    const filteredQueries = useMemo(() => {
        return queries.filter(q => {
            if (filterActionType === 'QUERY' && q.actionType !== 'QUERY') return false;
            if (filterActionType === 'OFFICIAL_WARNING' && q.actionType !== 'OFFICIAL_WARNING') return false;
            if (filterStatus !== 'ALL' && q.status !== filterStatus) return false;
            if (searchQuery) {
                const s = searchQuery.toLowerCase();
                const name = (q.staff?.user?.name || '').toLowerCase();
                const sid = (q.staff?.staffId || '').toLowerCase();
                const title = (q.title || '').toLowerCase();
                if (!name.includes(s) && !sid.includes(s) && !title.includes(s)) return false;
            }
            return true;
        });
    }, [queries, filterActionType, filterStatus, searchQuery]);

    const paginatedQueries = useMemo(() => {
        return filteredQueries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [filteredQueries, currentPage, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredQueries.length / pageSize));

    const handleIssueDisciplinaryAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaffProfileId) {
            alert('Please select a target staff member');
            return;
        }
        if (!description || description.trim().length < 5) {
            alert('Please provide the details/allegation for this disciplinary action');
            return;
        }

        setIsSubmitting(true);
        try {
            const formattedTitle = subjectTitle.trim() || (
                actionType === 'QUERY' 
                    ? `[${severity}] Formal Disciplinary Query: Defense Required`
                    : `[${severity}] Official Warning & Administrative Admonition`
            );

            await api.post('/api/queries/issue', {
                staffProfileId: selectedStaffProfileId,
                actionType,
                title: formattedTitle,
                content: description,
                severity,
                stipulatedHours: actionType === 'QUERY' ? Number(stipulatedHours) : 0,
                copyHR
            });

            setShowModal(false);

            // Reset Form
            setSelectedStaffProfileId('');
            setSubjectTitle('');
            setDescription('');
            setStipulatedHours('48');
            setSeverity('MINOR');
            setStaffSearchQuery('');
            setCopyHR(true);

            // Refresh queries
            const res = await api.get('/api/queries');
            setQueries(res.data || []);

            alert(actionType === 'QUERY' 
                ? 'Formal Disciplinary Query issued successfully. Defense countdown initiated.' 
                : 'Official Warning / Admonition issued and logged to personnel folio.'
            );
        } catch (error: any) {
            console.error('Issue Action Error:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to dispatch disciplinary action.';
            alert(`Failed to dispatch action: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResolve = async (verdict: string) => {
        if (!viewQuery) return;

        setIsSubmitting(true);
        try {
            await api.put(`/api/queries/${viewQuery.id}/resolve`, { 
                status: 'CLOSED',
                resolutionStatus: verdict
            });

            setQueries(queries.map(q =>
                q.id === viewQuery.id ? { ...q, status: 'CLOSED', resolutionStatus: verdict } : q
            ));

            alert(`Disciplinary record marked as resolved (${verdict}).`);
            setViewQuery(null);
        } catch (error: any) {
            console.error('Resolve error:', error);
            alert('Failed to resolve query: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        if (!viewQuery) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const isQuery = viewQuery.actionType !== 'OFFICIAL_WARNING';
        const docTitle = isQuery 
            ? 'FORMAL DISCIPLINARY QUERY & CALL FOR DEFENSE' 
            : 'OFFICIAL LETTER OF WARNING & ADMINISTRATIVE ADMONITION';

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${docTitle} - ${viewQuery.staff?.user?.name}</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; padding: 45px; color: #111; line-height: 1.5; font-size: 13pt; }
                        .header { text-align: center; border-bottom: 2px solid #006533; padding-bottom: 12px; margin-bottom: 25px; }
                        .inst-title { font-size: 18pt; font-weight: bold; color: #006533; text-transform: uppercase; margin-bottom: 2px; }
                        .directorate { font-size: 13pt; font-weight: bold; color: #333; text-transform: uppercase; }
                        .subhead { font-size: 10pt; color: #666; }
                        .ref-table { width: 100%; margin-bottom: 20px; font-size: 11pt; border-collapse: collapse; }
                        .ref-table td { padding: 4px 0; vertical-align: top; }
                        .badge { display: inline-block; padding: 3px 8px; font-size: 10pt; font-weight: bold; border-radius: 4px; border: 1px solid #999; }
                        .subject-box { background: #f8fafc; border-left: 4px solid #006533; padding: 12px; margin: 20px 0; font-weight: bold; font-size: 13pt; text-transform: uppercase; }
                        .body-text { margin: 20px 0; text-align: justify; font-size: 12pt; line-height: 1.6; }
                        .response-section { margin-top: 30px; border-top: 1px dashed #999; padding-top: 15px; }
                        .footer { margin-top: 50px; font-size: 10pt; color: #777; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="inst-title">National Open University of Nigeria</div>
                        <div class="directorate">Central Directorate of Human Resource &amp; Registry</div>
                        <div class="subhead">University Village, Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja</div>
                    </div>

                    <table class="ref-table">
                        <tr>
                            <td style="width: 60%;"><strong>Ref:</strong> NOUN/REG/DISC/${viewQuery.id.substring(0, 8).toUpperCase()}</td>
                            <td style="text-align: right;"><strong>Date:</strong> ${new Date(viewQuery.createdAt).toLocaleDateString('en-NG', { dateStyle: 'long' })}</td>
                        </tr>
                        <tr>
                            <td><strong>To:</strong> ${viewQuery.staff?.user?.name} (${viewQuery.staff?.staffId || 'N/A'})</td>
                            <td style="text-align: right;"><strong>Action Type:</strong> ${isQuery ? 'FORMAL QUERY' : 'OFFICIAL WARNING'}</td>
                        </tr>
                        <tr>
                            <td><strong>Rank / Designation:</strong> ${viewQuery.staff?.rank || 'Staff Officer'}</td>
                            <td style="text-align: right;"><strong>Severity:</strong> ${viewQuery.severity || 'STANDARD'}</td>
                        </tr>
                    </table>

                    <div class="subject-box">
                        ${docTitle}<br/>
                        <span style="font-size: 11pt; font-weight: normal; color: #444;">SUBJECT: ${viewQuery.title}</span>
                    </div>

                    <div class="body-text">
                        ${viewQuery.content || viewQuery.description}
                    </div>

                    ${isQuery ? `
                        <div style="background: #fff8f8; border: 1px solid #fca5a5; padding: 12px; margin-top: 20px; font-size: 11pt;">
                            <strong>MANDATORY DEFENSE DIRECTIVE:</strong><br/>
                            You are hereby directed to submit a written explanation/defense in exculpation of this allegation within 
                            <strong>${viewQuery.stipulatedHours || 48} hours</strong> of receipt of this notice. Failure to do so will result in ex-parte determination and immediate disciplinary sanctions.
                        </div>
                    ` : `
                        <div style="background: #fffdf0; border: 1px solid #fde047; padding: 12px; margin-top: 20px; font-size: 11pt;">
                            <strong>OFFICIAL FOLIO RECORD &amp; ACKNOWLEDGMENT DIRECTIVE:</strong><br/>
                            This serves as a formal written admonition and caution. This letter has been entered into your digital personnel dossier. You are required to log into the HRMS portal and confirm receipt.
                        </div>
                    `}

                    ${viewQuery.response ? `
                        <div class="response-section">
                            <div style="font-weight: bold; margin-bottom: 8px;">STAFF WRITTEN DEFENSE / SUBMISSION:</div>
                            <div style="background: #f1f5f9; padding: 12px; font-size: 11pt; border-radius: 4px;">
                                ${viewQuery.response}
                            </div>
                        </div>
                    ` : ''}

                    <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                        <div>
                            ___________________________________<br/>
                            <strong>For: Registrar / Issuing Authority</strong><br/>
                            ${getIssuerDisplayName(viewQuery.issuedBy)}
                        </div>
                    </div>

                    <div class="footer">
                        National Open University of Nigeria • Unified Human Resource Management System • Confidential Disciplinary Record
                    </div>

                    <script>
                        window.onload = () => { setTimeout(() => window.print(), 400); };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-500/20 rounded-xl border border-rose-400/30">
                            <AlertTriangle className="w-7 h-7 text-rose-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Disciplinary Actions: Queries &amp; Warnings</h1>
                            <p className="text-slate-300 text-sm mt-0.5">
                                Unified Disciplinary Dispatch — Issue formal defense queries or official folio warnings across NOUN directorates.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-rose-600/30 transition-all text-sm"
                    >
                        <Plus size={18} /> Dispatch Disciplinary Action
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Disciplinary Actions</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{queries.length}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Dispatched records</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
                    <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Formal Queries (Defense)</div>
                    <div className="text-2xl font-bold text-rose-700 mt-1">
                        {queries.filter(q => q.actionType !== 'OFFICIAL_WARNING').length}
                    </div>
                    <div className="text-xs text-rose-400 mt-0.5">Defense submission window</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                    <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Official Warnings / Admonitions</div>
                    <div className="text-2xl font-bold text-amber-700 mt-1">
                        {queries.filter(q => q.actionType === 'OFFICIAL_WARNING').length}
                    </div>
                    <div className="text-xs text-amber-400 mt-0.5">Personnel folio cautions</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">SLA Breached / Defaults</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                        {queries.filter(q => q.slaBreached).length}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Overdue formal defenses</div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => { setFilterActionType('ALL'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterActionType === 'ALL'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        All Actions ({queries.length})
                    </button>
                    <button
                        onClick={() => { setFilterActionType('QUERY'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterActionType === 'QUERY'
                                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                    >
                        Formal Queries ({queries.filter(q => q.actionType !== 'OFFICIAL_WARNING').length})
                    </button>
                    <button
                        onClick={() => { setFilterActionType('OFFICIAL_WARNING'); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filterActionType === 'OFFICIAL_WARNING'
                                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                    >
                        Official Warnings ({queries.filter(q => q.actionType === 'OFFICIAL_WARNING').length})
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search staff, ID, or subject..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    <select
                        value={filterStatus}
                        onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="OPEN">Open / Active</option>
                        <option value="RESPONDED">Responded</option>
                        <option value="CLOSED">Closed / Resolved</option>
                    </select>
                </div>
            </div>

            {/* Queries & Warnings Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Details</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action Type</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject &amp; Allegation</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status / Defense</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 text-xs">
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading disciplinary records...</td></tr>
                        ) : paginatedQueries.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-400">No disciplinary records found.</td></tr>
                        ) : paginatedQueries.map(q => {
                            const isQuery = q.actionType !== 'OFFICIAL_WARNING';
                            return (
                                <tr key={q.id} className="hover:bg-slate-50/70 transition-all">
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <div className="font-semibold text-gray-900">{q.staff?.user?.name || 'Unknown Staff'}</div>
                                        <div className="text-[11px] text-gray-500">{q.staff?.staffId || q.staff?.user?.email}</div>
                                        <div className="text-[10px] text-slate-400">{q.staff?.unit?.name || 'Central Directorate'}</div>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        {isQuery ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                <AlertTriangle size={12} /> Formal Query
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                <ShieldAlert size={12} /> Official Warning
                                            </span>
                                        )}
                                        {q.breachLoggedToFolio && (
                                            <div className="text-[9px] text-amber-700 font-semibold mt-1">✓ Logged to Folio</div>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 max-w-xs truncate" title={q.content || q.description}>
                                        <div className="font-semibold text-gray-800 truncate">{q.title}</div>
                                        <div className="text-[11px] text-gray-500 truncate">
                                            {(q.content || q.description || '').replace(/<[^>]*>/g, '').substring(0, 60)}...
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                            Issued by: {getIssuerDisplayName(q.issuedBy)} • {new Date(q.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            q.severity === 'GROSS_MISCONDUCT' ? 'bg-red-100 text-red-800' :
                                            q.severity === 'MAJOR' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {q.severity || 'NORMAL'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        {isQuery ? (
                                            <div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    q.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-800' :
                                                    q.status === 'RESPONDED' ? 'bg-blue-100 text-blue-800' :
                                                    q.slaBreached ? 'bg-rose-100 text-rose-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {q.status === 'CLOSED' ? 'RESOLVED' : q.status}
                                                </span>
                                                {q.slaBreached && (
                                                    <div className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-0.5">
                                                        <XCircle size={11} /> SLA Breached
                                                    </div>
                                                )}
                                                {q.response && (
                                                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">
                                                        <CheckCircle size={11} /> Defense Received
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                                                    {q.warningAcknowledged ? 'ACKNOWLEDGED' : 'CAUTION LOGGED'}
                                                </span>
                                                {q.warningAcknowledged ? (
                                                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                                        ✓ Receipt Signed
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                                                        ⏳ Pending Staff Receipt
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-right font-medium">
                                        <button
                                            onClick={() => setViewQuery(q)}
                                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1 font-semibold"
                                        >
                                            <Eye size={15} /> Review &amp; Print
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {!loading && filteredQueries.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredQueries.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(s: number) => { setPageSize(s); setCurrentPage(1); }}
                    />
                )}
            </div>

            {/* View / Review Modal (Standard NOUN Letterhead) */}
            {viewQuery && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50 rounded-t-2xl">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        viewQuery.actionType === 'OFFICIAL_WARNING' 
                                            ? 'bg-amber-100 text-amber-800' 
                                            : 'bg-rose-100 text-rose-800'
                                    }`}>
                                        {viewQuery.actionType === 'OFFICIAL_WARNING' ? 'OFFICIAL WARNING / ADMONITION' : 'FORMAL DISCIPLINARY QUERY'}
                                    </span>
                                    <span className="text-xs text-gray-500">Ref: NOUN/REG/DISC/{viewQuery.id.substring(0, 8).toUpperCase()}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mt-1">{viewQuery.title}</h3>
                            </div>
                            <button onClick={() => setViewQuery(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Standard NOUN Letterhead Preview Card */}
                            <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-4">
                                <div className="text-center border-b pb-3 border-emerald-800/30">
                                    <h4 className="text-sm font-bold text-emerald-800 tracking-wider uppercase">National Open University of Nigeria</h4>
                                    <p className="text-[11px] font-semibold text-slate-600 uppercase">Central Directorate of Human Resource &amp; Registry</p>
                                    <p className="text-[9px] text-slate-400">Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div><strong>Target Staff:</strong> {viewQuery.staff?.user?.name} ({viewQuery.staff?.staffId || 'N/A'})</div>
                                    <div className="text-right"><strong>Date Issued:</strong> {new Date(viewQuery.createdAt).toLocaleDateString()}</div>
                                    <div><strong>Issuing Authority:</strong> {getIssuerDisplayName(viewQuery.issuedBy)}</div>
                                    <div className="text-right"><strong>Severity:</strong> {viewQuery.severity || 'STANDARD'}</div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Allegation / Official Reprimand Details:</div>
                                    <div 
                                        dangerouslySetInnerHTML={{ __html: viewQuery.content || viewQuery.description || '' }} 
                                        className="text-xs text-slate-800 prose max-w-none leading-relaxed p-4 bg-slate-50 rounded-lg border border-slate-100"
                                    />
                                </div>

                                {viewQuery.actionType === 'OFFICIAL_WARNING' ? (
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800">
                                        <div className="font-bold flex items-center gap-1.5">
                                            <FolderLock size={14} /> Personnel Digital Folio Record
                                        </div>
                                        <p className="mt-1 text-[11px]">
                                            This formal warning has been logged to the staff dossier. 
                                            {viewQuery.warningAcknowledged 
                                                ? ` Receipt was acknowledged by the staff member.` 
                                                : ` Pending acknowledgment receipt by staff member.`}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-800">
                                        <div className="font-bold flex items-center gap-1.5">
                                            <Clock size={14} /> Mandatory Defense Window: {viewQuery.stipulatedHours || 48} Hours
                                        </div>
                                        <p className="mt-1 text-[11px]">
                                            Failure to provide a satisfactory formal defense triggers an SLA breach, administrative promotion hold, and referral to the Disciplinary Committee.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Staff Response (for Queries) */}
                            {viewQuery.actionType !== 'OFFICIAL_WARNING' && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                    <div className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                                        <span>Staff Exculpatory Defense</span>
                                        {viewQuery.response ? (
                                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                                                <CheckCircle size={13} /> Defense Submitted
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 font-semibold text-[11px]">
                                                ⏳ Defense Pending
                                            </span>
                                        )}
                                    </div>

                                    {viewQuery.response ? (
                                        <div className="space-y-2">
                                            <div className="text-xs text-slate-800 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                                                {viewQuery.response}
                                            </div>
                                            {viewQuery.responseAttachmentUrl && (
                                                <a
                                                    href={`${process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com'}${viewQuery.responseAttachmentUrl}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-xs text-indigo-600 hover:underline bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 font-medium"
                                                >
                                                    <Paperclip size={14} /> View Attached Supporting Evidence
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-xs text-slate-400 italic">
                                            No defense submitted yet by the staff member.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Resolution Controls for Registry/Unit Managers */}
                            {viewQuery.status !== 'CLOSED' && (
                                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                                    <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                                        Official Resolution &amp; Verdict Determination
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => handleResolve('SATISFACTORY')}
                                            disabled={isSubmitting}
                                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                                        >
                                            Accept Defense (Satisfactory)
                                        </button>
                                        <button
                                            onClick={() => handleResolve('EXONERATED')}
                                            disabled={isSubmitting}
                                            className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                                        >
                                            Exonerate Staff (Clear Record)
                                        </button>
                                        <button
                                            onClick={() => handleResolve('COMMITTEE_REFERRAL')}
                                            disabled={isSubmitting}
                                            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                                        >
                                            Refer to Senior Disciplinary Committee
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-between items-center rounded-b-2xl">
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 text-slate-700 hover:bg-white border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                            >
                                <Printer size={15} /> Print Official Record
                            </button>
                            <button
                                onClick={() => setViewQuery(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Issue Disciplinary Action Modal (Unified Query & Warning Dispatch) */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
                        {/* Modal Title */}
                        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                                    Dispatch Disciplinary Action
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Select action mode: Formal Query (Defense required) or Official Warning (Folio caution).
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleIssueDisciplinaryAction} className="space-y-4 mt-4">
                            {/* 1. Action Type Toggle Switch */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Action Type:
                                </label>
                                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('QUERY')}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                                            actionType === 'QUERY'
                                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <AlertTriangle size={15} />
                                        Formal Disciplinary Query
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionType('OFFICIAL_WARNING')}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                                            actionType === 'OFFICIAL_WARNING'
                                                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <ShieldAlert size={15} />
                                        Official Warning / Admonition
                                    </button>
                                </div>

                                {actionType === 'QUERY' ? (
                                    <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-start gap-2">
                                        <Clock className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                                        <span>
                                            <strong>Formal Query Mode:</strong> Directs the staff member to submit a formal exculpatory defense within stipulated hours. Unanswered queries breach SLA and freeze promotion reviews.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-start gap-2">
                                        <FolderLock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                        <span>
                                            <strong>Official Warning Mode:</strong> Administrative caution without defense requirement. Automatically entered into the digital personnel folio with an acknowledgment receipt.
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 2. Location & Target Scope */}
                            {!isHrAdmin ? (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                                    <span className="font-semibold text-slate-700 uppercase tracking-wider block mb-1">Your Directorate / Study Center Scope</span>
                                    <span className="text-slate-900 font-medium">
                                        {isCenterManager
                                            ? user?.staffProfile?.studyCenter?.name || 'Assigned Study Center'
                                            : user?.staffProfile?.unit?.name || 'Assigned Unit'
                                        }
                                    </span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Location Type</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
                                            value={targetType}
                                            onChange={e => {
                                                setTargetType(e.target.value);
                                                setSelectedOrgId('');
                                                setSelectedStaffProfileId('');
                                                setStaffSearchQuery('');
                                            }}
                                        >
                                            <option value="CENTER">Study Center</option>
                                            <option value="UNIT">HQ Directorate / Academic Unit</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Select Center / Directorate</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
                                            value={selectedOrgId}
                                            onChange={e => {
                                                setSelectedOrgId(e.target.value);
                                                setSelectedStaffProfileId('');
                                                setStaffSearchQuery('');
                                            }}
                                        >
                                            <option value="">-- Choose Center or Unit --</option>
                                            {targetType === 'CENTER' ? (
                                                orgData.centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                            ) : (
                                                orgData.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                                            )}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* 3. Target Staff Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Staff Member</label>
                                {selectedOrgId && (
                                    <input
                                        type="text"
                                        placeholder="Filter staff by Name or Staff ID..."
                                        value={staffSearchQuery}
                                        onChange={e => setStaffSearchQuery(e.target.value)}
                                        className="mb-2 block w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                    />
                                )}
                                {(() => {
                                    const searchedStaff = filteredStaff.filter(s => {
                                        const q = staffSearchQuery.toLowerCase().trim();
                                        if (!q) return true;
                                        const name = (s.name || '').toLowerCase();
                                        const email = (s.email || '').toLowerCase();
                                        const staffId = (s.staffProfile?.staffId || '').toLowerCase();
                                        const surname = (s.staffProfile?.surname || '').toLowerCase();
                                        const otherNames = (s.staffProfile?.otherNames || '').toLowerCase();
                                        return name.includes(q) || email.includes(q) || staffId.includes(q) || surname.includes(q) || otherNames.includes(q);
                                    });

                                    return (
                                        <select
                                            required
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
                                            value={selectedStaffProfileId}
                                            onChange={e => setSelectedStaffProfileId(e.target.value)}
                                            disabled={!selectedOrgId}
                                        >
                                            <option value="">
                                                {selectedOrgId 
                                                    ? `-- Select Staff (${searchedStaff.length} available) --` 
                                                    : '-- Select Location First --'
                                                }
                                            </option>
                                            {searchedStaff.map(s => (
                                                <option key={s.id} value={s.staffProfile?.id}>
                                                    {s.name} {s.staffProfile?.staffId ? `(${s.staffProfile.staffId})` : ''} - {s.staffProfile?.rank || 'Staff'}
                                                </option>
                                            ))}
                                        </select>
                                    );
                                })()}
                            </div>

                            {/* 4. Subject & Severity */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Caption</label>
                                    <input
                                        type="text"
                                        placeholder={actionType === 'QUERY' ? 'e.g. Failure to submit end-of-semester exam records' : 'e.g. Administrative Admonition on Workstation Punctuality'}
                                        value={subjectTitle}
                                        onChange={e => setSubjectTitle(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Severity Level</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500"
                                        value={severity}
                                        onChange={e => setSeverity(e.target.value)}
                                    >
                                        <option value="MINOR">Minor Infraction</option>
                                        <option value="MAJOR">Major Breach</option>
                                        <option value="GROSS_MISCONDUCT">Gross Misconduct</option>
                                    </select>
                                </div>
                            </div>

                            {/* 5. Stipulated Hours (Only for Queries) */}
                            {actionType === 'QUERY' && (
                                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                                    <label className="block text-xs font-bold text-rose-900 mb-1">
                                        Mandatory Defense Window (Stipulated Hours):
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['24', '48', '72', '120'].map(h => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => setStipulatedHours(h)}
                                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                                    stipulatedHours === h
                                                        ? 'bg-rose-600 text-white border-rose-600'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                {h} Hours {h === '48' ? '(Default)' : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 6. Rich Text Editor for Content */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    {actionType === 'QUERY' ? 'Formal Allegation / Query Content' : 'Official Warning / Reprimand Text'}
                                </label>
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder={actionType === 'QUERY' ? 'Enter detailed allegations and specific directives for formal defense...' : 'Enter caution details and formal admonition notice...'}
                                />
                            </div>

                            {/* 7. Copy Registry HR */}
                            <div className="flex items-center gap-2 py-1">
                                <input
                                    type="checkbox"
                                    id="copyHRToggle"
                                    checked={copyHR}
                                    onChange={e => setCopyHR(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                />
                                <label htmlFor="copyHRToggle" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                                    Copy Central Registry HR Directorate on this record (Places statutory folio hold)
                                </label>
                            </div>

                            {/* Form Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setStaffSearchQuery(''); }}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !selectedStaffProfileId}
                                    className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 ${
                                        actionType === 'QUERY'
                                            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                                            : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                                    } disabled:opacity-50`}
                                >
                                    <Send size={14} />
                                    {isSubmitting 
                                        ? 'Dispatching...' 
                                        : actionType === 'QUERY' ? 'Dispatch Formal Query' : 'Issue Official Warning'
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
