import * as Clipboard from "expo-clipboard";
import * as ExpoFileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Feather } from "@expo/vector-icons";

import {
  WORKSHEET_PROVIDERS,
  WorksheetOp,
  useApp,
} from "@/context/AppContext";
import { useHistory } from "@/context/HistoryContext";
import { useColors } from "@/hooks/useColors";
import { processText } from "@/services/textProcessing";
import { worksheetStore } from "@/stores/worksheetStore";
import { audioStem, uniqueTxtUri } from "@/utils/fileName";

const MAX_UNDO = 30;

interface UndoState {
  text: string;
  title: string;
}

const AI_BUTTONS: Array<{
  op: WorksheetOp;
  icon: string;
  label: string;
  desc: string;
  color: string;
}> = [
  {
    op: "correct",
    icon: "check-circle",
    label: "مراجعة وتصحيح",
    desc: "تصحيح إملائي ونحوي",
    color: "#10B981",
  },
  {
    op: "organize",
    icon: "align-justify",
    label: "تنظيم وتنسيق",
    desc: "ترتيب الفقرات والعناوين",
    color: "#3B82F6",
  },
  {
    op: "summarize",
    icon: "list",
    label: "تلخيص",
    desc: "هيكلة وتلخيص النص",
    color: "#F59E0B",
  },
];

export default function WorksheetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, worksheetSettings } = useApp();
  const { addEntry } = useHistory();

  const initialData = worksheetStore.get();

  const [title, setTitle] = useState(
    initialData ? audioStem(initialData.title) : "مستند جديد"
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [text, setText] = useState(initialData?.text ?? "");
  const [processing, setProcessing] = useState<WorksheetOp | null>(null);
  const [chunkProgress, setChunkProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);

  const titleInputRef = useRef<TextInput>(null);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    return () => {
      worksheetStore.clear();
    };
  }, []);

  const pushUndo = useCallback((snapshot: UndoState) => {
    setUndoStack((prev) => [snapshot, ...prev].slice(0, MAX_UNDO));
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const [last, ...rest] = prev;
      setText(last.text);
      setTitle(last.title);
      setDraftTitle(last.title);
      Haptics.selectionAsync();
      return rest;
    });
  }, []);

  const handleTitleEdit = useCallback(() => {
    setDraftTitle(title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 80);
  }, [title]);

  const handleTitleSave = useCallback(() => {
    const cleaned = draftTitle.trim() || title;
    setTitle(cleaned);
    setDraftTitle(cleaned);
    setEditingTitle(false);
    Haptics.selectionAsync();
  }, [draftTitle, title]);

  const getOpConfig = useCallback(
    (op: WorksheetOp) => {
      const providerKey = `${op}Provider` as
        | "correctProvider"
        | "organizeProvider"
        | "summarizeProvider";
      const providerId = worksheetSettings[providerKey];
      const apiKey = worksheetSettings.apiKeys[providerId];
      const meta = WORKSHEET_PROVIDERS.find((p) => p.id === providerId);
      return { providerId, apiKey, meta };
    },
    [worksheetSettings]
  );

  const handleAI = useCallback(
    async (op: WorksheetOp) => {
      const { providerId, apiKey, meta } = getOpConfig(op);

      if (!apiKey.trim()) {
        Alert.alert(
          "مفتاح API مطلوب",
          `الرجاء إضافة مفتاح ${meta?.name ?? providerId} في إعدادات ورقة العمل.`,
          [
            { text: "إلغاء", style: "cancel" },
            {
              text: "الإعدادات",
              onPress: () => router.push("/worksheet-settings"),
            },
          ]
        );
        return;
      }
      if (!text.trim()) {
        Alert.alert("تنبيه", "النص فارغ.");
        return;
      }

      pushUndo({ text, title });
      setProcessing(op);
      setChunkProgress(null);

      try {
        const result = await processText(
          text,
          op,
          providerId,
          apiKey.trim(),
          (chunkIndex, totalChunks) => {
            if (totalChunks > 1) {
              setChunkProgress({ current: chunkIndex + 1, total: totalChunks });
            }
          }
        );
        setText(result);
        setChunkProgress(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
        Alert.alert("خطأ", msg);
        setUndoStack((prev) => prev.slice(1));
      } finally {
        setProcessing(null);
        setChunkProgress(null);
      }
    },
    [text, title, getOpConfig, pushUndo]
  );

  const handleCopy = useCallback(async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Haptics.selectionAsync();
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [text]);

  const handleShare = useCallback(async () => {
    if (!text) return;
    Haptics.selectionAsync();
    const stem = title || "transcription";
    const { uri: fileUri, name: fileName } = await uniqueTxtUri(stem);
    await ExpoFileSystem.writeAsStringAsync(fileUri, text, {
      encoding: ExpoFileSystem.EncodingType.UTF8,
    });
    if (Platform.OS === "web") {
      const blob = new Blob([text], { type: "text/plain" });
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
  }, [text, title]);

  const handleSave = useCallback(async () => {
    if (!text.trim()) {
      Alert.alert("تنبيه", "لا يوجد نص للحفظ.");
      return;
    }
    await addEntry({
      text,
      fileName: title + ".txt",
      fileSize: new Blob([text]).size,
      provider: settings.provider,
      model: "worksheet",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaveDone(true);
    setTimeout(() => setSaveDone(false), 2000);
  }, [text, title, settings, addEntry]);

  const s = makeStyles(colors, insets);
  const isWeb = Platform.OS === "web";
  const canUndo = undoStack.length > 0;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>

        <View style={s.titleArea}>
          {editingTitle ? (
            <TextInput
              ref={titleInputRef}
              style={s.titleInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              onSubmitEditing={handleTitleSave}
              returnKeyType="done"
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
            />
          ) : (
            <Text style={s.titleText} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>

        {editingTitle ? (
          <Pressable onPress={handleTitleSave} style={s.titleBtn} hitSlop={10}>
            <Feather name="check" size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <Pressable onPress={handleTitleEdit} style={s.titleBtn} hitSlop={10}>
            <Feather name="edit-2" size={17} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* ── AI Toolbar ── */}
      <View style={s.aiToolbar}>
        {AI_BUTTONS.map((btn) => {
          const isActive = processing === btn.op;
          const isDisabled = processing !== null;
          const { meta } = getOpConfig(btn.op);
          const providerLabel = meta
            ? meta.name.replace("Google ", "").replace(" AI", "")
            : "";
          return (
            <Pressable
              key={btn.op}
              onPress={() => handleAI(btn.op)}
              disabled={isDisabled}
              style={({ pressed }) => [
                s.aiBtn,
                { borderColor: btn.color + "44" },
                pressed && !isDisabled && { opacity: 0.75 },
                isDisabled && !isActive && s.aiBtnDisabled,
              ]}
            >
              {isActive ? (
                <ActivityIndicator size="small" color={btn.color} />
              ) : (
                <Feather name={btn.icon as never} size={15} color={btn.color} />
              )}
              <View style={s.aiBtnText}>
                <Text style={[s.aiBtnLabel, { color: btn.color }]}>
                  {btn.label}
                </Text>
                <Text style={s.aiBtnDesc}>
                  {isActive && chunkProgress && chunkProgress.total > 1
                    ? `جزء ${chunkProgress.current} من ${chunkProgress.total}`
                    : providerLabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── Text Area ── */}
      <ScrollView
        style={s.editorScroll}
        contentContainerStyle={s.editorContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          ref={textInputRef}
          style={s.editor}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          textAlign="right"
          placeholder="اكتب أو الصق النص هنا..."
          placeholderTextColor={colors.mutedForeground}
          scrollEnabled={false}
          autoCorrect={false}
          editable={processing === null}
        />
      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View
        style={[
          s.bottomBar,
          { paddingBottom: isWeb ? 16 : Math.max(insets.bottom, 12) },
        ]}
      >
        {/* Undo */}
        <Pressable
          onPress={handleUndo}
          disabled={!canUndo}
          style={({ pressed }) => [
            s.bottomBtn,
            pressed && s.bottomBtnPressed,
            !canUndo && s.bottomBtnDisabled,
          ]}
        >
          <Feather
            name="corner-up-left"
            size={18}
            color={canUndo ? colors.text : colors.mutedForeground}
          />
          <Text
            style={[
              s.bottomBtnText,
              !canUndo && { color: colors.mutedForeground },
            ]}
          >
            تراجع
          </Text>
        </Pressable>

        <View style={s.bottomDivider} />

        {/* Copy */}
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [
            s.bottomBtn,
            pressed && s.bottomBtnPressed,
          ]}
        >
          <Feather
            name={copyDone ? "check" : "copy"}
            size={18}
            color={copyDone ? colors.success : colors.text}
          />
          <Text
            style={[
              s.bottomBtnText,
              copyDone && { color: colors.success },
            ]}
          >
            {copyDone ? "تم" : "نسخ"}
          </Text>
        </Pressable>

        <View style={s.bottomDivider} />

        {/* Export */}
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            s.bottomBtn,
            pressed && s.bottomBtnPressed,
          ]}
        >
          <Feather name="share-2" size={18} color={colors.text} />
          <Text style={s.bottomBtnText}>تصدير</Text>
        </Pressable>

        <View style={s.bottomDivider} />

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            s.bottomBtn,
            s.saveBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather
            name={saveDone ? "check" : "save"}
            size={18}
            color="#fff"
          />
          <Text style={s.saveBtnText}>{saveDone ? "تم!" : "حفظ"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<
    typeof import("react-native-safe-area-context").useSafeAreaInsets
  >
) {
  const isWeb = Platform.OS === "web";
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: isWeb ? 67 : insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 14,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    titleArea: {
      flex: 1,
    },
    titleText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
      textAlign: "right",
    },
    titleInput: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
      borderBottomWidth: 1.5,
      borderBottomColor: colors.primary,
      paddingVertical: 2,
      textAlign: "right",
    },
    titleBtn: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },

    // AI Toolbar
    aiToolbar: {
      flexDirection: "row",
      padding: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    aiBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: colors.card,
    },
    aiBtnDisabled: {
      opacity: 0.4,
    },
    aiBtnText: {
      flex: 1,
    },
    aiBtnLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      textAlign: "right",
    },
    aiBtnDesc: {
      fontSize: 9,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "right",
    },

    // Editor
    editorScroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    editorContent: {
      flexGrow: 1,
      padding: 16,
    },
    editor: {
      flex: 1,
      fontSize: 16,
      lineHeight: 28,
      color: colors.text,
      fontFamily: "Inter_400Regular",
      minHeight: 300,
      writingDirection: "rtl",
    },

    // Bottom Bar
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingTop: 8,
      paddingHorizontal: 4,
    },
    bottomBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 8,
    },
    bottomBtnPressed: {
      backgroundColor: colors.primary + "12",
    },
    bottomBtnDisabled: {
      opacity: 0.35,
    },
    bottomBtnText: {
      fontSize: 11,
      color: colors.text,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    bottomDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      marginHorizontal: 4,
      flex: 1.2,
    },
    saveBtnText: {
      fontSize: 11,
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
  });
}
