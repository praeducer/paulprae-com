# Data Model & Knowledge Base Plan

## Overview

This plan tracks all work related to curating, enriching, and structuring the career data and knowledge base that powers the resume generator — and will feed Phase 2 RAG-based chat.

Three areas:

1. **Quantified metrics** — Adding real numbers to career positions (only Paul knows these)
2. **Knowledge base curation** — Improving content quality, adding missing entries, fixing stale data
3. **Data model improvements** — Structural changes to support better grounding, temporal metadata, and Phase 2 RAG

---

## Status

| Area                            | Status      | Priority |
| ------------------------------- | ----------- | -------- |
| Quantified metrics — TReNDS     | Not started | High     |
| Quantified metrics — NeuroLex   | Not started | High     |
| Quantified metrics — Hyperbloom | Not started | Medium   |
| Quantified metrics — AWS        | Optional    | Low      |
| Arine metrics (company facts)   | Done (v2.0) | —        |
| KnowledgeEntry temporal fields  | Done (v2.0) | —        |
| companies.json verified metrics | Done (v2.0) | —        |

---

## Part 1: Add Quantified Metrics to Position Knowledge Entries

**File to edit:** `data/sources/knowledge/career/position-metrics.json` on main.

The resume generator cannot fabricate numbers (grounding rule G4: Source Grounding). These positions have qualitative context from the knowledge base but zero quantified metrics — only you have the real numbers from your career.

**How to edit:** Add metrics directly into the `content` string of each JSON entry. Keep the `--- SCOPE BOUNDARY ---` markers intact — they prevent the generator from mixing achievements across companies.

**Risk:** If you add inaccurate numbers, they will appear in the generated resume. The grounding rules treat the knowledge base as a verified source. Double-check everything before pushing.

**After editing:** Push to main, then start a Claude Code session and say: _"Run the full pipeline on main, review quality (target 388+), approve if it passes, and deploy."_

---

### TReNDS Center

Find the entry with `"entity": "Georgia State University / TReNDS Center"` and add numbers to the `content` field:

- How many institutions/research sites use COINSTAC? (e.g., "deployed across 20+ research institutions")
- Grant amounts secured? (e.g., "$2.1M NIH R01 grant" or "$500K SBIR Phase II")
- Data scale processed? (e.g., "100K+ neuroimaging datasets")
- Open-source community size? (e.g., "15+ contributors across 5 institutions")

---

### NeuroLex Labs

Find the entry with `"entity": "NeuroLex Diagnostics"` and add:

- ML models deployed to production? (e.g., "5 production NLP models")
- Voice data volume? (e.g., "analyzed 50K+ voice samples")
- Test coverage growth? (e.g., "increased test coverage from 0% to 85%")
- Tribe fellowship details? (e.g., "mentored cohort of 8 fellows")

---

### Hyperbloom

Find the entry with `"entity": "Hyperbloom"` and add:

- Total client engagements? (e.g., "delivered 15+ client engagements")
- Peak team size managed? (e.g., "team of 12 engineers and designers")
- Industries served? (e.g., "across healthcare, fintech, and education verticals")

---

### AWS (optional — already has solid data)

Nice-to-have additions:

- Speaking engagements? (e.g., "delivered 10+ technical talks at AWS events")
- Technical publications? (e.g., "authored 5 AWS solution briefs")

---

## Part 2: Knowledge Base Curation

### Phase 1 gaps (affects resume quality today)

- [ ] TReNDS: add quantified metrics (see Part 1)
- [ ] NeuroLex: add quantified metrics (see Part 1)
- [ ] Hyperbloom: add quantified metrics (see Part 1)
- [ ] Booz Allen: verify current company facts (employee count, revenue, healthcare portfolio) in `companies.json`
- [ ] Slalom: add behavioral health forecasting project details to `position-metrics.json`
- [ ] AWS: add speaking/publishing details if available

### Phase 2 prep (for RAG chat)

When Phase 2 (AI chat interface) is implemented, the knowledge base will be ingested into a vector store (Supabase + pgvector) for semantic retrieval. These improvements make chat answers more accurate:

- [ ] Add entries for notable projects (COINSTAC, behavioral health forecasting tools)
- [ ] Add entries for certifications with descriptions of what was learned/applied
- [ ] Add entries for technologies with usage context (e.g., "Used Snowflake at Arine for X")
- [ ] Ensure all entries have `asOf` and `source` fields where verifiable
- [ ] Add skill entries with concrete example applications

---

## Phase 3: Full Implementation

> **Status note:** Phase 3 begins after PR #28 merges to main and is verified in production. Parts 1 and 2 above are data quality prerequisites.

### Architecture Guardrails (Locked)

- **Vector store lives in PostgreSQL (`pgvector`)** — no Upstash Vector.
- **Operational + vector data are co-located** to avoid sync drift.
- **Schema aligns with two standards:**
  - LinkedIn export semantics from `data/sources/linkedin/`.
  - `schema.org` interoperability (`Person`, `Organization`, `OrganizationRole`, `EmployeeRole`, `Occupation`, `CreativeWork` patterns).
- **All curated facts remain recruiter-safe and public-safe.**
- **Current file pipeline remains source of truth** during migration (`data/sources/**` and `data/generated/career-data.json`).

---

### Phase 3 Milestones

| Milestone | Outcome                                                 | Primary Owner     | Target Status |
| --------- | ------------------------------------------------------- | ----------------- | ------------- |
| M0        | Canonical schema + mapping spec approved                | Human + Assistant | In progress   |
| M1        | Supabase PostgreSQL + pgvector provisioned              | Assistant         | Planned       |
| M2        | Initial ETL loads operational and vector tables         | Assistant         | Planned       |
| M3        | Admin curation interface with CRUD + review workflow    | Assistant         | Planned       |
| M4        | AI-assisted unstructured ingestion pipeline operational | Human + Assistant | Planned       |
| M5        | Neo4j bridge design and first graph sync                | Assistant         | Planned       |

---

### Workstream A — Canonical Data Model Design (Start Here)

#### A1) Canonical entity inventory

- [ ] Define canonical entities and IDs:
  - `person`
  - `organization`
  - `role`
  - `engagement`
  - `project`
  - `skill`
  - `certification`
  - `education`
  - `publication`
  - `fact`
  - `relationship`
  - `source_document`
- [ ] Add temporal and provenance fields to every fact-bearing entity:
  - `valid_from`, `valid_to`
  - `as_of`
  - `confidence`
  - `source_type`
  - `source_uri`
  - `ingested_at`, `last_verified_at`
- [ ] Standardize identifiers:
  - UUID primary keys.
  - Stable external IDs (`linkedin_*`, `schema_org_type`, `legacy_json_path`).

#### A2) LinkedIn + schema.org mapping matrix

- [ ] Build explicit mapping table from LinkedIn CSVs (for example `Positions.csv`, `Projects.csv`, `Skills.csv`, `Certifications.csv`, `Education.csv`, `Publications.csv`) into canonical entities.
- [ ] Add `schema.org` type/property mapping per canonical entity:
  - `person` -> `Person`
  - `organization` -> `Organization`
  - `role`/employment relationship -> `OrganizationRole` or `EmployeeRole`
  - role taxonomy -> `Occupation`
  - authored artifacts -> `CreativeWork`
- [ ] Track lossless transform notes for each mapped field (`raw_value`, `normalized_value`, `transform_rule`).

#### A3) Deliverables

- [ ] `docs/data-model/canonical-entity-spec.md`
- [ ] `docs/data-model/linkedin-to-canonical-mapping.md`
- [ ] `docs/data-model/canonical-to-schemaorg-mapping.md`
- [ ] ERD diagram committed under `docs/data-model/`.

---

### Workstream B — PostgreSQL Design (Operational + Vector)

#### B1) Operational schema (`ops`)

- [ ] Create migration set for:
  - `ops.people`
  - `ops.organizations`
  - `ops.roles`
  - `ops.projects`
  - `ops.skills`
  - `ops.certifications`
  - `ops.education`
  - `ops.publications`
  - `ops.role_project_links`
  - `ops.role_skill_links`
  - `ops.facts` (atomic fact store)
  - `ops.fact_relationships` (subject/predicate/object style links)
  - `ops.source_documents` (imported files, URLs, raw snippets)
- [ ] Add constraints + indexes for:
  - dedupe (`natural_key_hash`),
  - temporal integrity (`valid_from <= valid_to`),
  - provenance coverage (`source_type` not null for verified facts).

#### B2) Vector retrieval schema (`ai`)

- [ ] Enable extensions: `vector` (and optional `pgvectorscale` depending on provider support).
- [ ] Create:
  - `ai.embedding_documents` (one per fact cluster or artifact)
  - `ai.embedding_chunks` (chunked text units with metadata)
  - `ai.embedding_vectors` (`vector` column + model metadata + dimensions)
  - `ai.retrieval_feedback` (query, retrieved IDs, human rating, correction notes)
- [ ] Index strategy:
  - HNSW/IVFFlat benchmark and selection criteria.
  - filter-first metadata indexes (`topic`, `source_type`, `confidence`, `as_of`).

#### B3) Anthropic integration readiness

- [ ] Define chunk metadata contract for Claude tool calls:
  - `entity_type`, `entity_id`, `source_uri`, `confidence`, `as_of`, `visibility`.
- [ ] Define retrieval API envelope for agent use:
  - query,
  - top-k,
  - optional filters,
  - citations-ready payload.

---

### Workstream C — Ingestion and ETL

#### C1) Source zones

- [ ] Continue using current source files:
  - `data/sources/linkedin/`
  - `data/sources/knowledge/`
  - `data/generated/career-data.json`
- [ ] Introduce `raw -> staged -> canonical` ETL stages in SQL migrations/scripts.

#### C2) ETL execution tasks

- [ ] Build deterministic import for LinkedIn exports (schema drift-tolerant parser).
- [ ] Import approved curated markdown/docx/pdf artifacts via `source_documents`.
- [ ] Normalize entities before embedding generation.
- [ ] Add idempotent upsert behavior for repeated imports.
- [ ] Write reconciliation report:
  - counts by entity,
  - missing key fields,
  - orphan relationships,
  - conflicts needing human review.

#### C3) Validation gates

- [ ] `npm run check:quick` still passes.
- [ ] New DB validation command passes (to be added in Phase 3).
- [ ] Spot-check high-risk facts (employment dates, role overlaps, company affiliations).

---

### Workstream D — Admin Interface for Data Curation

#### D1) Product scope

- [ ] Add admin area for structured curation:
  - CRUD for facts, projects, roles, organizations, relationships.
  - provenance editor (`source_uri`, `confidence`, `as_of`, notes).
  - conflict resolution UI for duplicate/contradictory facts.
- [ ] Add review workflow states:
  - `draft` -> `pending_review` -> `approved` -> `published`.

#### D2) Backend schema additions for curation

- [ ] `ops.raw_authored_content` (ground-truth longform artifacts you wrote).
- [ ] `ops.faq_entries` (approved Q/A and recruiter-facing clarifications).
- [ ] `ops.curation_submissions` (raw natural language submissions).
- [ ] `ops.curation_extractions` (AI-extracted candidate facts and relationships).
- [ ] `ops.curation_decisions` (human accept/reject/edit log).

#### D3) AI-assisted ingestion flow

- [ ] User submits unstructured text in admin UI.
- [ ] AI extraction step proposes:
  - atomic facts,
  - entities,
  - relationships,
  - confidence scores,
  - required citations.
- [ ] Human reviews suggestions before write.
- [ ] Accepted facts are written to `ops.facts` + relationship tables and queued for embedding refresh.

---

### Workstream E — AI Reference Library (Lean, Immediate)

The goal is immediate curation, not framework design. Keep this library simple and flat so it stays maintainable for a one-person part-time workflow while still supporting multiple stakeholders and LLM platforms.

#### Current directory structure

```text
data/generated/reference-library/
├── README.md
├── INDEX.md
├── resumes/
├── case-studies/
└── stakeholder-qa/
```

#### Operational rules

- [ ] Keep only approved source artifacts you want to curate and ingest.
- [ ] Keep filenames readable; avoid deep nested date folders.
- [ ] Update `INDEX.md` whenever files are added/replaced.
- [ ] Save stakeholder clarifications as standalone markdown files in `stakeholder-qa/`.
- [ ] Ignore Windows `:Zone.Identifier` files.
- [ ] Keep documents platform-agnostic for ingestion by Claude, Bedrock, and Gemini/Vertex.

#### Deferred by design

- Golden datasets, eval suites, and few-shot corpora are intentionally postponed until automated evaluation workflows are active.
- When that work starts, add `datasets/` and `few-shot/` back with only the minimum required structure.

---

### Workstream F — Neo4j Transition Path (After PostgreSQL Stabilizes)

- [ ] Define graph projection from canonical Postgres entities:
  - `Person -> Role -> Organization -> Project -> Skill -> Outcome`.
- [ ] Build sync job from Postgres canonical views into Neo4j.
- [ ] Keep Postgres as operational source of truth and Neo4j as graph-analytics and relationship reasoning layer.
- [ ] Add graph-aware retrieval strategies for agent tool calls only after Postgres retrieval quality is stable.

---

### Immediate Task Board (Human + Assistant)

#### This week (start curation now)

- [ ] **Human:** Approve canonical entity list and naming decisions.
- [ ] **Assistant:** Draft initial SQL DDL for `ops` + `ai` schemas.
- [ ] **Assistant:** Add mapping docs from LinkedIn exports to canonical fields.
- [ ] **Human:** Review and correct employment timeline overlap facts.
- [ ] **Assistant:** Create admin UI technical spec (`/docs/admin-curation-spec.md`).

#### Next week

- [ ] **Assistant:** Provision Supabase project, migrations, and seed scripts.
- [ ] **Assistant:** Build first ETL run and reconciliation report.
- [ ] **Human:** Resolve flagged conflicts and approve facts.
- [ ] **Assistant:** Implement first curation UI slice (facts + FAQ CRUD).

#### Backlog tasks promoted into Phase 3

- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 3 is active.
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active.
- [ ] Add Vercel MCP server tool access for DB/vector/graph operations once service credentials are set.

---

### Seed Entry for Future Ingestion (Approved Stakeholder Clarification)

Source artifact:

- `data/generated/reference-library/stakeholder-qa/faq-employment-timeline-ey-2026-03.md`

Recommended destination tables:

- `ops.faq_entries`
- `ops.raw_authored_content`
- `ops.facts`
- `ops.fact_relationships`

Fact extraction checklist:

- [ ] Hyperbloom timeline means incorporation-through-sunset lifecycle, not continuous overlapping full-time consulting.
- [ ] No active consulting while employed full-time at AWS and Booz Allen.
- [ ] Mento role was part-time contract work during Hyperbloom bootstrap period.
- [ ] Modular Earth is a not-for-profit umbrella for open-source philanthropic work.
- [ ] Current career objective: transition from startup volatility to long-term enterprise employment.
- [ ] Booz Allen exit context: FDA contractor reduction during DOGE-related layoffs.

---

## Notes

- **Data model files:** `lib/types.ts` (TypeScript interfaces), `data/sources/knowledge/` (JSON source files), `data/generated/career-data.json` (merged output, committed)
- **Ingest runs automatically** in the pipeline — no manual step needed after editing source files
- **All knowledge base content is public** — it ends up in the resume sent to strangers, so never add anything you wouldn't put on a resume
- **Schema validation is strict** — Zod validates all entries on ingest; if required fields are missing, ingest will error
