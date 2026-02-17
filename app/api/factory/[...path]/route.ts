import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = "http://127.0.0.1:8000";

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const pathStr = path.join('/');
    const searchParams = request.nextUrl.search;
    const targetUrl = `${BACKEND_URL}/api/${pathStr}${searchParams}`;

    console.log(` Proxying ${request.method} request to: ${targetUrl}`);

    try {
        const body = request.method !== 'GET' ? await request.text() : undefined;

        const response = await fetch(targetUrl, {
            method: request.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body,
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error(`❌ Backend returned non-JSON: ${text.substring(0, 200)}...`);
            return NextResponse.json({ error: "Backend error", details: text }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
    }
}

export async function GET(request: NextRequest, context: any) {
    return proxy(request, context);
}

export async function POST(request: NextRequest, context: any) {
    return proxy(request, context);
}
