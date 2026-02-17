import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
        // Check if exists and is file
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stats = fs.statSync(fullPath);
        const data = fs.createReadStream(fullPath);

        // TypeScript definition for Stream in Response is tricky in Next.js tailored types
        // @ts-ignore
        return new NextResponse(data, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': stats.size.toString(),
                'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"`
            }
        });

    } catch (e) {
        return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
}
