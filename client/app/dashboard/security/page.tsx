'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { 
  Shield, AlertTriangle, Users, FileText, Send, CheckCircle, 
  Clock, MapPin, PlusCircle, RefreshCw, Eye, EyeOff 
} from 'lucide-react';

interface Incident {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  location: string;
  attachmentUrl: string | null;
  status: string; // REPORTED, DISPATCHED, RESOLVED
  reporterName: string | null;
  reporter?: { name: string; email: string };
  assignedTo?: { name: string };
  assignedToId?: string | null;
  assignedOfficerIds?: string | null;
  createdAt: string;
}

interface RosterItem {
  id: string;
  shift: string; // MORNING, AFTERNOON, NIGHT
  zone: string;
  date: string;
  user: { name: string; email: string };
}

export default function SecurityDashboard() {
  const { user } = useAuth();
  const role = user?.role;

  // Demo Role Overrides for easy testing/demos in HRMS
  const [activeRole, setActiveRole] = useState<string>('');
  
  useEffect(() => {
    if (user) {
      setActiveRole(user.role);
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState<'command' | 'roster' | 'report' | 'compile' | 'inventory'>('command');

  // Auto-switch non-security roles to report tab
  useEffect(() => {
    if (activeRole && !['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(activeRole)) {
      setActiveTab('report');
    }
  }, [activeRole]);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // Incident Form state
  const [newIncident, setNewIncident] = useState({
    title: '', description: '', category: 'SUSPICIOUS_ACTIVITY', location: '', attachmentUrl: '', isAnonymous: false
  });

  // Roster Form state
  const [newRoster, setNewRoster] = useState({ userId: '', shift: 'MORNING', zone: '', date: '' });
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; role: string }[]>([]);

  // Consolidated Report Form state
  const [newReport, setNewReport] = useState({ startDate: '', endDate: '', summary: '', recommendations: '' });

  // Inventory & Gear Store state
  const [gearList, setGearList] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loadingGear, setLoadingGear] = useState(true);
  const [loadingLoans, setLoadingLoans] = useState(true);

  const [isAddGearModalOpen, setIsAddGearModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  const [gearForm, setGearForm] = useState({ name: '', totalQty: '', unit: 'pcs' });
  const [loanForm, setLoanForm] = useState({ gearId: '', officerId: '', quantity: '1' });

  // Fetch Functions
  const fetchIncidents = async () => {
    try {
      const res = await api.get('/api/security/incidents');
      setIncidents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoster = async () => {
    try {
      const res = await api.get('/api/security/roster');
      setRoster(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await api.get('/api/staff');
      setAllUsers(res.data.map((s: any) => {
        const uId = s.id || (s.user ? s.user.id : '');
        const profile = s.staffProfile || s;
        const name = `${profile.title ? profile.title + ' ' : ''}${profile.surname || ''} ${profile.otherNames || ''}`.trim() || s.name || s.email;
        return { id: uId, name, role: s.role };
      }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeRole && ['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(activeRole)) {
      fetchIncidents();
      fetchRoster();
    }
    if (activeRole && ['SECURITY_HEAD', 'SUPER_USER', 'ADMIN'].includes(activeRole)) {
      fetchAllUsers();
    }
  }, [activeRole]);

  const fetchGear = async () => {
    try {
      setLoadingGear(true);
      const res = await api.get('/api/security/gear');
      setGearList(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGear(false);
    }
  };

  const fetchLoans = async () => {
    try {
      setLoadingLoans(true);
      const res = await api.get('/api/security/gear/loans');
      setLoans(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLoans(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchGear();
      fetchLoans();
      fetchAllUsers();
    }
  }, [activeTab]);

  const handleAddGear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/security/gear', gearForm);
      setMsg({ type: 'success', text: 'Gear item added/updated successfully!' });
      setGearForm({ name: '', totalQty: '', unit: 'pcs' });
      setIsAddGearModalOpen(false);
      fetchGear();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to add gear item' });
    }
  };

  const handleLoanGear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/security/gear/loans', loanForm);
      setMsg({ type: 'success', text: 'Equipment checked out to officer successfully!' });
      setLoanForm({ gearId: '', officerId: '', quantity: '1' });
      setIsLoanModalOpen(false);
      fetchGear();
      fetchLoans();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to checkout gear item' });
    }
  };

  const handleReturnGear = async (loanId: string) => {
    try {
      await api.put(`/api/security/gear/loans/${loanId}/return`);
      setMsg({ type: 'success', text: 'Equipment check-in registered successfully!' });
      fetchGear();
      fetchLoans();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to process equipment return' });
    }
  };

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/security/incidents', newIncident);
      setMsg({ type: 'success', text: 'Incident reported successfully. Security Head notified.' });
      setNewIncident({ title: '', description: '', category: 'SUSPICIOUS_ACTIVITY', location: '', attachmentUrl: '', isAnonymous: false });
      if (['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(activeRole)) {
        fetchIncidents();
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to submit incident report' });
    }
  };

  const handleAssignRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/security/roster', newRoster);
      setMsg({ type: 'success', text: 'Patrol shift roster assigned successfully!' });
      setNewRoster({ userId: '', shift: 'MORNING', zone: '', date: '' });
      fetchRoster();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to assign roster shift' });
    }
  };

  const handleUpdateIncident = async (
    incidentId: string, 
    updates: { priority?: string; status?: string; assignedToId?: string; assignedOfficerIds?: string }
  ) => {
    try {
      await api.put('/api/security/incidents', { incidentId, ...updates });
      setMsg({ type: 'success', text: 'Incident status updated.' });
      fetchIncidents();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to update incident' });
    }
  };

  const handleCompileReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/security/reports', newReport);
      setMsg({ type: 'success', text: 'Consolidated report compiled and transmitted to the Vice-Chancellor (VC).' });
      setNewReport({ startDate: '', endDate: '', summary: '', recommendations: '' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to compile report' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Shield className="text-nounGreen" /> Campus Security Department
          </h1>
          <p className="text-sm text-slate-500">Live command intelligence, roster scheduling, universal reporting, and executive reporting to the VC</p>
        </div>

        {/* Demo switcher */}
        {['SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(role || '') && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
            <span className="text-xs font-bold text-indigo-700">Demo Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value)}
              className="text-xs border rounded bg-white p-1 text-slate-800 font-semibold"
            >
              <option value="SUPER_USER">Super User / Admin (Global)</option>
              <option value="SECURITY_HEAD">Security Head (Command Center)</option>
              <option value="SECURITY_OFFICER">Security Officer (Patrols)</option>
              <option value="STAFF">Regular Staff (Intake Reporter)</option>
            </select>
          </div>
        )}
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl border text-sm font-semibold ${
          msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {msg.text}
          <button onClick={() => setMsg({ type: '', text: '' })} className="ml-auto text-xs underline float-right">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        {['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('command')}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'command' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle size={16} /> Command Center Feed
          </button>
        )}

        {['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('roster')}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'roster' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={16} /> Shifts & Patrols
          </button>
        )}

        <button
          onClick={() => setActiveTab('report')}
          className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'report' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send size={16} /> File Incident Report
        </button>

        {['SECURITY_HEAD', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('compile')}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'compile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} /> Compile VC Report
          </button>
        )}

        {['SECURITY_HEAD', 'SECURITY_OFFICER', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <PlusCircle size={16} /> Inventory & Gear Store
          </button>
        )}
      </div>

      {/* Tab Content Panels */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">

        {/* Tab 1: Live Command Center Feed */}
        {activeTab === 'command' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw size={18} className="text-blue-500 animate-spin-slow" /> Active Threat Feed
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {incidents.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 font-medium border rounded-xl border-dashed">No incidents reported across campus.</div>
              ) : (
                incidents.map((incident) => (
                  <div key={incident.id} className={`border rounded-2xl p-5 shadow-sm transition-all duration-200 hover:border-slate-300 ${
                    incident.priority === 'HIGH' ? 'bg-red-50/20 border-red-200' : 'bg-white'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${
                            incident.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-200' :
                            incident.priority === 'MEDIUM' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {incident.priority} PRIORITY
                          </span>
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{incident.category}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-800 mt-1">{incident.title}</h3>
                      </div>
                      <div className="text-right text-xs text-gray-500 font-semibold">
                        <div className="flex items-center gap-1"><Clock size={13} /> {new Date(incident.createdAt).toLocaleString()}</div>
                        <div className="flex items-center gap-1 mt-0.5 justify-end"><MapPin size={13} className="text-red-500" /> {incident.location}</div>
                      </div>
                    </div>

                    <div className="text-sm text-slate-700 leading-relaxed mb-4">
                      {incident.description}
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-semibold text-slate-500 border-t pt-3.5">
                      <div>
                        Reporter: <strong className="text-slate-700">{incident.reporterName || incident.reporter?.name || 'Anonymous'}</strong>
                      </div>
                      <div>
                        Assigned Officer: <strong className="text-slate-700">{incident.assignedTo?.name || 'Unassigned'}</strong>
                      </div>

                      {/* Command center operations */}
                      {['SECURITY_HEAD', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
                        <div className="flex flex-col gap-3 w-full border-t pt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="border rounded px-2.5 py-1.5 bg-slate-50 text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 transition"
                              value={incident.priority}
                              onChange={(e) => handleUpdateIncident(incident.id, { priority: e.target.value })}
                            >
                              <option value="LOW">Low Priority</option>
                              <option value="MEDIUM">Medium Priority</option>
                              <option value="HIGH">High Priority</option>
                            </select>

                            {incident.status !== 'RESOLVED' ? (
                              <button
                                onClick={() => handleUpdateIncident(incident.id, { status: 'RESOLVED' })}
                                className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-700 shadow-sm transition"
                              >
                                Resolve Threat
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-extrabold flex items-center gap-1 text-xs px-2.5 py-1.5">
                                <CheckCircle size={14} /> Resolved
                              </span>
                            )}
                          </div>

                          {(() => {
                            const assignedIds = incident.assignedOfficerIds
                              ? incident.assignedOfficerIds.split(',').map((id: string) => id.trim()).filter(Boolean)
                              : (incident.assignedToId ? [incident.assignedToId] : []);
                            
                            const securityOfficers = allUsers.filter(u => ['SECURITY_HEAD', 'SECURITY_OFFICER'].includes(u.role));
                            const unassignedOfficers = securityOfficers.filter(u => !assignedIds.includes(u.id));

                            return (
                              <div className="space-y-1.5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Dispatched Handlers / Officers</span>
                                <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                                  {assignedIds.length === 0 ? (
                                    <span className="text-xs text-slate-400 italic">No officers dispatched yet.</span>
                                  ) : (
                                    assignedIds.map(id => {
                                      const u = allUsers.find(user => user.id === id);
                                      const name = u ? u.name : 'Officer';
                                      return (
                                        <span key={id} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full text-xs transition">
                                          {name}
                                          <button
                                            type="button"
                                            title="Unassign officer"
                                            onClick={() => {
                                              const newIds = assignedIds.filter(x => x !== id);
                                              handleUpdateIncident(incident.id, { assignedOfficerIds: newIds.join(',') });
                                            }}
                                            className="hover:text-red-600 transition-colors text-[10px] ml-1 font-bold font-mono"
                                          >
                                            ✕
                                          </button>
                                        </span>
                                      );
                                    })
                                  )}
                                </div>
                                {unassignedOfficers.length > 0 && (
                                  <select
                                    className="border rounded px-2.5 py-1.5 bg-slate-50 text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 transition w-full max-w-xs mt-1"
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const newIds = [...assignedIds, e.target.value];
                                        handleUpdateIncident(incident.id, { assignedOfficerIds: newIds.join(',') });
                                      }
                                    }}
                                  >
                                    <option value="">➕ Dispatch / Assign Officer...</option>
                                    {unassignedOfficers.map((u) => (
                                      <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Shifts & Patrol rosters */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Roster Assignment */}
              {['SECURITY_HEAD', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                    <PlusCircle size={18} className="text-blue-500" /> Assign Patrol Shift
                  </h2>
                  <form onSubmit={handleAssignRoster} className="space-y-4 text-xs font-semibold text-slate-600">
                    <div>
                      <label className="block mb-1">Select Security Officer</label>
                      <select
                        required
                        className="w-full border rounded-lg p-2.5 bg-white outline-none"
                        value={newRoster.userId}
                        onChange={(e) => setNewRoster({ ...newRoster, userId: e.target.value })}
                      >
                        <option value="">Choose Personnel...</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">Shift Time</label>
                      <select
                        className="w-full border rounded-lg p-2.5 bg-white outline-none"
                        value={newRoster.shift}
                        onChange={(e) => setNewRoster({ ...newRoster, shift: e.target.value })}
                      >
                        <option value="MORNING">Morning (06:00 - 14:00)</option>
                        <option value="AFTERNOON">Afternoon (14:00 - 22:00)</option>
                        <option value="NIGHT">Night (22:00 - 06:00)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">Patrol Zone</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Campus Gate A, Registry block"
                        className="w-full border rounded-lg p-2.5 outline-none"
                        value={newRoster.zone}
                        onChange={(e) => setNewRoster({ ...newRoster, zone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Date</label>
                      <input
                        type="date"
                        required
                        className="w-full border rounded-lg p-2.5 outline-none"
                        value={newRoster.date}
                        onChange={(e) => setNewRoster({ ...newRoster, date: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary text-white font-bold text-xs py-2.5 rounded-lg hover:bg-primary-dark"
                    >
                      Publish Roster Entry
                    </button>
                  </form>
                </div>
              )}

              {/* Roster Listing */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock size={18} className="text-slate-500" /> Active Roster Calendar
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roster.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-sm text-gray-400 font-medium">No shifts rostered.</div>
                  ) : (
                    roster.map((item) => (
                      <div key={item.id} className="border p-4 rounded-xl shadow-sm bg-white flex items-center justify-between">
                        <div>
                          <strong className="block text-slate-800 text-sm">{item.user.name}</strong>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">Date: {new Date(item.date).toLocaleDateString()}</span>
                          <span className="text-xs text-blue-600 font-bold mt-1 inline-block flex items-center gap-0.5"><MapPin size={13} /> {item.zone}</span>
                        </div>
                        <span className="bg-slate-100 text-slate-700 border text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
                          {item.shift}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Quick Incident Reporter */}
        {activeTab === 'report' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b pb-2 mb-4">
              <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="text-amber-500" /> Report Security Incident
              </h2>
              <p className="text-xs text-gray-500 font-medium">Report suspicious threats, crimes, or emergencies. Reports are immediately routed to Command Center.</p>
            </div>
            
            <form onSubmit={handleReportIncident} className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Incident Headline / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Theft of laptop at lecture hall"
                    className="w-full border rounded-lg p-2.5 outline-none"
                    value={newIncident.title}
                    onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1">Category</label>
                  <select
                    className="w-full border rounded-lg p-2.5 bg-white outline-none"
                    value={newIncident.category}
                    onChange={(e) => setNewIncident({ ...newIncident, category: e.target.value })}
                  >
                    <option value="THEFT">Theft / Burglary</option>
                    <option value="VANDALISM">Vandalism</option>
                    <option value="MEDICAL_EMERGENCY">Medical Emergency</option>
                    <option value="ASSAULT">Assault / Violence</option>
                    <option value="SUSPICIOUS_ACTIVITY">Suspicious Activity</option>
                    <option value="OTHER">Other Threat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Campus Location Pin</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Faculty of Science, Room 102"
                    className="w-full border rounded-lg p-2.5 outline-none"
                    value={newIncident.location}
                    onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1">Attachment Url (Photo/Evidence)</label>
                  <input
                    type="text"
                    placeholder="Optional image link or path"
                    className="w-full border rounded-lg p-2.5 outline-none"
                    value={newIncident.attachmentUrl}
                    onChange={(e) => setNewIncident({ ...newIncident, attachmentUrl: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Incident Description Details</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide precise descriptions of suspects, sequence of events, and safety requirements..."
                  className="w-full border rounded-lg p-2.5 outline-none"
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                />
              </div>

              {/* Anonymous Report Toggle */}
              <div className="flex items-center gap-2 border bg-slate-50/50 rounded-xl p-3">
                <button
                  type="button"
                  onClick={() => setNewIncident({ ...newIncident, isAnonymous: !newIncident.isAnonymous })}
                  className="text-slate-600 flex items-center gap-1.5"
                >
                  {newIncident.isAnonymous ? <EyeOff className="text-red-500" size={18} /> : <Eye className="text-nounGreen" size={18} />}
                  <span>Report anonymously (Hides your identity from records)</span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full bg-nounGreen text-white font-bold text-sm py-2.5 rounded-lg shadow-sm"
              >
                Transmit Incident Report
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Compile Consolidated Executive Report */}
        {activeTab === 'compile' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b pb-2 mb-4">
              <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5">
                <FileText className="text-blue-500" /> Compile Consolidated Security Report
              </h2>
              <p className="text-xs text-gray-500 font-medium">Aggregates incident stats across specified date ranges and files a direct report to the VC office.</p>
            </div>

            <form onSubmit={handleCompileReport} className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Report Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-lg p-2.5 outline-none"
                    value={newReport.startDate}
                    onChange={(e) => setNewReport({ ...newReport, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1">Report End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-lg p-2.5 outline-none"
                    value={newReport.endDate}
                    onChange={(e) => setNewReport({ ...newReport, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1">Executive Summary (Intel & Crime Trends)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail aggregated findings, active patrols, command changes during the period..."
                  className="w-full border rounded-lg p-2.5 outline-none"
                  value={newReport.summary}
                  onChange={(e) => setNewReport({ ...newReport, summary: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">Strategic Recommendations (Budgets, Patrol additions)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Recommend policy changes directly to university management..."
                  className="w-full border rounded-lg p-2.5 outline-none"
                  value={newReport.recommendations}
                  onChange={(e) => setNewReport({ ...newReport, recommendations: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white font-bold text-sm py-2.5 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Send size={15} /> Transmit Consolidated Report to VC
              </button>
            </form>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Gear Inventory Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Tactical Gear & Assets Store</h2>
                <p className="text-xs text-slate-500">Track and dispatch patrol gear (vehicles, communication radios, uniforms) to officers.</p>
              </div>
              {['SECURITY_HEAD', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddGearModalOpen(true)}
                    className="bg-primary hover:bg-primary-dark text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <PlusCircle size={14} /> Add Inventory
                  </button>
                  <button
                    onClick={() => setIsLoanModalOpen(true)}
                    className="bg-primary hover:bg-primary-dark text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <Send size={14} /> Dispatch Equipment
                  </button>
                </div>
              )}
            </div>

            {/* Gear Items Grid */}
            {loadingGear ? (
              <div className="flex justify-center py-6">
                <RefreshCw className="animate-spin text-blue-600 w-6 h-6" />
              </div>
            ) : gearList.length === 0 ? (
              <div className="text-center p-8 border rounded-xl bg-slate-50/50 text-slate-400 text-xs font-semibold">
                No inventory assets registered yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {gearList.map((g) => (
                  <div key={g.id} className="border p-4 rounded-xl shadow-sm space-y-3 bg-slate-50/30">
                    <div className="flex justify-between items-start">
                      <strong className="text-slate-800 text-sm block">{g.name}</strong>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                        g.availableQty < 5 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {g.availableQty < 5 ? 'Low Stock' : 'Good Stock'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      <div>
                        <span className="block text-[9px] text-slate-400 uppercase">Available</span>
                        <strong className="text-sm text-slate-800">{g.availableQty} {g.unit}</strong>
                      </div>
                      <div>
                        <span className="block text-[9px] text-slate-400 uppercase">Total Pool</span>
                        <strong className="text-sm text-slate-600">{g.totalQty} {g.unit}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loans log section */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Active Patrol Dispatches & Loans</h3>
              {loadingLoans ? (
                <div className="flex justify-center py-6">
                  <RefreshCw className="animate-spin text-blue-600 w-6 h-6" />
                </div>
              ) : loans.length === 0 ? (
                <div className="text-center p-8 border rounded-xl bg-slate-50/50 text-slate-400 text-xs font-semibold">
                  No active gear dispatches logged.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left text-xs font-semibold text-slate-700">
                    <thead className="bg-slate-50 uppercase text-[10px] text-slate-400 tracking-wider">
                      <tr>
                        <th className="p-3">Gear Item</th>
                        <th className="p-3">Officer</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Loaned At</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loans.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/30">
                          <td className="p-3 font-bold text-slate-800">{l.gear.name}</td>
                          <td className="p-3">
                            <div>{l.officer.name || 'Unknown Officer'}</div>
                            <div className="text-[10px] text-gray-400">{l.officer.email}</div>
                          </td>
                          <td className="p-3 text-slate-600 font-bold">{l.quantity} {l.gear.unit}</td>
                          <td className="p-3 text-slate-500">{new Date(l.loanedAt).toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              l.status === 'RETURNED' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {l.status === 'LOANED' && ['SECURITY_HEAD', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
                              <button
                                onClick={() => handleReturnGear(l.id)}
                                className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-[10px] font-bold hover:bg-primary/20"
                              >
                                Mark Returned
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* MODALS */}
            {isAddGearModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Add/Update Gear Asset</h3>
                  <form onSubmit={handleAddGear} className="space-y-3 text-xs font-semibold text-slate-500 font-bold">
                    <div>
                      <label className="block mb-1">Asset Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Walkie-Talkie Motorola"
                        className="w-full border rounded-lg p-2.5 outline-none text-slate-700 font-bold focus:border-blue-500"
                        value={gearForm.name}
                        onChange={(e) => setGearForm({ ...gearForm, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1">Total Quantity</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 50"
                          className="w-full border rounded-lg p-2.5 outline-none text-slate-700 font-bold focus:border-blue-500"
                          value={gearForm.totalQty}
                          onChange={(e) => setGearForm({ ...gearForm, totalQty: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Unit</label>
                        <input
                          type="text"
                          required
                          placeholder="pcs"
                          className="w-full border rounded-lg p-2.5 outline-none text-slate-700 font-bold focus:border-blue-500"
                          value={gearForm.unit}
                          onChange={(e) => setGearForm({ ...gearForm, unit: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddGearModalOpen(false)}
                        className="border px-3.5 py-2 rounded-lg font-bold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="bg-primary text-white font-bold px-3.5 py-2 rounded-lg">
                        Save Asset
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {isLoanModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-800">Dispatch Gear to Patrol Officer</h3>
                  <form onSubmit={handleLoanGear} className="space-y-3 text-xs font-semibold text-slate-500">
                    <div>
                      <label className="block mb-1 font-bold">Select Equipment</label>
                      <select
                        required
                        className="w-full border rounded-lg p-2.5 outline-none text-slate-700 font-bold focus:border-blue-500"
                        value={loanForm.gearId}
                        onChange={(e) => setLoanForm({ ...loanForm, gearId: e.target.value })}
                      >
                        <option value="">-- Choose Gear --</option>
                        {gearList.map(g => (
                          <option key={g.id} value={g.id} disabled={g.availableQty <= 0}>
                            {g.name} ({g.availableQty} available)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 font-bold">Select Patrol Officer</label>
                      <select
                        required
                        className="w-full border rounded-lg p-2.5 outline-none text-slate-700 font-bold focus:border-primary"
                        value={loanForm.officerId}
                        onChange={(e) => setLoanForm({ ...loanForm, officerId: e.target.value })}
                      >
                        <option value="">-- Choose Officer --</option>
                        {allUsers.filter(u => ['SECURITY_HEAD', 'SECURITY_OFFICER', 'STAFF'].includes(u.role)).map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role.replace(/_/g, ' ')})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 font-bold">Quantity</label>
                      <input
                        type="number"
                        required
                        min={1}
                        className="w-full border rounded-lg p-2.5 outline-none text-slate-700 font-bold focus:border-primary"
                        value={loanForm.quantity}
                        onChange={(e) => setLoanForm({ ...loanForm, quantity: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsLoanModalOpen(false)}
                        className="border px-3.5 py-2 rounded-lg font-bold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="bg-primary text-white font-bold px-3.5 py-2 rounded-lg">
                        Dispatch
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
