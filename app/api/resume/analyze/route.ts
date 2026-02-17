import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { jobPostingUrl, resume, coverLetter } = await req.json();

        if (!jobPostingUrl) {
            return NextResponse.json({ error: '채용 공고 링크를 입력해주세요.' }, { status: 400 });
        }

        // Step 1: Fetch job posting content
        let jobContent = '';
        try {
            const response = await fetch(jobPostingUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            });
            const html = await response.text();
            // Strip HTML tags but keep text content
            jobContent = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 15000); // Limit to 15k chars
        } catch (e) {
            return NextResponse.json({ error: '채용 공고를 불러올 수 없습니다. URL을 확인해주세요.' }, { status: 400 });
        }

        // Step 2: Analyze with Gemini
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

        const systemPrompt = `당신은 채용 전문 컨설턴트입니다. 채용 공고를 분석하고, 사용자의 이력서/자기소개서를 해당 공고 기준으로 검토합니다.

**역할:**
1. 채용 공고에서 핵심 정보를 구조화하여 추출합니다.
2. 사용자의 이력서/자기소개서를 공고 요구사항과 비교 분석합니다.
3. 수정이 필요한 항목을 구체적인 체크리스트로 제공합니다.

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요:
{
  "company": "회사명",
  "position": "포지션명",
  "jobSummary": "직무 핵심 요약 (2-3문장)",
  "requirements": {
    "required": ["필수 자격 요건 1", "필수 자격 요건 2"],
    "preferred": ["우대 사항 1", "우대 사항 2"],
    "techStack": ["기술스택 1", "기술스택 2"],
    "softSkills": ["소프트스킬 1"]
  },
  "checklist": [
    {
      "category": "카테고리명 (예: 기술스택, 경력, 프로젝트, 자기소개서 등)",
      "item": "체크 항목 구체적 설명",
      "priority": "high | medium | low",
      "status": "missing | weak | ok",
      "suggestion": "구체적인 수정/보완 제안"
    }
  ],
  "overallMatch": 65,
  "matchSummary": "전반적인 매칭 분석 요약"
}`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            systemInstruction: systemPrompt,
        });

        let userPrompt = `## 채용 공고 내용:\n${jobContent}\n\n`;

        if (resume) {
            userPrompt += `## 사용자 이력서:\n${resume}\n\n`;
        }
        if (coverLetter) {
            userPrompt += `## 사용자 자기소개서:\n${coverLetter}\n\n`;
        }

        if (!resume && !coverLetter) {
            userPrompt += `이력서와 자기소개서가 아직 제출되지 않았습니다. 공고 분석만 수행하고, checklist에는 공고 기준으로 준비해야 할 항목을 나열해주세요.\n`;
        } else {
            userPrompt += `위 채용 공고 기준으로 이력서/자기소개서를 분석하고, 수정이 필요한 부분을 체크리스트로 작성해주세요. 빠진 키워드, 약한 부분, 보완할 내용을 구체적으로 명시해주세요.\n`;
        }

        const result = await model.generateContent(userPrompt);
        const text = result.response.text();

        // Parse JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
        }

        const analysis = JSON.parse(jsonMatch[0]);
        return NextResponse.json(analysis);

    } catch (error: any) {
        console.error('Analyze error:', error);
        return NextResponse.json({ error: error.message || '분석 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
