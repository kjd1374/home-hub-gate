'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HardDrive,
    Cpu,
    Activity,
    Folder,
    File,
    ChevronRight,
    Home,
    Download,
    Upload as UploadIcon,
    Server,
    Music,
    Image as ImageIcon,
    Video,
    FileText,
    Plus,
    FolderPlus,
    Trash2,
    Menu,
    X
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface FileItem {
    name: string;
    isDirectory: boolean;
    size: number;
    path: string;
}

interface SystemStats {
    memory: { free: number; total: number };
    cpu: number[];
    storage?: { free: number; total: number };
}

export default function Dashboard() {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [playingFile, setPlayingFile] = useState<FileItem | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const fetchFiles = async (path: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            if (data.files) {
                setFiles(data.files);
                setStats(data.system);
                setCurrentPath(path);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles('/');
    }, []);

    const handleNavigate = (path: string) => {
        fetchFiles(path);
    };

    const handleFileClick = (file: FileItem) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav'].includes(ext || '')) {
            setPlayingFile(file);
        } else {
            handleDownload(file.path);
        }
    };

    const handleDownload = (path: string) => {
        window.location.href = `/api/download?file=${encodeURIComponent(path)}`;
    };

    const handleCreateFolder = async () => {
        const name = prompt('Enter folder name:');
        if (!name) return;

        try {
            const res = await fetch('/api/files', {
                method: 'POST',
                body: JSON.stringify({ type: 'folder', name, folderPath: currentPath }),
            });
            if (res.ok) {
                fetchFiles(currentPath);
            } else {
                alert('Failed to create folder');
            }
        } catch (e) {
            console.error(e);
            alert('Error creating folder');
        }
    };

    const handleDelete = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const res = await fetch('/api/files', {
                method: 'DELETE',
                body: JSON.stringify({ path }),
            });
            if (res.ok) {
                fetchFiles(currentPath);
            } else {
                alert('Failed to delete');
            }
        } catch (error) {
            console.error(error);
            alert('Error deleting');
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);

        let file: File | null = null;
        if ('dataTransfer' in event) {
            file = event.dataTransfer.files[0];
        } else if (event.target.files) {
            file = event.target.files[0];
        }

        if (!file) return;

        setUploading(true);
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'x-file-name': encodeURIComponent(file.name),
                        'x-folder-path': currentPath,
                        'x-chunk-index': i.toString(),
                        'x-total-chunks': totalChunks.toString(),
                        'Content-Type': 'application/octet-stream',
                    },
                    body: chunk,
                });

                if (!res.ok) {
                    throw new Error(`Upload failed at chunk ${i}`);
                }
                setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
            }
            fetchFiles(currentPath);
        } catch (e) {
            console.error(e);
            alert('Error uploading');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const getIcon = (name: string, isDir: boolean) => {
        if (isDir) return <Folder className="text-blue-400" />;
        const ext = name.split('.').pop()?.toLowerCase();
        if (['jpg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="text-purple-400" />;
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return <Video className="text-red-400" />;
        if (['mp3', 'wav'].includes(ext || '')) return <Music className="text-pink-400" />;
        return <FileText className="text-gray-400" />;
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Memory usage percentage
    const memUsage = stats ? ((stats.memory.total - stats.memory.free) / stats.memory.total) * 100 : 0;
    // CPU load (using 1 min avg for demo)
    const cpuUsage = stats && stats.cpu ? stats.cpu[0] * 10 : 0; // Rough scaling
    // Storage usage percentage
    const storageUsage = stats && stats.storage ? ((stats.storage.total - stats.storage.free) / stats.storage.total) * 100 : 0;

    return (
        <div
            className="flex h-screen w-full bg-[#050505] text-white selection:bg-purple-500/30"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleUpload}
        >
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-purple-500 rounded-3xl m-4 pointer-events-none"
                    >
                        <div className="text-center">
                            <UploadIcon size={64} className="mx-auto text-purple-500 mb-4 animate-bounce" />
                            <h2 className="text-2xl font-bold">Drop file to upload</h2>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {uploading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-8 right-8 z-[70] bg-zinc-900 border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-2 w-64"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Uploading... {uploadProgress}%</span>
                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadProgress}%` }}
                                transition={{ duration: 0.2 }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {playingFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-10"
                        onClick={() => setPlayingFile(null)}
                    >
                        <div
                            className="w-full max-w-5xl bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 left-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center">
                                <h2 className="font-medium text-lg text-white/90">{playingFile.name}</h2>
                                <button
                                    onClick={() => setPlayingFile(null)}
                                    className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            {['mp3', 'wav'].includes(playingFile.name.split('.').pop()?.toLowerCase() || '') ? (
                                <div className="aspect-video bg-zinc-900 flex items-center justify-center flex-col gap-6">
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center animate-pulse">
                                        <Music size={64} className="text-white" />
                                    </div>
                                    <audio
                                        controls
                                        autoPlay
                                        className="w-2/3"
                                        src={`/api/stream?file=${encodeURIComponent(playingFile.path)}`}
                                    />
                                </div>
                            ) : (
                                <video
                                    controls
                                    autoPlay
                                    className="w-full h-full max-h-[80vh] bg-black"
                                    src={`/api/stream?file=${encodeURIComponent(playingFile.path)}`}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Sidebar Backdrop */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.div
                className={clsx(
                    "fixed md:static inset-y-0 left-0 z-50 w-80 flex-shrink-0 border-r border-white/10 bg-black/80 md:bg-black/50 p-6 flex flex-col gap-8 backdrop-blur-md transition-transform duration-300",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-purple-900/20">
                            <Server size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-xl tracking-tight">Mac Mini Server</h1>
                            <p className="text-xs text-gray-500">M4 High Performance</p>
                        </div>
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden p-2 hover:bg-white/10 rounded-lg text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Stats */}
                <div className="space-y-6">
                    <div className="glass-panel p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Cpu size={16} />
                            <span>CPU Load</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(cpuUsage, 100)}%` }}
                                transition={{ duration: 1 }}
                            />
                        </div>
                        <p className="text-right text-xs text-gray-500 font-mono">{cpuUsage.toFixed(1)}%</p>
                    </div>

                    <div className="glass-panel p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Activity size={16} />
                            <span>Memory Usage</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${memUsage}%` }}
                                transition={{ duration: 1 }}
                            />
                        </div>
                        <p className="text-right text-xs text-gray-500 font-mono">{stats ? formatBytes(stats.memory.total - stats.memory.free) : '-'} / {stats ? formatBytes(stats.memory.total) : '-'}</p>
                    </div>

                    <div className="glass-panel p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <HardDrive size={16} />
                            <span>Storage</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-green-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${storageUsage}%` }}
                                transition={{ duration: 1 }}
                            />
                        </div>
                        <p className="text-right text-xs text-gray-500 font-mono">
                            {stats && stats.storage ? formatBytes(stats.storage.total - stats.storage.free) : '-'} / {stats && stats.storage ? formatBytes(stats.storage.total) : '-'}
                        </p>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="glass-panel p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium">System Online</span>
                    </div>
                </div>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background Gradients */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-blue-900/10 blur-[100px]" />
                    <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[100px]" />
                </div>

                {/* Top Bar / Breadcrumbs */}
                <div className="h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 z-10 backdrop-blur-sm gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 hover:bg-white/10 rounded-lg text-white"
                        >
                            <Menu size={20} />
                        </button>

                        <div className="flex items-center gap-2 text-sm text-gray-400 overflow-x-auto no-scrollbar mask-linear-fade">
                            <button onClick={() => handleNavigate('/')} className="hover:text-white transition-colors flex-shrink-0">
                                <Home size={16} />
                            </button>
                            {currentPath.split('/').filter(Boolean).map((part, i, arr) => {
                                const fullPath = '/' + arr.slice(0, i + 1).join('/');
                                return (
                                    <div key={fullPath} className="flex items-center gap-2 flex-shrink-0">
                                        <ChevronRight size={14} />
                                        <button onClick={() => handleNavigate(fullPath)} className="hover:text-white transition-colors whitespace-nowrap">
                                            {part}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                        <button
                            onClick={handleCreateFolder}
                            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg cursor-pointer transition-colors border border-white/10 text-xs md:text-sm font-medium"
                        >
                            <FolderPlus size={16} />
                            <span className="hidden md:inline">New Folder</span>
                        </button>

                        <label className="flex items-center gap-2 px-3 md:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition-colors shadow-lg shadow-purple-900/20 text-xs md:text-sm font-medium">
                            <UploadIcon size={16} />
                            <span className="hidden md:inline">Upload</span>
                            <input type="file" className="hidden" onChange={handleUpload} />
                        </label>
                    </div>
                </div>

                {/* File Grid */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 z-10">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                            <AnimatePresence mode="popLayout">
                                {files.map((file) => (
                                    <motion.div
                                        key={file.path}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        className="group relative glass-panel rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-all"
                                        onClick={() => file.isDirectory ? handleNavigate(file.path) : handleFileClick(file)}
                                    >
                                        <div className="aspect-square rounded-xl bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                            <div className="scale-150 transform transition-transform group-hover:scale-125">
                                                {getIcon(file.name, file.isDirectory)}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-medium truncate text-sm text-gray-200">{file.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">{file.isDirectory ? 'Directory' : 'File'}</p>
                                        </div>

                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                            {!file.isDirectory && (
                                                <div className="p-2 bg-white/10 rounded-full hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDownload(file.path); }}>
                                                    <Download size={14} className="text-white" />
                                                </div>
                                            )}
                                            <div className="p-2 bg-red-500/20 rounded-full hover:bg-red-500/40" onClick={(e) => handleDelete(e, file.path)}>
                                                <Trash2 size={14} className="text-red-400" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
