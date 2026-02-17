'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    FileText,
    Briefcase,
    Bot,
    Loader2,
    Send,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Sparkles,
    LinkIcon,
    ClipboardPaste,
    Cloud,
    Search,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Target,
    ThumbsUp,
    ThumbsDown,
    HelpCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface ChecklistItem {
    category: string;
    item: string;
    priority: 'high' | 'medium' | 'low';
    status: 'missing' | 'weak' | 'ok';
    suggestion: string;
}

interface JobAnalysis {
    company: string;
    position: string;
    jobSummary: string;
    requirements: {
        required: string[];
        preferred: string[];
        techStack: string[];
        softSkills: string[];
    };
    checklist: ChecklistItem[];
    overallMatch: number;
    matchSummary: string;
}

interface FeedbackSection {
    section: string;
    score: number;
    strengths: string;
    weaknesses: string;
    suggestion: string;
}

interface InterviewerFeedback {
    decision: 'pass' | 'fail' | 'borderline';
    overallScore: number;
    resumeFeedback: FeedbackSection[];
    coverLetterFeedback: FeedbackSection[];
    criticalIssues: string[];
    interviewQuestions: string[];
    summary: string;
}

// ─── Helpers ────────────────────────────────────────────────────────
const loadFromLS = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const saveToLS = <T,>(key: string, value: T) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
};

// ─── Main Component ─────────────────────────────────────────────────
export default function ResumeCheckerPage() {
    // Input state
    const [jobPostingUrl, setJobPostingUrl] = useState('');
    const [resume, setResume] = useState('');
    const [coverLetter, setCoverLetter] = useState('');

    // Results state
    const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
    const [feedback, setFeedback] = useState<InterviewerFeedback | null>(null);

    // UI state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'resume' | 'coverLetter'>('resume');
    const [mobileView, setMobileView] = useState<'input' | 'result'>('input');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [errorMsg, setErrorMsg] = useState('');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            // LocalStorage first
            setJobPostingUrl(loadFromLS('rc_url', ''));
            setResume(loadFromLS('rc_resume', ''));
            setCoverLetter(loadFromLS('rc_coverLetter', ''));
            setAnalysis(loadFromLS('rc_analysis', null));
            setFeedback(loadFromLS('rc_feedback', null));

            // Supabase
            try {
                const res = await fetch('/api/resume/sync');
                if (res.ok) {
                    const data = await res.json();
                    if (data.resume) setResume(data.resume);
                    if (data.coverLetter) setCoverLetter(data.coverLetter);
                    if (data.jobPostingUrl) setJobPostingUrl(data.jobPostingUrl);
                    if (data.analysisResults) setAnalysis(data.analysisResults);
                    if (data.feedbackResults) setFeedback(data.feedbackResults);
                    setLastSynced(Date.now());
                }
            } catch (e) {
                console.error('Sync load failed:', e);
            }
        };
        loadData();
    }, []);

    // Save to Supabase (debounced)
    const saveData = useCallback(async () => {
        setIsSyncing(true);
        try {
            // Save to LS immediately
            saveToLS('rc_url', jobPostingUrl);
            saveToLS('rc_resume', resume);
            saveToLS('rc_coverLetter', coverLetter);
            saveToLS('rc_analysis', analysis);
            saveToLS('rc_feedback', feedback);

            await fetch('/api/resume/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume,
                    coverLetter,
                    jobPostingUrl,
                    analysisResults: analysis,
                    feedbackResults: feedback,
                }),
            });
            setLastSynced(Date.now());
        } catch (e) {
            console.error('Sync save failed:', e);
        } finally {
            setIsSyncing(false);
        }
    }, [jobPostingUrl, resume, coverLetter, analysis, feedback]);

    useEffect(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(saveData, 3000);
        return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
    }, [jobPostingUrl, resume, coverLetter, analysis, feedback, saveData]);

    // ─── Analyze Job Posting ────────────────────────────────────────
    const analyzeJobPosting = async () => {
        if (!jobPostingUrl.trim()) {
            setErrorMsg('채용 공고 링크를 입력해주세요.');
            return;
        }
        setIsAnalyzing(true);
        setErrorMsg('');
        setAnalysis(null);
        setFeedback(null);

        try {
            const res = await fetch('/api/resume/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobPostingUrl, resume, coverLetter }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '분석 실패');
            }

            const data: JobAnalysis = await res.json();
            setAnalysis(data);
            setMobileView('result');
        } catch (err: any) {
            setErrorMsg(err.message || '공고 분석 중 오류가 발생했습니다.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ─── Get Interviewer Feedback ───────────────────────────────────
    const getInterviewerFeedback = async () => {
        if (!resume.trim() && !coverLetter.trim()) {
            setErrorMsg('이력서 또는 자기소개서를 먼저 입력해주세요.');
            return;
        }
        if (!analysis) {
            setErrorMsg('먼저 채용 공고를 분석해주세요.');
            return;
        }
        setIsFeedbackLoading(true);
        setErrorMsg('');

        try {
            const res = await fetch('/api/resume/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume, coverLetter, jobAnalysis: analysis }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '피드백 실패');
            }

            const data: InterviewerFeedback = await res.json();
            setFeedback(data);
        } catch (err: any) {
            setErrorMsg(err.message || '피드백 생성 중 오류가 발생했습니다.');
        } finally {
            setIsFeedbackLoading(false);
        }
    };

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const priorityColor = (p: string) =>
        p === 'high' ? 'text-red-400 bg-red-500/10' :
            p === 'medium' ? 'text-amber-400 bg-amber-500/10' :
                'text-gray-400 bg-gray-500/10';

    const statusIcon = (s: string) =>
        s === 'ok' ? <CheckCircle2 size={14} className="text-emerald-400" /> :
            s === 'weak' ? <AlertTriangle size={14} className="text-amber-400" /> :
                <XCircle size={14} className="text-red-400" />;

    const decisionStyle = (d: string) =>
        d === 'pass' ? { icon: <ThumbsUp size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: '합격 가능' } :
            d === 'borderline' ? { icon: <HelpCircle size={20} />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: '경계선' } :
                { icon: <ThumbsDown size={20} />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: '불합격 위험' };

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="h-screen w-full bg-[#050505] text-white flex flex-col overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-[120px]" />
                <div className="absolute bottom-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-blue-900/10 blur-[100px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 h-16 border-b border-white/5 flex items-center px-4 md:px-6 gap-3 backdrop-blur-sm bg-black/20 flex-shrink-0">
                <a href="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <ArrowLeft size={20} />
                </a>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/30">
                        <Target size={18} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">Resume Checker AI</h1>
                        <p className="text-xs text-gray-500">공고 맞춤 이력서 분석</p>
                    </div>
                </div>

                {/* Sync Status */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 ml-4">
                    <Cloud size={12} className={isSyncing ? "text-violet-400 animate-pulse" : "text-gray-500"} />
                    <span className="text-[10px] text-gray-400">
                        {isSyncing ? "저장 중..." : lastSynced ? "동기화 완료" : "오프라인"}
                    </span>
                </div>

                {/* Mobile Tab */}
                <div className="md:hidden ml-auto flex gap-1 bg-white/5 rounded-lg p-1">
                    {[
                        { key: 'input' as const, label: '입력' },
                        { key: 'result' as const, label: '분석결과' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setMobileView(tab.key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mobileView === tab.key ? 'bg-violet-600 text-white' : 'text-gray-400'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main 2-column layout */}
            <div className="relative z-10 flex-1 flex overflow-hidden">

                {/* ── LEFT: Input Panel ── */}
                <div className={`w-full md:w-[480px] lg:w-[520px] flex-shrink-0 border-r border-white/5 flex flex-col bg-black/30 backdrop-blur-sm overflow-y-auto ${mobileView !== 'input' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-5 space-y-5">

                        {/* Job Posting URL */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-300">
                                <LinkIcon size={16} className="text-violet-400" />
                                채용 공고 링크
                            </label>
                            <div className="flex gap-2">
                                <input
                                    value={jobPostingUrl}
                                    onChange={(e) => setJobPostingUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && analyzeJobPosting()}
                                    placeholder="https://www.jobkorea.co.kr/..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                                />
                                <button
                                    onClick={analyzeJobPosting}
                                    disabled={isAnalyzing || !jobPostingUrl.trim()}
                                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all text-sm font-medium shadow-lg shadow-violet-900/30"
                                >
                                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                    <span className="hidden sm:inline">분석</span>
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        <AnimatePresence>
                            {errorMsg && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2"
                                >
                                    <AlertTriangle size={16} />
                                    {errorMsg}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Resume / Cover Letter Tabs */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-2 bg-white/5 rounded-xl p-1">
                                    <button
                                        onClick={() => setActiveTab('resume')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'resume' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <FileText size={14} />
                                        이력서
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('coverLetter')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'coverLetter' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <ClipboardPaste size={14} />
                                        자기소개서
                                    </button>
                                </div>
                                <span className="text-[11px] text-gray-500">
                                    {(activeTab === 'resume' ? resume : coverLetter).length}자
                                </span>
                            </div>
                            <textarea
                                value={activeTab === 'resume' ? resume : coverLetter}
                                onChange={(e) => activeTab === 'resume' ? setResume(e.target.value) : setCoverLetter(e.target.value)}
                                placeholder={activeTab === 'resume'
                                    ? "이력서 내용을 붙여넣으세요...\n\n• 학력, 경력, 프로젝트, 기술스택 등"
                                    : "자기소개서 내용을 붙여넣으세요...\n\n• 지원동기, 성장과정, 강점 등"
                                }
                                className="w-full h-[calc(100vh-340px)] min-h-[300px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none leading-relaxed"
                            />
                        </div>

                        {/* Analyze + Feedback buttons */}
                        {analysis && (resume.trim() || coverLetter.trim()) && (
                            <button
                                onClick={getInterviewerFeedback}
                                disabled={isFeedbackLoading}
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-900/30"
                            >
                                {isFeedbackLoading ? (
                                    <><Loader2 size={16} className="animate-spin" /> 면접관 AI 평가 중...</>
                                ) : (
                                    <><Bot size={16} /> 면접관 AI 피드백 받기</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Analysis Results Panel ── */}
                <div className={`flex-1 flex flex-col overflow-y-auto ${mobileView !== 'result' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-5 space-y-5">

                        {/* Empty State */}
                        {!analysis && !isAnalyzing && (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-4 text-gray-600">
                                <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
                                    <Target size={48} strokeWidth={1} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-400">분석 결과가 여기에 표시됩니다</p>
                                    <p className="text-xs text-gray-600 mt-1">왼쪽에서 채용 공고 링크를 입력하고 "분석" 버튼을 눌러주세요</p>
                                </div>
                            </div>
                        )}

                        {/* Loading */}
                        {isAnalyzing && (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-4">
                                <div className="p-4 rounded-2xl bg-violet-600/20 border border-violet-500/10">
                                    <Loader2 size={32} className="text-violet-400 animate-spin" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-300">공고를 분석하고 있습니다...</p>
                                    <p className="text-xs text-gray-500 mt-1">AI가 공고 내용을 읽고 핵심 요구사항을 추출합니다</p>
                                </div>
                            </div>
                        )}

                        {/* Analysis Results */}
                        {analysis && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

                                {/* Company / Position Card */}
                                <div className="glass-panel rounded-xl p-5 border border-white/5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h2 className="font-bold text-lg">{analysis.company}</h2>
                                            <p className="text-sm text-violet-400 font-medium">{analysis.position}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-2xl font-black ${analysis.overallMatch >= 70 ? 'text-emerald-400' : analysis.overallMatch >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                {analysis.overallMatch}%
                                            </div>
                                            <p className="text-[10px] text-gray-500">매칭률</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-400 leading-relaxed">{analysis.jobSummary}</p>
                                </div>

                                {/* Requirements */}
                                <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                                    <button
                                        onClick={() => toggleSection('req')}
                                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/3 transition-colors"
                                    >
                                        <h3 className="font-bold text-sm flex items-center gap-2">
                                            <Briefcase size={16} className="text-violet-400" />
                                            공고 요구사항
                                        </h3>
                                        {expandedSections['req'] ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                    </button>
                                    <AnimatePresence>
                                        {expandedSections['req'] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-5 pb-4 space-y-3">
                                                    {analysis.requirements.required.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-bold text-red-400 mb-1.5">필수 자격</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {analysis.requirements.required.map((r, i) => (
                                                                    <span key={i} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">{r}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {analysis.requirements.preferred.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-bold text-amber-400 mb-1.5">우대 사항</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {analysis.requirements.preferred.map((r, i) => (
                                                                    <span key={i} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">{r}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {analysis.requirements.techStack.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-bold text-blue-400 mb-1.5">기술 스택</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {analysis.requirements.techStack.map((r, i) => (
                                                                    <span key={i} className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">{r}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Match Summary */}
                                <div className="glass-panel rounded-xl p-5 border border-white/5">
                                    <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                                        <Sparkles size={16} className="text-violet-400" />
                                        매칭 분석
                                    </h3>
                                    <p className="text-sm text-gray-300 leading-relaxed">{analysis.matchSummary}</p>
                                </div>

                                {/* Checklist */}
                                <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                                    <div className="px-5 py-3 border-b border-white/5">
                                        <h3 className="font-bold text-sm flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-emerald-400" />
                                            수정 체크리스트
                                            <span className="ml-auto text-xs text-gray-500">{analysis.checklist.length}개 항목</span>
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {analysis.checklist.map((item, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="px-5 py-3 hover:bg-white/3 transition-colors"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5">{statusIcon(item.status)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityColor(item.priority)}`}>
                                                                {item.priority === 'high' ? '높음' : item.priority === 'medium' ? '중간' : '낮음'}
                                                            </span>
                                                            <span className="text-[11px] text-gray-500">{item.category}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-300">{item.item}</p>
                                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.suggestion}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Interviewer Feedback */}
                                {isFeedbackLoading && (
                                    <div className="glass-panel rounded-xl p-8 border border-blue-500/10 flex flex-col items-center gap-3">
                                        <Loader2 size={28} className="text-blue-400 animate-spin" />
                                        <p className="text-sm text-gray-400">면접관 AI가 이력서를 검토하고 있습니다...</p>
                                    </div>
                                )}

                                {feedback && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                                        {/* Decision Card */}
                                        <div className={`glass-panel rounded-xl p-5 border ${decisionStyle(feedback.decision).bg}`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={decisionStyle(feedback.decision).color}>
                                                    {decisionStyle(feedback.decision).icon}
                                                </div>
                                                <div>
                                                    <h3 className={`font-bold text-lg ${decisionStyle(feedback.decision).color}`}>
                                                        {decisionStyle(feedback.decision).label}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">면접관 AI 판정</p>
                                                </div>
                                                <div className="ml-auto text-right">
                                                    <div className={`text-3xl font-black ${feedback.overallScore >= 70 ? 'text-emerald-400' : feedback.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                        {feedback.overallScore}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500">/ 100점</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-300 leading-relaxed">{feedback.summary}</p>
                                        </div>

                                        {/* Critical Issues */}
                                        {feedback.criticalIssues?.length > 0 && (
                                            <div className="glass-panel rounded-xl p-5 border border-red-500/10">
                                                <h3 className="font-bold text-sm text-red-400 flex items-center gap-2 mb-3">
                                                    <XCircle size={16} />
                                                    치명적 문제점
                                                </h3>
                                                <ul className="space-y-2">
                                                    {feedback.criticalIssues.map((issue, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                            <span className="text-red-400 flex-shrink-0 mt-1">•</span>
                                                            {issue}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Section Feedback */}
                                        {feedback.resumeFeedback?.length > 0 && (
                                            <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                                                <div className="px-5 py-3 border-b border-white/5">
                                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                                        <FileText size={16} className="text-violet-400" />
                                                        이력서 섹션별 평가
                                                    </h3>
                                                </div>
                                                <div className="divide-y divide-white/5">
                                                    {feedback.resumeFeedback.map((fb, i) => (
                                                        <div key={i} className="px-5 py-4 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-bold">{fb.section}</span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${fb.score >= 7 ? 'bg-emerald-500/10 text-emerald-400' : fb.score >= 5 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                    {fb.score}/10
                                                                </span>
                                                            </div>
                                                            {fb.strengths && <p className="text-xs text-emerald-400">💪 {fb.strengths}</p>}
                                                            {fb.weaknesses && <p className="text-xs text-red-400">⚠️ {fb.weaknesses}</p>}
                                                            {fb.suggestion && <p className="text-xs text-gray-500">💡 {fb.suggestion}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {feedback.coverLetterFeedback?.length > 0 && (
                                            <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                                                <div className="px-5 py-3 border-b border-white/5">
                                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                                        <ClipboardPaste size={16} className="text-violet-400" />
                                                        자기소개서 섹션별 평가
                                                    </h3>
                                                </div>
                                                <div className="divide-y divide-white/5">
                                                    {feedback.coverLetterFeedback.map((fb, i) => (
                                                        <div key={i} className="px-5 py-4 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-bold">{fb.section}</span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${fb.score >= 7 ? 'bg-emerald-500/10 text-emerald-400' : fb.score >= 5 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                    {fb.score}/10
                                                                </span>
                                                            </div>
                                                            {fb.strengths && <p className="text-xs text-emerald-400">💪 {fb.strengths}</p>}
                                                            {fb.weaknesses && <p className="text-xs text-red-400">⚠️ {fb.weaknesses}</p>}
                                                            {fb.suggestion && <p className="text-xs text-gray-500">💡 {fb.suggestion}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Interview Questions */}
                                        {feedback.interviewQuestions?.length > 0 && (
                                            <div className="glass-panel rounded-xl p-5 border border-white/5">
                                                <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                                                    <MessageSquare size={16} className="text-blue-400" />
                                                    예상 면접 질문
                                                </h3>
                                                <ol className="space-y-2">
                                                    {feedback.interviewQuestions.map((q, i) => (
                                                        <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                                                            <span className="text-blue-400 font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}</span>
                                                            {q}
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
