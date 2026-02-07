import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const STORAGE_ROOT = '/Users/jungdookim/NAS/storage';

function getSafePath(targetPath: string) {
    const resolvedPath = path.resolve(STORAGE_ROOT, targetPath.replace(/^\/+/, ''));
    if (!resolvedPath.startsWith(STORAGE_ROOT)) {
        return STORAGE_ROOT;
    }
    return resolvedPath;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const currentPath = searchParams.get('path') || '';

    const fullPath = getSafePath(currentPath);

    try {
        const stats = await fs.stat(fullPath);

        if (!stats.isDirectory()) {
            // If it's a file, we might want to panic or handle download elsewhere, 
            // but for this listing API, we expect directories.
            return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
        }

        const dirents = await fs.readdir(fullPath, { withFileTypes: true });

        const files = dirents.map(dirent => ({
            name: dirent.name,
            isDirectory: dirent.isDirectory(),
            size: 0, // We'd need to stat each file for size, skipping for perf for now or doing it async
            path: path.join(currentPath, dirent.name)
        }));

        // Simple sorting: Directories first, then alphabetical
        files.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });

        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const cpuLoad = os.loadavg();

        // Get Disk Stats for the storage root
        let storage = { free: 0, total: 0 };
        try {
            const diskStats = await fs.statfs(STORAGE_ROOT);
            storage = {
                free: diskStats.bavail * diskStats.bsize,
                total: diskStats.blocks * diskStats.bsize
            };
        } catch (e) {
            console.error('Failed to get disk stats', e);
        }

        return NextResponse.json({
            files,
            currentPath,
            system: {
                memory: { free: freeMem, total: totalMem },
                cpu: cpuLoad,
                storage
            }
        });

    } catch (error) {
        console.error('File Error:', error);
        return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    // For simple file creation or folder creation
    try {
        const body = await request.json();
        const { type, name, folderPath } = body; // type: 'folder' | 'file'

        if (!name || (folderPath === undefined)) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        const fullPath = getSafePath(path.join(folderPath, name));

        if (type === 'folder') {
            await fs.mkdir(fullPath);
        } else {
            // Placeholder for file upload logic which is more complex with multipart
            // For now, let's just create empty files or handle text
            return NextResponse.json({ error: 'Use /api/upload for files' }, { status: 501 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Action failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { path: targetPath } = body;

        if (!targetPath) {
            return NextResponse.json({ error: 'Missing path' }, { status: 400 });
        }

        const fullPath = getSafePath(targetPath);

        // Safety check: Don't delete root
        if (fullPath === STORAGE_ROOT) {
            return NextResponse.json({ error: 'Cannot delete root' }, { status: 403 });
        }

        await fs.rm(fullPath, { recursive: true, force: true });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Delete failed', e);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
