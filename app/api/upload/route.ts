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

export async function POST(request: Request) {
    try {
        const filename = request.headers.get('x-file-name');
        const folderPath = request.headers.get('x-folder-path') || '/';

        if (!filename) {
            return NextResponse.json({ error: 'Filename required in headers' }, { status: 400 });
        }

        // Decode filename properly
        const decodedFilename = decodeURIComponent(filename);

        if (!request.body) {
            return NextResponse.json({ error: 'No file body' }, { status: 400 });
        }

        const safeDir = getSafePath(folderPath);

        // Ensure the directory exists
        try {
            await fs.promises.access(safeDir);
        } catch {
            return NextResponse.json({ error: 'Directory does not exist' }, { status: 404 });
        }

        const safeFilePath = path.join(safeDir, decodedFilename);

        const chunkIndex = parseInt(request.headers.get('x-chunk-index') || '0', 10);

        // Define write flags: 'w' for first chunk to overwrite/create, 'a' for subsequent chunks to append
        const flags = chunkIndex === 0 ? 'w' : 'a';

        // Streaming write directly from request body
        try {
            if (request.body) {
                const reader = request.body.getReader();
                const writeStream = fs.createWriteStream(safeFilePath, { flags });

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    writeStream.write(value);
                }

                // Wait for the stream to finish writing
                await new Promise((resolve, reject) => {
                    writeStream.end(() => {
                        resolve(null);
                    });
                    writeStream.on('error', reject);
                });
            }
        } catch (writeError) {
            console.error('Error writing file:', writeError);
            return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
        }

        return NextResponse.json({ success: true, path: path.join(folderPath, decodedFilename) });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
