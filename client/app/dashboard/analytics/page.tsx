'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { Users, Calendar, Briefcase, Activity } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

interface AnalyticsData {
    totalWorkforce: number;
    activeLeaves: {
        study: number;
        withoutPay: number;
        sick: number;
        sabbatical: number;
        maternity: number;
        paternity: number;
        annual: number;
    };
    genderDistribution: { gender: string; _count: { _all: number } }[];
    zoneDistribution: { zone: string; count: number }[];
}

export default function AnalyticsPage() {
    const { user, isLoading } = useAuth();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await api.get('/api/analytics/dashboard');
                setData(response.data);
            } catch (err: any) {
                console.error('Analytics Error:', err);
                if (err.response?.status === 403) {
                    setError('You do not have permission to view HR Analytics.');
                } else {
                    setError('Failed to load analytics data.');
                }
            } finally {
                setLoading(false);
            }
        };

        if (!isLoading && user) {
            fetchAnalytics();
        }
    }, [isLoading, user]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading analytics...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-medium">{error}</div>;
    if (!data) return null;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">HR Analytics Dashboard</h1>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-600">
                    <div className="flex items-center justify-between mb-4">
                        <Users className="text-blue-600" size={24} />
                        <span className="text-xs font-semibold text-gray-400 uppercase">Total Workforce</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{data.totalWorkforce}</div>
                    <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <Activity size={12} /> Live Data
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between mb-4">
                        <Calendar className="text-yellow-500" size={24} />
                        <span className="text-xs font-semibold text-gray-400 uppercase">Staff on Annual Leave</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{data.activeLeaves.annual}</div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                    <div className="flex items-center justify-between mb-4">
                        <Briefcase className="text-purple-500" size={24} />
                        <span className="text-xs font-semibold text-gray-400 uppercase">Study Leave</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{data.activeLeaves.study}</div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-4">
                        <Activity className="text-red-500" size={24} />
                        <span className="text-xs font-semibold text-gray-400 uppercase">Sick Leave</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{data.activeLeaves.sick}</div>
                </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leave Breakdown */}
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Leave Distribution</h3>
                    <div className="space-y-4">
                        <StatRow label="Sabbatical" value={data.activeLeaves.sabbatical} total={data.totalWorkforce} color="bg-indigo-500" />
                        <StatRow label="Maternity / Paternity" value={data.activeLeaves.maternity + data.activeLeaves.paternity} total={data.totalWorkforce} color="bg-pink-500" />
                        <StatRow label="Leave Without Pay" value={data.activeLeaves.withoutPay} total={data.totalWorkforce} color="bg-gray-500" />
                    </div>
                </div>

                {/* Gender Dist */}
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Gender Demographics</h3>
                    <div className="space-y-4">
                        {data.genderDistribution.map((g) => (
                            <StatRow
                                key={g.gender}
                                label={g.gender || 'Not Specified'}
                                value={g._count._all}
                                total={data.totalWorkforce}
                                color="bg-teal-500"
                            />
                        ))}
                        {data.genderDistribution.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No gender data available</p>}
                    </div>
                </div>
            </div>

            {/* Geo-Political Zones Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Geo-Political Zone Demographics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {data.zoneDistribution.map((z) => (
                        <StatRow
                            key={z.zone}
                            label={z.zone}
                            value={z.count}
                            total={data.totalWorkforce}
                            color="bg-blue-600"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

const StatRow = ({ label, value, total, color }: { label: string, value: number, total: number, color: string }) => {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="flex items-center gap-4">
            <div className="w-32 text-sm text-gray-600 font-medium truncate">{label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(percent, 5)}%` }}></div>
            </div>
            <div className="w-12 text-right text-sm font-bold text-gray-800">{value}</div>
        </div>
    );
};
