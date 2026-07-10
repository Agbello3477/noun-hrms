'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { FileText, Calendar, BarChart3, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Report {
  id: string;
  startDate: string;
  endDate: string;
  summary: string;
  totalIncidents: number;
  highPriorityIncidents: number;
  recommendations: string;
  createdAt: string;
  author: { name: string };
}

export default function SecurityReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      // Security Head and VC pull reports from backend
      const res = await api.get('/api/security/incidents'); // Reuse endpoints or pull
      // To satisfy retrieving consolidated reports specifically:
      // Let's create an endpoint in security controller for reports if it doesn't exist,
      // or we can fetch them via a generic fetch since we mapped reports.
      // Wait, let's make sure we expose GET /reports on backend routing so it is clean!
      const reportRes = await api.get('/api/security/reports');
      setReports(reportRes.data);
    } catch (err) {
      console.error('Failed to fetch consolidated reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Link href="/dashboard/security" className="text-gray-400 hover:text-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-500" /> Consolidated Security Intelligence
          </h1>
          <p className="text-sm text-slate-500">Official security audits and command summaries submitted to the VC Executive Office</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-2xl bg-slate-50 text-sm text-gray-400 font-semibold">
          No consolidated reports have been submitted yet.
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <div key={report.id} className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
              
              {/* Report Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3.5">
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Security Roster Summary</span>
                  <strong className="text-base text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Calendar size={16} className="text-blue-500" />
                    {new Date(report.startDate).toLocaleDateString()} — {new Date(report.endDate).toLocaleDateString()}
                  </strong>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                  <div className="bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <BarChart3 size={14} /> Total Incidents: {report.totalIncidents}
                  </div>
                  <div className="bg-red-50 text-red-650 border border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <ShieldAlert size={14} /> High Threats: {report.highPriorityIncidents}
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div className="space-y-4 text-xs font-semibold text-slate-650 leading-relaxed">
                <div>
                  <span className="text-slate-500 text-[10px] block mb-1 uppercase tracking-wider">Executive Summary</span>
                  <p className="bg-slate-50 p-4 rounded-xl font-medium text-slate-800">{report.summary}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block mb-1 uppercase tracking-wider">Strategic Recommendations</span>
                  <p className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/40 text-indigo-900 font-medium">{report.recommendations}</p>
                </div>
              </div>

              {/* Report Footer */}
              <div className="text-[10px] text-gray-400 font-bold border-t pt-3 flex justify-between items-center uppercase tracking-wider">
                <span>Submitted by: {report.author?.name || 'Security Head'}</span>
                <span>Transmitted: {new Date(report.createdAt).toLocaleDateString()}</span>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
