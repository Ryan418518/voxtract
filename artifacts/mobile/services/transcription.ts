import * as ExpoFileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

const CHUNK_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per chunk

export type TranscriptionStatus =
  | "idle"
  | "preparing"
  | "transcribing"
  | "combining"
  | "done"
  | "error";

export interface TranscriptionProgress {
  status: TranscriptionStatus;
  currentChunk: number;
  totalChunks: number;
  message: string;
  percent: number;
}

export interface TranscriptionInput {
  fileUri: string;
  fileName: string;
  fileSize: number;
  apiUrl: string;
  apiKey: string;
  model: string;
}

export async function transcribeAudio(
  input: TranscriptionInput,
  onProgress: (p: TranscriptionProgress) => void
): Promise<string> {
  const { fileUri, fileName, fileSize, apiUrl, apiKey, model } = input;
  const ext = fileName.split(".").pop()?.toLowerCase() || "mp3";
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES);

  onProgress({
    status: "preparing",
    currentChunk: 0,
    totalChunks,
    message:
      totalChunks === 1
        ? "جاري التحضير..."
        : `سيتم معالجة الملف في ${totalChunks} أجزاء`,
    percent: 0,
  });

  if (totalChunks === 1) {
    onProgress({
      status: "transcribing",
      currentChunk: 1,
      totalChunks: 1,
      message: "جاري التفريغ...",
      percent: 10,
    });
    const text = await transcribeFile(fileUri, fileName, apiUrl, apiKey, model);
    onProgress({
      status: "done",
      currentChunk: 1,
      totalChunks: 1,
      message: "اكتمل التفريغ!",
      percent: 100,
    });
    return text;
  }

  const texts: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * CHUNK_SIZE_BYTES;
    const length = Math.min(CHUNK_SIZE_BYTES, fileSize - offset);
    const percent = Math.round(((i + 0.5) / totalChunks) * 90);

    onProgress({
      status: "transcribing",
      currentChunk: i + 1,
      totalChunks,
      message: `تفريغ الجزء ${i + 1} من ${totalChunks}...`,
      percent,
    });

    const chunkUri =
      ExpoFileSystem.cacheDirectory + `voxtract_chunk_${Date.now()}_${i}.${ext}`;

    const base64Chunk = await ExpoFileSystem.readAsStringAsync(fileUri, {
      encoding: ExpoFileSystem.EncodingType.Base64,
      position: offset,
      length,
    });

    await ExpoFileSystem.writeAsStringAsync(chunkUri, base64Chunk, {
      encoding: ExpoFileSystem.EncodingType.Base64,
    });

    const chunkText = await transcribeFile(
      chunkUri,
      `chunk_${i}.${ext}`,
      apiUrl,
      apiKey,
      model
    );
    texts.push(chunkText);

    await ExpoFileSystem.deleteAsync(chunkUri, { idempotent: true });
  }

  onProgress({
    status: "combining",
    currentChunk: totalChunks,
    totalChunks,
    message: "دمج الأجزاء...",
    percent: 95,
  });

  onProgress({
    status: "done",
    currentChunk: totalChunks,
    totalChunks,
    message: "اكتمل التفريغ!",
    percent: 100,
  });

  return texts.join(" ");
}

async function transcribeFile(
  fileUri: string,
  fileName: string,
  apiUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  const formData = new FormData();
  const file = new File(fileUri);
  formData.append("file", file as unknown as Blob, fileName);
  formData.append("model", model);
  formData.append("language", "ar");
  formData.append("response_format", "text");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errMsg = `خطأ ${response.status}`;
    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      errMsg = parsed?.error?.message || parsed?.message || body || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const text = await response.text();
  return text.trim();
}
