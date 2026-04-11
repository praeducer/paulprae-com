# Content Quality System Design: Validator + Grader

> **Status:** Design reference. Implementation is partially in place (Phase A2 extracted the validator); full separation of concerns lands in Phase A1 of `remaining-phases-ssot.md`.
> **Scope:** How `lib/resume-validator.ts` and `scripts/grade-content.ts` coexist, interface, and stay in sync.

## Decision

**Keep the validator and grader as separate, complementary systems. Do not merge.** Unify only their data source (writing-rules.json via `lib/writing-rules.ts`).

## Rationale

An AI generation pipeline needs two distinct layers of quality enforcement:

1. **Fast deterministic checks** that run on every generation — catches structural bugs, known blocklist phrases, format violations, suppressed skills. Cheap enough to run in CI and pre-commit hooks.
2. **Slow semantic judgment** that runs on submission iterations — catches compound claims, grounded-source verification, nuanced rule interpretation, stylistic rhythm issues.

Merging these into one system produces a pipeline that is either too slow for every-generation checks or too shallow for pre-submission review. Keeping them separate mirrors the standard layered-quality pattern: linter + type-checker + integration test (fast → slow → semantic).

This aligns with established AI application conventions:

- **OpenAI Evals** separates reference-based checks (fast) from model-graded evaluations (slow).
- **Anthropic's constitutional AI** layers rule-based filters before harm classifiers.
- **DSPy** separates signature validation from metric evaluation.
- **LangSmith** separates trace assertions from evaluator LLM runs.

## Architecture

```
                   ┌────────────────────────────────────────┐
                   │  writing-rules.json v2                  │
                   │  Single source of truth:               │
                   │   - rules (narrative, applies_to)      │
                   │   - data (regex, blocklists, acronyms) │
                   │   - format (numeric/enum parameters)   │
                   └────────────────┬───────────────────────┘
                                    │
                                    ▼
                   ┌────────────────────────────────────────┐
                   │  lib/writing-rules.ts                   │
                   │  Typed Zod-validated loader:            │
                   │   - loadWritingRules()                  │
                   │   - getRulesFor(context)                │
                   │   - getBlocklist(kind)                  │
                   │   - getFormat(context)                  │
                   │   - getSuppressedSkills()               │
                   │   - getAcronymExpansions()              │
                   │   - getRulesForGrading()                │
                   └──┬─────────────────────────────────┬────┘
                      │                                 │
                      │                                 │
         ┌────────────▼─────────────┐    ┌──────────────▼──────────────┐
         │  lib/resume-validator.ts  │    │  scripts/grade-content.ts   │
         │  FAST DETERMINISTIC       │    │  SLOW SEMANTIC              │
         │                           │    │                             │
         │  validateResume(md, data) │    │  gradeContent(filePath)     │
         │                           │    │                             │
         │  Checks:                  │    │  Checks:                    │
         │   - Required sections     │    │   - Compound claims         │
         │   - Char range            │    │   - Cross-entity merging    │
         │   - Action-verb coverage  │    │   - Grounded metrics        │
         │   - Passive voice         │    │   - Editorial commentary    │
         │   - Cliches               │    │   - Tense mismatches        │
         │   - Invented compounds    │    │   - Cover letter tone       │
         │   - Suppressed skills     │    │   - CL5 rhythm              │
         │   - Recency-tier minimums │    │   - Quality scoring         │
         │   - Quantification density│    │                             │
         │   - First-person leakage  │    │  Runs Claude Opus 4.6       │
         │   - Numeric date format   │    │  with grounded sources      │
         │   - Cross-entity regex    │    │  from companies.json +      │
         │                           │    │  position-metrics.json      │
         │  Returns: string[]        │    │                             │
         │  Runtime: ~5ms            │    │  Returns: GradeResult JSON  │
         │  Cost: $0                 │    │  Runtime: 60-90s            │
         │  Runs: every generation   │    │  Cost: $2-3 per call        │
         │                           │    │  Runs: on-demand CLI        │
         │  Output: stdout warnings  │    │                             │
         │  Blocking: no (warn-only) │    │  Output: persisted to       │
         │                           │    │    <source>.grade.json      │
         │                           │    │  Blocking: exits non-zero   │
         │                           │    │    on critical violations   │
         └───────────▲───────────────┘    └───────────────▲─────────────┘
                     │                                    │
    ┌────────────────┴──────────────┐    ┌────────────────┴──────────────┐
    │  scripts/generate-resume.ts    │    │  Iteration workflow:          │
    │  scripts/generate-tailored-    │    │  1. Generate                  │
    │    resume.ts                   │    │  2. Validate (auto)           │
    │                                │    │  3. Grade (manual)            │
    │  Calls validateResume() after  │    │  4. Fix warnings              │
    │  Claude returns content.       │    │  5. Re-generate or hand-edit  │
    │  Prints warnings before        │    │  6. Re-grade                  │
    │  Prettier format.              │    │  7. Repeat ≤3 iterations      │
    └────────────────────────────────┘    └───────────────────────────────┘
```

## Interface contract

### `lib/writing-rules.ts` exports

```ts
export interface WritingRule {
  id: string; // e.g. "G1", "CL5"
  name: string; // e.g. "Entity-scope binding"
  rule: string; // machine-readable rule text
  prose?: string; // human-crafted paragraph for prompt hydration
  applies_to: ContentType[]; // ["resume", "cover_letter", "chat", "job_tools"]
  bad_example?: string;
  good_example?: string;
}

export interface WritingRulesV2 {
  version: "2.0";
  rules: {
    grounding: WritingRule[];
    ethics: WritingRule[];
    voice: WritingRule[];
    quality: WritingRule[];
    cover_letter: WritingRule[];
    chat: WritingRule[]; // new category for chat-specific rules
  };
  data: {
    action_verbs: { preferred: string[]; min_coverage_pct: number };
    phrase_blocklist: {
      cliches: string[];
      invented_compounds: string[];
      passive_markers: string[];
      violence_verbs: string[];
    };
    acronyms: {
      safe: string[]; // e.g. AI, ML, AWS, API
      spell_out_first_use: Record<string, string>; // e.g. SBIR → "Small Business Innovation Research"
    };
    suppress_from_output: { skills: string[] };
  };
  format: {
    resume: { char_range: [number, number]; target_pages: number /* ... */ };
    cover_letter: { word_range: [number, number] /* ... */ };
    chat: { perspective: string; no_emojis: boolean /* ... */ };
    job_tools: { perspective: string /* ... */ };
  };
}

export type ContentType = "resume" | "cover_letter" | "chat" | "job_tools";

// Loader
export function loadWritingRules(): WritingRulesV2;

// Rule accessors (for grader + prompt hydration)
export function getRulesFor(context: ContentType): WritingRule[];
export function getRulesForGrading(): Pick<WritingRulesV2, "rules">; // excludes data/format

// Data accessors (for validator)
export function getActionVerbs(): string[];
export function getBlocklist(
  kind: "cliches" | "invented_compounds" | "passive_markers" | "violence_verbs",
): string[];
export function getSuppressedSkills(): string[];
export function getAcronymExpansions(): { safe: Set<string>; spell_out: Record<string, string> };

// Format accessors (for validator + prompt hydration)
export function getFormat(context: ContentType): FormatRules;
```

### Validator contract

```ts
// lib/resume-validator.ts
import {
  getActionVerbs,
  getBlocklist,
  getSuppressedSkills,
  getFormat,
  getAcronymExpansions,
} from "./writing-rules.js";

export interface ValidationWarning {
  rule: string; // rule ID if known, or a category like "structure"
  severity: "warning" | "info";
  message: string;
  excerpt?: string;
}

export function validateResume(markdown: string, careerData: CareerData): ValidationWarning[];
```

**Contract invariants:**

- Validator never fails (no `throw`). Always returns an array, possibly empty.
- Validator runtime < 100ms for a 10K-char document.
- Validator has zero network calls, zero LLM calls.
- Validator output is stable: same input → same output (deterministic).
- Validator consumes `lib/writing-rules.ts` accessors, NOT raw JSON reads.

### Grader contract

```ts
// scripts/grade-content.ts → becomes lib/grader.ts in Phase A1
import { getRulesForGrading } from "../lib/writing-rules.js";

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: "critical" | "warning" | "info";
  excerpt: string;
  explanation: string;
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  violations: RuleViolation[];
}

export interface GradeResult {
  file: string;
  overallScore: number;
  maxScore: number;
  categories: CategoryScore[];
  generatedAt: string; // ISO-8601
  rulesVersion: string; // e.g. "2.0"
  modelId: string; // e.g. "claude-opus-4-6"
}

export async function gradeContent(filePath: string): Promise<GradeResult>;
```

**Contract invariants:**

- Grader can fail (network / API errors). Wrap in try/catch.
- Grader consumes `getRulesForGrading()` so it never sees regex arrays or numeric parameters that would confuse the LLM judge.
- Grader injects `companies.json` and `position-metrics.json` as `<grounded_sources>` in the user message to eliminate verification-flag noise.
- Grader persists `GradeResult` to `<source>.grade.json` alongside the markdown source.
- Grader exits non-zero when any violation has `severity: "critical"`.

## When to use which

| Situation                                                       | Use                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| During every `npm run generate` or `npm run generate:tailored`  | **Validator only** (automatic, in-pipeline)             |
| Pre-commit hook                                                 | **Validator only**                                      |
| CI on every push                                                | **Validator only** (until a budget allows grader in CI) |
| Before submitting a tailored resume/cover letter to a recruiter | **Validator + Grader**                                  |
| Iterating on a tailored prompt to improve quality               | **Validator + Grader** (after each change)              |
| Testing a new writing rule                                      | **Validator unit tests + Grader smoke test**            |

## Avoiding sync drift

The failure mode this design prevents: a rule defined in one place but enforced differently in two. The current codebase has exactly this bug — the action-verb list in `resume-writer.system.md:38` (20 verbs) drifted from the regex in `generate-resume.ts:261` (26 verbs). Phase A1 unifies them into `data.action_verbs.preferred` so there is only one list.

**Test invariant (added in Phase A1):** `tests/writing-rules.test.ts` asserts that for every rule ID referenced in any prompt file (`lib/prompts/*.system.md`), the rule exists in `writing-rules.json`. Prevents dangling references.

## Migration path from current state

1. **Today:** validator reads `writing-rules.json` inline for suppressed skills; grader reads it inline for the full rules payload. Two loaders, same file.
2. **After Phase A1 step 2:** `lib/writing-rules.ts` exists. Both tools import from it. Validator inlining is replaced by `getSuppressedSkills()`.
3. **After Phase A1 step 11:** validator consumes all its data through the loader (`getBlocklist`, `getActionVerbs`, `getFormat('resume')`). No more hardcoded arrays.
4. **After Phase A1 step 12:** grader consumes rules through `getRulesForGrading()` so its user-message payload is smaller and the LLM judge isn't confused by regex strings.

## Test plan (added in Phase A1)

```
tests/writing-rules.test.ts
- loader parses v1 JSON without error (backward compat)
- loader parses v2 JSON and produces typed output
- getRulesFor("resume") returns only rules with applies_to including "resume"
- getRulesFor("chat") returns a different (but possibly overlapping) set
- getRulesForGrading() omits data.*, format.*, and returns only the rules tree
- getActionVerbs() returns the unified preferred list with ≥20 entries
- getBlocklist("cliches") returns an array
- getSuppressedSkills() returns ["dbt", "LangChain", "n8n", "Rust"] at minimum
- Zod schema rejects malformed input with a clear error

tests/resume-validator.test.ts
- Migrated existing fixture-based tests from tests/generate.test.ts
- Regression test per historical bug: Arine 50M → should pass now
  (but 50M+ members text triggers the cross-entity pattern)
- Action-verb coverage test: 5/5 should pass, 2/5 should warn
- Passive marker test: "was responsible for" should warn
- Cliche test: "track record" should warn
- Suppressed-skill leakage: "dbt" in technical skills should warn
- Bullet tier minimum: 1-bullet current role should warn
- H1 heading check handles HTML provenance comments correctly

tests/hydrate-rules.test.ts (from Phase A3)
- renderRulesAsProse("resume") contains every G, E, V, Q, resume-applicable rule id
- renderFormatBlock("cover_letter") contains word_range
- renderPhraseBlocklistProse() contains all 4 kinds
- No output contains unsubstituted {{...}} placeholders

tests/system-prompts-snapshot.test.ts (from Phase A3)
- lib/generated/system-prompts.ts byte-identical to committed snapshot
- (This is the cache-key canary. Snapshot must be updated intentionally when prompts change.)
```

---

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
