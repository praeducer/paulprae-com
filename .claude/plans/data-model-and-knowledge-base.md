# Phase 3 Data Model & Knowledge Base Execution Plan

## Purpose

Phase 2 is complete and deployed. This document is now the implementation plan for Phase 3, with a strict build order:

1. Design canonical data model and mappings.
2. Stand up PostgreSQL (operational + vector retrieval in pgvector).
3. Load and validate data pipelines.
4. Launch curation admin interface with AI-assisted ingestion.
5. Expand naturally into Neo4j graph workflows.

This plan is written for both:

- **Human lead engineer (Paul):** architecture decisions, truth review, approval gates.
- **Coding assistants (Claude Code / Cursor agents):** execution, migration scripts, tests, UI/API implementation.

---

## Architecture Guardrails (Locked)

- **Vector store lives in PostgreSQL (`pgvector`)** — no Upstash Vector.
- **Operational + vector data are co-located** to avoid sync drift.
- **Schema aligns with two standards:**
  - LinkedIn export semantics from `data/sources/linkedin/`.
  - `schema.org` interoperability (`Person`, `Organization`, `OrganizationRole`, `EmployeeRole`, `Occupation`, `CreativeWork` patterns).
- **All curated facts remain recruiter-safe and public-safe.**
- **Current file pipeline remains source of truth** during migration (`data/sources/**` and `data/generated/career-data.json`).

---

## Phase 3 Milestones

| Milestone | Outcome                                                 | Primary Owner     | Target Status |
| --------- | ------------------------------------------------------- | ----------------- | ------------- |
| M0        | Canonical schema + mapping spec approved                | Human + Assistant | In progress   |
| M1        | Supabase PostgreSQL + pgvector provisioned              | Assistant         | Planned       |
| M2        | Initial ETL loads operational and vector tables         | Assistant         | Planned       |
| M3        | Admin curation interface with CRUD + review workflow    | Assistant         | Planned       |
| M4        | AI-assisted unstructured ingestion pipeline operational | Human + Assistant | Planned       |
| M5        | Neo4j bridge design and first graph sync                | Assistant         | Planned       |

---

## Workstream A — Canonical Data Model Design (Start Here)

### A1) Canonical entity inventory

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

### A2) LinkedIn + schema.org mapping matrix

- [ ] Build explicit mapping table from LinkedIn CSVs (for example `Positions.csv`, `Projects.csv`, `Skills.csv`, `Certifications.csv`, `Education.csv`, `Publications.csv`) into canonical entities.
- [ ] Add `schema.org` type/property mapping per canonical entity:
  - `person` -> `Person`
  - `organization` -> `Organization`
  - `role`/employment relationship -> `OrganizationRole` or `EmployeeRole`
  - role taxonomy -> `Occupation`
  - authored artifacts -> `CreativeWork`
- [ ] Track lossless transform notes for each mapped field (`raw_value`, `normalized_value`, `transform_rule`).

### A3) Deliverables

- [ ] `docs/data-model/canonical-entity-spec.md`
- [ ] `docs/data-model/linkedin-to-canonical-mapping.md`
- [ ] `docs/data-model/canonical-to-schemaorg-mapping.md`
- [ ] ERD diagram committed under `docs/data-model/`.

---

## Workstream B — PostgreSQL Design (Operational + Vector)

### B1) Operational schema (`ops`)

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

### B2) Vector retrieval schema (`ai`)

- [ ] Enable extensions: `vector` (and optional `pgvectorscale` depending on provider support).
- [ ] Create:
  - `ai.embedding_documents` (one per fact cluster or artifact)
  - `ai.embedding_chunks` (chunked text units with metadata)
  - `ai.embedding_vectors` (`vector` column + model metadata + dimensions)
  - `ai.retrieval_feedback` (query, retrieved IDs, human rating, correction notes)
- [ ] Index strategy:
  - HNSW/IVFFlat benchmark and selection criteria.
  - filter-first metadata indexes (`topic`, `source_type`, `confidence`, `as_of`).

### B3) Anthropic integration readiness

- [ ] Define chunk metadata contract for Claude tool calls:
  - `entity_type`, `entity_id`, `source_uri`, `confidence`, `as_of`, `visibility`.
- [ ] Define retrieval API envelope for agent use:
  - query,
  - top-k,
  - optional filters,
  - citations-ready payload.

---

## Workstream C — Ingestion and ETL

### C1) Source zones

- [ ] Continue using current source files:
  - `data/sources/linkedin/`
  - `data/sources/knowledge/`
  - `data/generated/career-data.json`
- [ ] Introduce `raw -> staged -> canonical` ETL stages in SQL migrations/scripts.

### C2) ETL execution tasks

- [ ] Build deterministic import for LinkedIn exports (schema drift-tolerant parser).
- [ ] Import approved curated markdown/docx/pdf artifacts via `source_documents`.
- [ ] Normalize entities before embedding generation.
- [ ] Add idempotent upsert behavior for repeated imports.
- [ ] Write reconciliation report:
  - counts by entity,
  - missing key fields,
  - orphan relationships,
  - conflicts needing human review.

### C3) Validation gates

- [ ] `npm run check:quick` still passes.
- [ ] New DB validation command passes (to be added in Phase 3).
- [ ] Spot-check high-risk facts (employment dates, role overlaps, company affiliations).

---

## Workstream D — Admin Interface for Data Curation

### D1) Product scope

- [ ] Add admin area for structured curation:
  - CRUD for facts, projects, roles, organizations, relationships.
  - provenance editor (`source_uri`, `confidence`, `as_of`, notes).
  - conflict resolution UI for duplicate/contradictory facts.
- [ ] Add review workflow states:
  - `draft` -> `pending_review` -> `approved` -> `published`.

### D2) Backend schema additions for curation

- [ ] `ops.raw_authored_content` (ground-truth longform artifacts you wrote).
- [ ] `ops.faq_entries` (approved Q/A and recruiter-facing clarifications).
- [ ] `ops.curation_submissions` (raw natural language submissions).
- [ ] `ops.curation_extractions` (AI-extracted candidate facts and relationships).
- [ ] `ops.curation_decisions` (human accept/reject/edit log).

### D3) AI-assisted ingestion flow

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

## Workstream E — AI Reference Library (Lean, Immediate)

The goal is immediate curation, not framework design. Keep this library simple and flat so it stays maintainable for a one-person part-time workflow while still supporting multiple stakeholders and LLM platforms.

### Current directory structure

```text
data/generated/reference-library/
├── README.md
├── INDEX.md
├── resumes/
├── case-studies/
└── stakeholder-qa/
```

### Operational rules

- [ ] Keep only approved source artifacts you want to curate and ingest.
- [ ] Keep filenames readable; avoid deep nested date folders.
- [ ] Update `INDEX.md` whenever files are added/replaced.
- [ ] Save stakeholder clarifications as standalone markdown files in `stakeholder-qa/`.
- [ ] Ignore Windows `:Zone.Identifier` files.
- [ ] Keep documents platform-agnostic for ingestion by Claude, Bedrock, and Gemini/Vertex.

### Deferred by design

- Golden datasets, eval suites, and few-shot corpora are intentionally postponed until automated evaluation workflows are active.
- When that work starts, add `datasets/` and `few-shot/` back with only the minimum required structure.

---

## Workstream F — Neo4j Transition Path (After PostgreSQL Stabilizes)

- [ ] Define graph projection from canonical Postgres entities:
  - `Person -> Role -> Organization -> Project -> Skill -> Outcome`.
- [ ] Build sync job from Postgres canonical views into Neo4j.
- [ ] Keep Postgres as operational source of truth and Neo4j as graph-analytics and relationship reasoning layer.
- [ ] Add graph-aware retrieval strategies for agent tool calls only after Postgres retrieval quality is stable.

---

## Immediate Task Board (Human + Assistant)

### This week (start curation now)

- [ ] **Human:** Approve canonical entity list and naming decisions.
- [ ] **Assistant:** Draft initial SQL DDL for `ops` + `ai` schemas.
- [ ] **Assistant:** Add mapping docs from LinkedIn exports to canonical fields.
- [ ] **Human:** Review and correct employment timeline overlap facts.
- [ ] **Assistant:** Create admin UI technical spec (`/docs/admin-curation-spec.md`).

### Next week

- [ ] **Assistant:** Provision Supabase project, migrations, and seed scripts.
- [ ] **Assistant:** Build first ETL run and reconciliation report.
- [ ] **Human:** Resolve flagged conflicts and approve facts.
- [ ] **Assistant:** Implement first curation UI slice (facts + FAQ CRUD).

### Backlog tasks promoted into Phase 3

- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 3 is active.
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active.
- [ ] Add Vercel MCP server tool access for DB/vector/graph operations once service credentials are set.

---

## Seed Entry for Future Ingestion (Approved Stakeholder Clarification)

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

- This plan intentionally prioritizes PostgreSQL operational and vector design before graph expansion.
- Neo4j is Phase 3b, not Phase 3a.
- Keep all new curation content public-safe and recruiter-safe by default.
