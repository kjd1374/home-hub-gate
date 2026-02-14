import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { resume, coverLetter, jobAnalysis } = await req.json();

    if (!resume && !coverLetter) {
      return NextResponse.json({ error: '이력서 또는 자기소개서를 입력해주세요.' }, { status: 400 });
    }

    if (!jobAnalysis) {
      return NextResponse.json({ error: '먼저 채용 공고를 분석해주세요.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

    const systemPrompt = `당신은 "${jobAnalysis.company || '해당 기업'}"의 "${jobAnalysis.position || '해당 포지션'}" 채용 면접관입니다.

**역할:**
- 제출된 이력서와 자기소개서를 해당 채용 공고의 면접관 입장에서 냉철하게 평가합니다.
- 합격시킬 수 있는지, 불합격 사유는 무엇인지 솔직하게 말합니다.
- 공고의 요구사항 대비 지원자의 강점과 약점을 명확히 짚습니다.
- 구체적이고 실행 가능한 수정 방안을 제시합니다.
- 감점 요소는 반드시 3개 이상 찾아야 합니다.

**채용 공고 핵심 요구사항:**
- 필수: ${JSON.stringify(jobAnalysis.requirements?.required || [])}
- 우대: ${JSON.stringify(jobAnalysis.requirements?.preferred || [])}
- 기술스택: ${JSON.stringify(jobAnalysis.requirements?.techStack || [])}

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요:
{
  "decision": "pass | fail | borderline",
  "overallScore": 75,
  "resumeFeedback": [
    {
      "section": "섹션명",
      "score": 7,
      "strengths": "강점 설명",
      "weaknesses": "약점 설명",
      "suggestion": "구체적 수정 방안"
    }
  ],
  "coverLetterFeedback": [
    {
      "section": "섹션명",
      "score": 6,
      "strengths": "강점 설명",
      "weaknesses": "약점 설명",
      "suggestion": "구체적 수정 방안"
    }
  ],
  "criticalIssues": ["치명적 문제 1", "치명적 문제 2"],
  "interviewQuestions": ["예상 면접 질문 1", "예상 면접 질문 2", "예상 면접 질문 3"],
  "summary": "전체 평가 요약"
}`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview',
      systemInstruction: systemPrompt,
    });

    let userPrompt = '';
    if (resume) userPrompt += `## 이력서:\n${resume}\n\n`;
    if (coverLetter) userPrompt += `## 자기소개서:\n${coverLetter}\n\n`;
    userPrompt += `위 지원서를 "${jobAnalysis.company}" "${jobAnalysis.position}" 포지션 면접관 입장에서 평가해주세요. 공고 요구사항 대비 부족한 점을 냉철하게 지적하고, 구체적인 수정 방안을 제시해주세요.`;

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
    }

    const feedback = JSON.parse(jsonMatch[0]);
    return NextResponse.json(feedback);

  } catch (error: any) {
    console.error('Feedback error:', error);
    return NextResponse.json({ error: error.message || '피드백 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
