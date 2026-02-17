import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Allow large request bodies for image uploads
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

interface WeightEntry {
    date: string;
    weight: number;
}

interface MealEntry {
    date: string;
    meal_type: string;
    description: string;
    calories?: number;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export async function POST(req: NextRequest) {
    try {
        const { message, image, history, weights, todayMeals } = (await req.json()) as {
            message: string;
            image?: string; // Base64 encoded image
            history: ChatMessage[];
            weights: WeightEntry[];
            todayMeals: MealEntry[];
        };

        if (!message && !image) {
            return NextResponse.json({ error: 'No message or image' }, { status: 400 });
        }

        // Build context from user data
        let context = '';

        if (weights && weights.length > 0) {
            const latest = weights[weights.length - 1];
            const oldest = weights[0];
            const totalChange = (latest.weight - oldest.weight).toFixed(1);
            context += `\n[체중 데이터]\n`;
            context += `- 최근 체중: ${latest.weight}kg (${latest.date})\n`;
            context += `- 기록 기간: ${oldest.date} ~ ${latest.date} (${weights.length}일)\n`;
            context += `- 총 변화: ${Number(totalChange) > 0 ? '+' : ''}${totalChange}kg\n`;
            if (weights.length >= 2) {
                const prev = weights[weights.length - 2];
                const diff = (latest.weight - prev.weight).toFixed(1);
                context += `- 전일 대비: ${Number(diff) > 0 ? '+' : ''}${diff}kg\n`;
            }
            context += `- 최근 7일 기록: ${weights.slice(-7).map(w => `${w.date.slice(5)}:${w.weight}kg`).join(', ')}\n`;
        }

        if (todayMeals && todayMeals.length > 0) {
            context += `\n[오늘 식단 기록]\n`;
            const mealTypeKR: Record<string, string> = {
                breakfast: '아침',
                lunch: '점심',
                dinner: '저녁',
            };
            todayMeals.forEach((m) => {
                context += `- ${mealTypeKR[m.meal_type] || m.meal_type}: ${m.description}`;
                if (m.calories) context += ` (~${m.calories}kcal)`;
                context += '\n';
            });
            const totalCal = todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
            if (totalCal > 0) context += `- 지금까지 총 칼로리: ~${totalCal}kcal\n`;
        }

        const systemPrompt = `당신은 10년 이상 경력의 스포츠 영양학 전문 다이어트 코치이자 체중관리 전문가입니다.

## 전문 분야
- 체성분 분석 및 체중 관리 전략 수립
- 영양소 균형 기반 식단 설계 (탄수화물/단백질/지방 비율)
- 기초대사량(BMR), 활동대사량(TDEE) 기반 칼로리 설계
- 행동 심리학 기반 식습관 교정
- 운동과 식단의 시너지 전략
- **음식 사진 분석**: 사진을 보고 음식 종류, 대략적인 칼로리, 영양소 구성을 분석

## 응답 원칙
1. **데이터 기반 분석**: 사용자의 체중 추이와 식단 기록을 반드시 분석하고 구체적 수치를 언급합니다.
2. **전문적이고 상세한 답변**: 왜 그런 조언을 하는지 과학적 근거를 함께 설명합니다.
3. **구조화된 답변**: 분석 → 평가 → 구체적 실행 방안 → 동기부여 순으로 답변합니다.
4. **실행 가능한 조언**: 막연한 조언 대신 구체적인 음식명, 양, 타이밍을 제시합니다.
5. **한국어 응답**, 이모지 적절히 활용
6. **답변 길이**: 충분히 상세하게 답변합니다 (최소 300자 이상). 짧은 답변은 금지합니다.

## 이미지 분석 규칙
만약 사용자가 음식 사진을 첨부했다면:
1. 사진에 보이는 모든 음식을 정확하게 식별합니다.
2. 각 음식의 대략적인 칼로리와 주요 영양소(탄/단/지)를 추정합니다.
3. 전체 식사의 총 칼로리를 추정합니다.
4. 다이어트 관점에서 이 식사에 대한 평가와 개선점을 제시합니다.
5. 부족한 영양소가 있다면 보완할 수 있는 음식을 추천합니다.

## 코칭 스타일
- 체중이 감소 중이면: 구체적으로 어떤 노력이 효과를 보고 있는지 분석하고, 다음 단계 목표를 제시
- 체중이 증가 중이면: 원인을 식단/수분/스트레스/수면 등 다각도로 분석하고, 즉시 실행 가능한 교정 방안 제시
- 식단 질문이면: 영양소 구성, 칼로리, 식사 타이밍, 대체 식품까지 상세히 안내
- 목표 설정 질문이면: 현실적인 주간/월간 감량 목표와 로드맵을 제시하고, 건강한 감량 속도(주 0.5~1kg)를 기준으로 계획 수립

## 중요 규칙
- 사용자의 체중/식단 데이터가 주어지면 이를 최우선적으로 참고하여 개인 맞춤 코칭합니다.
- 무리한 다이어트(극단적 단식, 초저칼로리)는 절대 권하지 않습니다.
- 필요시 전문의 상담을 권유합니다.

${context ? `\n## 사용자 현재 상태\n${context}` : ''}`;

        // User requested 3.0 explicitly (matching analyze route)
        // Note: This model name might be a custom mapping or experimental alias.
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            systemInstruction: systemPrompt,
        });

        // Build chat history (exclude the current user message)
        const chatHistory = (history || []).slice(0, -1).map((msg) => ({
            role: msg.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({
            history: chatHistory,
        });

        // Build message parts
        const messageParts: any[] = [];

        if (image) {
            messageParts.push({
                inlineData: {
                    data: image,
                    mimeType: 'image/jpeg',
                },
            });
        }

        messageParts.push({ text: message || '이 음식 사진을 분석해 주세요' });

        const result = await chat.sendMessage(messageParts);
        const reply = result.response.text();

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('Diet chat error:', error);
        return NextResponse.json(
            { reply: '죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해 주세요. 🙏' },
            { status: 500 }
        );
    }
}
