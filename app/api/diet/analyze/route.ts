import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const { meal, meal_type, image } = await req.json();

        // Image input support: If image is provided, use vision model
        const modelName = image ? 'gemini-1.5-flash' : 'gemini-3-flash-preview';
        const model = genAI.getGenerativeModel({ model: modelName });

        const mealTypeKR: Record<string, string> = {
            breakfast: '아침',
            lunch: '점심',
            dinner: '저녁',
        };

        let promptParts: any[] = [];

        if (image) {
            // Vision Prompt
            promptParts.push({
                inlineData: {
                    data: image,
                    mimeType: "image/jpeg",
                },
            });
            promptParts.push(`Analyze this food image. Identify the meal and estimate total calories.
            Context: This is for a ${mealTypeKR[meal_type] || 'meal'}.
            Output JSON only: { "analysis": "short description of food (Korean)", "calories": number }
            
            Example: { "analysis": "김치찌개와 쌀밥", "calories": 450 }`);
        } else {
            // Text Prompt
            if (!meal) {
                return NextResponse.json({ error: 'No meal provided' }, { status: 400 });
            }
            promptParts.push(`당신은 전문 영양사입니다. 다음 ${mealTypeKR[meal_type] || '식사'} 식단을 분석해 주세요.
            식단: ${meal}

            다음 두 가지 정보를 JSON 형식으로 반환해 주세요:
            1. analysis: 영양학적 평가 및 조언 (한 문장, 한국어, 이모지 포함)
            2. calories: 추정 칼로리 (정수값만)

            예시: { "analysis": "단백질이 풍부한 훌륭한 식단입니다! 🍗", "calories": 450 }
            
            규칙:
            - 칼로리는 대략적인 추정값으로 정수를 제공
            - 분석은 한국어로 작성
            - 과식이면 부드럽게 주의, 적절하면 격려
            - JSON만 반환, 다른 텍스트 없이`);
        }

        const result = await model.generateContent(promptParts);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const data = JSON.parse(text);
            return NextResponse.json({
                calories: data.calories || 0,
                analysis: data.analysis || '분석을 완료했습니다.',
            });
        } catch {
            return NextResponse.json({
                calories: 0,
                analysis: '식단 분석 결과를 처리하는 중 오류가 발생했습니다.',
            });
        }
    } catch (error) {
        console.error('Diet analyze error:', error);
        return NextResponse.json(
            { calories: 0, analysis: '분석 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
