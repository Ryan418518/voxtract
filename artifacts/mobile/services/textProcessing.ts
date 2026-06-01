import { fetch } from "expo/fetch";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export type TextProcessingOp = "correct" | "organize" | "summarize";

const SYSTEM_PROMPTS: Record<TextProcessingOp, string> = {
  correct: `أنت محرر لغوي متخصص في اللغة العربية الفصيحة. مهمتك تصحيح النص المقدَّم إملائياً ونحوياً بدقة تامة.

القواعد الصارمة التي يجب الالتزام بها حرفياً:
١. صحّح الأخطاء الإملائية والنحوية وعلامات الترقيم فقط.
٢. لا تحذف أي كلمة أو جملة أو فقرة من النص، باستثناء الكلمات المتكررة تماماً المتجاورة.
٣. لا تغير معنى الجمل ولا تعيد صياغتها.
٤. لا تضف أي محتوى جديد أو شروحات.
٥. حافظ على البنية والترتيب الأصلي للنص.
٦. أعد النص المصحَّح فقط بدون أي مقدمة أو تعليق أو خاتمة.`,

  organize: `أنت محرر محترف متخصص في تنظيم النصوص العربية. مهمتك تنظيم النص المقدَّم وتنسيقه باحترافية.

القواعد الصارمة التي يجب الالتزام بها حرفياً:
١. لا تحذف أي كلمة أو جملة أو فقرة من النص الأصلي.
٢. نظّم الفقرات وأضف فراغات مناسبة للفصل بينها.
٣. ميّز العناوين الرئيسية والفرعية إن وُجدت وضعها على أسطر مستقلة.
٤. صحّح علامات الترقيم ومواضعها.
٥. احتفظ بكامل المحتوى الأصلي مع إصلاح التنسيق فقط.
٦. أعد النص المنظَّم فقط بدون أي مقدمة أو تعليق.`,

  summarize: `أنت محرر احترافي للنصوص العربية. مهمتك إضافة هيكل تنظيمي واضح للنص المقدَّم مع تلخيص مدمج.

القواعد الصارمة التي يجب الالتزام بها حرفياً:
١. ابدأ بملخص تنفيذي موجز لا يتجاوز خمس جمل.
٢. أضف عناوين رئيسية وفرعية واضحة تعكس محتوى كل قسم.
٣. استخدم التعداد النقطي (•) أو الرقمي للبنود والقوائم حيثما يناسب السياق.
٤. لا تحذف أي جملة أو معلومة مهمة من النص الأصلي.
٥. ضمّن كامل محتوى النص الأصلي منظَّماً تحت العناوين المناسبة.
٦. أعد النص المهيكَّل فقط بدون أي تعليق خارجي.`,
};

export interface ProcessingResult {
  text: string;
}

export async function processText(
  text: string,
  operation: TextProcessingOp,
  apiKey: string
): Promise<string> {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[operation] },
        { role: "user", content: text },
      ],
      temperature: 0.15,
      max_tokens: 32768,
    }),
  });

  if (!response.ok) {
    let errMsg = `خطأ في الخادم ${response.status}`;
    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      errMsg = parsed?.error?.message || parsed?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const result = data.choices[0]?.message?.content?.trim();
  if (!result) throw new Error("لم يُرجع النموذج أي نتيجة");
  return result;
}
