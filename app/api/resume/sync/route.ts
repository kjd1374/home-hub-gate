import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const TABLE = 'resume_builder';

// GET: Load all resume checker data
export async function GET() {
    try {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', 'default_user')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Supabase load error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            resume: data?.profile?.resume || data?.resume || '',
            coverLetter: data?.profile?.coverLetter || data?.coverLetter || '',
            jobPostingUrl: data?.profile?.jobPostingUrl || data?.jobPostingUrl || '',
            analysisResults: data?.outputs?.analysisResults || data?.analysisResults || null,
            feedbackResults: data?.outputs?.feedbackResults || data?.feedbackResults || null,
        });
    } catch (error) {
        console.error('Load error:', error);
        return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
    }
}

// POST: Save resume checker data
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { resume, coverLetter, jobPostingUrl, analysisResults, feedbackResults } = body;

        const payload = {
            id: 'default_user',
            profile: { resume, coverLetter, jobPostingUrl },
            outputs: { analysisResults, feedbackResults },
            conversations: null,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from(TABLE)
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Supabase save error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Save error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
