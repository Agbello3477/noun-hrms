'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapPin, Clock, Calendar, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';
import Pagination from '../../../components/ui/Pagination';
import TableSkeleton from '../../../components/ui/TableSkeleton';

interface AttendanceLog {
    id: string;
    clockIn: string;
    clockOut?: string;
    status: string;
}

export default function AttendancePage() {
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState('');
    const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/attendance/logs');
            setLogs(response.data);

            // Check if logged in today
            const today = new Date().toDateString();
            const todaysRecord = response.data.find((log: AttendanceLog) =>
                new Date(log.clockIn).toDateString() === today
            );
            setTodayLog(todaysRecord || null);
        } catch (error) {
            console.error('Failed to fetch logs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Request location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    console.error(err);
                    setError('Location access denied. You cannot clock in without location.');
                }
            );
        } else {
            setError('Geolocation is not supported by this browser.');
        }
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [logs]);

    const handleClockIn = async () => {
        if (!location) {
            return setError('Waiting for location...');
        }
        setError('');
        try {
            await api.post('/api/attendance/clock-in', {
                latitude: location.lat,
                longitude: location.lng
            });
            fetchLogs();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to clock in');
        }
    };

    const handleClockOut = async () => {
        setError('');
        try {
            await api.post('/api/attendance/clock-out');
            fetchLogs();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to clock out');
        }
    };

    const paginatedLogs = useMemo(() => {
        return logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [logs, currentPage, pageSize]);

    const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Attendance & Geo-fencing</h1>
                    <p className="text-sm text-gray-500">Record your daily attendance logs within university boundaries.</p>
                </div>
                <button 
                    onClick={fetchLogs} 
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                    title="Refresh logs"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left Side: Clock In/Out card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 shadow-sm">
                                <Clock size={20} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">Time Clock</h2>
                                <p className="text-xs text-gray-400 font-medium">{new Date().toDateString()}</p>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold text-red-600">
                                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-4">
                            {!todayLog ? (
                                <button
                                    onClick={handleClockIn}
                                    disabled={!location}
                                    className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm tracking-wide shadow-sm hover:shadow active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    CLOCK IN
                                </button>
                            ) : !todayLog.clockOut ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl bg-green-50 p-4 text-center border border-green-200">
                                        <p className="text-green-800 font-bold text-sm">Currently Clocked In</p>
                                        <p className="text-xs text-green-600 mt-0.5">Since {new Date(todayLog.clockIn).toLocaleTimeString()}</p>
                                    </div>
                                    <button
                                        onClick={handleClockOut}
                                        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm tracking-wide shadow-sm hover:shadow active:scale-95 transition-all"
                                    >
                                        CLOCK OUT
                                    </button>
                                </div>
                            ) : (
                                <div className="rounded-xl bg-gray-50 p-4 text-center border border-gray-200">
                                    <div className="flex items-center justify-center gap-1.5 text-gray-800 font-bold text-sm">
                                        <CheckCircle2 size={16} className="text-green-500" />
                                        <span>Shift Complete</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 font-medium bg-white border border-gray-150 inline-block px-2.5 py-1 rounded-lg">
                                        {new Date(todayLog.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(todayLog.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex items-center gap-1.5 text-xs text-gray-400 border-t pt-4">
                            <MapPin size={13} className="text-gray-400" />
                            <span className="font-semibold">
                                {location ?
                                    `Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` :
                                    'Acquiring GPS location...'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Beautiful Paginated Table of Recent Logs */}
                <div className="lg:col-span-2 space-y-4">
                    {loading ? (
                        <TableSkeleton rows={5} cols={4} />
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                                <Calendar size={16} className="text-gray-400" />
                                <h2 className="text-sm font-bold text-gray-800">My Attendance Directory</h2>
                            </div>
                            <div className="overflow-x-auto flex-1">
                                <table className="min-w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Clock In</th>
                                            <th className="px-5 py-3">Clock Out</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-12 text-center text-gray-400 font-medium">
                                                    No attendance logs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50/50 transition">
                                                    <td className="px-5 py-3.5 font-semibold text-gray-800">
                                                        {new Date(log.clockIn).toLocaleDateString(undefined, {
                                                            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                                        })}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-medium text-gray-600">
                                                        {new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-medium text-gray-600">
                                                        {log.clockOut ? (
                                                            new Date(log.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        ) : (
                                                            <span className="text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded">Active</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                                                            log.status === 'PRESENT' ? 'bg-green-150 text-green-800' : 'bg-red-150 text-red-800'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {logs.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalItems={logs.length}
                                    pageSize={pageSize}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                                    pageSizeOptions={[5, 10, 20]}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
