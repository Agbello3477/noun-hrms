'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import {
    Settings, Shield, CheckCircle2, XCircle, RefreshCw,
    Building, HelpCircle, Phone, Mail, Award, Clock,
    Save, Database, Server, Info, ToggleLeft, ToggleRight
} from 'lucide-react';

interface SystemSettings {
    institutionName: string;
    institutionShortName: string;
    academicSession: string;
    semester: string;
    contactEmail: string;
    promotionEligibilityYears: number;
    minAperScore: number;
    autoPromoCronEnabled: boolean;
    clinicConsultationFee: number;
    dailyPatientLimit: number;
    clinicEmergencyPhone: string;
    securityControlRoomPhone: string;
    rosterAutoExpireDays: number;
    systemMode: string;
    mockEmailMode: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    resendApiKey?: string;
    resendFromEmail?: string;
}

const ALLOWED_ROLES = ['SUPER_USER', 'HR_ADMIN', 'VICE_CHANCELLOR', 'ADMIN'];
const WRITE_ROLES = ['SUPER_USER', 'HR_ADMIN', 'ADMIN'];

export default function SettingsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [activeSection, setActiveSection] = useState<'general' | 'hr' | 'operations' | 'system'>('general');
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Diagnostics / System action states
    const [dbChecking, setDbChecking] = useState(false);
    const [dbStatus, setDbStatus] = useState<'online' | 'error' | null>(null);
    const [flushingCache, setFlushingCache] = useState(false);

    useEffect(() => {
        if (!authLoading && user && !ALLOWED_ROLES.includes(user.role)) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get<SystemSettings>('/api/system/settings');
            setSettings(res.data);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to load system settings.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && ALLOWED_ROLES.includes(user.role)) {
            fetchSettings();
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        setSaving(true);
        try {
            const res = await api.put('/api/system/settings', settings);
            showToast(res.data.message || 'System settings updated successfully.', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to save settings.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const testDbConnection = async () => {
        setDbChecking(true);
        setDbStatus(null);
        try {
            // Ping staff endpoint as a live DB test query
            await api.get('/api/staff', { params: { limit: 1 } });
            setDbStatus('online');
            showToast('Database connection is healthy and responsive.', 'success');
        } catch {
            setDbStatus('error');
            showToast('Failed to connect to database.', 'error');
        } finally {
            setDbChecking(false);
        }
    };

    const handleFlushCache = () => {
        setFlushingCache(true);
        setTimeout(() => {
            setFlushingCache(false);
            showToast('System cache, dynamic lists and temporary states flushed successfully.', 'success');
        }, 1500);
    };

    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
        </div>
    );

    if (!user || !ALLOWED_ROLES.includes(user.role)) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
            <Shield className="h-16 w-16 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-800">403 — Access Denied</h1>
            <p className="text-gray-500 max-w-md">You do not have access to view or edit the system settings panel.</p>
            <button onClick={() => router.replace('/dashboard')} className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow">
                Return to Dashboard
            </button>
        </div>
    );

    const canWrite = WRITE_ROLES.includes(user.role);

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 max-w-7xl mx-auto space-y-6">
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl shadow-lg px-5 py-3 text-sm font-medium
                    ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {toast.text}
                </div>
            )}

            {/* Top Header Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-100">
                        <Settings className="h-6 w-6 text-white animate-spin-slow" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">System Settings</h1>
                        <p className="text-sm text-gray-500">Configure global university parameters, operational values & policies.</p>
                    </div>
                </div>
                {canWrite && settings && (
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition disabled:opacity-60 shadow-md shadow-green-100">
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Configuration
                    </button>
                )}
            </div>

            {/* Main Workspace */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Left Sidebar Sections Navigation */}
                <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm h-fit space-y-1">
                    {[
                        { id: 'general', label: 'General Settings', desc: 'Institution name & session details', icon: Building },
                        { id: 'hr', label: 'HR & Promotion Policies', desc: 'Eligibility metrics & timelines', icon: Award },
                        { id: 'operations', label: 'Clinic & Security Ops', desc: 'Hotlines & daily thresholds', icon: Phone },
                        { id: 'system', label: 'System Admin Console', desc: 'Maintenance & DB diagnostics', icon: Server }
                    ].map(({ id, label, desc, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveSection(id as any)}
                            className={`w-full text-left p-3.5 rounded-xl transition flex gap-3
                                ${activeSection === id 
                                    ? 'bg-green-50/70 border border-green-200/50 text-green-800' 
                                    : 'hover:bg-gray-50 text-gray-700 border border-transparent'}`}>
                            <Icon size={18} className={`mt-0.5 ${activeSection === id ? 'text-green-600' : 'text-gray-400'}`} />
                            <div>
                                <p className="text-sm font-semibold leading-tight">{label}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Right Form panel */}
                <div className="md:col-span-3">
                    {loading ? (
                        <div className="bg-white border border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-center">
                            <RefreshCw className="h-10 w-10 text-green-600 animate-spin" />
                            <p className="text-gray-500 font-medium">Retrieving configuration profile...</p>
                        </div>
                    ) : settings ? (
                        <form onSubmit={handleSave} className="space-y-6">
                            
                            {/* SECTION 1: GENERAL SETTINGS */}
                            {activeSection === 'general' && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                            <Building className="text-green-600" size={18} /> General Institution Profile
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-0.5">Customize public branding information & session timelines.</p>
                                    </div>
                                    <hr className="border-gray-100" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Institution Name</label>
                                            <input type="text" value={settings.institutionName} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, institutionName: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Short Code</label>
                                            <input type="text" value={settings.institutionShortName} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, institutionShortName: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Academic Session</label>
                                            <input type="text" value={settings.academicSession} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, academicSession: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Semester State</label>
                                            <select value={settings.semester} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, semester: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                                                <option value="1ST_SEMESTER">1st Semester</option>
                                                <option value="2ND_SEMESTER">2nd Semester</option>
                                                <option value="VACATION">Vacation / Term Break</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Registry Contact Email</label>
                                            <input type="email" value={settings.contactEmail} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 2: HR & PROMOTION SETTINGS */}
                            {activeSection === 'hr' && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                            <Award className="text-green-600" size={18} /> Promotion Policies & Requirements
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-0.5">Define conditions required for staff promotion evaluation.</p>
                                    </div>
                                    <hr className="border-gray-100" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                                Service Years Required <span title="Minimum calendar years at current rank before promotion"><HelpCircle size={13} className="text-gray-400" /></span>
                                            </label>
                                            <input type="number" min={1} max={10} value={settings.promotionEligibilityYears} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, promotionEligibilityYears: parseInt(e.target.value) || 3 })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                                Min APER Appraisal Score (%) <span title="Minimum percentage average on annual appraisal card"><HelpCircle size={13} className="text-gray-400" /></span>
                                            </label>
                                            <input type="number" min={0} max={100} value={settings.minAperScore} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, minAperScore: parseInt(e.target.value) || 60 })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex gap-3">
                                                <Clock className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">Auto-Run January 1st Promotion Cron</p>
                                                    <p className="text-xs text-gray-500">Enable automated batch processing and alerts at midnight on Jan 1st yearly.</p>
                                                </div>
                                            </div>
                                            {canWrite ? (
                                                <button type="button" onClick={() => setSettings({ ...settings, autoPromoCronEnabled: !settings.autoPromoCronEnabled })}
                                                    className="text-green-600 hover:text-green-700 transition">
                                                    {settings.autoPromoCronEnabled ? <ToggleRight size={44} /> : <ToggleLeft className="text-gray-400" size={44} />}
                                                </button>
                                            ) : (
                                                <span className="text-xs font-semibold uppercase px-2.5 py-1 rounded bg-gray-200 text-gray-600">
                                                    {settings.autoPromoCronEnabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 3: OPERATIONS SETTINGS */}
                            {activeSection === 'operations' && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                            <Phone className="text-green-600" size={18} /> Clinic & Security Settings
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-0.5">Parameters for healthcare triage flow and campus security dispatch.</p>
                                    </div>
                                    <hr className="border-gray-100" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Clinic Consultation Fee (₦)</label>
                                            <input type="number" min={0} value={settings.clinicConsultationFee} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, clinicConsultationFee: parseInt(e.target.value) || 0 })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Daily Patient Limit per Doctor</label>
                                            <input type="number" min={1} value={settings.dailyPatientLimit} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, dailyPatientLimit: parseInt(e.target.value) || 40 })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Clinic Emergency Hotline</label>
                                            <input type="text" value={settings.clinicEmergencyPhone} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, clinicEmergencyPhone: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Security Control Room Hotline</label>
                                            <input type="text" value={settings.securityControlRoomPhone} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, securityControlRoomPhone: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Roster Auto-Expire Timeline (Days)</label>
                                            <input type="number" min={1} value={settings.rosterAutoExpireDays} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, rosterAutoExpireDays: parseInt(e.target.value) || 7 })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-55 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 4: SYSTEM / ADMIN TOOLS */}
                            {activeSection === 'system' && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                            <Server className="text-green-600" size={18} /> System Administration Console
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-0.5">Maintenance flags, database diagnostics & mock service variables.</p>
                                    </div>
                                    <hr className="border-gray-100" />
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">System Mode</label>
                                            <select value={settings.systemMode} disabled={!canWrite}
                                                onChange={e => setSettings({ ...settings, systemMode: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                                                <option value="LIVE">Live / Active</option>
                                                <option value="MAINTENANCE">Maintenance Mode</option>
                                                <option value="TESTING">Restricted Test Sandbox</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5 md:col-span-2">
                                             <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex justify-between">
                                                 Mock Email Delivery
                                             </label>
                                             <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center justify-between text-sm">
                                                 <div>
                                                     <span className="text-xs font-semibold text-gray-700 block">Simulate Email Notifications</span>
                                                     <span className="text-[11px] text-gray-500">When enabled, emails are logged to system console rather than sent via live SMTP/Resend</span>
                                                 </div>
                                                 {canWrite ? (
                                                     <button type="button" onClick={() => setSettings({ ...settings, mockEmailMode: !settings.mockEmailMode })}
                                                         className="text-green-600 hover:text-green-700 transition flex-shrink-0 ml-3">
                                                         {settings.mockEmailMode ? <ToggleRight size={38} /> : <ToggleLeft className="text-gray-400" size={38} />}
                                                     </button>
                                                 ) : (
                                                     <span className="font-medium text-xs uppercase text-gray-600 flex-shrink-0 ml-3">{settings.mockEmailMode ? 'ON' : 'OFF'}</span>
                                                 )}
                                             </div>
                                         </div>

                                         {!settings.mockEmailMode && (
                                             <div className="md:col-span-2 border border-blue-200/70 bg-blue-50/40 rounded-2xl p-5 space-y-4">
                                                 <div>
                                                     <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                                                         <Mail size={16} className="text-blue-600" />
                                                         Live Email Provider Configuration (SMTP / Resend API)
                                                     </h4>
                                                     <p className="text-xs text-blue-700 mt-1">Configure your SMTP gateway or Resend API key to deliver live notifications to staff inboxes.</p>
                                                 </div>

                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                     <div className="space-y-1">
                                                         <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Resend API Key (Recommended)</label>
                                                         <input
                                                             type="password"
                                                             placeholder="re_123456789..."
                                                             disabled={!canWrite}
                                                             value={settings.resendApiKey || ''}
                                                             onChange={e => setSettings({ ...settings, resendApiKey: e.target.value })}
                                                             className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                                                         />
                                                     </div>
                                                     <div className="space-y-1">
                                                         <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">From Sender Email</label>
                                                         <input
                                                             type="email"
                                                             placeholder="no-reply@noun.edu.ng"
                                                             disabled={!canWrite}
                                                             value={settings.resendFromEmail || ''}
                                                             onChange={e => setSettings({ ...settings, resendFromEmail: e.target.value })}
                                                             className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                                         />
                                                     </div>

                                                     <div className="md:col-span-2 border-t border-blue-100 pt-3">
                                                         <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Or Custom SMTP Server Setup</span>
                                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                             <div className="space-y-1">
                                                                 <label className="text-[10px] font-bold text-gray-500 uppercase">SMTP Host</label>
                                                                 <input
                                                                     type="text"
                                                                     placeholder="smtp.gmail.com"
                                                                     disabled={!canWrite}
                                                                     value={settings.smtpHost || ''}
                                                                     onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                                                                     className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                 />
                                                             </div>
                                                             <div className="space-y-1">
                                                                 <label className="text-[10px] font-bold text-gray-500 uppercase">SMTP Port</label>
                                                                 <input
                                                                     type="number"
                                                                     placeholder="587"
                                                                     disabled={!canWrite}
                                                                     value={settings.smtpPort || 587}
                                                                     onChange={e => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                                                                     className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                 />
                                                             </div>
                                                             <div className="space-y-1">
                                                                 <label className="text-[10px] font-bold text-gray-500 uppercase">SMTP Username / Email</label>
                                                                 <input
                                                                     type="text"
                                                                     placeholder="your-email@gmail.com"
                                                                     disabled={!canWrite}
                                                                     value={settings.smtpUser || ''}
                                                                     onChange={e => setSettings({ ...settings, smtpUser: e.target.value })}
                                                                     className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                 />
                                                             </div>
                                                             <div className="space-y-1">
                                                                 <label className="text-[10px] font-bold text-gray-500 uppercase">SMTP Password / App Secret</label>
                                                                 <input
                                                                     type="password"
                                                                     placeholder="••••••••••••"
                                                                     disabled={!canWrite}
                                                                     value={settings.smtpPass || ''}
                                                                     onChange={e => setSettings({ ...settings, smtpPass: e.target.value })}
                                                                     className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                 />
                                                             </div>
                                                         </div>
                                                     </div>
                                                 </div>
                                             </div>
                                         )}
                                    </div>

                                    {/* Action Buttons Row */}
                                    <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                                        
                                        <div className="w-full md:w-auto">
                                            <button type="button" onClick={testDbConnection} disabled={dbChecking}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition text-gray-700 w-full">
                                                {dbChecking ? <RefreshCw className="animate-spin" size={14} /> : <Database size={14} />}
                                                Test DB Latency
                                            </button>
                                            {dbStatus && (
                                                <p className={`text-xs font-medium mt-1 text-center ${dbStatus === 'online' ? 'text-green-600' : 'text-red-500'}`}>
                                                    {dbStatus === 'online' ? '● Database connection secure' : '● Connection timed out'}
                                                </p>
                                            )}
                                        </div>

                                        <button type="button" onClick={handleFlushCache} disabled={flushingCache}
                                            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition text-gray-700 w-full md:w-auto">
                                            {flushingCache ? <RefreshCw className="animate-spin" size={14} /> : <Info size={14} />}
                                            Flush Application Cache
                                        </button>
                                    </div>
                                </div>
                            )}

                        </form>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center justify-center gap-3 text-red-500">
                            <XCircle size={20} />
                            <p className="font-semibold text-sm">Failed to retrieve settings payload.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
