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
    Archive
} from 'lucide-react';


export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const isActive = (path: string) => pathname === path;

    const LinkItem = ({ href, icon: Icon, label }: any) => (
        <Link
            href={href}
            onClick={() => setIsOpen && setIsOpen(false)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive(href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
        >
            <Icon size={20} />
            {label}
        </Link>
    );


    // Helper to determine active silos
    const role = user?.role;
    // const dept = user?.staffProfile?.department; // Legacy check, use Role first now

    // Logic for Enterprise Roles
    const isSuperUser = role === 'SUPER_USER';
    const isAdmin = role === 'ADMIN' || isSuperUser; // Legacy Admin support

    // Registry / HR
    const isRegistry = role === 'HR_ADMIN' || isAdmin;

    // Bursary / Finance
    const isBursary = role === 'BURSARY' || role === 'AUDIT' || isAdmin;
    const isAudit = role === 'AUDIT' || isAdmin;

    // Unit Heads (Directors/Deans) & Managers
    const isUnitHead = role === 'UNIT_HEAD' || role === 'STUDY_CENTER_MANAGER' || role === 'UNIT_ADMIN' || isAdmin;
    const isManager = role === 'STUDY_CENTER_MANAGER';

    // Academic check
    const isAcademic = user?.staffProfile?.cadre === 'ACADEMIC' || isSuperUser || isAdmin;

    return (
        <aside className="h-screen w-52 flex-none border-r border-gray-200 bg-white overflow-y-auto">
            <div className="flex h-16 items-center border-b px-6 gap-3">
                <img src="/noun_logo.png" alt="NOUN" className="h-8 w-8 object-contain" />
                <div className="text-xl font-bold text-nounGreen">NOUN HRMS</div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                <LinkItem href="/dashboard" icon={LayoutDashboard} label="Overview" />

                {/* Core HR (Registry & Admins) */}
                {isRegistry && (
                    <>
                        <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Registry
                        </div>
                        <LinkItem href="/dashboard/hr/files" icon={FolderOpen} label="File Registry" />
                        {['HR_ADMIN', 'SUPER_USER'].includes(role || '') && (
                            <LinkItem href="/dashboard/hr/archive" icon={Archive} label="Registry Archive" />
                        )}
                        <LinkItem href="/dashboard/hr/aper" icon={ClipboardCheck} label="Performance (APER)" />
                        <LinkItem href="/dashboard/staff" icon={Users} label="Staff Directory" />
                        <LinkItem href="/dashboard/registry/transfers" icon={History} label="Transfer History" />
                        <LinkItem href="/dashboard/analytics" icon={BarChart3} label="HR Analytics" />
                        <LinkItem href="/dashboard/registry/queries" icon={AlertTriangle} label="Disciplinary Queries" />
                        <LinkItem href="/dashboard/registry/memos" icon={Mail} label="Registry Memos" />
                    </>
                )}

                {/* Unit Management (Directors, Deans, Center Managers) */}
                {isUnitHead && (
                    <>
                        <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            My Unit
                        </div>
                        <LinkItem href="/dashboard/unit/staff" icon={Briefcase} label="Unit Staff" />
                        <LinkItem href="/dashboard/unit/leaves" icon={FileText} label="Leave Approvals" />
                        <LinkItem href="/dashboard/unit/aper" icon={ClipboardCheck} label="Appraisal Review" />
                        <LinkItem href="/dashboard/unit/transferred-staff" icon={ArrowLeftRight} label="Transferred Staff" />
                        <LinkItem href="/dashboard/registry/queries" icon={AlertTriangle} label="Disciplinary Queries" />
                    </>
                )}

                {/* Study Center Specific */}
                {isManager && (
                    <LinkItem href="/dashboard/attendance" icon={MapPin} label="Attendance" />
                )}

                {/* Bursary Silo */}
                {isBursary && (
                    <>
                        <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Bursary
                        </div>
                        <LinkItem href="/dashboard/payroll" icon={DollarSign} label="Payroll" />
                        {isAudit && <LinkItem href="/dashboard/bursary/audit" icon={Layers} label="Audit Logs" />}
                    </>
                )}

                {/* General Staff Actions (Visible to everyone essentially) */}
                <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                <LinkItem href="/dashboard/staff/aper" icon={ClipboardCheck} label="Appraisal" />
                <LinkItem href="/dashboard/queries" icon={AlertCircle} label="My Queries" />
                <LinkItem href="/dashboard/memos" icon={Mail} label="General Memos" />
                <LinkItem href="/dashboard/leaves?open=apply" icon={FileText} label="Apply for Leave" />

                {/* Academic Services */}
                {isAcademic && (
                    <>
                        <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Academic
                        </div>
                        <LinkItem href="/dashboard/academic/publications" icon={BookOpen} label="My Research" />
                        <LinkItem href="/dashboard/academic/workload" icon={Users} label="Teaching Workload" />
                        <LinkItem href="/dashboard/leaves?open=sabbatical" icon={MapPin} label="Apply Sabbatical" />
                    </>
                )}

                {/* System */}
                {isAdmin && (
                    <>
                        <div className="pt-4 pb-1 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            System
                        </div>
                        <LinkItem href="/dashboard/settings" icon={Settings} label="Settings" />
                        <LinkItem href="/dashboard/system/logs" icon={History} label="Activity Logs" />
                    </>
                )}
            </nav>

            <div className="border-t p-4">
                <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                    <LogOut size={20} />
                    Sign Out
                </button>
                <div className="mt-6 text-center opacity-60">
                    <p className="text-[5px] text-gray-400">
                        Powered by: <span className="font-bold text-nounGreen">MaSha Secure Tech</span>
                    </p>
                </div>
            </div>
        </aside >
    );
}
