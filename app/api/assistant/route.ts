import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { calculateInverse, calculateForward, calculateCircularCurve } from '@/lib/cogo-engine';
import { calculatePolygonArea, calculatePolygonPerimeter } from '@/lib/survey-calculations';
import { transformCoordinates } from '@/lib/crs-definitions';
import { runSurveyQAQC } from '@/lib/qa-qc-engine';

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

/**
 * Deterministic calculation intent parser
 * Evaluates mathematical queries using the deterministic engine first,
 * preventing hallucinations and floating-point errors.
 */
function tryDeterministicExecution(
  message: string,
  projectInfo: any
): { hasDeterministicResult: boolean; toolName?: string; resultSummary?: string } {
  const msg = message.toLowerCase();

  // Pattern 1: Inverse calculation between two explicit coordinates:
  // e.g. "احسب المسافة بين (1000, 1000) و (1100, 1100)" or "distance between 1000,1000 and 1100,1100"
  const coordsMatch = message.match(
    /(?:بين|between)\s*\(?\s*([0-9.-]+)\s*,\s*([0-9.-]+)(?:\s*,\s*([0-9.-]+))?\s*\)?\s*(?:و|and|إلى|to)\s*\(?\s*([0-9.-]+)\s*,\s*([0-9.-]+)(?:\s*,\s*([0-9.-]+))?\s*\)?/i
  );
  if (coordsMatch) {
    const e1 = parseFloat(coordsMatch[1]);
    const n1 = parseFloat(coordsMatch[2]);
    const z1 = coordsMatch[3] ? parseFloat(coordsMatch[3]) : 0;
    const e2 = parseFloat(coordsMatch[4]);
    const n2 = parseFloat(coordsMatch[5]);
    const z2 = coordsMatch[6] ? parseFloat(coordsMatch[6]) : 0;

    const inv = calculateInverse(
      { easting: e1, northing: n1, elevation: z1 },
      { easting: e2, northing: n2, elevation: z2 }
    );

    return {
      hasDeterministicResult: true,
      toolName: 'calculateInverse',
      resultSummary: `[نتيجة المحرك الحسابي الحتمي COGO]:
- المسافة الأفقية (Horizontal Distance): ${inv.horizontalDistance.toFixed(4)} م
- المسافة الفضائية (3D Distance): ${inv.slopeDistance.toFixed(4)} م
- فارق الشرقية (dE): ${inv.deltaEasting.toFixed(4)} م | فارق الشمالية (dN): ${inv.deltaNorthing.toFixed(4)} م | فارق المنسوب (dZ): ${inv.deltaElevation.toFixed(4)} م
- زاوية الانحراف الدائري (Azimuth): ${inv.azimuthDecimal.toFixed(4)}° (${inv.azimuthDMS.formatted})
- زاوية الربع الدائري (Bearing): ${inv.bearing}
- نسبة الميل (Slope): ${inv.slopePercent.toFixed(2)}%`,
    };
  }

  // Pattern 2: Point query from current project
  // e.g. "احسب المسافة بين P1 و P2"
  const pointsMatch = message.match(/(?:بين|between)\s*[Pp]([0-9]+)\s*(?:و|and|إلى|to)\s*[Pp]([0-9]+)/i);
  if (pointsMatch && projectInfo?.points && Array.isArray(projectInfo.points)) {
    const pNum1 = parseInt(pointsMatch[1], 10);
    const pNum2 = parseInt(pointsMatch[2], 10);

    const pt1 = projectInfo.points.find((p: any) => p.pointNumber === pNum1);
    const pt2 = projectInfo.points.find((p: any) => p.pointNumber === pNum2);

    if (pt1 && pt2) {
      const inv = calculateInverse(pt1, pt2);
      return {
        hasDeterministicResult: true,
        toolName: 'calculateInverse',
        resultSummary: `[نتيجة الحساب الحتمي بين النقطة P${pNum1} و P${pNum2} في المشروع]:
- إحداثيات P${pNum1}: (E: ${pt1.easting.toFixed(3)}, N: ${pt1.northing.toFixed(3)}, Z: ${pt1.elevation.toFixed(3)})
- إحداثيات P${pNum2}: (E: ${pt2.easting.toFixed(3)}, N: ${pt2.northing.toFixed(3)}, Z: ${pt2.elevation.toFixed(3)})
- المسافة الأفقية: ${inv.horizontalDistance.toFixed(4)} م
- المسافة المائلة 3D: ${inv.slopeDistance.toFixed(4)} م
- الانحراف (Azimuth): ${inv.azimuthDMS.formatted} (${inv.bearing})`,
      };
    } else {
      return {
        hasDeterministicResult: true,
        toolName: 'pointLookup',
        resultSummary: `[تنبيه]: لم يتم العثور على إحدى النقطتين (P${pNum1} أو P${pNum2}) في بيانات المشروع الحالي. يرجى التحقق من أرقام النقاط.`,
      };
    }
  }

  return { hasDeterministicResult: false };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, projectInfo, imageBase64 } = body;

    // Step 1: Run deterministic engine check for numerical requests
    const deterministic = tryDeterministicExecution(message || '', projectInfo);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      let reply = `مرحباً بك في SurveyPro AI!

بيانات المشروع الحالية:
- المشروع: ${projectInfo?.name || 'مشروع مساحي'}
- عدد النقاط: ${projectInfo?.pointCount || 0}
- المساحة: ${projectInfo?.areaSquareMeters || projectInfo?.area || 0} م²
- المحيط: ${projectInfo?.perimeter || 0} م`;

      if (deterministic.hasDeterministicResult) {
        reply += `\n\n${deterministic.resultSummary}`;
      } else {
        reply += `\n\n💡 استفسارك: "${message || 'تحليل البيانات'}"\n(يمكنك إعداد مفتاح GEMINI_API_KEY للتفسير الذكي والشروحات المتقدمة).`;
      }

      return NextResponse.json({ reply });
    }

    const ai = getAIClient();

    const projectContext = `أنت مساعد ذكي ومستشار هندسي معتمد في منصة SurveyPro AI لأعمال المساحة الميدانية، الجيوديسيا، ونظم المعلومات الجغرافية.
بيانات المشروع المساحي الحالية:
- اسم المشروع: ${projectInfo?.name || 'غير محدد'}
- مرجع الإحداثيات (CRS): ${projectInfo?.crsCode || 'EPSG:4326'}
- عدد النقاط: ${projectInfo?.pointCount || 0}
- المساحة: ${projectInfo?.areaSquareMeters || projectInfo?.area || 0} م²
- المحيط: ${projectInfo?.perimeter || 0} م

قواعد العمل الهندسية الصارمة:
1. عند وجود نتيجة حسابية حتمية مسبقة، اعتمد عليها حرفياً واشرحها للمستخدم دون اختراع أرقام جديدة أو حسابات تقريبية غير دقيقة.
2. إذا طلب المستخدم تحديد نظام إحداثيات (CRS) بناء على إحداثيات فقط (مثل E=500000, N=300000) دون تحديد الدولة أو النطاق الجغرافي، وضح بأمانة أنه لا يمكن تحديد نظام الإسقاط بشكل قاطع وموثوق بدون معلومات إضافية (كالدولة، الزون، أو الموقع التقريبي) لأن قيم الإحداثيات المستوية تتكرر عبر زونات مختلفة.
3. للمشاريع الفارغة، وضح أن جودة البيانات تكون "غير مُقيّمة (NO DATA)" وليست ممتازة.
4. اذكر دائماً المنهجيات الهندسية المعتمدة (طريقة Shoelace للمساحات، طريقة الخلايا المساحية Tributary Grid للحفر والردم، وتحليل MAD لكشف الشذوذ).`;

    const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [];

    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    let promptMessage = `${projectContext}\n\nسؤال المستخدم: ${message || 'حلل هذه البيانات'}`;
    if (deterministic.hasDeterministicResult) {
      promptMessage += `\n\n[بيانات تم استخراجها مسبقاً عبر المحرك الحسابي الحتمي للبرنامج]:\n${deterministic.resultSummary}\nيرجى صياغة الإجابة وشرح هذه النتائج بدقة للمستخدم.`;
    }

    contents.push(promptMessage);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    const reply = response.text || (deterministic.hasDeterministicResult ? deterministic.resultSummary : 'لم يتم استلام نص من النموذج.');
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error in Gemini Assistant route:', error);
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ أثناء معالجة الطلب' },
      { status: 500 }
    );
  }
}
