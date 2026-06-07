import { fetch } from "expo/fetch";

import {
  WORKSHEET_PROVIDERS,
  WorksheetOp,
  WorksheetProvider,
} from "@/context/AppContext";

export type TextProcessingOp = WorksheetOp;

// ── System prompts ────────────────────────────────────────────────────────────

const CORRECT_SYSTEM = `أنت محرر لغوي متخصص في اللغة العربية الفصيحة. مهمتك تصحيح النص التالي إملائياً ونحوياً بدقة تامة.
القواعد الصارمة:
١. صحّح الأخطاء الإملائية والنحوية وعلامات الترقيم فقط.
٢. لا تحذف أي كلمة أو جملة أو فقرة عدا الكلمات المكررة تماماً المتجاورة.
٣. لا تغير معنى الجمل ولا تعيد صياغتها.
٤. لا تضف محتوى جديداً أو شروحات.
٥. حافظ على الترتيب والبنية الأصلية.
٦. أعد النص المصحَّح فقط بدون أي مقدمة أو تعليق.`;

const ORGANIZE_SYSTEM = `أنت محرر محترف متخصص في تنظيم النصوص العربية. نظّم النص التالي وتنسّقه.
القواعد الصارمة:
١. لا تحذف أي كلمة أو جملة من النص.
٢. نظّم الفقرات وأضف فراغات مناسبة.
٣. ميّز العناوين الرئيسية والفرعية على أسطر مستقلة.
٤. صحّح علامات الترقيم ومواضعها.
٥. احتفظ بكامل المحتوى مع إصلاح التنسيق فقط.
٦. أعد النص المنظَّم فقط بدون تعليق.`;

const SUMMARIZE_SYSTEM_FULL = `أنت محرر احترافي للنصوص العربية. هيكل النص التالي وأضف تلخيصاً مدمجاً.
القواعد الصارمة:
١. ابدأ بملخص تنفيذي موجز لا يتجاوز خمس جمل.
٢. أضف عناوين رئيسية وفرعية واضحة.
٣. استخدم التعداد النقطي (•) أو الرقمي للبنود حيثما يناسب السياق.
٤. لا تحذف أي جملة أو معلومة مهمة.
٥. ضمّن كامل محتوى النص منظَّماً تحت العناوين.
٦. أعد النص المهيكَّل فقط بدون تعليق خارجي.`;

const SUMMARIZE_SYSTEM_PARTIAL = `أنت محرر احترافي للنصوص العربية. هيكل الجزء التالي من نص أطول وأضف عناوين واضحة.
القواعد الصارمة:
١. أضف عناوين رئيسية وفرعية واضحة للقسم.
٢. استخدم التعداد النقطي أو الرقمي للبنود عند الاقتضاء.
٣. لا تحذف أي جملة أو معلومة مهمة.
٤. احتفظ بكامل محتوى هذا الجزء منظَّماً.
٥. أعد النص المهيكَّل فقط بدون مقدمة تنفيذية أو تعليق.`;

// ── Chunk helpers ─────────────────────────────────────────────────────────────

function splitIntoChunks(text: string, chunkChars: number): string[] {
  if (chunkChars === 0 || text.length <= chunkChars) return [text];

  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    let end = Math.min(pos + chunkChars, text.length);

    if (end < text.length) {
      const paraBreak = text.lastIndexOf("\n\n", end);
      if (paraBreak > pos + chunkChars / 3) {
        end = paraBreak + 2;
      } else {
        const lineBreak = text.lastIndexOf("\n", end);
        if (lineBreak > pos + chunkChars / 3) {
          end = lineBreak + 1;
        } else {
          const period = text.lastIndexOf(".", end);
          if (period > pos + chunkChars / 3) {
            end = period + 1;
          }
        }
      }
    }

    const chunk = text.slice(pos, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    pos = end;
  }

  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Single API call ───────────────────────────────────────────────────────────

async function callProvider(
  provider: WorksheetProvider,
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const meta = WORKSHEET_PROVIDERS.find((p) => p.id === provider);
  if (!meta) throw new Error(`مزود غير معروف: ${provider}`);

  const url = `${meta.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // OpenRouter requires HTTP-Referer and X-Title headers
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://voxtract.app";
    headers["X-Title"] = "Voxtract";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: meta.defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.15,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    let errMsg = `خطأ ${response.status} من ${meta.name}`;
    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      errMsg =
        parsed?.error?.message ||
        parsed?.message ||
        errMsg;
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

// ── Main export ───────────────────────────────────────────────────────────────

export async function processText(
  text: string,
  operation: TextProcessingOp,
  provider: WorksheetProvider,
  apiKey: string,
  onProgress?: (chunkIndex: number, totalChunks: number) => void
): Promise<string> {
  const meta = WORKSHEET_PROVIDERS.find((p) => p.id === provider);
  if (!meta) throw new Error(`مزود غير معروف: ${provider}`);

  const chunks = splitIntoChunks(text, meta.chunkChars);
  const total = chunks.length;

  if (operation === "correct") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      results.push(await callProvider(provider, apiKey, CORRECT_SYSTEM, chunks[i]));
    }
    return results.join("\n\n");
  }

  if (operation === "organize") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      results.push(await callProvider(provider, apiKey, ORGANIZE_SYSTEM, chunks[i]));
    }
    return results.join("\n\n");
  }

  if (operation === "summarize") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      const system = i === 0 ? SUMMARIZE_SYSTEM_FULL : SUMMARIZE_SYSTEM_PARTIAL;
      results.push(await callProvider(provider, apiKey, system, chunks[i]));
    }
    return results.join("\n\n---\n\n");
  }

  throw new Error("عملية غير معروفة");
}
