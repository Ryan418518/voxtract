import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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

const STORAGE_KEY = "@voxtract_settings";

interface AppContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  providerModels: typeof PROVIDER_MODELS;
  getApiUrl: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved: Partial<Settings> = JSON.parse(raw);
          setSettings((prev) => ({ ...prev, ...saved }));
        } catch {}
      }
    });
  }, []);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getApiUrl = useCallback((): string => {
    if (settings.provider === "custom") return settings.customUrl;
    return PROVIDER_URLS[settings.provider];
  }, [settings]);

  return (
    <AppContext.Provider
      value={{ settings, updateSettings, providerModels: PROVIDER_MODELS, getApiUrl }}
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
