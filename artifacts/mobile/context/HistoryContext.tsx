import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface HistoryEntry {
  id: string;
  text: string;
  fileName: string;
  fileSize: number;
  dateMs: number;
  provider: string;
  model: string;
  charCount: number;
}

interface HistoryContextValue {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, "id" | "dateMs" | "charCount">) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);
const STORAGE_KEY = "@voxtract_history";
const MAX_ENTRIES = 50;

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setEntries(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const persist = useCallback((next: HistoryEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addEntry = useCallback(
    async (entry: Omit<HistoryEntry, "id" | "dateMs" | "charCount">) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: Date.now().toString(),
        dateMs: Date.now(),
        charCount: entry.text.length,
      };
      setEntries((prev) => {
        const next = [newEntry, ...prev].slice(0, MAX_ENTRIES);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clearAll = useCallback(async () => {
    setEntries([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <HistoryContext.Provider value={{ entries, addEntry, deleteEntry, clearAll }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}
