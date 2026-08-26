import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, projectInfo, imageBase64 } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: `مرحباً بك في SurveyPro AI!

بيانات المشروع الحالية:
- المشروع: ${projectInfo?.name || 'مخطط أرض النخيل'}
- عدد النقاط: ${projectInfo?.pointCount || 0}
- المساحة: ${projectInfo?.areaSquareMeters || projectInfo?.area || 0} م²
- المحيط: ${projectInfo?.perimeter || 0} م

💡 تم استلام استفسارك: "${message || 'تحليل البيانات'}"
(ملاحظة: يمكنك إعداد مفتاح GEMINI_API_KEY لتفعيل المحادثة الحية المباشرة مع نموذج الذكاء الاصطناعي).`,
      });
    }

    const ai = getAIClient();

    const projectContext = `أنت مساعد ذكي ومستشار هندسي خبير في أعمال المساحة الميدانية، الجيوديسيا، الحفر والردم، تحويل الإحداثيات (UTM / WGS84)، ونظم المعلومات الجغرافية (GIS).
بيانات المشروع المساحي الحالية:
- اسم المشروع: ${projectInfo?.name || 'غير محدد'}
- الموقع / الوصف: ${projectInfo?.location || projectInfo?.description || 'غير محدد'}
- عدد النقاط: ${projectInfo?.pointCount || 0}
- المساحة: ${projectInfo?.areaSquareMeters || projectInfo?.area || 0} م²
- المحيط: ${projectInfo?.perimeter || 0} م

المطلوب: أجب على استفسار المستخدم بدقة واحترافية هندسية عالية باللغة العربية، وقدم إرشادات دقيقة.`;

    const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [];

    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    contents.push(`${projectContext}\n\nسؤال المستخدم: ${message || 'حلل هذه البيانات'}`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    const reply = response.text || 'لم يتم استلام نص من النموذج.';
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error in Gemini Assistant route:', error);
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ أثناء معالجة الطلب' },
      { status: 500 }
    );
  }
}
