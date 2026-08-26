export async function callGeminiAPI(
  userMessage: string,
  projectInfo: any,
  imageBase64?: string
): Promise<string> {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        projectInfo,
        imageBase64,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }

    const data = await res.json();
    return data.reply || 'تم استلام رد فارغ من المساعد الذكي.';
  } catch (error) {
    console.error('❌ خطأ في الاتصال بالمساعد الذكي:', error);
    return `حدث خطأ في معالجة الطلب: ${error instanceof Error ? error.message : 'خطأ غير معروف'}. يرجى التأكد من اتصال الإنترنت أو إعداد مفتاح GEMINI_API_KEY.`;
  }
}

