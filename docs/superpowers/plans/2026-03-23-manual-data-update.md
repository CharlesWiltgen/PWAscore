# Manual CIU + MDN BCD Data Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Can I Use data, MDN BCD package + CDN URL, and cache version strings to current values.

**Architecture:** Three independent updates (CIU data file, MDN BCD version alignment, cache version bumps) all touching `src/` — then validate with integration tests and commit.

**Tech Stack:** Node.js scripts, pnpm, vitest

---

## File Map

| File                                | Action                      | Responsibility                          |
| ----------------------------------- | --------------------------- | --------------------------------------- |
| `src/public/data/caniuse-data.json` | Regenerate                  | CIU data snapshot                       |
| `src/package.json`                  | Modify (line 51)            | `@mdn/browser-compat-data` version      |
| `src/app/utils/canIUseLoader.ts`    | Modify (lines 33, 424, 427) | CDN URL version + cache version strings |
| `src/pnpm-lock.yaml`                | Auto-updated                | Lock file from pnpm update              |

---

### Task 1: Update Can I Use Data

**Files:**

- Regenerate: `src/public/data/caniuse-data.json`

- [ ] **Step 1: Run the CIU download script**

```bash
cd /Users/Charles/Projects/PWAscore/src && pnpm run update-caniuse
```

Expected: "✓ CanIUse data downloaded successfully" with ~5-6 MB downloaded.

- [ ] **Step 2: Verify the downloaded data is valid JSON**

```bash
cd /Users/Charles/Projects/PWAscore/src && node -e "const d = require('./public/data/caniuse-data.json'); console.log('Agents:', Object.keys(d.agents).length, '| Features:', Object.keys(d.data).length)"
```

Expected: Agent count ~12+, feature count ~500+.

---

### Task 2: Update MDN BCD Package

**Files:**

- Modify: `src/package.json` (line 51)

- [ ] **Step 1: Update the npm package**

```bash
cd /Users/Charles/Projects/PWAscore/src && pnpm update @mdn/browser-compat-data --latest
```

Expected: Package updates to latest version (currently `^7.1.12`, latest may be higher).

- [ ] **Step 2: Note the installed version**

```bash
cd /Users/Charles/Projects/PWAscore/src && node -e "const p = require('./node_modules/@mdn/browser-compat-data/package.json'); console.log('Installed:', p.version)"
```

Record this version — you'll need it for Task 3.

---

### Task 3: Sync CDN URL and Bump Cache Versions

**Files:**

- Modify: `src/app/utils/canIUseLoader.ts` (lines 33, 424, 427)

- [ ] **Step 1: Update the MDN BCD CDN URL version**

In `src/app/utils/canIUseLoader.ts` line 424, change the version in the URL to match the version from Task 2 Step 2:

```ts
// BEFORE:
const MDN_BCD_URL =
  'https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@7.1.11/data.json'

// AFTER (example — use actual installed version):
const MDN_BCD_URL =
  'https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@<INSTALLED_VERSION>/data.json'
```

- [ ] **Step 2: Bump CACHE_VERSION for CIU**

In `src/app/utils/canIUseLoader.ts` line 33, update to today's date:

```ts
// BEFORE:
const CACHE_VERSION = '2025-10-06'

// AFTER:
const CACHE_VERSION = '2026-03-23'
```

- [ ] **Step 3: Bump MDN_BCD_CACHE_VERSION**

In `src/app/utils/canIUseLoader.ts` line 427, update to today's date:

```ts
// BEFORE:
const MDN_BCD_CACHE_VERSION = '2025-10-07'

// AFTER:
const MDN_BCD_CACHE_VERSION = '2026-03-23'
```

---

### Task 4: Validate with Tests

**Files:**

- Read: `src/app/utils/canIUseLoader.integration.test.ts`

- [ ] **Step 1: Run integration tests to validate all CIU IDs resolve**

```bash
cd /Users/Charles/Projects/PWAscore/src && pnpm run test -- canIUseLoader.integration
```

Expected: All tests pass — every `canIUseId` in `pwa-features.json` exists in the updated CIU data, and every `mdnBcdPath` resolves in MDN BCD.

- [ ] **Step 2: Run the full test suite**

```bash
cd /Users/Charles/Projects/PWAscore/src && pnpm run test
```

Expected: All tests pass.

- [ ] **Step 3: Run lint and typecheck**

```bash
cd /Users/Charles/Projects/PWAscore/src && pnpm run precommit
```

Expected: No errors.

---

### Task 5: Commit

- [ ] **Step 1: Stage and commit**

```bash
cd /Users/Charles/Projects/PWAscore/src && git add public/data/caniuse-data.json app/utils/canIUseLoader.ts package.json pnpm-lock.yaml && git commit -m "chore: update CIU data and MDN BCD to latest versions"
```
