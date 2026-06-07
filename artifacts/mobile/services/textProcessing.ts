import { fetch } from "expo/fetch";

import {
  WORKSHEET_PROVIDERS,
  WorksheetOp,
  WorksheetProvider,
} from "@/context/AppContext";

export type TextProcessingOp = WorksheetOp;

// ── System prompts ────────────────────────────────────────────────────────────

const CORRECT_SYSTEM = `أنت مدقق لغوي محترف.

قم بتصحيح جميع الأخطاء الإملائية والنحوية وعلامات الترقيم فقط.
لا تغير المعنى أو الأسلوب.
لا تختصر النص ولا تضف أي معلومات جديدة.
أعد النص المصحح فقط دون أي مقدمات أو تعليقات.`;

const ORGANIZE_SYSTEM = `أنت محرر نصوص محترف.

قم بإعادة تنظيم النص مع:
- إضافة عناوين رئيسية وفرعية عند الحاجة.
- استخدام الترقيم والقوائم النقطية.
- تقسيم الفقرات الطويلة.
- تحسين علامات الترقيم والمسافات.

لا تحذف أي معلومة ولا تضف معلومات جديدة.
أعد النص المنظم فقط.`;

const SUMMARIZE_SYSTEM_FULL = `أنت متخصص في تلخيص النصوص.

لخص النص مع الحفاظ على جميع الأفكار الرئيسية.
استخدم عناوين ونقاط واضحة.
احذف التكرار والتفاصيل غير الضرورية فقط.
لا تضف معلومات غير موجودة في النص الأصلي.
أعد الملخص فقط.`;

const SUMMARIZE_SYSTEM_PARTIAL = `أنت متخصص في تلخيص النصوص.

لخص هذا الجزء من النص مع الحفاظ على جميع الأفكار الرئيسية.
استخدم عناوين ونقاط واضحة.
احذف التكرار والتفاصيل غير الضرورية فقط.
لا تضف معلومات غير موجودة في النص الأصلي.
أعد الملخص فقط.`;

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
  userContent: string,
  customModel?: string
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
      model: customModel ?? meta.defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.15,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    let apiMsg = "";
    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      apiMsg = parsed?.error?.message || parsed?.message || "";
    } catch {}

    let errMsg: string;
    if (response.status === 429) {
      errMsg = `تجاوزت الحد المجاني لـ ${meta.name}. انتظر دقيقة ثم أعد المحاولة، أو اختر مزوداً آخر من إعدادات ورقة العمل.`;
    } else if (response.status === 401 || response.status === 403) {
      errMsg = `مفتاح API لـ ${meta.name} غير صحيح أو منتهي الصلاحية. تحقق منه في إعدادات ورقة العمل.`;
    } else if (response.status === 500 || response.status === 503) {
      errMsg = `خدمة ${meta.name} غير متاحة حالياً. أعد المحاولة بعد لحظات.`;
    } else {
      errMsg = apiMsg || `خطأ ${response.status} من ${meta.name}`;
    }
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
  onProgress?: (chunkIndex: number, totalChunks: number) => void,
  customModel?: string
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
      results.push(await callProvider(provider, apiKey, CORRECT_SYSTEM, chunks[i], customModel));
    }
    return results.join("\n\n");
  }

  if (operation === "organize") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      results.push(await callProvider(provider, apiKey, ORGANIZE_SYSTEM, chunks[i], customModel));
    }
    return results.join("\n\n");
  }

  if (operation === "summarize") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      const system = i === 0 ? SUMMARIZE_SYSTEM_FULL : SUMMARIZE_SYSTEM_PARTIAL;
      results.push(await callProvider(provider, apiKey, system, chunks[i], customModel));
    }
    return results.join("\n\n---\n\n");
  }

  throw new Error("عملية غير معروفة");
}
