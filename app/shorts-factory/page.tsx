"use client";

import { useState, useEffect } from 'react';

export default function ShortsFactory() {
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<any>(null);
    const [videos, setVideos] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/status`);
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error("Failed to fetch status", e);
        }
    };

    const fetchVideos = async () => {
        try {
            const res = await fetch(`${API_BASE}/videos`);
            const data = await res.json();
            setVideos(data);
        } catch (e) {
            console.error("Failed to fetch videos", e);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch(`${API_BASE}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }), // Default category: "Review"
            });
            setUrl('');
            // Status update will happen via polling
        } catch (e) {
            alert("Failed to start job");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                🏭 AI Shorts Factory Manager
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Controls */}
                <div className="space-y-6">

                    {/* Status Card */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">🏭 Factory Status</h2>
                        <div className={`p-4 rounded-lg text-center font-bold text-lg ${status?.status === 'RUNNING' ? 'bg-yellow-500/20 text-yellow-500' :
                            status?.status === 'ERROR' ? 'bg-red-500/20 text-red-500' :
                                'bg-green-500/20 text-green-500'
                            }`}>
                            {status?.status || "Connecting..."}
                        </div>
                        {status?.status === 'RUNNING' && (
                            <div className="mt-4 text-sm text-gray-400 animate-pulse">
                                🚧 {status?.current_step}
                            </div>
                        )}
                        {status?.last_error && (
                            <div className="mt-4 text-sm text-red-400">
                                ❌ Error: {status?.last_error}
                            </div>
                        )}
                    </div>

                    {/* New Job Form */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">🚀 New Job</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    Product / Review URL
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
                                {loading ? "Starting..." : "Start Production 🎬"}
                            </button>
                        </form>
                        <p className="text-xs text-gray-500 mt-2">
                            * Currently supports Olive Young Global Review Pages
                        </p>
                    </div>

                    {/* Navigation Links */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">⚙️ Settings</h2>
                        <a href="/shorts-factory/config" className="block w-full text-center bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg">
                            Manage Target URLs & Schedule
                        </a>
                    </div>

                </div>

                {/* Right Column: Recent Outputs */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">📂 Recent Output</h2>
                    {videos.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No videos generated yet.</p>
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
                                        Open
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
