'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { AlertTriangle, Plus, CheckCircle, Eye, Paperclip, X, Printer } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import RichTextEditor from '../../../../components/dashboard/RichTextEditor';

interface Query {
    id: string;
    description: string;
    content?: string;
    title?: string;
    severity: string;
    status: string;
    createdAt: string;
    staffId: string;
    staff: { user: { name: string, email: string } };
    response?: string;
    responseAttachmentUrl?: string;
    copyHR?: boolean;
}

export default function RegistryQueriesPage() {
    const { user } = useAuth();
    const isHrAdmin = ['HR_ADMIN', 'SUPER_USER', 'ADMIN'].includes(user?.role || '');
    const isCenterManager = user?.role === 'STUDY_CENTER_MANAGER';
    const isUnitHead = user?.role === 'UNIT_HEAD' || user?.role === 'UNIT_ADMIN';

    const [queries, setQueries] = useState<Query[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewQuery, setViewQuery] = useState<Query | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);

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
            id: string; // Profile ID (needed for query)
            staffId?: string;
            centerId?: string;
            unitId?: string;
            surname?: string;
            otherNames?: string;
        };
    }
    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [staffList, setStaffList] = useState<StaffBasic[]>([]);

    // Issue Query Form
    const [targetType, setTargetType] = useState('CENTER'); // CENTER | UNIT
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [selectedStaffProfileId, setSelectedStaffProfileId] = useState('');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');

    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState('MINOR');
    const [deadline, setDeadline] = useState('');
    const [copyHR, setCopyHR] = useState(true);

    const fetchAllData = async () => {
        try {
            const [qRes, orgRes, staffRes] = await Promise.all([
                api.get('/api/queries'),
                api.get('/api/org/structure'),
                api.get('/api/staff')
            ]);
            setQueries(qRes.data);
            setOrgData(orgRes.data);
            setStaffList(staffRes.data);
        } catch (error) {
            console.error('Error fetching data', error);
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

    // Filter staff based on selection
    const filteredStaff = staffList.filter(s => {
        if (!selectedOrgId) return false;
        if (!s.staffProfile) return false;
        if (targetType === 'CENTER') return s.staffProfile.centerId === selectedOrgId;
        return s.staffProfile.unitId === selectedOrgId; // UNIT
    });

    const handleIssueQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const title = `[${severity}] Disciplinary Query`;
            const content = `${description}<br/><br/><strong>Response Deadline:</strong> ${deadline || 'Immediate'}`;

            await api.post('/api/queries/issue', {
                staffId: selectedStaffProfileId,
                title,
                content,
                copyHR
            });
            setShowModal(false);

            // Reset Form
            setSelectedStaffProfileId('');
            setDescription('');
            setDeadline('');
            setStaffSearchQuery('');
            setCopyHR(true);

            // Refresh
            const res = await api.get('/api/queries');
            setQueries(res.data);

            alert('Query Issued Successfully');
        } catch (error) {
            console.error(error);
            alert('Failed to issue query.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResolve = async () => {
        if (!viewQuery) return;

        setIsSubmitting(true);
        try {
            await api.put(`/api/queries/${viewQuery.id}/resolve`, { status: 'CLOSED' });

            // Update local state
            setQueries(queries.map(q =>
                q.id === viewQuery.id ? { ...q, status: 'CLOSED' } : q
            ));

            // Show feedback
            alert('Query resolved successfully'); // TODO: Replace with Toast if available
            setViewQuery(null); // Close modal
        } catch (error) {
            console.error('Resolve error:', error);
            alert('Failed to resolve query');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        if (!viewQuery) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <html>
                <head>
                    <title>Query Record - ${viewQuery.staff?.user?.name}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #333; }
                        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .logo { font-size: 24px; font-weight: bold; }
                        .meta { color: #555; font-size: 14px; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                        .section { margin-bottom: 25px; page-break-inside: avoid; }
                        .label { font-weight: bold; text-transform: uppercase; font-size: 11px; color: #666; letter-spacing: 0.05em; margin-bottom: 5px; }
                        .content { white-space: pre-wrap; line-height: 1.6; font-size: 14px; border-left: 3px solid #eee; padding-left: 15px; }
                        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; background: #eee; font-size: 12px; }
                        .footer { margin-top: 50px; border-top: 1px solid #eee; pt: 20px; font-size: 12px; color: #999; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">NOUN HRMS</div>
                        <div>OFFICIAL STAFF QUERY RECORD</div>
                    </div>

                    <div class="meta">
                        <div><strong>Staff Name:</strong> ${viewQuery.staff?.user?.name}</div>
                        <div><strong>Email:</strong> ${viewQuery.staff?.user?.email}</div>
                        <div><strong>Date Issued:</strong> ${new Date(viewQuery.createdAt).toLocaleString()}</div>
                        <div><strong>Reference ID:</strong> ${viewQuery.id.substring(0, 8)}</div>
                    </div>

                    <div class="section">
                        <div class="label">Subject</div>
                        <div class="content" style="font-size: 16px; font-weight: bold; border: none; padding: 0;">${viewQuery.title}</div>
                    </div>

                    <div class="section">
                        <div class="label">Severity</div>
                        <div><span class="status">${viewQuery.severity}</span></div>
                    </div>

                    <div class="section">
                        <div class="label">Query / Allegation Details</div>
                        <div class="content">${viewQuery.content || viewQuery.description}</div>
                    </div>

                    <div class="section">
                        <div class="label">Staff Response</div>
                        <div class="content">${viewQuery.response || 'No response recorded.'}</div>
                    </div>

                    <div class="section">
                        <div class="label">Current Status</div>
                        <div><span class="status">${viewQuery.status === 'CLOSED' ? 'RESOLVED' : viewQuery.status}</span></div>
                    </div>

                    <div class="footer">
                        Generated from NOUN HRMS on ${new Date().toLocaleString()}
                    </div>

                    <script>
                        window.onload = () => { setTimeout(() => window.print(), 500); };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Staff Queries</h1>
                    <p className="text-sm text-gray-500">Issue and manage disciplinary queries.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                    <Plus size={18} /> Issue Query
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>
                        ) : queries.map(q => (
                            <tr key={q.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{q.staff?.user?.name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">{q.staff?.user?.email}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 custom-truncate max-w-xs truncate" title={q.content || q.description}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-700">{q.title}</span>
                                        {!q.copyHR && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">Internal</span>
                                        )}
                                    </div>
                                    <span className="text-xs">{(q.content || q.description || '').replace(/<[^>]*>/g, '').substring(0, 50)}...</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${q.severity === 'GROSS_MISCONDUCT' ? 'bg-red-100 text-red-800' :
                                        q.severity === 'MAJOR' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>{q.severity || 'NORMAL'}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${q.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                                        q.status === 'ESCALATED' ? 'bg-red-100 text-red-800' :
                                            q.status === 'RESPONDED' ? 'bg-purple-100 text-purple-800' :
                                                'bg-blue-100 text-blue-800'
                                        }`}>
                                        {q.status === 'CLOSED' ? 'RESOLVED' : q.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {q.response ? (
                                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                            <CheckCircle size={12} /> Responded
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Pending</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => setViewQuery(q)}
                                        className="text-blue-600 hover:text-blue-900 mr-3 inline-flex items-center gap-1"
                                    >
                                        <Eye size={16} /> View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* View Query Modal */}
            {viewQuery && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{viewQuery.title || 'Query Details'}</h3>
                                <p className="text-sm text-gray-500">Issued to {viewQuery.staff?.user?.name}</p>
                            </div>
                            <button onClick={() => setViewQuery(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Query Details */}
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100 relative">
                                <span className="absolute top-4 right-4 text-xs font-bold text-red-600 uppercase bg-white px-2 py-1 rounded border border-red-100">
                                    {viewQuery.severity}
                                </span>
                                <h4 className="text-sm font-bold text-red-900 uppercase mb-2">Allegation / Query</h4>
                                <div 
                                    dangerouslySetInnerHTML={{ __html: viewQuery.content || viewQuery.description }} 
                                    className="text-sm text-gray-800 prose max-w-none leading-relaxed" 
                                />
                                <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-red-100">
                                    Issued on: {new Date(viewQuery.createdAt).toLocaleString()}
                                </p>
                            </div>

                            {/* Staff Response */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 uppercase mb-2 flex justify-between items-center">
                                    Staff Response
                                    {!viewQuery.response && <span className="text-xs font-normal text-gray-400 italic">Formatting...</span>}
                                </h4>
                                {viewQuery.response ? (
                                    <div className="space-y-3">
                                        <div className="text-sm text-gray-800 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 shadow-sm">
                                            {viewQuery.response}
                                        </div>
                                        {viewQuery.responseAttachmentUrl && (
                                            <a
                                                href={`${process.env.NEXT_PUBLIC_API_URL}${viewQuery.responseAttachmentUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline bg-blue-50 px-3 py-2 rounded border border-blue-100"
                                            >
                                                <Paperclip size={16} /> View Attached Evidence
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 italic">
                                        No response submitted yet by the staff member.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                <Printer size={16} /> Print / Save
                            </button>
                            <button
                                onClick={() => setViewQuery(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                            >
                                Close
                            </button>
                            {viewQuery.status !== 'CLOSED' && (
                                <button
                                    onClick={handleResolve}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                            Resolving...
                                        </>
                                    ) : (
                                        'Mark as Resolved'
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Issue Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4 text-red-600 flex items-center gap-2">
                            <AlertTriangle size={20} /> Issue Staff Query
                        </h3>
                        <form onSubmit={handleIssueQuery} className="space-y-4">

                            {/* 1. Location Selection */}
                            {!isHrAdmin ? (
                                <div className="bg-gray-55 p-3 rounded-lg border border-gray-200 text-sm">
                                    <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider block mb-1">Location Scope</span>
                                    <span className="text-gray-800 font-medium">
                                        {isCenterManager
                                            ? user?.staffProfile?.studyCenter?.name || 'My Study Center'
                                            : user?.staffProfile?.unit?.name || 'My Unit'
                                        }
                                    </span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Type</label>
                                        <select
                                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
                                            value={targetType}
                                            onChange={e => {
                                                setTargetType(e.target.value);
                                                setSelectedOrgId('');
                                                setSelectedStaffProfileId('');
                                                setStaffSearchQuery('');
                                            }}
                                        >
                                            <option value="CENTER">Study Center</option>
                                            <option value="UNIT">HQ / Unit</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Location</label>
                                        <select
                                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
                                            value={selectedOrgId}
                                            onChange={e => {
                                                setSelectedOrgId(e.target.value);
                                                setSelectedStaffProfileId('');
                                                setStaffSearchQuery('');
                                            }}
                                        >
                                            <option value="">-- Select --</option>
                                            {targetType === 'CENTER' ? (
                                                orgData.centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                            ) : (
                                                orgData.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                                            )}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* 2. Staff Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Staff Member</label>
                                {selectedOrgId && (
                                    <input
                                        type="text"
                                        placeholder="Search staff by Name or Staff ID..."
                                        value={staffSearchQuery}
                                        onChange={e => setStaffSearchQuery(e.target.value)}
                                        className="mt-1 mb-2 block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                )}
                                {(() => {
                                    const searchedStaff = filteredStaff.filter(s => {
                                        const query = staffSearchQuery.toLowerCase().trim();
                                        if (!query) return true;
                                        const name = (s.name || '').toLowerCase();
                                        const email = (s.email || '').toLowerCase();
                                        const staffId = (s.staffProfile?.staffId || '').toLowerCase();
                                        const surname = (s.staffProfile?.surname || '').toLowerCase();
                                        const otherNames = (s.staffProfile?.otherNames || '').toLowerCase();
                                        return name.includes(query) || 
                                               email.includes(query) || 
                                               staffId.includes(query) || 
                                               surname.includes(query) || 
                                               otherNames.includes(query);
                                    });

                                    return (
                                        <>
                                            <select
                                                required
                                                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                                value={selectedStaffProfileId}
                                                onChange={e => setSelectedStaffProfileId(e.target.value)}
                                                disabled={!selectedOrgId}
                                            >
                                                <option value="">
                                                    {selectedOrgId 
                                                        ? `-- Select Staff (${searchedStaff.length} found) --` 
                                                        : '-- Select Location First --'
                                                    }
                                                </option>
                                                {searchedStaff.map(s => {
                                                    const staffIdStr = s.staffProfile?.staffId ? ` (${s.staffProfile.staffId})` : '';
                                                    return (
                                                        <option key={s.id} value={s.staffProfile?.id}>
                                                            {s.name}{staffIdStr}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {selectedOrgId && filteredStaff.length === 0 && (
                                                <p className="text-xs text-red-500 mt-1">No staff found in this location.</p>
                                            )}
                                            {selectedOrgId && filteredStaff.length > 0 && searchedStaff.length === 0 && (
                                                <p className="text-xs text-red-500 mt-1">No staff matches the search filter.</p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Severity</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={severity}
                                    onChange={e => setSeverity(e.target.value)}
                                >
                                    <option value="MINOR">Minor</option>
                                    <option value="MAJOR">Major</option>
                                    <option value="GROSS_MISCONDUCT">Gross Misconduct</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Allegation</label>
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder="Enter allegation details..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Response Deadline (Optional)</label>
                                <input
                                    type="date"
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 py-1">
                                <input
                                    type="checkbox"
                                    id="copyHR"
                                    checked={copyHR}
                                    onChange={e => setCopyHR(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="copyHR" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                    Copy HR (Registry) on this query
                                </label>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => { setShowModal(false); setStaffSearchQuery(''); }} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !selectedStaffProfileId}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Issuing...' : 'Issue Query'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
