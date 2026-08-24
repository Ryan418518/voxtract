import { fetch } from "expo/fetch";

import {
  DEFAULT_WORKSHEET_OPERATIONS,
  WORKSHEET_PROVIDERS,
  WorksheetOp,
  WorksheetProvider,
} from "@/context/AppContext";

export type TextProcessingOp = WorksheetOp;

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
          const sentenceEndings = [".", "!", "?", "؟", "؛", "。"];
          const sentenceBreak = Math.max(
            ...sentenceEndings.map((mark) => text.lastIndexOf(mark, end))
          );
          if (sentenceBreak > pos + chunkChars / 3) {
            end = sentenceBreak + 1;
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(response: Response, retryIndex: number): number {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(Math.max(retryAfterSeconds * 1000, 1000), 90000);
  }

  // Gemini's free tier is rate-limited by requests per minute. The increasing
  // delay prevents a long transcript's chunks from being sent in a burst.
  return Math.min(5000 * 2 ** retryIndex, 60000);
}

function isRetryableProviderError(provider: WorksheetProvider, status: number): boolean {
  return provider === "gemini" && [429, 500, 502, 503, 504].includes(status);
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

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://voxtract.app";
    headers["X-Title"] = "Voxtract";
  }

  const requestedModel = customModel ?? meta.defaultModel;
  const models =
    provider === "gemini"
      ? [requestedModel, "gemini-3.6-flash", "gemini-3.5-flash-lite"].filter(
          (model, index, all) => all.indexOf(model) === index
        )
      : [requestedModel];

  for (const model of models) {
    for (let retryIndex = 0; retryIndex < 3; retryIndex++) {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.15,
          max_tokens: 8192,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        const result = data.choices[0]?.message?.content?.trim();
        if (!result) throw new Error("لم يُرجع النموذج أي نتيجة");
        return result;
      }

      let apiMsg = "";
      try {
        const body = await response.text();
        const parsed = JSON.parse(body);
        apiMsg = parsed?.error?.message || parsed?.message || "";
      } catch {}

      if (isRetryableProviderError(provider, response.status) && retryIndex < 2) {
        await sleep(getRetryDelay(response, retryIndex));
        continue;
      }

      if (isRetryableProviderError(provider, response.status)) {
        // Try the next compatible Gemini model after the backoff attempts.
        break;
      }

      let errMsg: string;
      if (response.status === 401 || response.status === 403) {
        errMsg = `مفتاح API لـ ${meta.name} غير صحيح أو منتهي الصلاحية. تحقق منه في إعدادات ورقة العمل.`;
      } else if (provider === "gemini" && response.status === 404) {
        errMsg =
          "نموذج Google Gemini غير متاح حالياً. حدّث التطبيق إلى آخر نسخة ثم أعد المحاولة.";
      } else {
        errMsg = apiMsg || `خطأ ${response.status} من ${meta.name}`;
      }
      throw new Error(errMsg);
    }
  }

  if (provider === "gemini") {
    throw new Error(
      "تعذر تنفيذ العملية مع Gemini بسبب حد مؤقت للطلبات. تم تقسيم النص تلقائياً وإعادة المحاولة عدة مرات؛ انتظر قليلاً ثم أعد المحاولة، أو اختر مزوداً آخر من إعدادات ورقة العمل."
    );
  }
  throw new Error(`تعذر الاتصال بخدمة ${meta.name}.`);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function processText(
  text: string,
  operation: TextProcessingOp,
  provider: WorksheetProvider,
  apiKey: string,
  onProgress?: (chunkIndex: number, totalChunks: number) => void,
  customModel?: string,
  customPrompt?: string
): Promise<string> {
  const meta = WORKSHEET_PROVIDERS.find((p) => p.id === provider);
  if (!meta) throw new Error(`مزود غير معروف: ${provider}`);

  const chunks = splitIntoChunks(text, meta.chunkChars);
  const total = chunks.length;
  const systemPrompt =
    customPrompt?.trim() || DEFAULT_WORKSHEET_OPERATIONS[operation].prompt;
  const betweenRequestsMs = provider === "gemini" ? 5500 : 800;

  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i, total);
    if (i > 0) await sleep(betweenRequestsMs);
    results.push(
      await callProvider(
        provider,
        apiKey,
        systemPrompt,
        chunks[i],
        customModel
      )
    );
  }

  if (operation === "summarize") {
    return results.join("\n\n---\n\n");
  }
  return results.join("\n\n");
}
