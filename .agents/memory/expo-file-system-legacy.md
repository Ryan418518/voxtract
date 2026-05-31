---
name: expo-file-system v19 legacy API
description: expo-file-system v19 (SDK 54 compatible) moved old functions to /legacy subpath; importing from main package throws at runtime.
---

## Rule

Always import old-style FileSystem functions from `expo-file-system/legacy`, not from `expo-file-system`.

**Why:** expo-file-system v19 introduced a new class-based API (`File`, `Directory`, `Paths`). The legacy functions (`readAsStringAsync`, `writeAsStringAsync`, `deleteAsync`, `cacheDirectory`, `EncodingType`, `getInfoAsync`) still type-check from the main export but throw at runtime with a "use the new API" error.

**How to apply:**
```typescript
// WRONG — throws at runtime
import * as FileSystem from 'expo-file-system';
FileSystem.cacheDirectory // undefined at runtime

// CORRECT
import * as FileSystem from 'expo-file-system/legacy';
FileSystem.cacheDirectory // works
FileSystem.EncodingType.Base64 // works
await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 1000 })

// New class-based API (from main package) — use for FormData uploads
import { File, Paths, Directory } from 'expo-file-system';
const file = new File(uri); // for FormData.append
```

**SDK 54 compatible package versions:**
- expo-file-system ~19.0.23
- expo-document-picker ~14.0.8
- expo-clipboard ~8.0.8
- expo-sharing ~14.0.8
