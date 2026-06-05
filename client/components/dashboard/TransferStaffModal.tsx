'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, User } from 'lucide-react';
import api from '../../lib/api';

interface TransferStaffModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

interface StaffBasic {
    id: string; // User ID
    name: string;
    email: string;
    staffProfile?: {
        id: string;
        staffId: string;
        department: string;
        rank: string;
        surname?: string;
        otherNames?: string;
        studyCenter?: { name: string };
        unit?: { name: string };
    };
}

export default function TransferStaffModal({ onClose, onSuccess }: TransferStaffModalProps) {
    const [mode, setMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
    const [formData, setFormData] = useState({
        staffId: '', // Selected Staff User ID
        targetType: 'CENTER', // CENTER or UNIT
        toCenterId: '',
        toUnitId: '',
        reason: '',
        effectiveDate: new Date().toISOString().split('T')[0]
    });

    // Batch State
    const [batchFile, setBatchFile] = useState<File | null>(null);

    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [staffList, setStaffList] = useState<StaffBasic[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingStaff, setFetchingStaff] = useState(true);
    const [error, setError] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<StaffBasic | null>(null);
    const [staffSearchQuery, setStaffSearchQuery] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [orgRes, staffRes] = await Promise.all([
                    api.get('/api/org/structure'),
                    api.get('/api/staff') // We need a list of staff to select from. Warning: This might be large in prod.
                ]);
                setOrgData(orgRes.data);
                setStaffList(staffRes.data);
            } catch (err) {
                console.error('Failed to load data', err);
                setError('Failed to load specific data needed for transfer.');
            } finally {
                setFetchingStaff(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'staffId') {
            const staff = staffList.find(s => s.id === value) || null;
            setSelectedStaff(staff);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setBatchFile(e.target.files[0]);
        }
    };

    const downloadTemplate = () => {
        const headers = ['email,target_code,type,reason,effective_date'];
        const example = ['staff@noun.edu.ng,HQ-SENATE,UNIT,Annual Rotation,2024-01-01'];
        const csvContent = "data:text/csv;charset=utf-8," + [...headers, ...example].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "batch_transfer_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (mode === 'SINGLE') {
                const payload = {
                    staffId: formData.staffId,
                    toCenterId: formData.targetType === 'CENTER' ? formData.toCenterId : undefined,
                    toUnitId: formData.targetType === 'UNIT' ? formData.toUnitId : undefined,
                    reason: formData.reason,
                    effectiveDate: formData.effectiveDate
                };
                await api.post('/api/registry/transfer', payload);
            } else {
                if (!batchFile) {
                    setError('Please select a CSV file to upload.');
                    setLoading(false);
                    return;
                }
                const formData = new FormData();
                formData.append('file', batchFile);

                const response = await api.post('/api/registry/transfer/batch', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                // If backend returns failures in 200 OK (partial success), we might want to show them?
                // For now, assuming success message or throw.
                if (response.data.failed > 0) {
                    alert(`Batch Processed: ${response.data.successful} Successful, ${response.data.failed} Failed. Check console/logs for details.`);
                }
            }

            onSuccess();
            handleClose();
        } catch (err: any) {
            console.error('Transfer Error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to initiate transfer');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStaffSearchQuery('');
        setSelectedStaff(null);
        setFormData({
            staffId: '',
            targetType: 'CENTER',
            toCenterId: '',
            toUnitId: '',
            reason: '',
            effectiveDate: new Date().toISOString().split('T')[0]
        });
        onClose();
    };

    // Helper to get current location
    const getCurrentLocation = () => {
        if (!selectedStaff?.staffProfile) return 'Unknown';
        if (selectedStaff.staffProfile.studyCenter) return selectedStaff.staffProfile.studyCenter.name;
        if (selectedStaff.staffProfile.unit) return selectedStaff.staffProfile.unit.name;
        return 'Unassigned';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl my-8">
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <h3 className="text-xl font-bold text-gray-900">Initiate Staff Transfer</h3>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex border-b mb-6">
                    <button
                        className={`px-4 py-2 text-sm font-medium ${mode === 'SINGLE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => { setMode('SINGLE'); setStaffSearchQuery(''); }}
                    >
                        Single Transfer
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium ${mode === 'BATCH' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => { setMode('BATCH'); setStaffSearchQuery(''); }}
                    >
                        Bulk Upload
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                    {mode === 'SINGLE' ? (
                        <>
                            {/* 1. Select Staff */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Staff Member</label>
                                {fetchingStaff ? (
                                    <div className="text-sm text-gray-500">Loading staff list...</div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Search staff by Name or Staff ID..."
                                            value={staffSearchQuery}
                                            onChange={e => setStaffSearchQuery(e.target.value)}
                                            className="mb-2 block w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                        />
                                        {(() => {
                                            const searchedStaff = staffList.filter(staff => {
                                                const query = staffSearchQuery.toLowerCase().trim();
                                                if (!query) return true;
                                                const name = (staff.name || '').toLowerCase();
                                                const email = (staff.email || '').toLowerCase();
                                                const staffId = (staff.staffProfile?.staffId || '').toLowerCase();
                                                const surname = (staff.staffProfile?.surname || '').toLowerCase();
                                                const otherNames = (staff.staffProfile?.otherNames || '').toLowerCase();
                                                return name.includes(query) || 
                                                       email.includes(query) || 
                                                       staffId.includes(query) ||
                                                       surname.includes(query) || 
                                                       otherNames.includes(query);
                                            });

                                            return (
                                                <>
                                                    <select
                                                        name="staffId"
                                                        required
                                                        className="w-full border rounded p-2"
                                                        value={formData.staffId}
                                                        onChange={handleChange}
                                                    >
                                                        <option value="">-- Select Staff ({searchedStaff.length} found) --</option>
                                                        {searchedStaff.map(staff => (
                                                            <option key={staff.id} value={staff.id}>
                                                                {staff.name} ({staff.staffProfile?.staffId || 'No ID'})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {staffList.length > 0 && searchedStaff.length === 0 && (
                                                        <p className="text-xs text-red-500 mt-1">No staff matches the search filter.</p>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </>
                                )}

                                {selectedStaff && (
                                    <div className="mt-3 flex items-center justify-between text-sm bg-white p-2 rounded border">
                                        <div className="flex items-center gap-2">
                                            <User size={16} className="text-blue-500" />
                                            <span className="font-semibold">{selectedStaff.name}</span>
                                        </div>
                                        <div className="text-gray-600">
                                            Current Post: <span className="font-medium text-gray-900">{getCurrentLocation()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. Destination */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination Type</label>
                                    <select
                                        name="targetType"
                                        className="w-full border rounded p-2"
                                        value={formData.targetType}
                                        onChange={handleChange}
                                    >
                                        <option value="CENTER">Study Center</option>
                                        <option value="UNIT">HQ Directorate / Unit</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {formData.targetType === 'CENTER' ? 'Select Study Center' : 'Select Unit / Faculty'}
                                    </label>

                                    {formData.targetType === 'CENTER' ? (
                                        <select
                                            name="toCenterId"
                                            required
                                            className="w-full border rounded p-2"
                                            value={formData.toCenterId}
                                            onChange={handleChange}
                                        >
                                            <option value="">-- Select Center --</option>
                                            {orgData.centers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select
                                            name="toUnitId"
                                            required
                                            className="w-full border rounded p-2"
                                            value={formData.toUnitId}
                                            onChange={handleChange}
                                        >
                                            <option value="">-- Select Unit --</option>
                                            <optgroup label="Faculties">
                                                {orgData.units.filter(u => u.type === 'FACULTY').map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Directorates & Units">
                                                {orgData.units.filter(u => u.type === 'DIRECTORATE').map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* 3. Details */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Transfer</label>
                                <textarea
                                    name="reason"
                                    required
                                    rows={3}
                                    className="w-full border rounded p-2"
                                    placeholder="e.g. Annual Rotation, Promotion, Request..."
                                    value={formData.reason}
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                                <input
                                    type="date"
                                    name="effectiveDate"
                                    required
                                    className="w-full border rounded p-2"
                                    value={formData.effectiveDate}
                                    onChange={handleChange}
                                />
                            </div>
                        </>
                    ) : (
                        // BATCH MODE
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-blue-800 mb-2">Instructions</h4>
                                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                                    <li>Download the template CSV file.</li>
                                    <li>Fill in the required columns: <code className="bg-blue-100 px-1 rounded">email</code>, <code className="bg-blue-100 px-1 rounded">target_code</code>, <code className="bg-blue-100 px-1 rounded">type</code> (CENTER/UNIT).</li>
                                    <li>Upload the file below to process bulk transfers.</li>
                                </ul>
                                <button
                                    type="button"
                                    onClick={downloadTemplate}
                                    className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                                >
                                    Download Template CSV
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Upload CSV File</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                        className="block w-full text-sm text-gray-500
                                          file:mr-4 file:py-2 file:px-4
                                          file:rounded-full file:border-0
                                          file:text-sm file:font-semibold
                                          file:bg-blue-50 file:text-blue-700
                                          hover:file:bg-blue-100"
                                    />
                                    <p className="mt-2 text-xs text-gray-500">Supported format: .csv only</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (mode === 'SINGLE' && !formData.staffId) || (mode === 'BATCH' && !batchFile)}
                            className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    <span>{mode === 'SINGLE' ? 'Confirm Transfer' : 'Upload & Process'}</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
