import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

function safeStem(stem: string): string {
  const cleaned = stem
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim()
    .replace(/\.txt$/i, "");
  return (cleaned || "transcription").slice(0, 80);
}

function makeFileName(stem: string): string {
  return `${safeStem(stem)}_${Date.now()}.txt`;
}

function downloadOnWeb(text: string, fileName: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createCacheFile(text: string, fileName: string): Promise<File> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(text);
  return file;
}

/** Opens the native Android/iOS share sheet for the TXT file. */
export async function shareTextFile(
  text: string,
  stem: string,
  dialogTitle = "تصدير النص"
): Promise<void> {
  const fileName = makeFileName(stem);

  if (Platform.OS === "web") {
    downloadOnWeb(text, fileName);
    return;
  }

  const file = await createCacheFile(text, fileName);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("المشاركة غير متاحة على هذا الجهاز.");
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/plain",
    dialogTitle,
    UTI: "public.plain-text",
  });
}

/** Opens the Android system folder picker and writes the TXT into the chosen folder. */
export async function saveTextFileToFolder(
  text: string,
  stem: string
): Promise<{ fileName: string; directoryUri?: string }> {
  const fileName = makeFileName(stem);

  if (Platform.OS === "web") {
    downloadOnWeb(text, fileName);
    return { fileName };
  }

  const directory = await Directory.pickDirectoryAsync();
  const file = directory.createFile(fileName, "text/plain");
  file.write(text);
  return { fileName, directoryUri: directory.uri };
}
