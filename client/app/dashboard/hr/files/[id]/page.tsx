'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Building, MapPin, Calendar, Shield, X } from 'lucide-react';
import api from '../../../../../lib/api';
import DigitalDossier from '../../../../../components/dashboard/DigitalDossier';
import BioDataTab from '../../../../../components/hr/dossier/BioDataTab';
import LeaveHistoryTab from '../../../../../components/hr/dossier/LeaveHistoryTab';
import TransferHistoryTab from '../../../../../components/hr/dossier/TransferHistoryTab';
import QueryHistoryTab from '../../../../../components/hr/dossier/QueryHistoryTab';
import AperHistoryTab from '../../../../../components/hr/dossier/AperHistoryTab';

export default function StaffDossierPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const [staff, setStaff] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('Overview');

    // Soft delete confirmation modal states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [confirmError, setConfirmError] = useState('');

    const handleDeleteFile = () => {
        setConfirmPassword('');
        setConfirmError('');
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        setConfirmLoading(true);
        setConfirmError('');

        try {
            await api.delete(`/api/registry/files/${staff.id}`, {
                data: { password: confirmPassword }
            });
            alert('Staff file successfully archived.');
            setShowDeleteConfirm(false);
            router.push('/dashboard/hr/files');
        } catch (err: any) {
            setConfirmError(err.response?.data?.message || 'Verification failed. Incorrect password.');
        } finally {
            setConfirmLoading(false);
        }
    };

    useEffect(() => {
        const fetchStaff = async () => {
            if (!id) return;
            try {
                const { data } = await api.get(`/api/registry/files/${id}`);
                setStaff(data);
            } catch (err: any) {
                setError('Failed to load staff details. ' + (err.response?.data?.message || ''));
            } finally {
                setLoading(false);
            }
        };

        fetchStaff();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading Staff Dossier...</div>;

    if (error) return (
        <div className="p-8">
            <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
                <ArrowLeft className="mr-2" size={20} /> Back
            </button>
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                {error}
            </div>
        </div>
    );

    if (!staff) return null;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-nounGreen transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
                </button>
                <button
                    onClick={handleDeleteFile}
                    className="bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-red-200"
                >
                    Delete Staff File
                </button>
            </div>

            {/* Staff Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-16 bg-nounGreen/10 rounded-full flex items-center justify-center text-nounGreen font-bold text-2xl border border-nounGreen/20">
                            {staff.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{staff.staffId || 'NO ID'}</span>
                                <span className="flex items-center gap-1"><Shield size={14} className="text-nounGreen" /> {staff.role}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${staff.userId ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {staff.userId ? 'Active Account' : 'Pending Activation'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600 border-l pl-6 border-gray-100">
                        <div className="flex items-center gap-2">
                            <Building size={16} className="text-gray-400" />
                            <span className="font-medium">{staff.unit?.name || 'Unassigned Unit'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-gray-400" />
                            <span>{staff.studyCenter?.name || staff.studyCenter?.code || 'HQ'}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span>Created: {new Date(staff.createdAt).toLocaleDateString()} by {staff.createdBy?.name || 'System'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto border-b border-gray-200 mb-6 scrollbar-hide">
                {['Overview', 'Documents', 'Leaves', 'Transfers', 'APER', 'Queries'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`whitespace-nowrap py-3 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-nounGreen text-nounGreen'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'Overview' && <BioDataTab staff={staff} />}
                
                {activeTab === 'Documents' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <DigitalDossier staffId={String(staff.id)} staffName={staff.name} />
                    </div>
                )}
                
                {activeTab === 'Leaves' && <LeaveHistoryTab staffId={String(staff.id)} />}
                
                {activeTab === 'Transfers' && <TransferHistoryTab staffId={String(staff.userId)} />}
                
                {activeTab === 'APER' && <AperHistoryTab staffId={String(staff.id)} />}
                
                {activeTab === 'Queries' && <QueryHistoryTab staffId={String(staff.id)} />}
            </div>

            {/* Soft Delete Password Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                            <h3 className="text-lg font-bold text-gray-800">Confirm Archive Deletion</h3>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            You are about to archive the staff file for <strong className="text-gray-950">{staff.name}</strong>. 
                            This will deactivate their user portal access and store their records in the archive. 
                            Please enter your password to authorize this action.
                        </p>
                        {confirmError && (
                            <div className="bg-red-50 text-red-700 p-2.5 rounded text-xs mb-4 border border-red-200">
                                {confirmError}
                            </div>
                        )}
                        <form onSubmit={handleConfirmDelete} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Your Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-blue-100 outline-none text-black"
                                    placeholder="Enter your login password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 py-2 border rounded text-gray-600 hover:bg-gray-50 font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={confirmLoading}
                                    className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
                                >
                                    {confirmLoading ? 'Verifying...' : 'Confirm Archiving'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
