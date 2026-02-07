import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const stat = promisify(fs.stat);

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
    const filePath = searchParams.get('file');

    if (!filePath) {
        return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const fullPath = getSafePath(filePath);

    try {
        const fileStat = await stat(fullPath);
        const fileSize = fileStat.size;
        const range = request.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(fullPath, { start, end });

            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': 'video/mp4', // Simplification: we might need dynamic mime types
            };

            // Simple MIME type detection
            const ext = path.extname(fullPath).toLowerCase();
            if (ext === '.mp3') head['Content-Type'] = 'audio/mpeg';
            else if (ext === '.wav') head['Content-Type'] = 'audio/wav';
            else if (ext === '.webm') head['Content-Type'] = 'video/webm';
            else if (ext === '.mkv') head['Content-Type'] = 'video/x-matroska';
            // Default to mp4 for video, but browsers are smart enough to look at the stream usually.

            // @ts-ignore
            return new NextResponse(file, {
                status: 206,
                headers: head,
            });
        } else {
            const head = {
                'Content-Length': fileSize.toString(),
                'Content-Type': 'video/mp4',
            };
            const file = fs.createReadStream(fullPath);

            // @ts-ignore
            return new NextResponse(file, {
                status: 200,
                headers: head,
            });
        }
    } catch (error) {
        return NextResponse.json({ error: 'File not found or error reading' }, { status: 404 });
    }
}
