import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Transcription settings ────────────────────────────────────────────────────

export type Provider = "groq" | "openai" | "custom";

export interface Settings {
  provider: Provider;
  apiKey: string;
  model: string;
  customUrl: string;
}

const DEFAULT_SETTINGS: Settings = {
  provider: "groq",
  apiKey: "",
  model: "whisper-large-v3",
  customUrl: "",
};

const PROVIDER_MODELS: Record<Provider, string[]> = {
  groq: ["whisper-large-v3", "whisper-large-v3-turbo"],
  openai: ["whisper-1"],
  custom: ["whisper-1", "whisper-large-v3"],
};

const PROVIDER_URLS: Record<Provider, string> = {
  groq: "https://api.groq.com/openai/v1/audio/transcriptions",
  openai: "https://api.openai.com/v1/audio/transcriptions",
  custom: "",
};

// ── Worksheet AI settings ─────────────────────────────────────────────────────

export type WorksheetProvider = "gemini" | "openrouter" | "groq" | "mistral";
export type WorksheetOp = "correct" | "organize" | "summarize";

export interface WorksheetProviderMeta {
  id: WorksheetProvider;
  name: string;
  tagline: string;
  freeNote: string;
  keyLink: string;
  keyLinkLabel: string;
  baseUrl: string;
  defaultModel: string;
  /** Max safe chars per request (0 = unlimited / very large context) */
  chunkChars: number;
}

export const WORKSHEET_PROVIDERS: WorksheetProviderMeta[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Google AI Studio",
    freeNote: "مجاني — سياق 1,000,000 رمز",
    keyLink: "https://aistudio.google.com/apikey",
    keyLinkLabel: "احصل على مفتاح مجاني من AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    // Gemini 2.0 Flash is no longer available through the OpenAI-compatible
    // endpoint. Keep correction chunks below the output limit for long
    // transcriptions while preserving their original order.
    defaultModel: "gemini-3.6-flash",
    chunkChars: 12000,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "نماذج مجانية متعددة",
    freeNote: "مجاني — llama-3.3-70b-instruct:free",
    keyLink: "https://openrouter.ai/keys",
    keyLinkLabel: "احصل على مفتاح مجاني من OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    chunkChars: 0,
  },
  {
    id: "groq",
    name: "Groq",
    tagline: "سريع جداً — مجاني",
    freeNote: "مجاني — يعالج النصوص الطويلة بالتقطيع",
    keyLink: "https://console.groq.com/keys",
    keyLinkLabel: "احصل على مفتاح مجاني من Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    chunkChars: 7000,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    tagline: "Mistral API",
    freeNote: "مجاني — سياق 128,000 رمز",
    keyLink: "https://console.mistral.ai/api-keys",
    keyLinkLabel: "احصل على مفتاح مجاني من Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    chunkChars: 0,
  },
];

export interface OpenRouterModel {
  id: string;
  label: string;
}

export const OPENROUTER_FREE_MODELS: OpenRouterModel[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B" },
  { id: "google/gemma-3-27b-it:free",              label: "Gemma 3 27B" },
  { id: "deepseek/deepseek-r1:free",               label: "DeepSeek R1" },
  { id: "mistralai/mistral-7b-instruct:free",      label: "Mistral 7B" },
  { id: "qwen/qwen3-30b-a3b:free",                 label: "Qwen 3 30B" },
  { id: "microsoft/phi-4-reasoning:free",          label: "Phi-4" },
];

export interface WorksheetSettings {
  apiKeys: Record<WorksheetProvider, string>;
  correctProvider: WorksheetProvider;
  organizeProvider: WorksheetProvider;
  summarizeProvider: WorksheetProvider;
  openrouterModel: string;
}

const DEFAULT_WORKSHEET: WorksheetSettings = {
  apiKeys: { gemini: "", openrouter: "", groq: "", mistral: "" },
  correctProvider: "gemini",
  organizeProvider: "gemini",
  summarizeProvider: "gemini",
  openrouterModel: "meta-llama/llama-3.3-70b-instruct:free",
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "@voxtract_settings";
const WORKSHEET_STORAGE_KEY = "@voxtract_worksheet_ai";

// ── Context ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  providerModels: typeof PROVIDER_MODELS;
  getApiUrl: () => string;
  worksheetSettings: WorksheetSettings;
  updateWorksheetSettings: (partial: Partial<WorksheetSettings>) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [worksheetSettings, setWorksheetSettings] =
    useState<WorksheetSettings>(DEFAULT_WORKSHEET);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, WORKSHEET_STORAGE_KEY]).then(
      (pairs) => {
        const [transcRaw, worksheetRaw] = pairs.map((p) => p[1]);
        if (transcRaw) {
          try {
            const saved: Partial<Settings> = JSON.parse(transcRaw);
            setSettings((prev) => ({ ...prev, ...saved }));
          } catch {}
        }
        if (worksheetRaw) {
          try {
            const saved: Partial<WorksheetSettings> = JSON.parse(worksheetRaw);
            setWorksheetSettings((prev) => ({
              ...prev,
              ...saved,
              apiKeys: { ...prev.apiKeys, ...saved.apiKeys },
            }));
          } catch {}
        }
      }
    );
  }, []);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateWorksheetSettings = useCallback(
    async (partial: Partial<WorksheetSettings>) => {
      setWorksheetSettings((prev) => {
        const next: WorksheetSettings = {
          ...prev,
          ...partial,
          apiKeys: { ...prev.apiKeys, ...(partial.apiKeys ?? {}) },
        };
        AsyncStorage.setItem(WORKSHEET_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const getApiUrl = useCallback((): string => {
    if (settings.provider === "custom") return settings.customUrl;
    return PROVIDER_URLS[settings.provider];
  }, [settings]);

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        providerModels: PROVIDER_MODELS,
        getApiUrl,
        worksheetSettings,
        updateWorksheetSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
