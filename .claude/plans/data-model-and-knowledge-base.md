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

## Part 3: Data Model Improvements

### Completed (v2.0)

- `KnowledgeEntry.asOf` — ISO date when fact was last verified
- `KnowledgeEntry.source` — URL or description for fact verification
- `KnowledgeEntry.confidence` — `"verified"` | `"self-reported"` | `"estimated"`
- `companies.json` — Arine metrics verified from arine.io (45+ health plans, >30M members, Inc. 5000 #5 AI)

### Planned (Phase 1 improvements)

- [ ] Add verified metrics to `companies.json` for Booz Allen and Slalom (public data available)
- [ ] Add `relatedSkills` field to position entries for better skill-role attribution
- [ ] Add `projectIds` field to position entries linking to knowledge base projects

### Phase 2 requirements (when building RAG chat)

- [ ] Migrate career data to Supabase PostgreSQL with pgvector
- [ ] Design embedding strategy (per-entry vs. chunked)
- [ ] Add `embedding` column to career_data table
- [ ] Build ingestion pipeline that syncs `data/sources/` → Supabase on push to main
- [ ] Define retrieval query patterns for common recruiter questions

---

## Notes

- **Data model files:** `lib/types.ts` (TypeScript interfaces), `data/sources/knowledge/` (JSON source files), `data/generated/career-data.json` (merged output, committed)
- **Ingest runs automatically** in the pipeline — no manual step needed after editing source files
- **All knowledge base content is public** — it ends up in the resume sent to strangers, so never add anything you wouldn't put on a resume
- **Schema validation is strict** — Zod validates all entries on ingest; if required fields are missing, ingest will error
