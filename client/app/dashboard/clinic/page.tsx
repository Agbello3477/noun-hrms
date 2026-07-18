'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { 
  Heart, Activity, Search, PlusCircle, Clipboard, FileText, 
  Beaker, Pill, Save, CheckCircle, RefreshCw, AlertCircle 
} from 'lucide-react';

interface PatientFile {
  id: string;
  patientId: string;
  name: string;
  gender: string;
  dob: string;
  bloodGroup: string | null;
  genotype: string | null;
  allergies: string | null;
  medicalHistory: string;
  encounters?: Encounter[];
}

interface Encounter {
  id: string;
  patientFileId: string;
  patientFile: PatientFile;
  status: string; // TRIAGE, AWAITING_DOCTOR, CONSULTATION, LAB_REQUESTED, PHARMACY_REQUESTED, CLOSED
  bp?: string | null;
  temperature?: number | null;
  weight?: number | null;
  symptoms?: string | null;
  clinicalNotes?: string | null;
  diagnoses?: string | null;
  labTests?: string | null;
  labResults?: string | null;
  prescriptions?: string | null;
  pharmacyStatus: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export default function ClinicDashboard() {
  const { user } = useAuth();
  
  // Custom role overrides for easy testing/demos in HRMS
  const [activeRole, setActiveRole] = useState<string>('');
  
  useEffect(() => {
    if (user) {
      setActiveRole(user.role);
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState<'records' | 'triage' | 'consultation' | 'laboratory' | 'pharmacy'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // Form states
  const [newPatient, setNewPatient] = useState({
    patientId: '', name: '', gender: 'MALE', dob: '', bloodGroup: 'O+', genotype: 'AA', allergies: '', medicalHistory: ''
  });
  const [triageVitals, setTriageVitals] = useState({ encounterId: '', bp: '', temperature: '', weight: '', symptoms: '' });
  const [consultNotes, setConsultNotes] = useState({ encounterId: '', clinicalNotes: '', diagnoses: '', labTests: '', prescriptions: '' });
  const [labInput, setLabInput] = useState({ encounterId: '', labResults: '' });
  // Tracks which routing action the doctor explicitly chose
  const [consultAction, setConsultAction] = useState<'LAB' | 'PHARMACY' | 'CLOSE'>('CLOSE');
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  
  // Inventory form
  const [newStock, setNewStock] = useState({ name: '', quantity: '', unit: 'tabs' });

  // ── Desktop Notifications ─────────────────────────────────────────────────
  // Use a ref so count changes never cause the effect to restart (infinite-loop fix)
  const prevQueueCountRef = useRef<number>(-1);

  const sendDesktopNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }, []);

  // Request notification permission once when activeRole is known
  useEffect(() => {
    if (!activeRole) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [activeRole]);

  // Stable polling effect – deps are ONLY activeRole and activeTab
  useEffect(() => {
    if (!activeRole) return;

    const poll = async () => {
      try {
        let statusFilter = '';
        if (activeRole === 'CLINIC_DOCTOR') statusFilter = 'AWAITING_DOCTOR';
        else if (activeRole === 'CLINIC_LAB_SCIENTIST') statusFilter = 'LAB_REQUESTED';
        else if (activeRole === 'CLINIC_PHARMACIST') statusFilter = 'PHARMACY_REQUESTED';
        else if (activeRole === 'CLINIC_NURSE') statusFilter = 'TRIAGE';

        const url = statusFilter
          ? `/api/clinic/encounters?status=${statusFilter}`
          : '/api/clinic/encounters';

        const res = await api.get(url);
        const currentCount: number = res.data.length;
        const prev = prevQueueCountRef.current;

        // Notify only when the queue genuinely grows (skip the very first poll)
        if (prev !== -1 && currentCount > prev) {
          const newest = res.data[0];
          const patientName = newest?.patientFile?.name || 'A Patient';

          if (activeRole === 'CLINIC_DOCTOR') {
            sendDesktopNotification(
              '🩺 New Patient in Queue',
              `${patientName}'s vitals have been logged. Awaiting your consultation.`
            );
          } else if (activeRole === 'CLINIC_LAB_SCIENTIST') {
            sendDesktopNotification('🔬 Lab Test Requested', `Tests have been ordered for ${patientName}.`);
          } else if (activeRole === 'CLINIC_PHARMACIST') {
            sendDesktopNotification('💊 New Prescription Ready', `Dispense medication for ${patientName}.`);
          } else if (activeRole === 'CLINIC_NURSE') {
            sendDesktopNotification('🏥 New Patient Check-In', `${patientName} is ready for triage.`);
          }
        }

        // Always update ref – never causes re-render / effect restart
        prevQueueCountRef.current = currentCount;

        // Refresh the visible list when the correct tab is active
        if (
          (activeRole === 'CLINIC_DOCTOR' && activeTab === 'consultation') ||
          (activeRole === 'CLINIC_LAB_SCIENTIST' && activeTab === 'laboratory') ||
          (activeRole === 'CLINIC_PHARMACIST' && activeTab === 'pharmacy') ||
          (activeRole === 'CLINIC_NURSE' && activeTab === 'triage')
        ) {
          setEncounters(res.data);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // Immediately poll then repeat every 6 s
    poll();
    const interval = setInterval(poll, 6000);
    return () => clearInterval(interval);
  // ⚠ prevQueueCountRef intentionally omitted – it's a ref, not state
  }, [activeRole, activeTab, sendDesktopNotification]);

  // Fetch functions
  const fetchPatientFiles = async () => {
    try {
      const res = await api.get(`/api/clinic/patients?query=${searchQuery}`);
      setPatientFiles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEncounters = async (status?: string) => {
    try {
      const res = await api.get(`/api/clinic/encounters${status ? `?status=${status}` : ''}`);
      setEncounters(res.data);
      // Sync ref so the next poll comparison is accurate (no state update = no effect restart)
      prevQueueCountRef.current = res.data.length;
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await api.get('/api/clinic/inventory');
      setInventory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPatientFiles();
    fetchEncounters();
    fetchInventory();
  }, [searchQuery]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/clinic/patients', newPatient);
      setMsg({ type: 'success', text: 'Patient record created successfully!' });
      setNewPatient({ patientId: '', name: '', gender: 'MALE', dob: '', bloodGroup: 'O+', genotype: 'AA', allergies: '', medicalHistory: '' });
      fetchPatientFiles();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create record' });
    }
  };

  const handleStartEncounter = async (patientFileId: string) => {
    try {
      const res = await api.post('/api/clinic/encounters', { patientFileId });
      setMsg({ type: 'success', text: 'New clinical encounter started.' });
      fetchEncounters();
      setActiveTab('triage');
      setTriageVitals(prev => ({ ...prev, encounterId: res.data.id }));
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to start encounter' });
    }
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/clinic/triage', triageVitals);
      setMsg({ type: 'success', text: 'Patient vitals triaged successfully!' });
      setTriageVitals({ encounterId: '', bp: '', temperature: '', weight: '', symptoms: '' });
      fetchEncounters();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to record vitals' });
    }
  };

  const handleSaveConsult = async (e: React.FormEvent, action: 'LAB' | 'PHARMACY' | 'CLOSE') => {
    e.preventDefault();
    // Build the payload — clear fields that don't apply for the chosen route
    const payload = {
      ...consultNotes,
      labTests: action === 'LAB' ? consultNotes.labTests : '',
      prescriptions: action === 'PHARMACY' ? consultNotes.prescriptions : '',
    };
    const actionLabel = action === 'LAB' ? 'Laboratory' : action === 'PHARMACY' ? 'Pharmacy' : 'Closed';
    try {
      await api.post('/api/clinic/consultation', payload);
      setMsg({ type: 'success', text: `Consultation saved — Patient routed to ${actionLabel}.` });
      setConsultNotes({ encounterId: '', clinicalNotes: '', diagnoses: '', labTests: '', prescriptions: '' });
      setSelectedEncounter(null);
      setConsultAction('CLOSE');
      fetchEncounters();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save consultation details' });
    }
  };

  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/clinic/lab', labInput);
      setMsg({ type: 'success', text: 'Laboratory test results uploaded successfully!' });
      setLabInput({ encounterId: '', labResults: '' });
      fetchEncounters();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to upload lab data' });
    }
  };

  const handleDispense = async (encounterId: string, prescriptions: string) => {
    try {
      // Parse prescription string (e.g. "Paracetamol (10), Amalar (2)") into parsed stock items
      const parsedItems = prescriptions.split(',').map(item => {
        const match = item.match(/(.+?)\s*\((\d+)\)/);
        if (match) {
          return { name: match[1].trim(), quantity: parseInt(match[2]) };
        }
        return { name: item.trim(), quantity: 1 };
      });

      await api.post('/api/clinic/dispense', { encounterId, items: parsedItems });
      setMsg({ type: 'success', text: 'Medication dispensed and stock updated successfully!' });
      fetchEncounters();
      fetchInventory();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to dispense medication' });
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/clinic/inventory', newStock);
      setMsg({ type: 'success', text: 'Stock items updated successfully!' });
      setNewStock({ name: '', quantity: '', unit: 'tabs' });
      fetchInventory();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to update stock' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Heart className="text-red-500 fill-red-500 animate-pulse" /> University Healthcare Center
          </h1>
          <p className="text-sm text-slate-500">Secure clinical patients, triage logs, consultations, laboratory workflows, and inventory tracking</p>
        </div>

        {/* Demo Role Switcher for HRMS Admins & Super Users */}
        {['SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(user?.role || '') && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
            <span className="text-xs font-bold text-indigo-700">Demo Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value)}
              className="text-xs border rounded bg-white p-1 text-slate-800 font-semibold"
            >
              <option value="SUPER_USER">Super User / Admin (Global)</option>
              <option value="CLINIC_NURSE">Clinic Nurse (Triage)</option>
              <option value="CLINIC_DOCTOR">Medical Doctor (Consultation)</option>
              <option value="CLINIC_LAB_SCIENTIST">Lab Scientist (Results)</option>
              <option value="CLINIC_PHARMACIST">Pharmacist (Prescriptions)</option>
            </select>
          </div>
        )}
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {msg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {msg.text}
          <button onClick={() => setMsg({ type: '', text: '' })} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('records')}
          className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'records' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search size={16} /> Patient Files
        </button>

        {['CLINIC_NURSE', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('triage')}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'triage' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} /> Nurse Triage
          </button>
        )}

        {['CLINIC_DOCTOR', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => {
              setActiveTab('consultation');
              // Fetch all encounters — the queue filter handles AWAITING_DOCTOR | CONSULTATION in JSX
              fetchEncounters();
            }}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'consultation' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clipboard size={16} /> Doctor Consultation
          </button>
        )}

        {['CLINIC_LAB_SCIENTIST', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => {
              setActiveTab('laboratory');
              fetchEncounters('LAB_REQUESTED');
            }}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'laboratory' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Beaker size={16} /> Laboratory
          </button>
        )}

        {['CLINIC_PHARMACIST', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => {
              setActiveTab('pharmacy');
              fetchEncounters('PHARMACY_REQUESTED');
            }}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'pharmacy' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pill size={16} /> Pharmacy & Inventory
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        
        {/* Tab 1: Records Search & Register */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Search & Results */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Search size={18} className="text-primary" /> Search Patient Files
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Employee ID, Student Matrix, or Name..."
                    className="w-full border rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                </div>

                <div className="border rounded-xl divide-y overflow-hidden max-h-[400px] overflow-y-auto">
                  {patientFiles.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 font-medium">No matching patient files found.</div>
                  ) : (
                    patientFiles.map((file) => (
                      <div key={file.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{file.name}</div>
                          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                            Patient ID: {file.patientId} | DOB: {new Date(file.dob).toLocaleDateString()} | Gender: {file.gender}
                          </div>
                          <div className="text-xs font-medium text-slate-500 mt-1">
                            Blood: <strong className="text-slate-700">{file.bloodGroup || 'N/A'}</strong> | Genotype: <strong className="text-slate-700">{file.genotype || 'N/A'}</strong>
                          </div>
                        </div>
                        {['CLINIC_NURSE', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
                          <button
                            onClick={() => handleStartEncounter(file.id)}
                            className="bg-primary text-white font-bold text-xs py-2 px-4 rounded-lg hover:bg-primary-dark shadow-sm flex items-center gap-1"
                          >
                            <PlusCircle size={14} /> Start Visit
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Create Patient File */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                  <PlusCircle size={18} className="text-emerald-500" /> New Patient File
                </h2>
                <form onSubmit={handleCreatePatient} className="space-y-3.5 text-xs font-semibold text-slate-600">
                  <div>
                    <label className="block mb-1">Employee ID / Student Matrix</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 outline-none"
                      required
                      placeholder="e.g. ST-4921 or NOUN/2026/001"
                      value={newPatient.patientId}
                      onChange={(e) => setNewPatient({ ...newPatient, patientId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Full Name</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 outline-none"
                      placeholder="Auto-pulls if HR staff matches"
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1">Gender</label>
                      <select
                        className="w-full border rounded-lg p-2 outline-none bg-white"
                        value={newPatient.gender}
                        onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">Date of Birth</label>
                      <input
                        type="date"
                        className="w-full border rounded-lg p-2 outline-none"
                        required
                        value={newPatient.dob}
                        onChange={(e) => setNewPatient({ ...newPatient, dob: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1">Blood Group</label>
                      <select
                        className="w-full border rounded-lg p-2 bg-white outline-none"
                        value={newPatient.bloodGroup}
                        onChange={(e) => setNewPatient({ ...newPatient, bloodGroup: e.target.value })}
                      >
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">Genotype</label>
                      <select
                        className="w-full border rounded-lg p-2 bg-white outline-none"
                        value={newPatient.genotype}
                        onChange={(e) => setNewPatient({ ...newPatient, genotype: e.target.value })}
                      >
                        <option value="AA">AA</option>
                        <option value="AS">AS</option>
                        <option value="AC">AC</option>
                        <option value="SS">SS</option>
                        <option value="SC">SC</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1">Allergies</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 outline-none"
                      placeholder="e.g. Penicillin, Peanuts"
                      value={newPatient.allergies}
                      onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Medical History (Encrypted in DB)</label>
                    <textarea
                      rows={3}
                      className="w-full border rounded-lg p-2 outline-none"
                      placeholder="Enter prior diagnoses, chronic conditions..."
                      value={newPatient.medicalHistory}
                      onChange={(e) => setNewPatient({ ...newPatient, medicalHistory: e.target.value })}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary text-white font-bold text-xs py-2 rounded-lg hover:bg-primary-dark"
                  >
                    Create & Encrypt Record
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Nurse Triage Vitals */}
        {activeTab === 'triage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Triage Queue */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Activity size={18} className="text-red-500" /> Triage Intake Queue
                </h2>
                <div className="border rounded-xl divide-y overflow-hidden max-h-[400px] overflow-y-auto">
                  {encounters.filter(e => e.status === 'TRIAGE').length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 font-medium">Triage queue is empty.</div>
                  ) : (
                    encounters.filter(e => e.status === 'TRIAGE').map((e) => (
                      <div key={e.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{e.patientFile?.name || 'Unknown Patient'}</div>
                          <div className="text-xs text-gray-500 font-semibold">Patient ID: {e.patientFile?.patientId || 'N/A'}</div>
                        </div>
                        <button
                          onClick={() => setTriageVitals(prev => ({ ...prev, encounterId: e.id }))}
                          className="bg-red-50 text-red-600 border border-red-200 font-bold text-xs py-2 px-4 rounded-lg hover:bg-red-100"
                        >
                          Record Vitals
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Triage Form */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                  <Clipboard size={18} className="text-red-500" /> Vitals Log
                </h2>
                {triageVitals.encounterId ? (
                  <form onSubmit={handleSaveTriage} className="space-y-4 text-xs font-semibold text-slate-600">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block mb-1">BP (mmHg)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 120/80"
                          className="w-full border rounded-lg p-2.5 outline-none"
                          value={triageVitals.bp}
                          onChange={(e) => setTriageVitals({ ...triageVitals, bp: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Temp (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          placeholder="36.5"
                          className="w-full border rounded-lg p-2.5 outline-none"
                          value={triageVitals.temperature}
                          onChange={(e) => setTriageVitals({ ...triageVitals, temperature: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          placeholder="72"
                          className="w-full border rounded-lg p-2.5 outline-none"
                          value={triageVitals.weight}
                          onChange={(e) => setTriageVitals({ ...triageVitals, weight: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-1">Recorded Symptoms</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Describe current complaints and symptoms..."
                        className="w-full border rounded-lg p-2.5 outline-none"
                        value={triageVitals.symptoms}
                        onChange={(e) => setTriageVitals({ ...triageVitals, symptoms: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-red-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-red-700 flex items-center justify-center gap-1.5"
                    >
                      <Save size={14} /> Push to Doctor Queue
                    </button>
                  </form>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400 font-medium">Select a patient from the queue to record vitals.</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Doctor Consultation */}
        {activeTab === 'consultation' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Consultation Queue */}
              <div className="space-y-4 lg:col-span-1">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Clipboard size={18} className="text-indigo-500" /> Consult Queue
                </h2>
                <div className="border rounded-xl divide-y overflow-hidden max-h-[400px] overflow-y-auto">
                  {encounters.filter(e => ['AWAITING_DOCTOR', 'CONSULTATION'].includes(e.status)).length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 font-medium">No patients waiting.</div>
                  ) : (
                    encounters.filter(e => ['AWAITING_DOCTOR', 'CONSULTATION'].includes(e.status)).map((e) => (
                      <div key={e.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{e.patientFile?.name || 'Unknown Patient'}</div>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            e.status === 'CONSULTATION' ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-600 border border-green-200'
                          }`}>
                            {e.status === 'CONSULTATION' ? 'Lab Ready' : 'Vitals Ready'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEncounter(e);
                            setConsultNotes(prev => ({ ...prev, encounterId: e.id }));
                          }}
                          className="bg-indigo-600 text-white font-bold text-xs py-2 px-3 rounded-lg hover:bg-indigo-700 shadow-sm"
                        >
                          Diagnose
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Consultation Panel */}
              <div className="lg:col-span-2 space-y-4">
                {selectedEncounter ? (
                  <div className="space-y-4">
                    {/* Patient Overview */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Patient Name:</span>
                        <strong className="text-slate-800 text-sm">{selectedEncounter.patientFile?.name || 'Unknown Patient'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">BP:</span>
                        <strong className="text-slate-800">{selectedEncounter.bp}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Temp / Weight:</span>
                        <strong className="text-slate-800">{selectedEncounter.temperature}°C / {selectedEncounter.weight}kg</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Allergies:</span>
                        <strong className="text-red-600">{selectedEncounter.patientFile?.allergies || 'None'}</strong>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700">
                      <strong className="block mb-1">Nurse Symptoms Log:</strong>
                      <p className="italic">{selectedEncounter.symptoms}</p>
                    </div>

                    {selectedEncounter.labResults && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-slate-700">
                        <strong className="text-amber-800 block mb-1">Laboratory Test Results:</strong>
                        <p className="font-mono">{selectedEncounter.labResults}</p>
                      </div>
                    )}

                    {/* Diagnose Form */}
                    <form className="space-y-4 text-xs font-semibold text-slate-600">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1">Clinical Diagnoses <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Severe Malaria, Respiratory infection"
                            className="w-full border rounded-lg p-2.5 outline-none focus:border-indigo-400"
                            value={consultNotes.diagnoses}
                            onChange={(e) => setConsultNotes({ ...consultNotes, diagnoses: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block mb-1">Clinical Treatment Notes <span className="text-red-500">*</span></label>
                          <input
                            required
                            placeholder="Log consultation findings, patient guidance..."
                            className="w-full border rounded-lg p-2.5 outline-none focus:border-indigo-400"
                            value={consultNotes.clinicalNotes}
                            onChange={(e) => setConsultNotes({ ...consultNotes, clinicalNotes: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* ── Routing Destination ───────────────────────────────────── */}
                      <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Route Patient After Consultation</p>

                        <div className="grid grid-cols-3 gap-3">
                          {/* Option 1 – Lab */}
                          <label
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              consultAction === 'LAB'
                                ? 'border-amber-400 bg-amber-50'
                                : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="routeAction"
                              className="hidden"
                              checked={consultAction === 'LAB'}
                              onChange={() => setConsultAction('LAB')}
                            />
                            <Beaker size={22} className={consultAction === 'LAB' ? 'text-amber-500' : 'text-slate-400'} />
                            <span className={`font-bold text-[11px] ${consultAction === 'LAB' ? 'text-amber-700' : 'text-slate-500'}`}>Send to Lab</span>
                          </label>

                          {/* Option 2 – Pharmacy */}
                          <label
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              consultAction === 'PHARMACY'
                                ? 'border-green-400 bg-green-50'
                                : 'border-slate-200 hover:border-green-300 hover:bg-green-50/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="routeAction"
                              className="hidden"
                              checked={consultAction === 'PHARMACY'}
                              onChange={() => setConsultAction('PHARMACY')}
                            />
                            <Pill size={22} className={consultAction === 'PHARMACY' ? 'text-green-500' : 'text-slate-400'} />
                            <span className={`font-bold text-[11px] ${consultAction === 'PHARMACY' ? 'text-green-700' : 'text-slate-500'}`}>Send to Pharmacy</span>
                          </label>

                          {/* Option 3 – Close */}
                          <label
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              consultAction === 'CLOSE'
                                ? 'border-slate-400 bg-slate-100'
                                : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="routeAction"
                              className="hidden"
                              checked={consultAction === 'CLOSE'}
                              onChange={() => setConsultAction('CLOSE')}
                            />
                            <CheckCircle size={22} className={consultAction === 'CLOSE' ? 'text-slate-600' : 'text-slate-400'} />
                            <span className={`font-bold text-[11px] ${consultAction === 'CLOSE' ? 'text-slate-700' : 'text-slate-500'}`}>Close Encounter</span>
                          </label>
                        </div>

                        {/* Contextual input for Lab or Pharmacy */}
                        {consultAction === 'LAB' && (
                          <div>
                            <label className="block mb-1 text-amber-700">Lab Tests to Order <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Malaria Parasite (MP), Full Blood Count, Widal Test"
                              className="w-full border-2 border-amber-300 rounded-lg p-2.5 outline-none focus:border-amber-500 bg-amber-50/30"
                              value={consultNotes.labTests}
                              onChange={(e) => setConsultNotes({ ...consultNotes, labTests: e.target.value })}
                            />
                          </div>
                        )}

                        {consultAction === 'PHARMACY' && (
                          <div>
                            <label className="block mb-1 text-green-700">Prescribe Medications <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Paracetamol (10), Amalar (2), Vitamin C (15)"
                              className="w-full border-2 border-green-300 rounded-lg p-2.5 outline-none focus:border-green-500 bg-green-50/30"
                              value={consultNotes.prescriptions}
                              onChange={(e) => setConsultNotes({ ...consultNotes, prescriptions: e.target.value })}
                            />
                            <p className="text-[10px] text-gray-400 mt-1 font-normal">Format: Drug Name (Quantity) — separate multiple with commas</p>
                          </div>
                        )}
                      </div>

                      {/* Submit */}
                      <button
                        onClick={(e) => {
                          if (!consultNotes.diagnoses || !consultNotes.clinicalNotes) {
                            setMsg({ type: 'error', text: 'Clinical Diagnoses and Treatment Notes are required.' });
                            return;
                          }
                          if (consultAction === 'LAB' && !consultNotes.labTests) {
                            setMsg({ type: 'error', text: 'Please enter lab tests to order before sending to Lab.' });
                            return;
                          }
                          if (consultAction === 'PHARMACY' && !consultNotes.prescriptions) {
                            setMsg({ type: 'error', text: 'Please enter prescriptions before sending to Pharmacy.' });
                            return;
                          }
                          handleSaveConsult(e as any, consultAction);
                        }}
                        className={`w-full text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${
                          consultAction === 'LAB'
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : consultAction === 'PHARMACY'
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Save size={14} />
                        {consultAction === 'LAB' && '⚗ Save & Send to Laboratory'}
                        {consultAction === 'PHARMACY' && '💊 Save & Send to Pharmacy'}
                        {consultAction === 'CLOSE' && '✓ Save & Close Encounter'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400 font-medium border rounded-xl border-dashed">Select a patient from the queue to diagnose.</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 4: Laboratory */}
        {activeTab === 'laboratory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Lab Queue */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Beaker size={18} className="text-amber-500" /> Lab Test Queue
                </h2>
                <div className="border rounded-xl divide-y overflow-hidden max-h-[400px] overflow-y-auto">
                  {encounters.filter(e => e.status === 'LAB_REQUESTED').length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 font-medium">No lab tests pending.</div>
                  ) : (
                    encounters.filter(e => e.status === 'LAB_REQUESTED').map((e) => (
                      <div key={e.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{e.patientFile?.name || 'Unknown Patient'}</div>
                          <div className="text-xs text-amber-600 font-bold">Requested: {e.labTests}</div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEncounter(e);
                            setLabInput(prev => ({ ...prev, encounterId: e.id }));
                          }}
                          className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs py-2 px-4 rounded-lg hover:bg-amber-100"
                        >
                          Process Test
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Lab Input Form */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                  <Beaker size={18} className="text-amber-500" /> Record Lab Results
                </h2>
                {labInput.encounterId && selectedEncounter ? (
                  <form onSubmit={handleSaveLab} className="space-y-4 text-xs font-semibold text-slate-600">
                    <div className="bg-slate-100 p-4 rounded-xl text-slate-700">
                      <span className="block text-gray-400 mb-0.5">Tests Requested:</span>
                      <strong className="text-sm font-bold text-slate-800">{selectedEncounter.labTests}</strong>
                    </div>
                    <div>
                      <label className="block mb-1">Enter Test Results / Findings</label>
                      <textarea
                        required
                        rows={6}
                        placeholder="Log clinical test readings, values, observations..."
                        className="w-full border rounded-lg p-2.5 outline-none font-mono"
                        value={labInput.labResults}
                        onChange={(e) => setLabInput({ ...labInput, labResults: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-amber-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-1.5"
                    >
                      <Save size={14} /> Submit Results to Doctor
                    </button>
                  </form>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400 font-medium">Select a patient from the queue to process tests.</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 5: Pharmacy & Inventory */}
        {activeTab === 'pharmacy' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Prescriptions Queue */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Pill size={18} className="text-emerald-500" /> Pharmacy Dispense Queue
                </h2>
                <div className="border rounded-xl divide-y overflow-hidden max-h-[400px] overflow-y-auto">
                  {encounters.filter(e => e.status === 'PHARMACY_REQUESTED').length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 font-medium">No pending prescriptions.</div>
                  ) : (
                    encounters.filter(e => e.status === 'PHARMACY_REQUESTED').map((e) => (
                      <div key={e.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{e.patientFile?.name || 'Unknown Patient'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">Diagnoses: <strong className="text-slate-700">{e.diagnoses}</strong></div>
                          <div className="text-xs text-emerald-600 font-bold mt-1">Prescribed: {e.prescriptions}</div>
                        </div>
                        <button
                          onClick={() => handleDispense(e.id, e.prescriptions || '')}
                          className="bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-lg hover:bg-emerald-700 shadow-sm"
                        >
                          Dispense
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Inventory stock */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                  <PlusCircle size={18} className="text-emerald-500" /> Update Stock Inventory
                </h2>
                <form onSubmit={handleAddStock} className="space-y-4 text-xs font-semibold text-slate-600">
                  <div>
                    <label className="block mb-1">Medication Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Paracetamol, Amalar, Vitamin C"
                      className="w-full border rounded-lg p-2.5 outline-none"
                      value={newStock.name}
                      onChange={(e) => setNewStock({ ...newStock, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1">Quantity</label>
                      <input
                        type="number"
                        required
                        placeholder="100"
                        className="w-full border rounded-lg p-2.5 outline-none"
                        value={newStock.quantity}
                        onChange={(e) => setNewStock({ ...newStock, quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Unit</label>
                      <input
                        type="text"
                        required
                        placeholder="tabs"
                        className="w-full border rounded-lg p-2.5 outline-none"
                        value={newStock.unit}
                        onChange={(e) => setNewStock({ ...newStock, unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-emerald-700"
                  >
                    Save Stock
                  </button>
                </form>
              </div>

            </div>

            {/* Inventory Stock List */}
            <div className="space-y-4 border-t pt-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                <Pill size={18} className="text-emerald-500" /> Pharmacy Inventory Stock
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {inventory.length === 0 ? (
                  <div className="col-span-full p-4 text-center text-sm text-gray-400">No inventory entries available. Add stock above.</div>
                ) : (
                  inventory.map((item) => (
                    <div key={item.id} className="border p-4 rounded-xl bg-white shadow-sm flex items-center justify-between">
                      <div>
                        <strong className="block text-sm text-slate-800">{item.name}</strong>
                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{item.unit}</span>
                      </div>
                      <span className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${
                        item.quantity < 20 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {item.quantity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
