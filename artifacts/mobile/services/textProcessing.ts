import { fetch } from "expo/fetch";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Safe chunk size for Groq free tier (12k TPM limit).
// Arabic text ≈ 0.7 tokens/char → 7000 chars ≈ 4900 tokens input,
// leaving ~7000 tokens headroom for system prompt + output.
const CHUNK_CHARS = 7000;

export type TextProcessingOp = "correct" | "organize" | "summarize";

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

// Summarize prompt has two variants: full (for single-chunk or first chunk)
// and partial (for subsequent chunks in a multi-chunk flow).
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

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    let end = Math.min(pos + CHUNK_CHARS, text.length);

    if (end < text.length) {
      // Prefer to break at a double newline (paragraph boundary)
      const paraBreak = text.lastIndexOf("\n\n", end);
      if (paraBreak > pos + CHUNK_CHARS / 3) {
        end = paraBreak + 2;
      } else {
        // Fall back to a single newline
        const lineBreak = text.lastIndexOf("\n", end);
        if (lineBreak > pos + CHUNK_CHARS / 3) {
          end = lineBreak + 1;
        } else {
          // Fall back to last period (Arabic or Latin)
          const periodAr = text.lastIndexOf(".", end);
          const periodLat = text.lastIndexOf(".", end);
          const period = Math.max(periodAr, periodLat);
          if (period > pos + CHUNK_CHARS / 3) {
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

// ── Single-chunk API call ─────────────────────────────────────────────────────

async function callGroq(
  systemPrompt: string,
  userContent: string,
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
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.15,
      max_tokens: 8192,
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

// Small delay between chunk requests to avoid hitting rate limits
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function processText(
  text: string,
  operation: TextProcessingOp,
  apiKey: string,
  onProgress?: (chunkIndex: number, totalChunks: number) => void
): Promise<string> {
  const chunks = splitIntoChunks(text);
  const total = chunks.length;

  if (operation === "correct") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800); // brief pause between requests
      const result = await callGroq(CORRECT_SYSTEM, chunks[i], apiKey);
      results.push(result);
    }
    return results.join("\n\n");
  }

  if (operation === "organize") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      const result = await callGroq(ORGANIZE_SYSTEM, chunks[i], apiKey);
      results.push(result);
    }
    return results.join("\n\n");
  }

  // summarize: first chunk gets the full prompt (includes executive summary),
  // subsequent chunks get the partial prompt (structure only, no intro)
  if (operation === "summarize") {
    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, total);
      if (i > 0) await sleep(800);
      const systemPrompt =
        i === 0 ? SUMMARIZE_SYSTEM_FULL : SUMMARIZE_SYSTEM_PARTIAL;
      const result = await callGroq(systemPrompt, chunks[i], apiKey);
      results.push(result);
    }
    return results.join("\n\n---\n\n");
  }

  throw new Error("عملية غير معروفة");
}
