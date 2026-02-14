'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Plus,
    Send,
    TrendingDown,
    TrendingUp,
    Minus,
    Scale,
    Utensils,
    MessageCircle,
    Sun,
    Cloud,
    Moon,
    Sparkles,
    Bot,
    User,
    Camera,
    Loader2,
    X,
    ChevronDown,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────
interface WeightEntry {
    date: string;
    weight: number;
}

interface MealEntry {
    id: string;
    date: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner';
    description: string;
    ai_analysis?: string;
    calories?: number;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// ─── Helpers ────────────────────────────────────────────────────────
const todayStr = () => {
    const d = new Date();
    // Precise local YYYY-MM-DD adjustment for KST (Asia/Seoul)
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);
};

// ─── Custom Tooltip ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-zinc-900/90 backdrop-blur-lg border border-white/10 px-4 py-2 rounded-xl shadow-xl">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-lg font-bold text-emerald-400">{payload[0].value} kg</p>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function DietCoachPage() {
    // State
    const [weights, setWeights] = useState<WeightEntry[]>([]);
    const [meals, setMeals] = useState<MealEntry[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [selectedMealTab, setSelectedMealTab] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [showMealModal, setShowMealModal] = useState(false);
    const [weightInput, setWeightInput] = useState('');
    const [mealInput, setMealInput] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [mobileView, setMobileView] = useState<'data' | 'chat'>('data');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedWeightDate, setSelectedWeightDate] = useState(todayStr());
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // ─── Load data from Supabase on mount ─────────────────────────────
    // ─── Load data from Supabase on mount ─────────────────────────────
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load weights (last 90 days)
                const { data: weightData } = await supabase
                    .from('weight_logs')
                    .select('date, weight')
                    .order('date', { ascending: true })
                    .limit(90);

                if (weightData) setWeights(weightData);

                // Load today's meals
                const { data: mealData } = await supabase
                    .from('meal_logs')
                    .select('*')
                    .eq('date', todayStr())
                    .order('created_at', { ascending: true });

                if (mealData) {
                    setMeals(mealData.map((m: any) => ({
                        id: m.id.toString(),
                        date: m.date,
                        meal_type: m.meal_type,
                        description: m.description,
                        ai_analysis: m.ai_analysis,
                        calories: m.calories,
                    })));
                }

                // Load chat history from Supabase
                const { data: chatData } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (chatData) {
                    setChatMessages(chatData.map((m: any) => ({
                        role: m.role,
                        content: m.content
                    })));
                }
            } catch (e) {
                console.error('Failed to load data from Supabase:', e);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // Scroll to bottom on new message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    // ─── Weight Functions ─────────────────────────────────────────────
    const addWeight = async () => {
        const w = parseFloat(weightInput);
        if (isNaN(w) || w < 30 || w > 300) return;

        const targetDate = selectedWeightDate;

        // Upsert to Supabase (insert or update if same date)
        const { error } = await supabase
            .from('weight_logs')
            .upsert({ date: targetDate, weight: w }, { onConflict: 'date' });

        if (error) {
            console.error('Failed to save weight:', error);
            return;
        }

        // Update local state
        const updated = weights.filter((e) => e.date !== targetDate);
        updated.push({ date: targetDate, weight: w });
        updated.sort((a, b) => a.date.localeCompare(b.date));

        setWeights(updated);
        setShowWeightModal(false);
        setWeightInput('');
    };

    // ─── Image Upload for Chat ─────────────────────────────────────────
    const [chatImageBase64, setChatImageBase64] = useState<string | null>(null);
    const chatFileInputRef = useRef<HTMLInputElement>(null);

    const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Resize image to reduce payload size
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setChatImageBase64(dataUrl.split(',')[1]);
            URL.revokeObjectURL(url);
        };
        img.src = url;
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    // ─── Meal Functions ───────────────────────────────────────────────
    const addMeal = async () => {
        if (!mealInput.trim()) return;

        const today = todayStr();
        const description = mealInput.trim();

        // Insert to Supabase
        const { data: inserted, error } = await supabase
            .from('meal_logs')
            .insert({
                date: today,
                meal_type: selectedMealTab,
                description: description,
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to save meal:', error);
            return;
        }

        const entry: MealEntry = {
            id: inserted.id.toString(),
            date: today,
            meal_type: selectedMealTab,
            description: description,
        };

        const updated = [...meals, entry];
        setMeals(updated);
        setMealInput('');
        setShowMealModal(false);

        // If it was already analyzed by image, we might already have calories?
        // But the current flow updates DB with analysis *after* insertion.
        // For simplicity, let's just run text analysis again OR use the data if we had stored it.
        // Since we didn't store calories in state from image analysis, we'll let existing flow run.
        // It's a bit redundant but safe.
        // OPTIMIZATION: If we already have analysis from image, we should skip this.

        // Let's stick to existing flow for now to keep it robust. Text analysis of "Grilled Chicken Salad" is fast and cheap.

        // AI analysis via the API
        try {
            const res = await fetch('/api/diet/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meal: entry.description,
                    meal_type: entry.meal_type,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                entry.ai_analysis = data.analysis;
                entry.calories = data.calories;

                // Update Supabase with analysis
                await supabase
                    .from('meal_logs')
                    .update({
                        ai_analysis: data.analysis,
                        calories: data.calories,
                    })
                    .eq('id', inserted.id);

                const updatedWithAnalysis = updated.map((m) => (m.id === entry.id ? entry : m));
                setMeals(updatedWithAnalysis);
            }
        } catch (e) {
            console.error('Analysis failed:', e);
        }
    };

    // ─── Chat Functions ───────────────────────────────────────────────
    const sendChat = useCallback(async () => {
        if ((!chatInput.trim() && !chatImageBase64) || isTyping) return;

        const msgText = chatInput.trim() || (chatImageBase64 ? '이 음식 사진을 분석해 주세요' : '');
        const userMsg: ChatMessage = { role: 'user', content: chatImageBase64 ? `📸 ${msgText}` : msgText };
        const imageToSend = chatImageBase64;

        // Optimistic update
        const newMessages = [...chatMessages, userMsg];
        setChatMessages(newMessages);
        setChatInput('');
        setChatImageBase64(null);
        setIsTyping(true);

        try {
            // Save User Message to Supabase
            await supabase.from('chat_messages').insert({
                role: 'user',
                content: userMsg.content
            });

            const res = await fetch('/api/diet/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msgText,
                    image: imageToSend || undefined,
                    history: newMessages.slice(-10),
                    weights: weights.slice(-14),
                    todayMeals: meals.filter((m) => m.date === todayStr()),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply };

                // Save Assistant Message to Supabase
                await supabase.from('chat_messages').insert({
                    role: 'assistant',
                    content: assistantMsg.content
                });

                setChatMessages((prev) => [...prev, assistantMsg]);
            } else {
                throw new Error(res.statusText || 'Server Error');
            }
        } catch (e) {
            console.error('Chat failed:', e);
            const errorMsg: ChatMessage = { role: 'assistant', content: '죄송합니다, 응답을 받지 못했습니다. 다시 시도해 주세요.' };
            setChatMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    }, [chatInput, chatImageBase64, chatMessages, isTyping, weights, meals]);

    // Derived Data
    const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : null;
    const prevWeight = weights.length > 1 ? weights[weights.length - 2].weight : null;
    const weightDiff = latestWeight && prevWeight ? latestWeight - prevWeight : null;
    const chartData = weights.slice(-30).map((w) => ({
        date: w.date.slice(5), // MM-DD
        weight: w.weight,
    }));

    const todayMeals = meals.filter((m) => m.date === todayStr());
    const mealTabs = [
        { key: 'breakfast' as const, label: '아침', icon: Sun },
        { key: 'lunch' as const, label: '점심', icon: Cloud },
        { key: 'dinner' as const, label: '저녁', icon: Moon },
    ];

    if (isLoading) {
        return (
            <div className="h-screen w-full bg-[#050505] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="text-emerald-400 animate-spin" />
                    <p className="text-gray-400 text-sm">데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-[#050505] text-white flex flex-col overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-emerald-900/10 blur-[120px]" />
                <div className="absolute bottom-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-teal-900/10 blur-[100px]" />
            </div>

            {/* Top Bar */}
            <header className="relative z-10 h-16 border-b border-white/5 flex items-center px-4 md:px-8 gap-4 backdrop-blur-sm bg-black/20 flex-shrink-0">
                <a href="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <ArrowLeft size={20} />
                </a>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-900/30">
                        <Scale size={18} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">Diet Coach</h1>
                        <p className="text-xs text-gray-500">AI 기반 다이어트 코칭</p>
                    </div>
                </div>

                {/* Mobile Tab Toggle */}
                <div className="ml-auto md:hidden flex gap-1 bg-white/5 rounded-lg p-1">
                    <button
                        onClick={() => setMobileView('data')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mobileView === 'data' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}
                    >
                        데이터
                    </button>
                    <button
                        onClick={() => setMobileView('chat')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mobileView === 'chat' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}
                    >
                        코칭
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex overflow-hidden">
                {/* LEFT: Data Panel */}
                <div className={`flex-1 flex flex-col overflow-y-auto p-4 md:p-6 gap-4 md:gap-6 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
                    {/* ── Weight Chart Card ── */}
                    <div className="glass-panel rounded-2xl p-5 md:p-6 space-y-4 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <TrendingDown size={20} className="text-emerald-400" />
                                    체중 추이
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">최근 30일</p>
                            </div>
                            <button
                                onClick={() => setShowWeightModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors text-sm font-medium shadow-lg shadow-emerald-900/30"
                            >
                                <Plus size={16} />
                                오늘 체중 기록
                            </button>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">현재 체중</p>
                                <p className="text-2xl font-bold text-emerald-400">{latestWeight ?? '—'}</p>
                                <p className="text-xs text-gray-500">kg</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">전일 대비</p>
                                <p className={`text-2xl font-bold ${weightDiff !== null ? (weightDiff < 0 ? 'text-emerald-400' : weightDiff > 0 ? 'text-red-400' : 'text-gray-400') : 'text-gray-600'}`}>
                                    {weightDiff !== null ? (weightDiff > 0 ? '+' : '') + weightDiff.toFixed(1) : '—'}
                                </p>
                                <p className="text-xs text-gray-500">kg</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">기록 수</p>
                                <p className="text-2xl font-bold text-teal-400">{weights.length}</p>
                                <p className="text-xs text-gray-500">일</p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="h-48 md:h-56">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            domain={chartData.length > 1 ? ['dataMin - 1', 'dataMax + 1'] : ['auto', 'auto']}
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="weight"
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            fill="url(#weightGradient)"
                                            dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                                            activeDot={{ r: 6, fill: '#10b981', stroke: '#050505', strokeWidth: 3 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center flex-col gap-3 text-gray-600">
                                    <Scale size={40} />
                                    <p className="text-sm">아직 기록이 없습니다. 오늘 체중을 기록해 보세요!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Meal Tracker Card ── */}
                    <div className="glass-panel rounded-2xl p-5 md:p-6 space-y-4 flex-1 min-h-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Utensils size={20} className="text-amber-400" />
                                오늘의 식단
                            </h2>
                            <button
                                onClick={() => setShowMealModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors text-sm font-medium shadow-lg shadow-amber-900/30"
                            >
                                <Plus size={16} />
                                식사 기록
                            </button>
                        </div>

                        {/* Meal Tabs */}
                        <div className="flex gap-2">
                            {mealTabs.map((tab) => {
                                const Icon = tab.icon;
                                const count = todayMeals.filter((m) => m.meal_type === tab.key).length;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setSelectedMealTab(tab.key)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${selectedMealTab === tab.key
                                            ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        {tab.label}
                                        {count > 0 && (
                                            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Meal List */}
                        <div className="flex-1 overflow-y-auto space-y-3 min-h-[100px] max-h-[280px]">
                            <AnimatePresence mode="popLayout">
                                {todayMeals
                                    .filter((m) => m.meal_type === selectedMealTab)
                                    .map((meal) => (
                                        <motion.div
                                            key={meal.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="bg-white/5 rounded-xl p-4 space-y-2"
                                        >
                                            <div className="flex items-start justify-between">
                                                <p className="font-medium text-sm">{meal.description}</p>
                                                {meal.calories && (
                                                    <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-1 rounded-lg flex-shrink-0 ml-2">
                                                        ~{meal.calories} kcal
                                                    </span>
                                                )}
                                            </div>
                                            {meal.ai_analysis && (
                                                <div className="flex items-start gap-2 bg-emerald-900/20 rounded-lg p-3 border border-emerald-500/10">
                                                    <Sparkles size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-xs text-emerald-300/80 leading-relaxed">{meal.ai_analysis}</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                            </AnimatePresence>

                            {todayMeals.filter((m) => m.meal_type === selectedMealTab).length === 0 && (
                                <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
                                    아직 {mealTabs.find((t) => t.key === selectedMealTab)?.label} 식사를 기록하지 않았습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: AI Chat Panel */}
                <div
                    className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 border-l border-white/5 flex flex-col bg-black/30 backdrop-blur-sm ${mobileView === 'data' ? 'hidden md:flex' : 'flex'
                        }`}
                >
                    {/* Chat Header */}
                    <div className="p-4 border-b border-white/5 flex items-center gap-3">
                        <div className="relative">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600 shadow-lg">
                                <Bot size={18} />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050505]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">AI Diet Coach</h3>
                            <p className="text-[11px] text-emerald-400">온라인 · 맞춤 코칭 제공</p>
                        </div>
                        {chatMessages.length > 0 && (
                            <button
                                onClick={async () => {
                                    if (confirm('대화 내용을 모두 삭제하시겠습니까?')) {
                                        setChatMessages([]);
                                        await supabase.from('chat_messages').delete().neq('id', 0); // Delete all rows
                                    }
                                }}
                                className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                대화 초기화
                            </button>
                        )}
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatMessages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-4">
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border border-emerald-500/10">
                                    <MessageCircle size={32} className="text-emerald-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-gray-300">안녕하세요! 👋</p>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[250px]">
                                        체중과 식단 데이터를 기반으로 맞춤형 다이어트 코칭을 제공합니다. 무엇이든 물어보세요!
                                    </p>
                                </div>
                                <div className="space-y-2 w-full max-w-[280px]">
                                    {['오늘 점심 뭐 먹으면 좋을까?', '내 체중 변화를 분석해줘', '다이어트에 좋은 간식 추천해줘'].map(
                                        (q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setChatInput(q);
                                                    chatInputRef.current?.focus();
                                                }}
                                                className="w-full text-left px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-colors border border-white/5"
                                            >
                                                {q}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        {chatMessages.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="p-1.5 rounded-lg bg-emerald-600/20 h-fit flex-shrink-0">
                                        <Bot size={14} className="text-emerald-400" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-emerald-600 text-white rounded-br-md'
                                        : 'bg-white/5 text-gray-200 rounded-bl-md border border-white/5'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="p-1.5 rounded-lg bg-blue-600/20 h-fit flex-shrink-0">
                                        <User size={14} className="text-blue-400" />
                                    </div>
                                )}
                            </motion.div>
                        ))}

                        {isTyping && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                                <div className="p-1.5 rounded-lg bg-emerald-600/20 h-fit">
                                    <Bot size={14} className="text-emerald-400" />
                                </div>
                                <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-bl-md border border-white/5">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-white/5 bg-black/40">
                        {/* Image Preview */}
                        {chatImageBase64 && (
                            <div className="mb-2 relative inline-block">
                                <img
                                    src={`data:image/jpeg;base64,${chatImageBase64}`}
                                    alt="첨부 이미지"
                                    className="h-16 w-16 object-cover rounded-lg border border-white/10"
                                />
                                <button
                                    onClick={() => setChatImageBase64(null)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={chatFileInputRef}
                                className="hidden"
                                onChange={handleChatImageSelect}
                            />
                            <button
                                onClick={() => chatFileInputRef.current?.click()}
                                disabled={isTyping}
                                className={`p-3 rounded-xl transition-all border ${chatImageBase64 ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'} disabled:opacity-50`}
                            >
                                <Camera size={18} />
                            </button>
                            <input
                                ref={chatInputRef}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                                placeholder={chatImageBase64 ? '사진에 대해 질문하세요...' : '다이어트 관련 질문을 입력하세요...'}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                            />
                            <button
                                onClick={sendChat}
                                disabled={(!chatInput.trim() && !chatImageBase64) || isTyping}
                                className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg shadow-emerald-900/30"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Weight Input Modal ── */}
            <AnimatePresence>
                {showWeightModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowWeightModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold">⚖️ 오늘의 체중</h3>
                                <button onClick={() => setShowWeightModal(false)} className="text-gray-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-2">날짜 선택</label>
                                    <input
                                        type="date"
                                        value={selectedWeightDate}
                                        onChange={(e) => setSelectedWeightDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-2">체중 (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weightInput}
                                        onChange={(e) => setWeightInput(e.target.value)}
                                        placeholder="예: 75.5"
                                        autoFocus
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-center placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                                        onKeyDown={(e) => e.key === 'Enter' && addWeight()}
                                    />
                                </div>
                                <button
                                    onClick={addWeight}
                                    disabled={!weightInput}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 rounded-xl font-medium transition-colors"
                                >
                                    기록하기
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Meal Input Modal ── */}
            <AnimatePresence>
                {showMealModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowMealModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold">🍽️ 식사 기록</h3>
                                <button onClick={() => setShowMealModal(false)} className="text-gray-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Meal Type Selection */}
                                <div className="flex gap-2">
                                    {mealTabs.map((tab) => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.key}
                                                onClick={() => setSelectedMealTab(tab.key)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium transition-all ${selectedMealTab === tab.key
                                                    ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                                                    : 'bg-white/5 text-gray-400 border border-transparent'
                                                    }`}
                                            >
                                                <Icon size={14} />
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-2">먹은 음식</label>
                                    <input
                                        value={mealInput}
                                        onChange={(e) => setMealInput(e.target.value)}
                                        placeholder="예: 현미밥, 된장찌개, 두부, 김치"
                                        autoFocus
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                                        onKeyDown={(e) => e.key === 'Enter' && addMeal()}
                                    />
                                    <p className="text-[11px] text-gray-600 mt-1.5">AI가 자동으로 칼로리를 분석합니다</p>
                                </div>

                                <button
                                    onClick={addMeal}
                                    disabled={!mealInput.trim()}
                                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-30 rounded-xl font-medium transition-colors"
                                >
                                    기록 & AI 분석
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
