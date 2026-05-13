'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock } from 'lucide-react';
import api from '../../../lib/api';

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

    const fetchLogs = async () => {
        try {
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

    return (
        <div>
            <h1 className="mb-6 text-2xl font-bold text-gray-800">Attendance & Geo-fencing</h1>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Time Clock</h2>
                            <p className="text-sm text-gray-500">{new Date().toDateString()}</p>
                        </div>
                    </div>

                    {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

                    <div className="flex flex-col gap-4">
                        {!todayLog ? (
                            <button
                                onClick={handleClockIn}
                                disabled={!location}
                                className="w-full rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                            >
                                CLOCK IN
                            </button>
                        ) : !todayLog.clockOut ? (
                            <div className="space-y-4">
                                <div className="rounded-lg bg-green-50 p-4 text-center border border-green-200">
                                    <p className="text-green-800 font-medium">Currently Clocked In</p>
                                    <p className="text-sm text-green-600">Since {new Date(todayLog.clockIn).toLocaleTimeString()}</p>
                                </div>
                                <button
                                    onClick={handleClockOut}
                                    className="w-full rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-700"
                                >
                                    CLOCK OUT
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-lg bg-gray-50 p-4 text-center border border-gray-200">
                                <p className="text-gray-800 font-medium">Shift Complete</p>
                                <p className="text-sm text-gray-600">
                                    {new Date(todayLog.clockIn).toLocaleTimeString()} - {new Date(todayLog.clockOut).toLocaleTimeString()}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                        <MapPin size={12} />
                        {location ?
                            `Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` :
                            'Acquiring location...'}
                    </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Logs</h2>
                    <div className="space-y-4">
                        {loading ? <p>Loading...</p> : logs.length === 0 ? <p>No logs found.</p> : (
                            logs.slice(0, 5).map(log => (
                                <div key={log.id} className="flex justify-between border-b pb-2 last:border-0">
                                    <div>
                                        <p className="font-medium text-gray-800">{new Date(log.clockIn).toDateString()}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(log.clockIn).toLocaleTimeString()}
                                            {log.clockOut ? ` - ${new Date(log.clockOut).toLocaleTimeString()}` : ' (Active)'}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full h-fit ${log.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {log.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
