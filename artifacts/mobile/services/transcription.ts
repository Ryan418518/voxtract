import * as ExpoFileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { Platform } from "react-native";

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
  // Some Android document providers do not return a file size even though
  // the file URI is valid. Treat an unknown size as one complete upload
  // instead of calculating zero chunks and silently returning an empty result.
  const totalChunks =
    fileSize > 0 ? Math.max(1, Math.ceil(fileSize / CHUNK_SIZE_BYTES)) : 1;

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
  const mimeType = getMimeType(fileName);

  if (Platform.OS !== "web") {
    // Native Android/iOS uploadAsync handles local file URIs more reliably
    // than constructing a web FormData/File object from a content URI.
    const result = await ExpoFileSystem.uploadAsync(apiUrl, fileUri, {
      uploadType: ExpoFileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      parameters: {
        model,
        language: "ar",
        response_format: "text",
      },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(parseApiError(result.status, result.body));
    }

    return result.body.trim();
  }

  // Keep the browser preview working with the web fetch implementation.
  const formData = new FormData();
  const file = new File(fileUri);
  formData.append("file", file as unknown as Blob, fileName);
  formData.append("model", model);
  formData.append("language", "ar");
  formData.append("response_format", "text");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  const body = await response.text();
  if (!response.ok) throw new Error(parseApiError(response.status, body));
  return body.trim();
}

function parseApiError(status: number, body: string): string {
  const fallback = `خطأ ${status}`;
  if (!body.trim()) return fallback;
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const nested =
      typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    return nested || parsed.message || body || fallback;
  } catch {
    return body || fallback;
  }
}

function getMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    case "webm":
      return "audio/webm";
    default:
      return "audio/mpeg";
  }
}
