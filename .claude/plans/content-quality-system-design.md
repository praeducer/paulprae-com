# Content Quality System Design: Validator + Grader

> **Status:** Design reference. Implementation is partially in place (Phase A2 extracted the validator); full separation of concerns lands in Phase A1 of `remaining-phases-ssot.md`.
> **Scope:** How `lib/resume-validator.ts` and `scripts/grade-content.ts` coexist, interface, and stay in sync.

## Decision

**Keep the validator and grader as separate, complementary systems. Do not merge.** Unify only their data source (writing-rules.json via `lib/writing-rules.ts`).

## Rationale

An AI generation pipeline needs **three distinct layers** of quality enforcement, in priority order:

1. **Fact invariants** (milliseconds, zero cost, runs before generation) — catches impossible states in the source data: position overlaps, orphan references, missing required fields, temporal inversions, suppressed-skill leakage in source descriptions. Deterministic. Blocks generation if violated.
2. **Deterministic structural validator** (~5ms, zero cost, runs on every generation) — catches structural bugs in generated content: missing sections, passive voice, cliches, first-person leakage, numeric date formats, malformed markdown, recency-tier bullet minimums, action-verb coverage, cross-entity conflation patterns.
3. **LLM-as-judge semantic grader** (~60-90s, $2-3 per run, runs on submission iterations) — catches semantic issues: compound claims, editorial commentary, tense mismatches the regex can't catch, stylistic rhythm (CL5), rule interpretation requiring judgment.

Merging these into one system produces a pipeline that is either too slow for every-generation checks or too shallow for pre-submission review. Keeping them separate mirrors the standard layered-quality pattern: compiler errors → linter → type-checker → integration test (impossible-state → style → correctness → semantic).

This aligns with established AI application conventions:

- **OpenAI Evals** separates reference-based checks (fast) from model-graded evaluations (slow).
- **Anthropic's constitutional AI** layers rule-based filters before harm classifiers.
- **DSPy** separates signature validation from metric evaluation.
- **LangSmith** separates trace assertions from evaluator LLM runs.

## The fraud-detection gap (why LLM judges cannot catch fabrications in self-consistent data)

During the 2026-04-11 sessions, the LLM grader scored a resume containing **two separate fabricated date ranges** at 95% with zero critical violations. Why?

**The grader's grounding pattern:** inject the resume + `writing-rules.json` + grounded sources (`companies.json` + `position-metrics.json`), ask Claude to find rule violations. The G1 (Entity-scope binding) and G4 (Source grounding) rules ask the grader to check whether claims in the resume are supported by claims in the grounded sources.

**The failure mode:** if the grounded sources themselves contain fabrications, the grader has no way to detect them. It only checks "does this claim exist in the source?" — not "is the source correct?". When Hyperbloom was listed as starting Jan 2020 in `positions.json` (stale LinkedIn data), the grader happily confirmed "yes, the resume's Jan 2020 date matches the source". Same for NeuroLex's fabricated May 2020 end date.

**This is a fundamental limitation of LLM-as-judge for fraud detection.** You cannot detect a fabrication by cross-checking against grounded sources if the grounded sources are also fabricated. The LLM cannot reach outside its input to verify against physical reality.

**The solution is an invariant layer below the grader.** Invariants encode "what cannot happen in physical reality" independent of any specific claim in the content:

- A person cannot hold two full-time employer roles at different companies at the same time
- A position cannot end before it started
- An `is_current: true` position must have `end: null`
- Company metrics must have timestamps
- Every referenced company_id must resolve

These are not stylistic rules. They are physical constraints. They catch fabrications that are consistent with the rest of the source but inconsistent with reality. A regex validator + an LLM grader together will never catch this class of error; only a dedicated invariant checker will.

**Design rule:** every time a new class of fabrication surfaces, the first question is "can we encode this as an invariant". If yes, add it to the invariant checker. If no, fall back to the grader. The invariant layer should grow over time to subsume fraud-detection responsibilities from the grader.

## RAG-style fact grounding in generation (proposed Phase A7)

The current generation pipeline injects the entire `career-data.json` + `companies.json` + `writing-rules.json` + knowledge entries into every user message. ~50KB of structured data, ~12K tokens. Most of it is irrelevant to the specific target role.

This is wasteful and ungrounded. Wasteful because the LLM has to read ~12K tokens of content it won't use. Ungrounded because the LLM sees a JSON blob and has no explicit signal about which facts are authoritative, which metrics are verified, or which scope boundaries apply.

**The RAG-style alternative:** for each generation request, retrieve only the relevant facts from an atomic facts store, inject them with explicit fact IDs, and instruct the LLM to cite fact IDs in its output.

```
Traditional injection (current):
  User message:
    <documents>
      <document index="1">[20KB career-data.json]</document>
      <document index="2">[5KB companies.json]</document>
      <document index="3">[15KB knowledge entries]</document>
      <document index="4">[10KB writing-rules.json]</document>
    </documents>
    Generate a resume for NVIDIA GSI Lead.

RAG-style injection (target):
  User message:
    <facts>
      <position id="arine" ...>
        <highlight id="arine-h1">...</highlight>
        <company-metric ref="arine.healthPlans">45+</company-metric>
      </position>
      <position id="hyperbloom" ...>
        ...
      </position>
      [retrieved: 8-12 facts relevant to NVIDIA HCLS GSI role]
    </facts>
    Generate a resume for NVIDIA GSI Lead. For each bullet, end with
    a comment listing the fact IDs that back it: <!-- @facts: id1, id2 -->
```

**Benefits:**

- **~60% token savings** on user message
- **Explicit grounding** — LLM knows which facts are citeable
- **Provenance trail** — fact IDs in output enable mechanical citation verification (see provenance manifest section below)
- **Smaller prompt cache entries** — retrieval produces smaller, more focused messages
- **Better signal-to-noise** — the LLM isn't wading through irrelevant knowledge entries

**Retrieval strategy:**

- Always include profile + most recent 3 positions + the target role's emphasis areas
- Rank remaining facts by tag match (emphasis areas → position tags) + recency + metric density
- Cap the retrieved bundle at ~8KB of facts
- Fall back to full-inclusion mode if the retrieval is sparse (<5 facts)

**Prerequisite:** atomic facts store (Phase 0.5). Without stable fact IDs and a typed retrieval layer, RAG has nothing to retrieve against.

## Provenance manifests (proposed Phase A9)

Every generated resume or cover letter should emit a parallel `*.provenance.json` manifest listing the fact IDs that back each claim. A mechanical citation grader then verifies that every claim resolves to a real fact.

```json
{
  "source": "Paul-Prae-Resume-NVIDIA.md",
  "generatedAt": "2026-04-11T10:30:00Z",
  "rulesVersion": "2.0",
  "factsVersion": "data/facts/career.yaml@sha1",
  "bullets": [
    {
      "section": "Professional Experience > Arine",
      "text": "Managed enterprise data platform on Snowflake and AWS...",
      "fact_refs": ["position.arine.highlight.platform", "company.arine.metrics.healthPlans"],
      "unverified_claims": []
    }
  ],
  "orphan_claims": [],
  "drift_warnings": []
}
```

The mechanical grader (`scripts/grade-citations.ts`) checks:

1. **Orphan claims:** bullets without any `fact_refs` (potentially fabricated). Threshold: zero.
2. **Broken references:** `fact_refs` that don't resolve to a fact in `data/facts/career.yaml`. Threshold: zero.
3. **Paraphrase drift:** bullet text diverges significantly from the referenced fact's authoritative value. Uses string-distance scoring with configurable threshold per fact type (metrics: exact or rounded, narrative: 30% Levenshtein tolerance).
4. **Scope boundary violations:** if a fact has a `scope_boundary` field, the bullet text must include a parenthetical or clause that respects the boundary. E.g., Florence Healthcare metrics must be attributed to Florence, not to Paul.

**What the LLM grader does after the mechanical grader:** only semantic/stylistic review. Rhythm, tone, voice, rule interpretation that requires judgment. Its scope narrows and its false-positive rate drops because the mechanical grader has already handled the grounding class of errors.

**Why this matters for fraud detection:** if a fabricated bullet has no `fact_refs`, the mechanical grader flags it as an orphan. If a fabricated bullet cites a real fact but paraphrases it wrong (e.g., "5.5 million monthly activities" attributed to Paul instead of Florence), the drift/scope checks catch it. The LLM grader cannot catch either of these — it treats self-consistent text as valid.

**Combined with the invariant layer:** the invariant layer catches fabrications in the **source data**, the mechanical grader catches fabrications in the **generated output**. Together they eliminate the class of fraud that LLM judges miss.

## Architecture

The full content-quality stack has five layers. Earlier layers catch more fundamental errors at lower cost. The later layers only see content that passed the earlier ones.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: ATOMIC FACTS STORE (data/facts/*.yaml)                         │
│  Single-source-of-truth for every career fact. Human-authored, version-  │
│  controlled, provenance-tracked. One fact lives in exactly one place.    │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         ▼ (derive + retrieve)
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CAREER INVARIANT CHECKER (lib/career-invariants.ts)            │
│  Runs BEFORE generation. Deterministic. ~10ms.                           │
│  - No two full-time roles overlap at different companies                 │
│  - All company_id references resolve                                     │
│  - Dates are valid ISO, end >= start                                     │
│  - is_current ↔ end: null                                                │
│  - No suppressed skills in source highlights                             │
│  - Scope boundaries declared for client-scale metrics                    │
│  Violations BLOCK generation.                                            │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │ (pass)
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: LLM GENERATION WITH RAG-STYLE FACT INJECTION                   │
│  - Retrieve relevant facts from atomic store                             │
│  - Inject as <facts> XML with explicit fact IDs                          │
│  - Model cites fact IDs in output: <!-- @facts: id1, id2 -->             │
│  - Emit parallel .provenance.json manifest                               │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: DETERMINISTIC VALIDATOR (lib/resume-validator.ts)              │
│  Runs AFTER generation. Deterministic. ~5ms.                             │
│  - Missing sections, char range, action-verb coverage                    │
│  - Passive voice, cliches, invented compounds                            │
│  - First-person leakage, numeric date formats                            │
│  - Recency-tier bullet minimums                                          │
│  - Cross-entity conflation regex                                         │
│  Warnings non-blocking.                                                  │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: MECHANICAL CITATION GRADER (scripts/grade-citations.ts, new)   │
│  Runs AFTER generation. Deterministic. ~50ms.                            │
│  - Every bullet has fact_refs                                            │
│  - Every fact_ref resolves to a fact in data/facts/                      │
│  - Paraphrase drift check (metrics exact, narrative 30% tolerance)       │
│  - Scope boundary respect check                                          │
│  Orphan claims BLOCK submission.                                         │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: LLM SEMANTIC GRADER (scripts/grade-content.ts)                 │
│  Runs AFTER generation, on demand. ~60-90s, $2-3 per call.               │
│  - Voice, rhythm, tone, rule interpretation                              │
│  - Compound claims that need judgment                                    │
│  - CL5 "human-written feel"                                              │
│  Scope narrows because Layers 1-4 have already handled grounding.        │
└──────────────────────────────────────────────────────────────────────────┘

Data source for rules (all layers share this loader):

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

| Situation                                                       | Layers to run                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Editing `data/facts/*.yaml` (pre-commit)                        | **L1 (invariants)** — blocks commit if violated                                                           |
| During every `npm run generate` or `npm run generate:tailored`  | **L1 → generation → L3 (validator) → L4 (citation grader)** — all automatic                               |
| Pre-commit hook on generated content                            | **L1 + L3 + L4** — fast, mechanical, no LLM calls                                                         |
| CI on every push                                                | **L1 + L3 + L4**                                                                                          |
| Before submitting a tailored resume/cover letter to a recruiter | **All 5 layers including L5 (LLM grader)**                                                                |
| Iterating on a tailored prompt to improve quality               | **All 5 layers** after each change                                                                        |
| Testing a new writing rule                                      | **L3 unit tests + L5 smoke test**                                                                         |
| Adding a new invariant                                          | **L1 unit tests** — synthesize a fake career data fixture that violates the invariant, assert detection   |
| Fraud detection                                                 | **L1 (source fraud) + L4 (output fraud).** Not L5 — LLM judges cannot detect self-consistent fabrications |

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

tests/career-invariants.test.ts (from Phase A6)
- Synthesized fixture for each invariant rule
- Regression fixtures for historical incidents:
  - 2026-04-11 #1: "Hyperbloom starts during AWS" (Jan 2020 start while AWS Aug 2018 – May 2021) must trigger critical violation
  - 2026-04-11 #2: "NeuroLex Jan 2018 – May 2020 overlaps Slalom + AWS" must trigger critical violation
- Positive fixtures proving legitimate overlaps pass (self-employed + full-time, part-time moonlight + full-time)

tests/grade-citations.test.ts (from Phase A9)
- Orphan claim detection (bullet with no fact_refs)
- Broken reference detection (fact_ref that doesn't resolve)
- Paraphrase drift on metrics (exact match required)
- Paraphrase drift on narrative (Levenshtein tolerance)
- Scope boundary violation (Florence metrics without attribution)
```

---

## Appendix: Lessons from the April 2026 sessions

The 2026-04-11 sessions surfaced three failure modes that motivated the expanded design above. Documenting them here so future agents understand why the architecture is shaped this way.

### Failure 1: Multi-copy fact storage (Hyperbloom date propagation)

**What happened:** A single career fact ("Hyperbloom Jun 2021 – Aug 2025") existed in ~11 physical locations across the repo. Correcting one date required ~40 hand edits to keep all copies synchronized. A one-off Python script helped with the embedded JSON-string snapshots in `career-data.json.knowledge[]`, but the script was not reusable for future fact corrections.

**Root cause:** the `loadKnowledgeBase()` ingest function wraps every JSON file in the knowledge directory as an embedded content string and stores it inside `career-data.json.knowledge[]`. This creates a snapshot that drifts from the source once `positions.json` / `projects.json` / etc. are edited without re-running ingest. Additionally, the generated resume and its public copy were never regenerated after date corrections, so they carried stale values indefinitely.

**Design response:**

- **Phase 0.5 atomic facts store:** one fact, one file, one location. All derived views regenerated from the canonical source.
- **`fix-fact` CLI (Phase A8):** single command updates the fact and regenerates all downstream artifacts in one atomic operation.
- **Pre-commit hook on derived files:** rejects direct edits to `data/generated/career-data.json`, `data/generated/Paul-Prae-Resume.md`, and `public/Paul-Prae-Resume.md`. If a human or agent tries to edit these directly, the hook tells them to edit `data/facts/career.yaml` instead.

### Failure 2: Context poisoning via memory files (Arine/Hyperbloom regression)

**What happened:** Session 1 wrote a memory file `user_career_timeline.md` with initial-guess dates (Arine Mar 2025, Hyperbloom Feb 2025) before checking LinkedIn. Later in session 1 I learned the correct dates (Sep 2025, Aug 2025) from `career-data.json` and updated the code — but never updated the memory file. Session 2 loaded the stale memory, treated it as authoritative, and reverted the code back to the wrong values (commit `ea3e074`, reverted by `dd342a1`).

**Root cause:** memory files had no freshness stamp, no provenance chain, and no test that compared their claims against the current source state. Future sessions had no signal that the memory was stale.

**Design response:**

- **Memory hygiene rule:** every memory file with fact claims must include a `last_verified_against_source: YYYY-MM-DD` frontmatter field and a link to the authoritative source file.
- **Memory file sections:** fact-claim memory files have a "⚠️ FRAUD-DETECTION WARNING" or "⚠️ FRESHNESS CHECK" section at the top with instructions for future readers ("cross-check against `data/generated/career-data.json` before treating any fact here as authoritative").
- **Test pinning:** `tests/data-consistency.test.ts` has hardcoded assertions for every fact Paul has personally verified, with in-code comments explaining which memory file / session the verification came from. A future session that tries to "correct" a pinned fact will fail the test and have to read the prior-art comment before acting.
- **Invariant layer as external check:** Layer 1 invariants run against the current source data, not against memory. Even if memory is wrong, invariants catch the downstream data state if it drifts into an impossible configuration.

### Failure 3: LLM grader certifies self-consistent fabrications (NeuroLex/Decooda)

**What happened:** The LLM grader scored the NVIDIA resume at 95% with zero critical violations, despite the resume containing two separate fabricated date ranges (Hyperbloom Jan 2020 – Aug 2025 overlapping AWS, NeuroLex Jan 2018 – May 2020 overlapping Slalom AND AWS). Paul caught both by manual review.

**Root cause:** the grader's grounding check is "does this claim exist in the grounded sources". If the grounded sources contain fabrications, the grader certifies them. The grounded sources had the wrong dates because they were derived from stale LinkedIn CSV data that no one had verified against physical reality. The grader had no "cannot happen" invariant layer to catch temporal overlaps.

**Design response:**

- **Layer 1 invariants (Phase A6):** deterministic checks for impossible data states. Runs before generation, not just after. Blocks the pipeline if career data contains overlaps, orphan references, missing fields, or other physical impossibilities. The `tests/data-consistency.test.ts` pins for the historical regressions are a subset; the general invariant checker catches future fraud that hasn't happened yet.
- **Layer 4 mechanical citation grader (Phase A9):** verifies every claim in generated output traces to a real fact. Orphan claims block submission. Paraphrase drift is detected mechanically (string distance) rather than by LLM judgment.
- **Narrowed LLM grader scope (Phase A9):** Layer 5 LLM grader runs only semantic/stylistic checks after Layers 1 and 4 have handled grounding. This matches the LLM's actual strength (nuanced semantic judgment) and avoids its weakness (trust in self-consistent input).

### Cross-cutting principle: lower layers catch more fundamental errors

The five-layer architecture is ordered so that **earlier layers catch more fundamental errors at lower cost**. A bug caught at Layer 1 costs milliseconds to detect and zero dollars to fix; a bug caught at Layer 5 costs $2-3 and requires iteration. The goal is to push error detection as low as possible.

When a new class of bug appears, the first question is "can we encode this at Layer 1 or Layer 4 rather than Layer 5". If yes, the bug becomes impossible to ship (layers 1/3/4 are deterministic and blocking). If no, it stays in Layer 5 and relies on LLM judgment, which is probabilistic and can miss.

The April 2026 fraud incidents would have been caught at Layer 1 if Layer 1 had existed at the time. They should have been caught at Layer 4 even after generation. Neither layer existed, so they fell through to Layer 5 which certified them as valid. The expanded design closes this gap.

---

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
