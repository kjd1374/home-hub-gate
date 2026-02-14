import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const scriptPath = path.join(process.cwd(), 'scripts', 'codex_runner.py');

        // Escape prompt to be safe for shell arg (basic)
        // Ideally we should pass via stdin or env var to avoid shell injection, 
        // but for this prototype we will use JSON stringify to escape
        const safePrompt = JSON.stringify(prompt);

        const { stdout, stderr } = await execPromise(`python3 ${scriptPath} ${safePrompt}`);

        try {
            const result = JSON.parse(stdout);
            return NextResponse.json(result);
        } catch (e) {
            // Fallback if script didn't output JSON
            return NextResponse.json({
                success: false,
                error: 'Failed to parse script output',
                stdout,
                stderr
            });
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
