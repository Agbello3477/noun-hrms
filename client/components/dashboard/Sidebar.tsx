'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
    Users,
    MapPin,
    DollarSign,
    LayoutDashboard,
    Settings,
    LogOut,
    ArrowLeftRight,
    Briefcase,
    Layers,
    FileText,
    BarChart3,
    AlertTriangle,
    AlertCircle,
    History,
    BookOpen,
    FolderOpen,
    ClipboardCheck,
    Mail,
    Archive,
    Calendar,
    HeartPulse,
    Shield,
    TrendingUp
} from 'lucide-react';


export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const isActive = (path: string) => {
        if (path === '/dashboard') return pathname === '/dashboard';
        return pathname === path || pathname.startsWith(`${path}/`);
    };

    const LinkItem = ({ href, icon: Icon, label, badge }: any) => {
        const active = isActive(href);
        return (
            <Link
                href={href}
                prefetch={true}
                onClick={() => setIsOpen && setIsOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 ${
                    active
                        ? 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/60 shadow-xs relative before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-1.5 before:rounded-r-full before:bg-[#006533]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <Icon 
                        size={17} 
                        className={`flex-shrink-0 transition-colors ${
                            active ? 'text-[#006533]' : 'text-slate-400 group-hover:text-slate-700'
                        }`} 
                    />
                    <span className="truncate">{label}</span>
                </div>
                {badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {badge}
                    </span>
                )}
            </Link>
        );
    };

    // Helper to determine active silos
    const role = user?.role;

    // Logic for Enterprise Roles
    const isSuperUser = role === 'SUPER_USER';
    const isAdmin = role === 'ADMIN' || isSuperUser; // Legacy Admin support
    const isVC = role === 'VICE_CHANCELLOR';

    // Registry / HR
    const isRegistry = role === 'HR_ADMIN' || isVC || isAdmin;

    // Bursary / Finance
    const isBursary = role === 'BURSARY' || role === 'AUDIT' || isVC || isAdmin;
    const isAudit = role === 'AUDIT' || isVC || isAdmin;

    // Unit Heads (Directors/Deans) & Managers
    const isUnitHead = role === 'UNIT_HEAD' || role === 'STUDY_CENTER_MANAGER' || role === 'UNIT_ADMIN' || isVC || isAdmin;
    const isManager = role === 'STUDY_CENTER_MANAGER' || isAdmin;

    // Academic check
    const isAcademic = user?.staffProfile?.cadre === 'ACADEMIC' || isVC || isSuperUser || isAdmin;

    // Clinic & Security Access checks
    const isClinic = ['CLINIC_HEAD', 'CLINIC_NURSE', 'CLINIC_DOCTOR', 'CLINIC_LAB_SCIENTIST', 'CLINIC_PHARMACIST'].includes(role || '') || isAdmin;
    const isSecurity = ['SECURITY_HEAD', 'SECURITY_OFFICER'].includes(role || '') || isAdmin || isVC;

    return (
        <aside className="h-screen w-64 flex-none border-r border-slate-200/80 bg-white flex flex-col justify-between select-none">
            {/* Header / Brand Logo */}
            <div className="flex h-14 items-center border-b border-slate-200/80 px-4 gap-3 bg-white flex-shrink-0">
                <img src="/noun_logo.png" alt="NOUN" className="h-8 w-8 object-contain rounded-lg shadow-2xs" />
                <div className="flex flex-col">
                    <span className="text-sm font-extrabold tracking-tight text-[#006533]">NOUN HRMS</span>
                    <span className="text-[10px] font-semibold text-slate-400 -mt-0.5">Enterprise Portal</span>
                </div>
            </div>

            {/* Scrollable Navigation Area */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-thin">
                <LinkItem href="/dashboard" icon={LayoutDashboard} label="Overview" />

                {/* VC Executive Section */}
                {(isVC || isSuperUser) && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Executive Oversight
                        </div>
                        <LinkItem href="/dashboard/vc-executive" icon={TrendingUp} label="VC Command Center" />
                    </>
                )}

                {/* Core Administration (Registry & Admins) */}
                {isRegistry && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Core Administration
                        </div>
                        <LinkItem href="/dashboard/staff" icon={Users} label="Staff Directory" />
                        <LinkItem href="/dashboard/hr/files" icon={FolderOpen} label="File Registry" />
                        {['HR_ADMIN', 'SUPER_USER'].includes(role || '') && (
                            <LinkItem href="/dashboard/hr/archive" icon={Archive} label="Registry Archive" />
                        )}
                        <LinkItem href="/dashboard/hr/aper" icon={ClipboardCheck} label="Performance (APER)" />
                        <LinkItem href="/dashboard/registry/transfers" icon={History} label="Transfer History" />
                        <LinkItem href="/dashboard/analytics" icon={BarChart3} label="HR Analytics" />
                        <LinkItem href="/dashboard/registry/queries" icon={AlertTriangle} label="Disciplinary Queries" />
                        <LinkItem href="/dashboard/registry/memos" icon={Mail} label="Registry Memos" />
                        {['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'].includes(role || '') && (
                            <LinkItem href="/dashboard/registry/due-for-promotion" icon={TrendingUp} label="Due for Promotion" />
                        )}
                    </>
                )}

                {/* Unit Management (Directors, Deans, Center Managers) */}
                {isUnitHead && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Unit Management
                        </div>
                        <LinkItem href="/dashboard/unit/staff" icon={Briefcase} label="Unit Staff" />
                        <LinkItem href="/dashboard/unit/leaves" icon={FileText} label="Leave Approvals" />
                        <LinkItem href="/dashboard/unit/aper" icon={ClipboardCheck} label="Appraisal Review" />
                        <LinkItem href="/dashboard/unit/memos" icon={Mail} label="Unit Memos" />
                        <LinkItem href="/dashboard/unit/transferred-staff" icon={ArrowLeftRight} label="Transferred Staff" />
                    </>
                )}

                {/* Study Center Specific */}
                {isManager && (
                    <LinkItem href="/dashboard/attendance" icon={MapPin} label="Attendance" />
                )}

                {/* Bursary & Finance Silo */}
                {isBursary && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Bursary &amp; Finance
                        </div>
                        <LinkItem href="/dashboard/payroll" icon={DollarSign} label="Payroll Central" />
                        <LinkItem href="/dashboard/bursary" icon={Layers} label="Bursary Operations" />
                        {isAudit && <LinkItem href="/dashboard/bursary/audit" icon={Layers} label="Audit Verification" />}
                    </>
                )}

                {/* Clinical Services */}
                {isClinic && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Clinical Services
                        </div>
                        <LinkItem href="/dashboard/clinic" icon={HeartPulse} label="Health Services" />
                    </>
                )}

                {/* Campus Safety */}
                <>
                    <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Campus Safety
                    </div>
                    <LinkItem 
                        href="/dashboard/security" 
                        icon={Shield} 
                        label={['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(role || '') ? "Command Center" : "Report Threat / Incident"} 
                    />
                    {(String(role) === 'SECURITY_HEAD' || isVC || isAdmin) && (
                        <LinkItem href="/dashboard/security/reports" icon={FileText} label="Security Reports" />
                    )}
                </>

                {/* Academic Research Services */}
                {isAcademic && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Academic &amp; Research
                        </div>
                        <LinkItem href="/dashboard/research" icon={FileText} label="Research Forum" />
                        <LinkItem href="/dashboard/academic/publications" icon={BookOpen} label="My Publications" />
                        <LinkItem href="/dashboard/academic/workload" icon={Users} label="Teaching Workload" />
                    </>
                )}

                {/* General Staff Self-Service */}
                <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Self Service
                </div>
                <LinkItem href="/dashboard/profile" icon={Users} label="My Profile" />
                <LinkItem href="/dashboard/documents" icon={FileText} label="My Dossier" />
                <LinkItem href="/dashboard/payslips" icon={DollarSign} label="My Payslips" />
                {role !== 'STAFF' && (
                    <>
                        <LinkItem href="/dashboard/services/file-requests" icon={Briefcase} label="File Requests" />
                        <LinkItem href="/dashboard/received-files" icon={FolderOpen} label="Received Files" />
                    </>
                )}
                {user?.staffProfile?.cadre !== 'ACADEMIC' && (
                    <LinkItem href="/dashboard/staff/aper" icon={ClipboardCheck} label="Staff Appraisal" />
                )}
                <LinkItem href="/dashboard/queries" icon={AlertCircle} label="My Queries" />
                <LinkItem href="/dashboard/memos" icon={Mail} label="General Memos" />
                <LinkItem href="/dashboard/leaves" icon={Calendar} label="My Applications" />

                {/* System Administration */}
                {isAdmin && (
                    <>
                        <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            System Administration
                        </div>
                        <LinkItem href="/dashboard/settings" icon={Settings} label="Settings" />
                        <LinkItem href="/dashboard/system/logs" icon={History} label="Audit Activity Logs" />
                    </>
                )}
            </nav>

            {/* Footer / Sign Out */}
            <div className="border-t border-slate-200/80 p-3 bg-slate-50/50 flex-shrink-0">
                <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200/60 transition-all"
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
                <div className="mt-2.5 text-center">
                    <p className="text-[9px] text-slate-400 font-medium tracking-wide">
                        Powered by <span className="font-bold text-[#006533]">MaSha Tech Innovations</span>
                    </p>
                </div>
            </div>
        </aside>
    );
}
