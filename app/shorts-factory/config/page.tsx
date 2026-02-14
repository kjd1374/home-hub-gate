"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfigPage() {
    const [config, setConfig] = useState<any>({ target_urls: [], auto_schedule: false });
    const [newUrl, setNewUrl] = useState('');
    const router = useRouter();

    const API = "/api/factory/config";

    useEffect(() => {
        fetch(API).then(res => res.json()).then(setConfig);
    }, []);

    const saveConfig = async (newConfig: any) => {
        setConfig(newConfig);
        await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newConfig)
        });
    };

    const addUrl = () => {
        if (newUrl) {
            const updated = { ...config, target_urls: [...config.target_urls, newUrl] };
            saveConfig(updated);
            setNewUrl('');
        }
    };

    const removeUrl = (index: number) => {
        const updated = { ...config, target_urls: config.target_urls.filter((_: any, i: number) => i !== index) };
        saveConfig(updated);
    };

    const toggleSchedule = () => {
        saveConfig({ ...config, auto_schedule: !config.auto_schedule });
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
                        ← 뒤로
                    </button>
                    <h1 className="text-3xl font-bold">⚙️ 공장 설정 (Settings)</h1>
                </div>

                {/* Schedule Toggle */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold">자동 실행 스케줄</h2>
                        <p className="text-gray-400 text-sm">매일 오전 9시에 크롤러 실행</p>
                    </div>
                    <button
                        onClick={toggleSchedule}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${config.auto_schedule ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                    >
                        {config.auto_schedule ? '켜짐' : '꺼짐'}
                    </button>
                </div>

                {/* URL List */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">공략 URL (자동 크롤링)</h2>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="올리브영 카테고리 URL 추가..."
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                        />
                        <button onClick={addUrl} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold">
                            추가
                        </button>
                    </div>

                    <ul className="space-y-2">
                        {config.target_urls.length === 0 ? (
                            <li className="text-gray-500 text-center py-4">설정된 URL이 없습니다.</li>
                        ) : (
                            config.target_urls.map((url: string, i: number) => (
                                <li key={i} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                                    <span className="truncate flex-1">{url}</span>
                                    <button onClick={() => removeUrl(i)} className="text-red-400 hover:text-red-300 ml-4">
                                        삭제
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

            </div>
        </div>
    );
}
