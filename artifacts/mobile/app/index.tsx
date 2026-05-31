import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ExpoFileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Feather } from "@expo/vector-icons";

import { useApp } from "@/context/AppContext";
import { useHistory } from "@/context/HistoryContext";
import { useColors } from "@/hooks/useColors";
import { audioStem, uniqueTxtUri } from "@/utils/fileName";
import {
  TranscriptionProgress,
  transcribeAudio,
} from "@/services/transcription";

interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
}

const SUPPORTED_AUDIO =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/flac,audio/m4a,audio/x-m4a,audio/aac,audio/webm,audio/mp4,audio/*,*/*";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, getApiUrl } = useApp();
  const { addEntry } = useHistory();

  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const animateProgress = useCallback(
    (toValue: number) => {
      Animated.timing(progressAnim, {
        toValue,
        duration: 300,
        useNativeDriver: false,
      }).start();
    },
    [progressAnim]
  );

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_AUDIO.split(","),
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      Haptics.selectionAsync();
      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType,
      });
      setTranscription("");
      setProgress(null);
      progressAnim.setValue(0);
    } catch {
      Alert.alert("خطأ", "تعذّر فتح الملف. حاول مرة أخرى.");
    }
  }, [progressAnim]);

  const handleTranscribe = useCallback(async () => {
    if (!selectedFile) return;
    if (!settings.apiKey.trim()) {
      Alert.alert(
        "مفتاح API مطلوب",
        "الرجاء إضافة مفتاح API في الإعدادات أولاً.",
        [
          { text: "إلغاء", style: "cancel" },
          { text: "الإعدادات", onPress: () => router.push("/settings") },
        ]
      );
      return;
    }

    setIsTranscribing(true);
    setTranscription("");
    progressAnim.setValue(0);

    const fileSize =
      selectedFile.size > 0
        ? selectedFile.size
        : await getFileSizeFromUri(selectedFile.uri);

    try {
      const result = await transcribeAudio(
        {
          fileUri: selectedFile.uri,
          fileName: selectedFile.name,
          fileSize,
          apiUrl: getApiUrl(),
          apiKey: settings.apiKey.trim(),
          model: settings.model,
        },
        (p) => {
          setProgress(p);
          animateProgress(p.percent);
        }
      );
      setTranscription(result);
      await addEntry({
        text: result,
        fileName: selectedFile.name,
        fileSize,
        provider: settings.provider,
        model: settings.model,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      Alert.alert("خطأ في التفريغ", msg);
      setProgress(null);
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedFile, settings, getApiUrl, progressAnim, animateProgress]);

  const handleCopy = useCallback(async () => {
    if (!transcription) return;
    await Clipboard.setStringAsync(transcription);
    Haptics.selectionAsync();
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [transcription]);

  const handleShare = useCallback(async () => {
    if (!transcription || !selectedFile) return;
    Haptics.selectionAsync();
    const stem = audioStem(selectedFile.name);
    const { uri: fileUri, name: fileName } = await uniqueTxtUri(stem);
    await ExpoFileSystem.writeAsStringAsync(fileUri, transcription, {
      encoding: ExpoFileSystem.EncodingType.UTF8,
    });

    if (Platform.OS === "web") {
      const blob = new Blob([transcription], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          dialogTitle: "تصدير النص",
          UTI: "public.plain-text",
        });
      }
    }
  }, [transcription, selectedFile]);

  const s = makeStyles(colors, insets);

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  const providerLabel =
    settings.provider === "groq"
      ? "Groq (مجاني)"
      : settings.provider === "openai"
      ? "OpenAI"
      : "مخصص";

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoMark} />
          <Text style={s.logoText}>Voxtract</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable
            onPress={() => router.push("/history")}
            style={s.iconBtn}
            hitSlop={10}
          >
            <Feather name="clock" size={20} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            style={s.iconBtn}
            hitSlop={10}
          >
            <Feather name="settings" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Upload Zone */}
        <Pressable
          onPress={handlePickFile}
          style={({ pressed }) => [s.uploadZone, pressed && s.uploadZonePressed]}
        >
          <View style={s.uploadIconWrap}>
            <Feather name="mic" size={36} color={colors.primary} />
          </View>
          {selectedFile ? (
            <>
              <Text style={s.uploadTitle} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={s.uploadSub}>
                {formatBytes(selectedFile.size)} · اضغط لتغيير الملف
              </Text>
            </>
          ) : (
            <>
              <Text style={s.uploadTitle}>اختر ملفاً صوتياً</Text>
              <Text style={s.uploadSub}>
                MP3 · WAV · M4A · OGG · FLAC وغيرها
              </Text>
            </>
          )}
          <View style={s.uploadBadge}>
            <Feather name="upload" size={13} color={colors.primary} />
            <Text style={s.uploadBadgeText}>رفع ملف</Text>
          </View>
        </Pressable>

        {/* Provider Info */}
        <View style={s.infoRow}>
          <Feather name="cpu" size={13} color={colors.mutedForeground} />
          <Text style={s.infoText}>
            {providerLabel} · {settings.model}
          </Text>
          <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
            <Text style={s.infoLink}>تغيير</Text>
          </Pressable>
        </View>

        {/* Transcribe Button */}
        <Pressable
          onPress={handleTranscribe}
          disabled={!selectedFile || isTranscribing}
          style={({ pressed }) => [
            s.transcribeBtn,
            pressed && s.transcribeBtnPressed,
            (!selectedFile || isTranscribing) && s.transcribeBtnDisabled,
          ]}
        >
          {isTranscribing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="zap" size={18} color="#fff" />
          )}
          <Text style={s.transcribeBtnText}>
            {isTranscribing ? "جاري التفريغ..." : "بدء التفريغ"}
          </Text>
        </Pressable>

        {/* Progress */}
        {progress && isTranscribing && (
          <View style={s.progressCard}>
            <View style={s.progressHeader}>
              <Text style={s.progressMsg}>{progress.message}</Text>
              <Text style={s.progressPct}>{progress.percent}%</Text>
            </View>
            <View style={s.progressTrack}>
              <Animated.View
                style={[s.progressFill, { width: progressBarWidth }]}
              />
            </View>
            {progress.totalChunks > 1 && (
              <Text style={s.progressSub}>
                الجزء {progress.currentChunk} من {progress.totalChunks}
              </Text>
            )}
          </View>
        )}

        {/* Result */}
        {!!transcription && !isTranscribing && (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <Feather name="file-text" size={15} color={colors.primary} />
              <Text style={s.resultHeaderText}>النص المستخرج</Text>
            </View>
            <ScrollView
              style={s.resultScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.resultText} selectable>
                {transcription}
              </Text>
            </ScrollView>
            <View style={s.resultActions}>
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [
                  s.actionBtn,
                  pressed && s.actionBtnPressed,
                ]}
              >
                <Feather
                  name={copyDone ? "check" : "copy"}
                  size={16}
                  color={copyDone ? colors.success : colors.primary}
                />
                <Text
                  style={[
                    s.actionBtnText,
                    copyDone && { color: colors.success },
                  ]}
                >
                  {copyDone ? "تم النسخ!" : "نسخ"}
                </Text>
              </Pressable>
              <View style={s.actionDivider} />
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  s.actionBtn,
                  pressed && s.actionBtnPressed,
                ]}
              >
                <Feather name="share-2" size={16} color={colors.primary} />
                <Text style={s.actionBtnText}>تصدير TXT</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

async function getFileSizeFromUri(uri: string): Promise<number> {
  try {
    const info = await ExpoFileSystem.getInfoAsync(uri);
    if (info.exists && "size" in info) return (info as { size: number }).size;
  } catch {}
  return 0;
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) {
  const isWeb = Platform.OS === "web";
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: isWeb ? 67 : insets.top + 12,
      paddingBottom: 14,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    logoMark: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    logoText: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.text,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.5,
    },
    headerActions: {
      flexDirection: "row",
      gap: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      gap: 14,
    },
    uploadZone: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: "dashed",
      padding: 32,
      alignItems: "center",
      gap: 8,
    },
    uploadZonePressed: {
      opacity: 0.75,
      borderColor: colors.primary,
    },
    uploadIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + "1A",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    uploadTitle: {
      fontSize: 17,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center",
    },
    uploadSub: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    uploadBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.primary + "22",
    },
    uploadBadgeText: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    infoText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    infoLink: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    transcribeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 4,
    },
    transcribeBtnPressed: {
      opacity: 0.85,
    },
    transcribeBtnDisabled: {
      opacity: 0.45,
    },
    transcribeBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    progressCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressMsg: {
      fontSize: 14,
      color: colors.text,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
      flex: 1,
      textAlign: "right",
    },
    progressPct: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
      marginLeft: 8,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    progressSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "right",
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.primary + "0F",
    },
    resultHeaderText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
    resultScroll: {
      maxHeight: 280,
      minHeight: 120,
    },
    resultText: {
      fontSize: 16,
      lineHeight: 28,
      color: colors.text,
      fontFamily: "Inter_400Regular",
      padding: 18,
      textAlign: "right",
      writingDirection: "rtl",
    },
    resultActions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingVertical: 14,
    },
    actionBtnPressed: {
      backgroundColor: colors.primary + "12",
    },
    actionBtnText: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    actionDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
  });
}
