"use client";

import { useState, useEffect } from 'react';

export default function ShortsFactory() {
    const [activeTab, setActiveTab] = useState<'manager' | 'ranking'>('ranking');
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<any>(null);
    const [videos, setVideos] = useState<string[]>([]);
    const [rankings, setRankings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [rankingLoading, setRankingLoading] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("100000100010000"); // Default: Skincare

    const API_BASE = "/api/factory";

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/status`);
            if (!res.ok) throw new Error("Status check failed");
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error("Failed to fetch status", e);
            setStatus({ status: "ERROR", last_error: "Backend Disconnected" });
        }
    };

    const fetchVideos = async () => {
        try {
            const res = await fetch(`${API_BASE}/videos`);
            if (!res.ok) throw new Error("Video fetch failed");
            const data = await res.json();
            if (Array.isArray(data)) setVideos(data);
        } catch (e) {
            console.error("Failed to fetch videos", e);
        }
    };

    const fetchRankings = async (categoryId: string) => {
        setRankingLoading(true);
        try {
            const res = await fetch(`${API_BASE}/rankings?category=${categoryId}`);
            const data = await res.json();
            setRankings(data);
        } catch (e) {
            console.error("Failed to fetch rankings", e);
        } finally {
            setRankingLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchVideos();
        const interval = setInterval(() => {
            fetchStatus();
            fetchVideos();
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Fetch rankings when category changes
    useEffect(() => {
        if (selectedCategoryId) {
            fetchRankings(selectedCategoryId);
        }
    }, [selectedCategoryId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch(`${API_BASE}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            setUrl('');
        } catch (e) {
            alert("Failed to start job");
        } finally {
            setLoading(false);
        }
    };

    const startRankingJob = async (product: any) => {
        if (!confirm(`'${product.name}' 비디오 제작을 시작할까요?`)) return;

        try {
            await fetch(`${API_BASE}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: product.url,
                    category: "Skincare",
                    rank: product.rank,
                    name: product.name
                }),
            });
            alert("작업이 시작되었습니다! '공장 상태' 탭에서 확인하세요.");
        } catch (e) {
            alert("Failed to start job");
        }
    };

    return (
        <div className="h-screen overflow-y-auto bg-gray-900 text-white p-8 custom-scrollbar">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                🏭 AI 쇼츠 공장 관리자
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-gray-700 pb-2">
                <button
                    onClick={() => setActiveTab('ranking')}
                    className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'ranking' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                    🏆 랭킹 게시판 (Ranking Board)
                </button>
                <button
                    onClick={() => setActiveTab('manager')}
                    className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'manager' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                    ⚙️ 작업 관리 (Job Manager)
                </button>
            </div>

            {/* Status Bar (Always Visible) */}
            <div className={`mb-8 p-4 rounded-xl border ${status?.status === 'RUNNING' ? 'bg-gray-800 border-yellow-500/50' : 'bg-gray-800 border-gray-700'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold">상태:</span>
                        <span className={`${status?.status === 'RUNNING' ? 'text-yellow-500 animate-pulse' : 'text-green-500'}`}>
                            {status?.status === 'RUNNING' ? '🚧 작업 중...' : '✅ 대기 중'}
                        </span>
                        {status?.status === 'RUNNING' && <span className="text-gray-400 text-sm">({status?.current_step})</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                        {status?.last_video && `Last: ${status.last_video}`}
                    </div>
                </div>
                {status?.status === 'RUNNING' && (
                    <div className="mt-4">
                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${status.progress || 0}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-end mt-1">
                            <span className="text-xs text-yellow-500 font-mono">{status.progress || 0}%</span>
                        </div>
                    </div>
                )}
            </div>

            {
                activeTab === 'ranking' && (
                    <div className="space-y-6">
                        {/* Main Categories (Beauty vs Fashion) */}
                        <div className="flex w-full bg-gray-800 rounded-lg p-1">
                            <button
                                className={`flex-1 py-3 text-lg font-bold rounded-md transition-colors ${true ? 'bg-white text-black shadow' : 'text-gray-400'}`}
                            >
                                뷰티 (Beauty)
                            </button>
                            <button
                                disabled
                                className="flex-1 py-3 text-lg font-bold rounded-md text-gray-600 cursor-not-allowed"
                            >
                                패션 (Fashion) <span className="text-xs font-normal opacity-70">(준비중)</span>
                            </button>
                        </div>

                        {/* Sub Categories */}
                        <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-800">
                            {[
                                { name: "전체", id: "100000100010000" },
                                { name: "스킨케어", id: "100000100010000" },
                                { name: "마스크팩", id: "100000100090000" },
                                { name: "클렌징", id: "100000100100000" },
                                { name: "선케어", id: "100000100110000" },
                                { name: "더모 코스메틱", id: "100000100120000" },
                                { name: "메이크업", id: "100000100020000" },
                                { name: "헤어케어", id: "100000100030000" },
                                { name: "바디케어", id: "100000100040000" },
                            ].map((cat) => (
                                <button
                                    key={cat.name}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${selectedCategoryId === cat.id
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                        : 'border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:border-gray-500'
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                🔥 올리브영 실시간 랭킹
                                <span className="text-sm font-normal text-gray-500 ml-2">Top 20</span>
                            </h2>
                            <button onClick={() => fetchRankings(selectedCategoryId)} className="text-gray-400 hover:text-white text-sm underline">
                                {rankingLoading ? "로딩 중..." : "새로고침"}
                            </button>
                        </div>

                        {rankingLoading ? (
                            <div className="text-center py-20 text-gray-500 animate-pulse">
                                <div className="text-4xl mb-4">🧴</div>
                                데이터를 불러오는 중입니다...
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-20">
                                {Array.isArray(rankings) && rankings.map((product) => (
                                    <div key={product.rank} className="group bg-white rounded-lg overflow-hidden border border-gray-200 flex flex-col relative transition-transform hover:-translate-y-1 hover:shadow-lg">
                                        {/* Rank Badge */}
                                        <div className="absolute top-0 left-0 bg-black text-white text-sm font-bold w-8 h-8 flex items-center justify-center rounded-br-lg z-10 shadow-md">
                                            {product.rank}
                                        </div>

                                        {/* Image */}
                                        <div className="aspect-[1/1] overflow-hidden bg-gray-100 relative">
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                                                loading="lazy"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "/placeholder.png";
                                                }}
                                            />
                                        </div>

                                        {/* Content */}
                                        <div className="p-2 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 mb-0.5 truncate">{product.brand}</div>
                                                <div className="text-xs font-medium text-gray-900 leading-tight line-clamp-2 h-[32px] mb-2">
                                                    {product.name}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => startRankingJob(product)}
                                                    disabled={status?.status === 'RUNNING'}
                                                    className="w-full bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 rounded-md text-xs font-bold transition-colors"
                                                >
                                                    이거요! 👆
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {
                activeTab === 'manager' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Controls */}
                        <div className="space-y-6">
                            {/* New Job Form */}
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                                <h2 className="text-xl font-semibold mb-4">🚀 수동 작업 요청</h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            제품 / 리뷰 URL
                                        </label>
                                        <input
                                            type="text"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://global.oliveyoung.com/..."
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading || status?.status === 'RUNNING'}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                                    >
                                        {loading ? "시작 중..." : "제작 시작 🎬"}
                                    </button>
                                </form>
                                <p className="text-xs text-gray-500 mt-2">
                                    * 현재 올리브영 글로벌 리뷰 페이지를 지원합니다
                                </p>
                            </div>

                            {/* Navigation Links */}
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                                <h2 className="text-xl font-semibold mb-4">⚙️ 설정</h2>
                                <a href="/shorts-factory/config" className="block w-full text-center bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg">
                                    타겟 URL 및 스케줄 관리
                                </a>
                            </div>
                        </div>

                        {/* Right Column: Recent Outputs */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4">📂 최근 작업물</h2>
                            {videos.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">아직 생성된 비디오가 없습니다.</p>
                            ) : (
                                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                    {videos.map((vid, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition">
                                            <span className="text-sm truncate max-w-[250px]">{vid}</span>
                                            <a
                                                href={`http://[NAS-IP]/shorts_output/${vid}`} // Placeholder for now
                                                target="_blank"
                                                className="text-xs bg-gray-600 px-3 py-1 rounded hover:bg-gray-500"
                                            >
                                                열기
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
