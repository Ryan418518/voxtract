import * as FileSystem from "expo-file-system/legacy";

const AUDIO_EXTENSIONS = /\.(mp3|mp4|m4a|wav|ogg|flac|aac|webm|mpeg|mpga|oga|opus|wma|amr)$/i;

/**
 * Strips the audio extension from a filename and returns the bare stem.
 * e.g. "lecture.mp3" → "lecture"
 */
export function audioStem(fileName: string): string {
  return fileName.replace(AUDIO_EXTENSIONS, "").trim() || "transcription";
}

/**
 * Returns a unique TXT file URI in the cache directory.
 * Tries "<stem>.txt", then "<stem>_1.txt", "<stem>_2.txt", ...
 */
export async function uniqueTxtUri(stem: string): Promise<{ uri: string; name: string }> {
  const base = FileSystem.cacheDirectory || "";

  const first = `${stem}.txt`;
  const firstUri = base + first;
  const info = await FileSystem.getInfoAsync(firstUri);
  if (!info.exists) return { uri: firstUri, name: first };

  let n = 1;
  while (true) {
    const name = `${stem}_${n}.txt`;
    const uri = base + name;
    const check = await FileSystem.getInfoAsync(uri);
    if (!check.exists) return { uri, name };
    n++;
  }
}
