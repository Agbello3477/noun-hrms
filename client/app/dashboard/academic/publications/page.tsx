'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import Button from '@/components/ui/Button';
import {
    BookOpen, Plus, Trash2, Link as LinkIcon, Calendar,
    Award, CheckCircle2, AlertTriangle, FileText, Upload,
    ExternalLink, X, Shield, Star, Layers, Sparkles,
    Check, HelpCircle, FileCheck, Search, Filter, Download
} from 'lucide-react';

interface Publication {
    id: string;
    title: string;
    type: string;
    doiOrIsbn?: string | null;
    peerReviewed: boolean;
    pointsClaimed: number;
    pointsAwarded: number;
    verificationStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
    publicationDate: string;
    year: number;
    citation?: string | null;
    link?: string | null;
    evidenceDocumentUrl?: string | null;
    indexingStatus?: string | null;
    vettingRemarks?: string | null;
    vettedBy?: {
        name: string;
        email: string;
    } | null;
}

interface EvaluationData {
    currentRank: string;
    currentRankLabel: string;
    targetRank: string;
    targetRankLabel: string;
    highestQualification: string;
    phdRegistrationProofUrl?: string | null;
    phdRegistrationVerified: boolean;
    qualificationGate: {
        passed: boolean;
        title: string;
        details: string;
        required: string;
        actual: string;
    };
    publicationScoringGate: {
        passed: boolean;
        title: string;
        details: string;
        required: string;
        actual: string;
    };
    tenureGate: {
        passed: boolean;
        title: string;
        details: string;
        required: string;
        actual: string;
    };
    disciplinaryGate: {
        passed: boolean;
        title: string;
        details: string;
        required: string;
        actual: string;
    };
    overallEligible: boolean;
    deficits: string[];
    checklist: string[];
    publicationBreakdown: {
        totalValidPoints: number;
        requiredPoints: number;
        pointsRequirementMet: boolean;
        pointsDeficit: number;
        courseMaterialsCount: number;
        courseMaterialsCapped: boolean;
        categoryTotals: Record<string, number>;
    };
}

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
    JOURNAL_ARTICLE: 'Journal Article',
    CONFERENCE_PROCEEDING: 'Refereed Conference Proceeding',
    COURSE_MATERIAL: 'Developed Course Material',
    ACADEMIC_BOOK: 'Authored/Edited Academic Book',
    BOOK_CHAPTER: 'Book Chapter'
};

const DEFAULT_POINTS: Record<string, number> = {
    JOURNAL_ARTICLE: 5.0,
    ACADEMIC_BOOK: 10.0,
    BOOK_CHAPTER: 4.0,
    CONFERENCE_PROCEEDING: 3.0,
    COURSE_MATERIAL: 3.0
};

export default function PublicationsPage() {
    const { user } = useAuth();
    const [publications, setPublications] = useState<Publication[]>([]);
    const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    // Form Inputs
    const [title, setTitle] = useState('');
    const [type, setType] = useState('JOURNAL_ARTICLE');
    const [doiOrIsbn, setDoiOrIsbn] = useState('');
    const [peerReviewed, setPeerReviewed] = useState(true);
    const [pointsClaimed, setPointsClaimed] = useState<number>(5.0);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [citation, setCitation] = useState('');
    const [link, setLink] = useState('');
    const [indexingStatus, setIndexingStatus] = useState('Scopus / WoS Indexed');
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const pubRes = await api.get('/api/academic/publications');
            setPublications(pubRes.data);

            const staffId = user?.staffProfile?.id;
            if (staffId) {
                try {
                    const evalRes = await api.get(`/api/academic/evaluation/${staffId}`);
                    setEvaluation(evalRes.data);
                } catch (err) {
                    console.warn('Evaluation fetch error:', err);
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?.staffProfile?.id]);

    const handleTypeChange = (newType: string) => {
        setType(newType);
        setPointsClaimed(DEFAULT_POINTS[newType] || 5.0);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this publication record?')) return;
        try {
            await api.delete(`/api/academic/publications/${id}`);
            await fetchData();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to delete publication.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMessage('');

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('type', type);
            formData.append('doiOrIsbn', doiOrIsbn);
            formData.append('peerReviewed', String(peerReviewed));
            formData.append('pointsClaimed', String(pointsClaimed));
            formData.append('year', String(year));
            formData.append('citation', citation);
            formData.append('link', link);
            formData.append('indexingStatus', indexingStatus);

            if (evidenceFile) {
                formData.append('file', evidenceFile);
            }

            await api.post('/api/academic/publications', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setShowModal(false);
            // Reset
            setTitle('');
            setType('JOURNAL_ARTICLE');
            setDoiOrIsbn('');
            setPeerReviewed(true);
            setPointsClaimed(5.0);
            setCitation('');
            setLink('');
            setEvidenceFile(null);

            await fetchData();
        } catch (error: any) {
            console.error('Submit error:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to save publication');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredPublications = publications.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.citation && p.citation.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (p.doiOrIsbn && p.doiOrIsbn.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = filterType === 'ALL' || p.type === filterType;
        return matchesSearch && matchesType;
    });

    const totalVerifiedPoints = evaluation?.publicationBreakdown?.totalValidPoints ??
        publications
            .filter(p => p.verificationStatus === 'VERIFIED' && p.peerReviewed)
            .reduce((sum, p) => sum + (Number(p.pointsAwarded) || Number(p.pointsClaimed) || 0), 0);

    const requiredPoints = evaluation?.publicationBreakdown?.requiredPoints ?? 24.0;
    const progressPercent = Math.min(100, Math.round((totalVerifiedPoints / (requiredPoints || 1)) * 100));

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 rounded-2xl text-white shadow-xl gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider mb-2">
                        <Award size={13} className="text-blue-300" />
                        Academic Promotion & Publications Engine
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Research Publications & Scoring</h1>
                    <p className="text-blue-100/80 text-sm mt-1">
                        Track peer-reviewed research output, statutory point thresholds, and promotion criteria vetting.
                    </p>
                </div>
                <Button
                    onClick={() => setShowModal(true)}
                    variant="primary"
                    className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 rounded-xl px-5 py-2.5 font-semibold text-sm flex items-center gap-2"
                >
                    <Plus size={18} /> Submit Publication
                </Button>
            </div>

            {/* Live Criteria Scoring Progress Card */}
            {evaluation && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                <Layers size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statutory Promotion Trajectory</div>
                                <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>{evaluation.currentRankLabel}</span>
                                    <span className="text-indigo-600 font-bold">➔</span>
                                    <span className="text-indigo-700 font-extrabold">{evaluation.targetRankLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                evaluation.qualificationGate.passed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                                <CheckCircle2 size={13} />
                                {evaluation.highestQualification} Degree {evaluation.highestQualification === 'PHD' ? '(Ph.D. Verified)' : ''}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                evaluation.overallEligible
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                                <Star size={13} />
                                {evaluation.overallEligible ? 'Criteria Satisfied' : 'Accruing Output'}
                            </span>
                        </div>
                    </div>

                    {/* Publication Points Progress Meter */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Publication Points Accrued</span>
                                <div className="text-2xl font-extrabold text-slate-900">
                                    {totalVerifiedPoints.toFixed(1)} <span className="text-sm font-semibold text-slate-400">/ {requiredPoints.toFixed(1)} pts required</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold text-indigo-700">{progressPercent}% Completed</span>
                                <div className="text-xs text-slate-500">
                                    {evaluation.publicationBreakdown.pointsDeficit > 0
                                        ? `Deficit: ${evaluation.publicationBreakdown.pointsDeficit.toFixed(1)} pts needed`
                                        : 'Points Threshold Met'}
                                </div>
                            </div>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    progressPercent >= 100
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        {/* Category Cap Notes */}
                        <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-500">
                            {evaluation.publicationBreakdown.courseMaterialsCount !== undefined && (
                                <span className="inline-flex items-center gap-1">
                                    <strong>Course Materials:</strong> {evaluation.publicationBreakdown.courseMaterialsCount}/2 utilized
                                    {evaluation.publicationBreakdown.courseMaterialsCapped && ' (Capped at 2 units maximum)'}
                                </span>
                            )}
                            <span><strong>Journals:</strong> {evaluation.publicationBreakdown.categoryTotals?.JOURNAL_ARTICLE || 0} pts</span>
                            <span><strong>Books:</strong> {evaluation.publicationBreakdown.categoryTotals?.ACADEMIC_BOOK || 0} pts</span>
                            <span><strong>Conferences:</strong> {evaluation.publicationBreakdown.categoryTotals?.CONFERENCE_PROCEEDING || 0} pts</span>
                        </div>
                    </div>

                    {/* Criteria Checklist Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                        <div className={`p-3.5 rounded-xl border ${
                            evaluation.qualificationGate.passed ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-rose-50/50 border-rose-200 text-rose-900'
                        }`}>
                            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                                {evaluation.qualificationGate.passed ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-rose-600" />}
                                Qualification Gate
                            </div>
                            <div className="text-[11px] leading-relaxed text-slate-600">{evaluation.qualificationGate.details}</div>
                        </div>

                        <div className={`p-3.5 rounded-xl border ${
                            evaluation.publicationScoringGate.passed ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-amber-50/50 border-amber-200 text-amber-900'
                        }`}>
                            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                                {evaluation.publicationScoringGate.passed ? <Check size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
                                Publication Scoring
                            </div>
                            <div className="text-[11px] leading-relaxed text-slate-600">{evaluation.publicationScoringGate.details}</div>
                        </div>

                        <div className={`p-3.5 rounded-xl border ${
                            evaluation.tenureGate.passed ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                                {evaluation.tenureGate.passed ? <Check size={14} className="text-emerald-600" /> : <Calendar size={14} className="text-slate-500" />}
                                Statutory 3-Yr Tenure
                            </div>
                            <div className="text-[11px] leading-relaxed text-slate-600">{evaluation.tenureGate.details}</div>
                        </div>

                        <div className={`p-3.5 rounded-xl border ${
                            evaluation.disciplinaryGate.passed ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-rose-50/50 border-rose-200 text-rose-900'
                        }`}>
                            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                                {evaluation.disciplinaryGate.passed ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-rose-600" />}
                                Registry Disciplinary Gate
                            </div>
                            <div className="text-[11px] leading-relaxed text-slate-600">{evaluation.disciplinaryGate.details}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search publications by title, citation, DOI..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={15} className="text-slate-400" />
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none"
                    >
                        <option value="ALL">All Categories</option>
                        <option value="JOURNAL_ARTICLE">Journal Articles</option>
                        <option value="ACADEMIC_BOOK">Academic Books</option>
                        <option value="BOOK_CHAPTER">Book Chapters</option>
                        <option value="CONFERENCE_PROCEEDING">Conference Proceedings</option>
                        <option value="COURSE_MATERIAL">Course Materials</option>
                    </select>
                </div>
            </div>

            {/* Publications Data List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 animate-pulse">
                        Loading academic output records...
                    </div>
                ) : filteredPublications.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-6 space-y-3">
                        <BookOpen size={48} className="mx-auto text-slate-300" />
                        <h3 className="text-lg font-bold text-slate-800">No Research Publications Found</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            Submit your verified journal papers, authored books, and developed course materials to accrue statutory promotion points.
                        </p>
                        <Button
                            onClick={() => setShowModal(true)}
                            variant="secondary"
                            className="text-xs font-bold mt-2"
                        >
                            <Plus size={14} /> Submit New Publication
                        </Button>
                    </div>
                ) : (
                    filteredPublications.map(pub => {
                        const statusColor =
                            pub.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : pub.verificationStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200';

                        return (
                            <div key={pub.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition space-y-3">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            {PUBLICATION_TYPE_LABELS[pub.type] || pub.type}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor}`}>
                                            {pub.verificationStatus === 'VERIFIED' ? '✓ Committee Verified' :
                                             pub.verificationStatus === 'REJECTED' ? '✕ Not Approved' : '⏳ Pending Vetting'}
                                        </span>
                                        {pub.peerReviewed && (
                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                Peer Reviewed
                                            </span>
                                        )}
                                        {pub.indexingStatus && (
                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                                {pub.indexingStatus}
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Calendar size={12} /> {pub.year || new Date(pub.publicationDate).getFullYear()}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 self-end md:self-auto">
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-slate-400 uppercase">Points Awarded</div>
                                            <div className="text-base font-extrabold text-slate-900">
                                                {pub.pointsAwarded > 0 ? pub.pointsAwarded.toFixed(1) : pub.pointsClaimed.toFixed(1)} pts
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(pub.id)}
                                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                            title="Delete publication"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-base font-bold text-slate-900 leading-snug">{pub.title}</h3>
                                    {pub.citation && (
                                        <p className="text-xs text-slate-600 italic mt-1 leading-relaxed bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                                            {pub.citation}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                                    <div className="flex flex-wrap gap-4 text-slate-500">
                                        {pub.doiOrIsbn && (
                                            <span><strong>DOI/ISBN:</strong> {pub.doiOrIsbn}</span>
                                        )}
                                        {pub.vettingRemarks && (
                                            <span className="text-indigo-700"><strong>Vetting Notes:</strong> {pub.vettingRemarks}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {pub.link && (
                                            <a
                                                href={pub.link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                                            >
                                                <ExternalLink size={13} /> Online Index
                                            </a>
                                        )}
                                        {pub.evidenceDocumentUrl && (
                                            <a
                                                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055'}${pub.evidenceDocumentUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold border border-blue-200 transition"
                                            >
                                                <FileCheck size={13} /> View Offprint PDF
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Submit Publication Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slideUp">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <BookOpen className="text-blue-600" size={20} />
                                    Submit Academic Publication
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Record your verified research output for committee appraisal and scoring.
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMessage && (
                                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-semibold">
                                    {errorMessage}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Title of Academic Work *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Distributed Consensus in Cloud-Native Education Systems"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Publication Category *
                                    </label>
                                    <select
                                        value={type}
                                        onChange={e => handleTypeChange(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="JOURNAL_ARTICLE">Journal Article (5.0 pts standard)</option>
                                        <option value="ACADEMIC_BOOK">Authored Academic Book (10.0 pts standard)</option>
                                        <option value="BOOK_CHAPTER">Book Chapter (4.0 pts standard)</option>
                                        <option value="CONFERENCE_PROCEEDING">Refereed Conference Proceeding (3.0 pts standard)</option>
                                        <option value="COURSE_MATERIAL">Developed Course Material (3.0 pts standard, max 2 units)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Points Claimed *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        required
                                        value={pointsClaimed}
                                        onChange={e => setPointsClaimed(Number(e.target.value))}
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        DOI or ISBN Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 10.1145/3377811.3380389 or 978-3-16-148410-0"
                                        value={doiOrIsbn}
                                        onChange={e => setDoiOrIsbn(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Indexing & Repository Status
                                    </label>
                                    <select
                                        value={indexingStatus}
                                        onChange={e => setIndexingStatus(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                    >
                                        <option value="Scopus / WoS Indexed">Scopus / Web of Science (WoS) Indexed</option>
                                        <option value="Peer-Reviewed University Press">Peer-Reviewed University Press</option>
                                        <option value="Institutional Repository (NOUN)">Institutional Repository (NOUN)</option>
                                        <option value="National/International Refereed">National/International Refereed Conference</option>
                                        <option value="Other Indexed Outlet">Other Indexed Outlet</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Publication Year *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        value={year}
                                        onChange={e => setYear(Number(e.target.value))}
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Online Publisher / DOI Link
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://doi.org/..."
                                        value={link}
                                        onChange={e => setLink(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Full Citation (APA / MLA Format)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Author, A. A. (Year). Title of article. Title of Periodical, volume(issue), pages."
                                    value={citation}
                                    onChange={e => setCitation(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Upload size={13} className="text-slate-400" />
                                    Upload Offprint / Publication PDF Evidence
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setEvidenceFile(e.target.files[0]);
                                        } else {
                                            setEvidenceFile(null);
                                        }
                                    }}
                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 file:cursor-pointer hover:file:bg-blue-100 border border-slate-300 rounded-xl p-2 outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="peerReviewedCheck"
                                    checked={peerReviewed}
                                    onChange={e => setPeerReviewed(e.target.checked)}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                />
                                <label htmlFor="peerReviewedCheck" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    I confirm this output is peer-reviewed by an editorial board or referee committee.
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 rounded-xl font-semibold"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={submitting}
                                    className="flex-1 py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                                >
                                    Submit for Scoring
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
