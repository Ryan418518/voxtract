import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
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
  WorksheetProvider,
  WorksheetProviderMeta,
  useApp,
} from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const OP_LABELS: Record<WorksheetOp, { label: string; icon: string; color: string }> = {
  correct: { label: "مراجعة وتصحيح", icon: "check-circle", color: "#10B981" },
  organize: { label: "تنظيم وتنسيق", icon: "align-justify", color: "#3B82F6" },
  summarize: { label: "تلخيص", icon: "list", color: "#F59E0B" },
};

const OPS: WorksheetOp[] = ["correct", "organize", "summarize"];

export default function WorksheetSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { worksheetSettings, updateWorksheetSettings } = useApp();

  // Local state for API key inputs (one per provider)
  const [localKeys, setLocalKeys] = useState<Record<WorksheetProvider, string>>(
    worksheetSettings.apiKeys
  );
  const [showKey, setShowKey] = useState<Record<WorksheetProvider, boolean>>({
    gemini: false,
    openrouter: false,
    groq: false,
    mistral: false,
  });
  const [saved, setSaved] = useState(false);

  const handleSetKey = useCallback(
    (provider: WorksheetProvider, value: string) => {
      setLocalKeys((prev) => ({ ...prev, [provider]: value }));
    },
    []
  );

  const toggleShowKey = useCallback((provider: WorksheetProvider) => {
    setShowKey((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  const handleOpProvider = useCallback(
    async (op: WorksheetOp, provider: WorksheetProvider) => {
      Haptics.selectionAsync();
      await updateWorksheetSettings({
        [`${op}Provider`]: provider,
      } as Parameters<typeof updateWorksheetSettings>[0]);
    },
    [updateWorksheetSettings]
  );

  const handleSave = useCallback(async () => {
    await updateWorksheetSettings({ apiKeys: localKeys });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 1200);
  }, [localKeys, updateWorksheetSettings]);

  const s = makeStyles(colors, insets);
  const isWeb = Platform.OS === "web";

  const getOpProvider = (op: WorksheetOp): WorksheetProvider =>
    worksheetSettings[`${op}Provider`] as WorksheetProvider;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>ذكاء اصطناعي ورقة العمل</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={s.infoBanner}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={s.infoText}>
            جميع الخدمات المتاحة مجانية بالكامل. Gemini هو الأفضل للنصوص الطويلة جداً (سياق مليون رمز).
          </Text>
        </View>

        {/* ── Per-operation provider selector ── */}
        <Text style={s.sectionLabel}>ربط العمليات بالخدمات</Text>
        <View style={s.card}>
          {OPS.map((op, idx) => {
            const meta = OP_LABELS[op];
            const currentProvider = getOpProvider(op);
            return (
              <View
                key={op}
                style={[s.opRow, idx < OPS.length - 1 && s.rowBorder]}
              >
                {/* Operation label */}
                <View style={s.opLabel}>
                  <Feather
                    name={meta.icon as never}
                    size={15}
                    color={meta.color}
                  />
                  <Text style={[s.opLabelText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
                {/* Provider pills */}
                <View style={s.pillRow}>
                  {WORKSHEET_PROVIDERS.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => handleOpProvider(op, p.id)}
                      style={({ pressed }) => [
                        s.pill,
                        currentProvider === p.id && s.pillActive,
                        pressed && s.pillPressed,
                      ]}
                    >
                      <Text
                        style={[
                          s.pillText,
                          currentProvider === p.id && s.pillTextActive,
                        ]}
                      >
                        {p.name.replace(" AI", "").replace("Google ", "")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* ── API keys per provider ── */}
        <Text style={s.sectionLabel}>مفاتيح API</Text>
        {WORKSHEET_PROVIDERS.map((p: WorksheetProviderMeta) => (
          <View key={p.id} style={s.providerBlock}>
            {/* Provider header */}
            <View style={s.providerHeader}>
              <View style={s.providerHeaderLeft}>
                <Text style={s.providerName}>{p.name}</Text>
                <View style={s.freeBadge}>
                  <Text style={s.freeBadgeText}>مجاني</Text>
                </View>
              </View>
              <Text style={s.providerTagline}>{p.freeNote}</Text>
            </View>

            {/* Key input */}
            <View style={[s.card, { marginTop: 6 }]}>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={localKeys[p.id]}
                  onChangeText={(v) => handleSetKey(p.id, v)}
                  placeholder={`مفتاح ${p.name}...`}
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showKey[p.id]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="ascii-capable"
                  textAlign="right"
                />
                <Pressable
                  onPress={() => toggleShowKey(p.id)}
                  hitSlop={8}
                  style={s.eyeBtn}
                >
                  <Feather
                    name={showKey[p.id] ? "eye-off" : "eye"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            {/* Get key link */}
            <Pressable
              onPress={() => Linking.openURL(p.keyLink)}
              style={s.linkRow}
            >
              <Feather name="external-link" size={13} color={colors.primary} />
              <Text style={s.linkText}>{p.keyLinkLabel}</Text>
            </Pressable>
          </View>
        ))}

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            s.saveBtn,
            pressed && s.saveBtnPressed,
            saved && s.saveBtnDone,
          ]}
        >
          <Feather name={saved ? "check" : "save"} size={18} color="#fff" />
          <Text style={s.saveBtnText}>
            {saved ? "تم الحفظ!" : "حفظ الإعدادات"}
          </Text>
        </Pressable>

        <View style={{ height: isWeb ? 34 : insets.bottom + 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<
    typeof import("react-native-safe-area-context").useSafeAreaInsets
  >
) {
  const web = Platform.OS === "web";
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

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
    headerTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },

    scroll: { flex: 1 },
    scrollContent: { padding: 20, gap: 8 },

    infoBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: colors.primary + "15",
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.primary + "30",
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
      textAlign: "right",
    },

    sectionLabel: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: 10,
      textAlign: "right",
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    // Op rows
    opRow: {
      padding: 14,
      gap: 10,
    },
    opLabel: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    opLabelText: {
      fontSize: 14,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "flex-end",
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "18",
    },
    pillPressed: { opacity: 0.7 },
    pillText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    pillTextActive: {
      color: colors.primary,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },

    // Provider blocks
    providerBlock: { gap: 0 },
    providerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    providerHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    providerName: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },
    freeBadge: {
      backgroundColor: "#10B981" + "22",
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    freeBadgeText: {
      fontSize: 10,
      color: "#10B981",
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    providerTagline: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },

    // Input
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: "Inter_400Regular",
      padding: 14,
      textAlign: "right",
    },
    eyeBtn: { paddingRight: 14 },

    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      justifyContent: "flex-end",
      paddingVertical: 4,
    },
    linkText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_400Regular",
    },

    // Save
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 14,
    },
    saveBtnPressed: { opacity: 0.85 },
    saveBtnDone: { backgroundColor: colors.success },
    saveBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
