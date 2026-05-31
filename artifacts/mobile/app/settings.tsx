import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

import { Provider, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  {
    id: "groq",
    label: "Groq",
    description: "مجاني وسريع — موصى به للعربية",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Whisper API — مدفوع",
  },
  {
    id: "custom",
    label: "مخصص",
    description: "أي خادم متوافق مع OpenAI API",
  },
];

const GROQ_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];
const OPENAI_MODELS = ["whisper-1"];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, providerModels } = useApp();

  const [localKey, setLocalKey] = useState(settings.apiKey);
  const [localUrl, setLocalUrl] = useState(settings.customUrl);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalKey(settings.apiKey);
    setLocalUrl(settings.customUrl);
  }, [settings.apiKey, settings.customUrl]);

  const handleSave = useCallback(async () => {
    if (settings.provider !== "custom" && !localKey.trim()) {
      Alert.alert("تنبيه", "الرجاء إدخال مفتاح API.");
      return;
    }
    if (settings.provider === "custom" && !localUrl.trim()) {
      Alert.alert("تنبيه", "الرجاء إدخال رابط الخادم.");
      return;
    }
    await updateSettings({ apiKey: localKey.trim(), customUrl: localUrl.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 1200);
  }, [settings.provider, localKey, localUrl, updateSettings]);

  const handleProviderChange = useCallback(
    async (p: Provider) => {
      Haptics.selectionAsync();
      const defaultModel = providerModels[p][0];
      await updateSettings({ provider: p, model: defaultModel });
    },
    [providerModels, updateSettings]
  );

  const handleModelChange = useCallback(
    async (m: string) => {
      Haptics.selectionAsync();
      await updateSettings({ model: m });
    },
    [updateSettings]
  );

  const models =
    settings.provider === "groq"
      ? GROQ_MODELS
      : settings.provider === "openai"
      ? OPENAI_MODELS
      : providerModels[settings.provider];

  const s = makeStyles(colors, insets);

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
        <Text style={s.headerTitle}>الإعدادات</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Provider Selection */}
        <Text style={s.sectionLabel}>مزود الخدمة</Text>
        <View style={s.card}>
          {PROVIDERS.map((p, idx) => (
            <Pressable
              key={p.id}
              onPress={() => handleProviderChange(p.id)}
              style={({ pressed }) => [
                s.providerRow,
                pressed && s.rowPressed,
                idx < PROVIDERS.length - 1 && s.rowBorder,
              ]}
            >
              <View
                style={[
                  s.radioOuter,
                  settings.provider === p.id && s.radioOuterActive,
                ]}
              >
                {settings.provider === p.id && <View style={s.radioInner} />}
              </View>
              <View style={s.providerInfo}>
                <Text style={s.providerLabel}>{p.label}</Text>
                <Text style={s.providerDesc}>{p.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* API Key */}
        <Text style={s.sectionLabel}>مفتاح API</Text>
        <View style={s.card}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={localKey}
              onChangeText={setLocalKey}
              placeholder="sk-... أو gsk-..."
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="ascii-capable"
            />
            <Pressable
              onPress={() => setShowKey((v) => !v)}
              hitSlop={8}
              style={s.eyeBtn}
            >
              <Feather
                name={showKey ? "eye-off" : "eye"}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>

        {/* Free key link for Groq */}
        {settings.provider === "groq" && (
          <Pressable
            onPress={() => Linking.openURL("https://console.groq.com/keys")}
            style={s.linkRow}
          >
            <Feather name="external-link" size={13} color={colors.primary} />
            <Text style={s.linkText}>
              احصل على مفتاح Groq مجاني من console.groq.com
            </Text>
          </Pressable>
        )}
        {settings.provider === "openai" && (
          <Pressable
            onPress={() =>
              Linking.openURL("https://platform.openai.com/api-keys")
            }
            style={s.linkRow}
          >
            <Feather name="external-link" size={13} color={colors.primary} />
            <Text style={s.linkText}>
              احصل على مفتاح OpenAI من platform.openai.com
            </Text>
          </Pressable>
        )}

        {/* Custom URL */}
        {settings.provider === "custom" && (
          <>
            <Text style={s.sectionLabel}>رابط الخادم</Text>
            <View style={s.card}>
              <TextInput
                style={[s.input, { paddingRight: 14 }]}
                value={localUrl}
                onChangeText={setLocalUrl}
                placeholder="https://api.example.com/v1/audio/transcriptions"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </>
        )}

        {/* Model Selection */}
        <Text style={s.sectionLabel}>النموذج</Text>
        <View style={s.card}>
          {models.map((m, idx) => (
            <Pressable
              key={m}
              onPress={() => handleModelChange(m)}
              style={({ pressed }) => [
                s.modelRow,
                pressed && s.rowPressed,
                idx < models.length - 1 && s.rowBorder,
              ]}
            >
              <View
                style={[
                  s.radioOuter,
                  settings.model === m && s.radioOuterActive,
                ]}
              >
                {settings.model === m && <View style={s.radioInner} />}
              </View>
              <Text style={s.modelName}>{m}</Text>
              {m === "whisper-large-v3" && settings.provider === "groq" && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>الأفضل للعربية</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            s.saveBtn,
            pressed && s.saveBtnPressed,
            saved && s.saveBtnDone,
          ]}
        >
          <Feather
            name={saved ? "check" : "save"}
            size={18}
            color="#fff"
          />
          <Text style={s.saveBtnText}>{saved ? "تم الحفظ!" : "حفظ الإعدادات"}</Text>
        </Pressable>

        <View style={{ height: isWeb() ? 34 : insets.bottom + 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function isWeb() {
  return Platform.OS === "web";
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) {
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
    headerTitle: {
      fontSize: 17,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: 20,
      gap: 8,
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
    rowPressed: {
      backgroundColor: colors.primary + "10",
    },
    providerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterActive: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    providerInfo: {
      flex: 1,
      alignItems: "flex-end",
    },
    providerLabel: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },
    providerDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontFamily: "Inter_400Regular",
      padding: 14,
      textAlign: "right",
    },
    eyeBtn: {
      paddingRight: 14,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "flex-end",
      paddingVertical: 2,
    },
    linkText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_400Regular",
    },
    modelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
    },
    modelName: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: "Inter_400Regular",
      textAlign: "right",
    },
    badge: {
      backgroundColor: colors.primary + "20",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 11,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 12,
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
