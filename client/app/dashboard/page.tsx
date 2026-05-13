'use client';

import { useAuth } from '../../hooks/useAuth';

export default function DashboardHome() {
    const { user } = useAuth();

    return (
        <div>
            <h1 className="mb-6 text-3xl font-bold text-gray-800">
                Welcome back, {user?.name?.split(' ')[0]}!
            </h1>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Stat Card 1 */}
                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500">Total Staff</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">42</p>
                    <span className="text-sm text-green-600">+2 from last month</span>
                </div>

                {/* Stat Card 2 */}
                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500">Active Duty</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">38</p>
                    <span className="text-sm text-gray-500">90% attendance today</span>
                </div>

                {/* Stat Card 3 */}
                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500">Leave Requests</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">3</p>
                    <span className="text-sm text-yellow-600">Pending approval</span>
                </div>

                {/* Stat Card 4 */}
                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500">Next Payroll</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">Jan 25</p>
                    <span className="text-sm text-blue-600">8 days remaining</span>
                </div>
            </div>

            <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Recent Activity</h2>
                <div className="space-y-4">
                    <div className="border-l-4 border-blue-500 bg-blue-50 p-4">
                        <p className="text-sm font-medium text-gray-900">New Staff Registration</p>
                        <p className="text-xs text-gray-600">John Doe was added to the Academic Staff list.</p>
                        <p className="mt-1 text-xs text-gray-400">2 hours ago</p>
                    </div>
                    <div className="border-l-4 border-green-500 bg-green-50 p-4">
                        <p className="text-sm font-medium text-gray-900">Payroll Processed</p>
                        <p className="text-xs text-gray-600">December payroll has been finalized and approved.</p>
                        <p className="mt-1 text-xs text-gray-400">Yesterday</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
