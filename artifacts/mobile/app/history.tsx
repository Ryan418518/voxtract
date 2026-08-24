import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Feather } from "@expo/vector-icons";

import { HistoryEntry, useHistory } from "@/context/HistoryContext";
import { useColors } from "@/hooks/useColors";
import { worksheetStore } from "@/stores/worksheetStore";
import { audioStem } from "@/utils/fileName";
import { shareTextFile, saveTextFileToFolder } from "@/utils/textExport";

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return d.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function HistoryCard({
  entry,
  onDelete,
  colors,
}: {
  entry: HistoryEntry;
  onDelete: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(entry.text);
    Haptics.selectionAsync();
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [entry.text]);

  const handleExport = useCallback(() => {
    Haptics.selectionAsync();
    const stem = audioStem(entry.fileName);
    const handleError = (err: unknown) => {
      const message = err instanceof Error ? err.message : "تعذر تصدير الملف.";
      Alert.alert("تعذر التصدير", message);
    };

    Alert.alert("تصدير النص", "اختر طريقة التصدير:", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حفظ في مجلد",
        onPress: () => {
          void saveTextFileToFolder(entry.text, stem)
            .then(({ fileName }) => {
              Alert.alert("تم الحفظ", `تم حفظ الملف ${fileName} في المجلد الذي اخترته.`);
            })
            .catch(handleError);
        },
      },
      {
        text: "مشاركة مع تطبيق آخر",
        onPress: () => {
          void shareTextFile(entry.text, stem).catch(handleError);
        },
      },
    ]);
  }, [entry]);

  const handleEdit = useCallback(() => {
    worksheetStore.set({
      text: entry.text,
      title: entry.fileName,
      fileSize: entry.fileSize,
      provider: entry.provider,
      model: entry.model,
    });
    router.push("/worksheet");
  }, [entry]);

  const s = makeCardStyles(colors);

  return (
    <View style={s.card}>
      {/* Header Row */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [s.cardHeader, pressed && s.pressed]}
      >
        <View style={s.fileIcon}>
          <Feather name="mic" size={16} color={colors.primary} />
        </View>
        <View style={s.cardMeta}>
          <Text style={s.fileName} numberOfLines={1}>
            {entry.fileName}
          </Text>
          <Text style={s.cardSub}>
            {formatDate(entry.dateMs)} · {formatBytes(entry.fileSize)} ·{" "}
            {entry.charCount.toLocaleString("ar-SA")} حرف
          </Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.modelBadge}>{entry.model.replace("whisper-", "")}</Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </Pressable>

      {/* Text Preview (always shown) */}
      <View style={s.previewWrap}>
        <Text
          style={s.previewText}
          numberOfLines={expanded ? undefined : 2}
        >
          {entry.text}
        </Text>
        {!expanded && entry.charCount > 120 && (
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={s.showMore}>عرض الكل</Text>
          </Pressable>
        )}
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
        >
          <Feather
            name={copyDone ? "check" : "copy"}
            size={14}
            color={copyDone ? colors.success : colors.mutedForeground}
          />
          <Text
            style={[
              s.actionText,
              copyDone && { color: colors.success },
            ]}
          >
            {copyDone ? "تم" : "نسخ"}
          </Text>
        </Pressable>

        <View style={s.actionDivider} />

        <Pressable
                        onPress={handleExport}

          style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
        >
          <Feather name="share-2" size={14} color={colors.mutedForeground} />
          <Text style={s.actionText}>تصدير</Text>
        </Pressable>

        <View style={s.actionDivider} />

        <Pressable
          onPress={handleEdit}
          style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
        >
          <Feather name="edit-3" size={14} color={colors.primary} />
          <Text style={[s.actionText, { color: colors.primary }]}>تحرير</Text>
        </Pressable>

        <View style={s.actionDivider} />

        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[s.actionText, { color: colors.destructive }]}>حذف</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { entries, deleteEntry, clearAll } = useHistory();

  const handleDelete = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      deleteEntry(id);
    },
    [deleteEntry]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      "مسح السجل",
      "هل تريد حذف جميع التفريغات المحفوظة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "مسح الكل",
          style: "destructive",
          onPress: () => {
            clearAll();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [clearAll]);

  const s = makeStyles(colors, insets);
  const isWeb = Platform.OS === "web";

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>السجل</Text>
          {entries.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{entries.length}</Text>
            </View>
          )}
        </View>
        {entries.length > 0 ? (
          <Pressable
            onPress={handleClearAll}
            hitSlop={10}
            style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={s.clearBtnText}>مسح الكل</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {entries.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Feather name="clock" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={s.emptyTitle}>لا يوجد سجل بعد</Text>
          <Text style={s.emptyDesc}>
            ستظهر هنا تفريغاتك السابقة بعد إجراء أول تفريغ
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [s.goBtn, pressed && { opacity: 0.8 }]}
          >
            <Feather name="mic" size={16} color="#fff" />
            <Text style={s.goBtnText}>ابدأ التفريغ</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[
            s.listContent,
            { paddingBottom: isWeb ? 24 : insets.bottom + 16 },
          ]}
          renderItem={({ item }) => (
            <HistoryCard
              entry={item}
              onDelete={() => handleDelete(item.id)}
              colors={colors}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function makeCardStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
    },
    pressed: {
      backgroundColor: colors.primary + "0A",
    },
    fileIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primary + "1A",
      alignItems: "center",
      justifyContent: "center",
    },
    cardMeta: {
      flex: 1,
      gap: 3,
    },
    fileName: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
      textAlign: "right",
    },
    cardSub: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "right",
    },
    headerRight: {
      alignItems: "flex-end",
      gap: 6,
    },
    modelBadge: {
      fontSize: 10,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
      backgroundColor: colors.primary + "18",
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    previewWrap: {
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 4,
    },
    previewText: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      textAlign: "right",
      writingDirection: "rtl",
    },
    showMore: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
      textAlign: "right",
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 11,
    },
    actionPressed: {
      backgroundColor: colors.primary + "0F",
    },
    actionText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    actionDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
  });
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>
) {
  const web = Platform.OS === "web";
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: web ? 67 : insets.top + 12,
      paddingBottom: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },
    countBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      minWidth: 20,
      alignItems: "center",
    },
    countText: {
      fontSize: 11,
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    clearBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    clearBtnText: {
      fontSize: 13,
      color: colors.destructive,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    listContent: {
      padding: 16,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },
    emptyDesc: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
    },
    goBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 8,
    },
    goBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
