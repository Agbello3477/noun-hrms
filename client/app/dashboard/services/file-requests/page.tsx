'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  FolderOpen,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileCheck2,
  ShieldCheck,
  ExternalLink,
  Printer,
  History,
} from 'lucide-react';
import { RequisitionStatusStepper, FileRequisitionStatus } from '@/components/fileRequisition/RequisitionStatusStepper';
import { LodgeRequisitionModal } from '@/components/fileRequisition/LodgeRequisitionModal';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';
import { DigitalTranscriptViewerModal } from '@/components/fileRequisition/DigitalTranscriptViewerModal';
import { useAuth } from '@/hooks/useAuth';

export default function MyFileRequisitionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);

  // Modals
  const [isLodgeOpen, setIsLodgeOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);

  const fetchMyRequisitions = async () => {
    if (user?.role === 'STAFF') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/api/v1/registry/file-requests/my');
      if (res.data?.success) {
        setRequisitions(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch personal file requisitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequisitions();
  }, [user]);

  if (user && user.role === 'STAFF') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Restricted Statutory Access</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Personnel File Requisitions are restricted to Unit Heads, Deans, Directors, Study Centre Managers, and Registry Vault Officers. Regular staff are not authorized to requisition confidential personnel files.
          </p>
          <div className="pt-2">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-[#006533] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <FolderOpen className="w-4 h-4" />
            <span>Staff Self Service • Registry Vault Gatepass & Custody</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            My Personnel File Requisitions
          </h1>
          <p className="text-xs text-slate-500">
            Lodge official file requests, monitor Registry Vault folio intake, track Registrar executive authorization, and retrieve custody release gatepasses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMyRequisitions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsLodgeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Lodge Personnel File Request
          </button>
        </div>
      </div>

      {/* Main Requisition List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-xs font-medium">Loading your file requisitions from the Registry Vault...</p>
          </div>
        ) : requisitions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <FolderOpen className="w-10 h-10 text-emerald-700/50 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No File Requisitions Lodged Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              If your department or unit requires official physical or digital personnel records (for Accreditation, APER, or Promotions), click below to lodge a requisition.
            </p>
            <button
              type="button"
              onClick={() => setIsLodgeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" /> Lodge File Requisition
            </button>
          </div>
        ) : (
          requisitions.map((req) => {
            const isReleased = req.status === 'DISPATCHED_RELEASED';
            const isReturned = req.status === 'RETURNED_ARCHIVED';
            const hasDigitalFormat =
              req.requestedFileFormat === 'DIGITAL_TRANSCRIPT' || req.requestedFileFormat === 'BOTH';

            return (
              <div
                key={req.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Header Strip */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {req.requisitionNumber}
                    </span>
                    {req.registryFolioReference && (
                      <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                        Vault Folio: {req.registryFolioReference}
                      </span>
                    )}
                    {req.dispatchReceiptNumber && (
                      <span className="font-mono text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-sm border border-indigo-200">
                        Receipt: {req.dispatchReceiptNumber}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Lodged On:{' '}
                    <span className="font-medium text-slate-700">
                      {new Date(req.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Subject Staff */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Subject Personnel Record
                      </span>
                      <p className="font-bold text-slate-900 text-sm">
                        {req.staffProfile?.user?.name || 'Staff Member'}
                      </p>
                      <p className="text-slate-600 font-mono text-[11px]">
                        Staff ID: {req.staffProfile?.staffId || 'N/A'}
                      </p>
                      <p className="text-slate-500 text-[11px]">{req.staffProfile?.rank || 'Staff'}</p>
                    </div>

                    {/* Request Details */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Requisition Parameters
                      </span>
                      <p className="font-semibold text-slate-800">
                        Format: <span className="font-bold text-slate-900">{req.requestedFileFormat}</span>
                      </p>
                      <p className="text-slate-600">
                        Urgency: <span className="font-bold text-emerald-800">{req.urgencyLevel}</span>
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Expected Return:{' '}
                        {req.expectedReturnDate
                          ? new Date(req.expectedReturnDate).toLocaleDateString('en-GB')
                          : '14 Days SLA'}
                      </p>
                    </div>

                    {/* Purpose */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Stated Purpose
                      </span>
                      <p className="text-slate-700 italic line-clamp-3 text-[11px]" title={req.purposeOfRequest}>
                        &ldquo;{req.purposeOfRequest}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* 5-Step Progress Tracker */}
                  <RequisitionStatusStepper
                    status={req.status as FileRequisitionStatus}
                    folioNumber={req.registryFolioReference}
                    dispatchReceiptNumber={req.dispatchReceiptNumber}
                    urgency={req.urgencyLevel}
                    format={req.requestedFileFormat}
                  />

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500">
                      Status:{' '}
                      <span className="font-bold text-emerald-800">{req.status.replace(/_/g, ' ')}</span>
                      {req.authorizedBy && (
                        <span> • Authorized by {req.authorizedBy.name}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {(isReleased || isReturned || req.dispatchReceiptNumber) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReq(req);
                            setIsReceiptOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" /> Custody Gatepass
                        </button>
                      )}

                      {isReleased && hasDigitalFormat && req.digitalAccessToken && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReq(req);
                            setIsDigitalViewerOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Digital Transcript
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lodge Requisition Modal */}
      <LodgeRequisitionModal
        isOpen={isLodgeOpen}
        onClose={() => setIsLodgeOpen(false)}
        onSuccess={() => {
          fetchMyRequisitions();
        }}
        defaultDepartment={user?.staffProfile?.department || ''}
      />

      {/* Custody Receipt Gatepass */}
      <CustodyReleaseReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        requisition={selectedReq}
        onViewDigital={() => {
          setIsReceiptOpen(false);
          setIsDigitalViewerOpen(true);
        }}
      />

      {/* Digital Transcript Viewer */}
      {selectedReq && (
        <DigitalTranscriptViewerModal
          isOpen={isDigitalViewerOpen}
          onClose={() => setIsDigitalViewerOpen(false)}
          requisitionId={selectedReq.id}
          token={selectedReq.digitalAccessToken}
        />
      )}
    </div>
  );
}
