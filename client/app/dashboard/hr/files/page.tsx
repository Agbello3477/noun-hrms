
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import { FolderIcon } from '../../../../components/hr/FolderIcon';
import StaffFileForm from '../../../../components/hr/StaffFileForm';
import { Search, Plus, FileInput, X, Archive } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';

interface FileUser {
    id: string;
    name: string;
    role: string;
    staffProfile: {
        staffId: string;
        title?: string | null;
        rank?: string | null;
        level?: string | null;
        cadre?: string | null;
        createdById: string | null;
        createdBy?: { name: string };
        createdAt: string;
        unit?: { name: string };
        studyCenter?: { name: string };
        queries?: any[];
        fileRequests?: any[];
    };
}

export default function FileRegistryPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [files, setFiles] = useState<FileUser[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<FileUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Filters
    const [filterCenter, setFilterCenter] = useState('');
    const [filterUnit, setFilterUnit] = useState(''); // Directorate/Faculty

    // Structure Data for Filters
    const [centers, setCenters] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExistingModal, setShowExistingModal] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [fileRes, orgRes] = await Promise.all([
                api.get('/api/registry/files'),
                api.get('/api/org/structure') // Reuse generic struct endpoint
            ]);

            setFiles(fileRes.data);
            setFilteredFiles(fileRes.data);

            setCenters(orgRes.data.centers);
            setUnits(orgRes.data.units);
        } catch (error) {
            console.error('Failed to load registry data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Logic
    useEffect(() => {
        let res = files;

        if (search) {
            const lower = search.toLowerCase();
            res = res.filter(f =>
                f.name.toLowerCase().includes(lower) ||
                (f.staffProfile?.staffId || '').toLowerCase().includes(lower)
            );
        }

        if (filterCenter) {
            res = res.filter(f => f.staffProfile?.studyCenter?.name === filterCenter);
        }

        // Simplistic Unit Filter (matches Directorate OR Faculty name)
        if (filterUnit) {
            res = res.filter(f => f.staffProfile?.unit?.name === filterUnit);
        }

        setFilteredFiles(res);
    }, [search, filterCenter, filterUnit, files]);


    const handleFileCreated = () => {
        setShowCreateModal(false);
        setShowExistingModal(false);
        fetchData(); // Refresh grid
        alert('File action successful!');
    };

    return (
        <div className="p-6 min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">File Registry</h2>
                    <p className="text-gray-500 text-sm">Manage official digitized staff profiles and records</p>
                </div>
                <div className="flex gap-3">
                    {['HR_ADMIN', 'SUPER_USER'].includes(user?.role || '') && (
                        <button
                            onClick={() => router.push('/dashboard/hr/archive')}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 shadow-sm text-sm font-medium"
                        >
                            <Archive size={16} className="text-gray-500" />
                            View Archive
                        </button>
                    )}
                    <button
                        onClick={() => setShowExistingModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm text-sm font-medium"
                    >
                        <FileInput size={16} />
                        Add Existing File
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 shadow-sm text-sm font-medium"
                    >
                        <Plus size={16} />
                        Create New File
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Name or Staff ID..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-100"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="p-2 border rounded-lg text-sm bg-gray-50 min-w-[150px]"
                    value={filterCenter}
                    onChange={(e) => setFilterCenter(e.target.value)}
                >
                    <option value="">All Study Centers</option>
                    {centers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>

                <select
                    className="p-2 border rounded-lg text-sm bg-gray-50 min-w-[200px]"
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                >
                    <option value="">All Units / Faculties / Directorates / Departments</option>
                    <optgroup label="Faculties">
                        {units.filter(u => u.type === 'FACULTY').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Directorates">
                        {units.filter(u => u.type === 'DIRECTORATE').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Departments">
                        {units.filter(u => u.type === 'DEPARTMENT').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </optgroup>
                </select>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center text-gray-400">
                    <FolderIcon staffName="No Files" staffId="---" createdAt={new Date().toISOString()} createdBy={null} />
                    <p className="mt-4">No staff files found matching your criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 justify-items-center">
                    {filteredFiles.map(file => {
                        let folderColor: 'blue' | 'yellow' | 'red' = 'blue';
                        const hasOpenQuery = file.staffProfile?.queries && file.staffProfile.queries.length > 0;
                        const hasActiveTransfer = file.staffProfile?.fileRequests && file.staffProfile.fileRequests.length > 0;

                        if (hasOpenQuery) {
                            folderColor = 'red';
                        } else if (hasActiveTransfer) {
                            folderColor = 'yellow';
                        }

                        const designationParts = [];
                        if (file.staffProfile?.rank) designationParts.push(file.staffProfile.rank);
                        if (file.staffProfile?.level) designationParts.push(`Level ${file.staffProfile.level}`);
                        const designation = designationParts.join(' - ') || 'Staff';

                        return (
                            <FolderIcon
                                key={file.id}
                                staffName={`${file.staffProfile?.title ? file.staffProfile.title + ' ' : ''}${file.name}`}
                                staffId={(file.staffProfile?.staffId || 'N/A').replace('NOUN/', '')}
                                createdAt={file.staffProfile?.createdAt}
                                createdBy={file.staffProfile?.createdBy?.name || null}
                                color={folderColor}
                                role={file.role}
                                designation={designation}
                                onClick={() => router.push(`/dashboard/hr/files/${encodeURIComponent(file.staffProfile?.staffId || file.id)}`)}
                            />
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-bold text-gray-800">Create New Staff File</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <StaffFileForm mode="CREATE" onSuccess={handleFileCreated} onCancel={() => setShowCreateModal(false)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Modal */}
            {showExistingModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-bold text-gray-800">Add Existing Staff File</h3>
                            <button onClick={() => setShowExistingModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <StaffFileForm mode="EXISTING" onSuccess={handleFileCreated} onCancel={() => setShowExistingModal(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
