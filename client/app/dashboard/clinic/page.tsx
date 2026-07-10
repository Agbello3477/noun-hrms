'use client';

import { useState, useEffect } from 'react';
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
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  
  // Inventory form
  const [newStock, setNewStock] = useState({ name: '', quantity: '', unit: 'tabs' });

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

  const handleSaveConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/clinic/consultation', consultNotes);
      setMsg({ type: 'success', text: 'Consultation notes and prescription/lab requests saved!' });
      setConsultNotes({ encounterId: '', clinicalNotes: '', diagnoses: '', labTests: '', prescriptions: '' });
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
            activeTab === 'records' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search size={16} /> Patient Files
        </button>

        {['CLINIC_NURSE', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('triage')}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'triage' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} /> Nurse Triage
          </button>
        )}

        {['CLINIC_DOCTOR', 'SUPER_USER', 'ADMIN'].includes(activeRole) && (
          <button
            onClick={() => {
              setActiveTab('consultation');
              fetchEncounters('AWAITING_DOCTOR');
            }}
            className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'consultation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
              activeTab === 'laboratory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
              activeTab === 'pharmacy' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
                  <Search size={18} className="text-blue-500" /> Search Patient Files
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Employee ID, Student Matrix, or Name..."
                    className="w-full border rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500"
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
                            className="bg-blue-600 text-white font-bold text-xs py-2 px-4 rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-1"
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
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 outline-none"
                        placeholder="O+"
                        value={newPatient.bloodGroup}
                        onChange={(e) => setNewPatient({ ...newPatient, bloodGroup: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Genotype</label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 outline-none"
                        placeholder="AA"
                        value={newPatient.genotype}
                        onChange={(e) => setNewPatient({ ...newPatient, genotype: e.target.value })}
                      />
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
                    className="w-full bg-blue-600 text-white font-bold text-xs py-2 rounded-lg hover:bg-blue-700"
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
                          <div className="font-bold text-slate-800">{e.patientFile.name}</div>
                          <div className="text-xs text-gray-500 font-semibold">Patient ID: {e.patientFile.patientId}</div>
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
                          <div className="font-bold text-slate-800">{e.patientFile.name}</div>
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
                          className="bg-indigo-650 text-white font-bold text-xs py-2 px-3 rounded-lg hover:bg-indigo-700"
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
                        <strong className="text-slate-800 text-sm">{selectedEncounter.patientFile.name}</strong>
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
                        <strong className="text-red-600">{selectedEncounter.patientFile.allergies || 'None'}</strong>
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
                    <form onSubmit={handleSaveConsult} className="space-y-4 text-xs font-semibold text-slate-600">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1">Clinical Diagnoses</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Severe Malaria, Respiratory infection"
                            className="w-full border rounded-lg p-2.5 outline-none"
                            value={consultNotes.diagnoses}
                            onChange={(e) => setConsultNotes({ ...consultNotes, diagnoses: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block mb-1">Laboratory Tests Order (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Malaria Parasite (MP), Widal test"
                            className="w-full border rounded-lg p-2.5 outline-none"
                            value={consultNotes.labTests}
                            onChange={(e) => setConsultNotes({ ...consultNotes, labTests: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1">Clinical Treatment Notes</label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Log consultation findings, patient guidance..."
                          className="w-full border rounded-lg p-2.5 outline-none"
                          value={consultNotes.clinicalNotes}
                          onChange={(e) => setConsultNotes({ ...consultNotes, clinicalNotes: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Prescribe Medications (format: Drug Name (Quantity))</label>
                        <input
                          type="text"
                          placeholder="e.g. Paracetamol (10), Amalar (2), Vitamin C (15)"
                          className="w-full border rounded-lg p-2.5 outline-none"
                          value={consultNotes.prescriptions}
                          onChange={(e) => setConsultNotes({ ...consultNotes, prescriptions: e.target.value })}
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-indigo-650 text-white font-bold text-xs py-2.5 px-6 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
                      >
                        <Save size={14} /> Submit Notes
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
                          <div className="font-bold text-slate-800">{e.patientFile.name}</div>
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
                          <div className="font-bold text-slate-800">{e.patientFile.name}</div>
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
