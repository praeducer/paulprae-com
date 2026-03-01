# Knowledge Base Architecture & Data Extraction Plan for paulprae.com

## Context

Paul's career platform at paulprae.com currently generates a resume from LinkedIn CSV exports via a TypeScript pipeline (ingest → Claude Opus 4.6 → static site). Two other repos contain rich career data that is not yet leveraged:

- **pgp** — A Human Digital Twin with `paul_prae_knowledge_base.json` (1,352 lines): career history, personality, values, communication styles, goals, expertise
- **job-finding-assistant** — A 6-agent job search system with `job_search_knowledge_base.json` (career objectives, GTM strategy, brand narratives) and `ai_assistants_system_config.json` (workflow architecture, audience frameworks, writing formulas, quality checklists)

This plan creates a curated, well-structured knowledge base in `paulprae-com/data/knowledge/` by extracting, transforming, and loading relevant data from both repos. The knowledge base is designed as flat JSON files that:

1. **Now:** Augment the resume generation pipeline with richer context
2. **Soon:** Upload trivially into PostgreSQL/Supabase tables
3. **Mid-term:** Transform into vector embeddings for RAG-powered AI chat
4. **Long-term:** Ingest into Neo4j as a career knowledge graph

Pipeline integration (modifying `ingest-linkedin.ts` and `generate-resume.ts`) is **documented but not executed** — that happens under a separate plan.

---

## Phase A: Infrastructure Setup

### A1. Update `.gitignore`

**File:** `/home/praeducer/dev/paulprae-com/.gitignore`

Add pattern to cover knowledge base subdirectories:

```
data/knowledge/**/*.json
```

### A2. Create directory structure

```
data/knowledge/
├── career/          # Career facts: positions, education, skills, projects, etc.
├── brand/           # Identity, values, personality, communication styles
├── strategy/        # Job search config, career objectives, audience frameworks
├── agents/          # AI agent configurations, workflow architecture, rules
├── content/         # Writing formulas, message templates, platform constraints
└── _meta/           # Manifest and schema metadata
```

Create directories with `.gitkeep` files.

### A3. Define TypeScript interfaces

**File:** `/home/praeducer/dev/paulprae-com/lib/knowledge-types.ts` (NEW)

All interfaces defined below in Section "Data Models" go here. This keeps the knowledge base types separate from the existing LinkedIn pipeline types in `lib/types.ts`.

### A4. Update `lib/config.ts`

Add path constants for each knowledge base subdirectory:

```typescript
export const KNOWLEDGE_PATHS = {
  career: path.join(ROOT, "data", "knowledge", "career"),
  brand: path.join(ROOT, "data", "knowledge", "brand"),
  strategy: path.join(ROOT, "data", "knowledge", "strategy"),
  agents: path.join(ROOT, "data", "knowledge", "agents"),
  content: path.join(ROOT, "data", "knowledge", "content"),
  meta: path.join(ROOT, "data", "knowledge", "_meta"),
} as const;
```

---

## Phase B: Career Data Files

Source: primarily `pgp/paul_prae_knowledge_base.json` sections `professional`, `expertise`, `quick_index`, `digital_presence`

### B1. `career/profile.json` — Single object

| Field                | Type   | Source                                      |
| -------------------- | ------ | ------------------------------------------- |
| `name`               | string | pgp `quick_index.name`                      |
| `headline`           | string | pgp `professional.current.headline`         |
| `summary`            | string | pgp `professional.linkedin_profile.summary` |
| `location.primary`   | string | pgp `personal.location.primary`             |
| `location.secondary` | string | pgp `personal.location.secondary`           |
| `email`              | string | pgp `digital_presence.contact.email`        |
| `linkedin`           | string | pgp `digital_presence.contact.linkedin_url` |
| `website`            | string | pgp `digital_presence.contact.website`      |
| `github`             | string | pgp `digital_presence.online.github`        |
| `blog`               | string | pgp `digital_presence.online.blog`          |
| `presentations`      | string | pgp `digital_presence.online.slideshare`    |
| `academic`           | string | pgp `digital_presence.online.academia`      |
| `years_experience`   | number | pgp `professional.current.years_experience` |
| `current_role`       | string | pgp `professional.current.title`            |
| `current_company`    | string | pgp `professional.current.company`          |

**PostgreSQL:** `profiles` table (single row) or app config
**Neo4j:** `(:Person)` node

### B2. `career/companies.json` — Array (NEWLY AUTHORED)

| Field         | Type    | Description                                                     |
| ------------- | ------- | --------------------------------------------------------------- |
| `id`          | string  | Slug: `"arine"`, `"booz-allen-hamilton"`                        |
| `name`        | string  | Company name                                                    |
| `industry`    | string  | Primary industry                                                |
| `size`        | string  | `"startup"` \| `"mid-market"` \| `"enterprise"`                 |
| `type`        | string  | `"employer"` \| `"client"` \| `"own-business"` \| `"nonprofit"` |
| `website`     | string? | Company URL                                                     |
| `description` | string  | Brief description                                               |

Extract companies from pgp position descriptions. Enriched with metadata for Neo4j `(:Company)` and `(:Company)-[:IN_INDUSTRY]->(:Industry)`.

### B3. `career/positions.json` — Array (16+ records)

| Field             | Type     | Source                                                               |
| ----------------- | -------- | -------------------------------------------------------------------- |
| `id`              | string   | Slug: `"arine-staff-data-ops-2025"`                                  |
| `title`           | string   | pgp `professional.experience[].title`                                |
| `company`         | string   | pgp `professional.experience[].company`                              |
| `company_id`      | string   | References companies.json                                            |
| `location`        | string   | pgp `professional.experience[].location`                             |
| `start_date`      | string   | Normalized to `YYYY-MM`                                              |
| `end_date`        | string?  | null = current                                                       |
| `is_current`      | boolean  | pgp `professional.experience[].current`                              |
| `employment_type` | string   | `"full-time"` \| `"contract"` \| `"self-employed"` \| `"internship"` |
| `description`     | string   | Raw paragraph description                                            |
| `highlights`      | string[] | Split from description on `+` bullets                                |
| `technologies`    | string[] | Extracted from description text                                      |
| `industries`      | string[] | From company_id cross-reference                                      |
| `sort_order`      | number   | 1 = most recent                                                      |

**Transformation:** Split description text on `+` character into `highlights[]`. Keep raw `description` intact.
**PostgreSQL:** `positions` table
**Neo4j:** `(:Role)` with `Person-[:HELD_ROLE]->Role`, `Role-[:AT_COMPANY]->Company`

### B4. `career/education.json` — Array (3 records)

| Field            | Type     | Source                                                      |
| ---------------- | -------- | ----------------------------------------------------------- |
| `id`             | string   | `"uga-bs-cs-2012"`                                          |
| `school`         | string   | pgp `professional.education[].school`                       |
| `degree`         | string   | pgp `professional.education[].degree`                       |
| `field`          | string   | Extracted from degree text                                  |
| `specialization` | string   | pgp `professional.education[].focus` or `emphasis`          |
| `start_date`     | string   | Normalized                                                  |
| `end_date`       | string   | Normalized                                                  |
| `activities`     | string   | pgp `professional.education[].activities`                   |
| `honors`         | string[] | e.g., `["Cum Laude"]`                                       |
| `certificates`   | string[] | e.g., `["Interdisciplinary Certificate in Music Business"]` |
| `description`    | string   | pgp `professional.education[].description`                  |

### B5. `career/skills.json` — Array (55+ records)

| Field              | Type     | Source                                                                                                                                                                                               |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | string   | Slugified: `"artificial-intelligence"`                                                                                                                                                               |
| `name`             | string   | Skill display name                                                                                                                                                                                   |
| `category`         | string   | `"ai_ml"` \| `"cloud_platforms"` \| `"programming"` \| `"databases"` \| `"technologies"` \| `"web_development"` \| `"domain_healthcare"` \| `"domain_business"` \| `"domain_data"` \| `"leadership"` |
| `proficiency`      | string   | `"expert"` \| `"advanced"` \| `"intermediate"`                                                                                                                                                       |
| `years_experience` | number?  | Estimated from positions                                                                                                                                                                             |
| `is_featured`      | boolean  | In pgp `core_expertise` or jfa `core_skills`                                                                                                                                                         |
| `related_skills`   | string[] | Skill IDs for Neo4j `RELATED_TO`                                                                                                                                                                     |

**Merge strategy:** Start with pgp `expertise.technical_skills` + `expertise.domain_knowledge` (categorized). Add uncategorized skills from pgp `professional.skills[]`. Deduplicate by normalized name.

### B6. Remaining career files

All are straightforward extractions from pgp `professional.*`:

- **`career/certifications.json`** — Array. Fields: `id`, `name`, `authority`, `issue_date`, `expiry_date`, `license_number`, `url`. Source: pgp `professional.certifications[]` (10 records)
- **`career/projects.json`** — Array. Fields: `id`, `title`, `description`, `url`, `start_date`, `end_date`, `status`, `technologies[]`, `outcomes[]`, `position_id`, `project_type`. Source: pgp `professional.projects[]` (18+ records)
- **`career/publications.json`** — Array. Fields: `id`, `name`, `publisher`, `published_date`, `url`, `description`. Source: pgp `professional.publications[]` (2 records)
- **`career/recommendations.json`** — Array. Fields: `id`, `recommender_name`, `recommender_company`, `recommender_title`, `text`, `date`, `themes[]`. Source: pgp `professional.recommendations[]` (7 records). Flatten nested recommender object.
- **`career/honors.json`** — Array. Fields: `id`, `title`, `organization`, `date`, `description`, `category`. Source: pgp `professional.awards[]` (4 records)
- **`career/volunteering.json`** — Array. Fields: `id`, `organization`, `role`, `cause`, `start_date`, `end_date`, `description`. Source: pgp `professional.volunteering[]` (6 records)
- **`career/courses.json`** — Array. Fields: `id`, `name`, `code`, `category`, `discipline`, `institution`, `associated_education_id`. Source: pgp `professional.courses{}` (~70 records). **Transformation:** Flatten nested-by-discipline structure into flat array with `discipline` field.

---

## Phase C: Brand Data Files

### C1. `brand/values.json` — Array (8 records)

| Field               | Type   | Source                                                 |
| ------------------- | ------ | ------------------------------------------------------ |
| `name`              | string | jfa `personal_brand.core_values` (richer descriptions) |
| `description`       | string | jfa `personal_brand.core_values[].description`         |
| `ethical_principle` | string | pgp `values.ethical_principles[]` (paired by index)    |

**Merge:** Both repos define the same 8 values. Use jfa descriptions (richer) + pgp ethical principles.

Also include from pgp `values`:

- `priorities` array
- `non_negotiables` array
- `worldview` string

### C2. `brand/personality.json` — Single object

| Field                                   | Type     | Source                                                                        |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `writing_style`                         | string   | pgp `personality.writing_style`                                               |
| `tone_preferences`                      | string[] | pgp `personality.tone_preferences`                                            |
| `humor_style`                           | string   | pgp `personality.humor_style`                                                 |
| `decision_making`                       | string   | pgp `personality.decision_making`                                             |
| `enthusiasm_expression`                 | string   | pgp `personality.enthusiasm_expression`                                       |
| `core_traits.primary`                   | string[] | pgp `personality.core_traits.primary` (15 traits)                             |
| `core_traits.communication`             | string[] | pgp `personality.core_traits.communication`                                   |
| `leadership_style`                      | string[] | jfa `user_personality.character_traits.leadership_style`                      |
| `personal_interests.creative_pursuits`  | string[] | jfa `user_personality.character_traits.personal_interests.creative_pursuits`  |
| `personal_interests.outdoor_activities` | string[] | jfa `user_personality.character_traits.personal_interests.outdoor_activities` |
| `communities`                           | string[] | pgp `cultural_context.communities`                                            |

### C3. `brand/identity.json` — Single object

| Field                           | Type     | Source                                               |
| ------------------------------- | -------- | ---------------------------------------------------- |
| `mission.description`           | string   | jfa `personal_brand.mission` summary                 |
| `mission.core_areas`            | object   | jfa `personal_brand.mission.core_areas`              |
| `vision.description`            | string   | jfa `personal_brand.vision` summary                  |
| `vision.focus_areas`            | object   | jfa `personal_brand.vision.focus_areas`              |
| `causes`                        | string[] | pgp `professional.causes` (9 causes)                 |
| `life_philosophy.mission_areas` | object   | pgp `values.life_philosophy.mission_areas` (4 areas) |
| `company_websites`              | object   | pgp `digital_presence.online.company_websites`       |

### C4. `brand/communication-styles.json` — Single object

Merge two sources:

- **Context-specific styles** from pgp `communication_style`: `professional`, `personal`, `social_media`, `creative` sub-objects
- **Standards** from jfa `ai_assistants_system_config`: `core_principles`, `tone_guidelines`, `ethical_boundaries`

### C5. `brand/brand-narratives.json` — Array of strings

Source: jfa `personal_brand.brand_narratives` (9 positioning statements).

---

## Phase D: Strategy Data Files

### D1. `strategy/job-search.json` — Single object

Source: jfa `go_to_market_strategy`

| Field                                  | Type                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| `target_roles.primary`                 | string[] (10+ roles)                                     |
| `target_industries.primary`            | string[] (10+ industries)                                |
| `target_audience.titles`               | string[]                                                 |
| `job_preferences.compensation`         | `{ annual_salary, bonus, total_compensation, currency }` |
| `job_preferences.employment_type`      | string                                                   |
| `job_preferences.location_preferences` | string                                                   |
| `job_preferences.work_arrangements`    | string[]                                                 |
| `core_skills_by_category`              | object (6 categories)                                    |

### D2. `strategy/career-objectives.json` — Single object

Source: pgp `goals` + jfa `career_objectives`. **Privacy-filtered:**

| Original                                      | Transformed                                        |
| --------------------------------------------- | -------------------------------------------------- |
| "Eliminate $60,000 debt by 2027-2028"         | "Achieve debt freedom within 2-3 years"            |
| "Save $1M for retirement by age 45 (2031)"    | "Build substantial retirement savings by mid-40s"  |
| "Support wife as stay-at-home parent"         | "Support family financial needs as primary earner" |
| "Save for children's college (starting 2038)" | "Plan for children's education expenses"           |
| "Afford modifying 4X4 Jeep Grand Cherokee"    | EXCLUDED (too personal)                            |

Structure: `current_focus`, `objectives_by_category` (financial, career, family, entrepreneurship, lifestyle), `short_term`, `long_term`, `legacy`.

### D3. `strategy/audience-frameworks.json` — Array (5 records)

Source: jfa `ai_assistants_system_config.audience_frameworks`. One record per audience type: `hiring_managers`, `recruiters`, `hr_representatives`, `potential_colleagues`, `alumni_connections`.

Fields: `audience_type`, `primary_concerns[]`, `messaging_focus`, `preferred_length`, `key_elements[]`.

### D4. `strategy/target-market.json` — Single object

Source: jfa GTM strategy + CLAUDE.md target companies (NVIDIA, Microsoft, AWS, Google, Anthropic, Perplexity, Cursor, Mistral).

Fields: `target_companies[]`, `target_industries[]`, `positioning_statement`, `competitive_advantages[]`.

---

## Phase E: Agent Configuration Files (NEW)

Source: jfa `ai_assistants_system_config.json` + `AI_assistants/` directory

### E1. `agents/workflow-architecture.json` — Single object

Extract the 6-stage workflow pipeline definition:

```json
{
  "stages": [
    { "stage": 1, "name": "Career Coach Assistant", "purpose": "...", "outputs": [...], "prerequisites": [] },
    { "stage": 2, "name": "Personal Brand Development Assistant", "purpose": "...", "outputs": [...], "prerequisites": [1] },
    ...
  ],
  "execution_notes": "Stages 1-3 sequential, then 4A/4B/4C parallel"
}
```

### E2. `agents/permissions-matrix.json` — Array

Extract the knowledge base read/write permissions per agent:

```json
[
  { "agent": "career_coach", "read": ["user_profile", "career_objectives"], "write": ["user_profile.basic_info", "career_objectives"] },
  ...
]
```

### E3. `agents/agent-definitions.json` — Array (6 records)

Extract structured metadata from each AI_assistants/\*.md file:

| Field                | Type     | Description                                 |
| -------------------- | -------- | ------------------------------------------- |
| `id`                 | string   | `"career_coach"`, `"personal_brand"`, etc.  |
| `name`               | string   | Full display name                           |
| `stage`              | string   | `"1"`, `"2"`, `"3"`, `"4A"`, `"4B"`, `"4C"` |
| `role`               | string   | One-line role description                   |
| `purpose`            | string   | Primary responsibility                      |
| `prerequisites`      | string[] | Stage IDs that must complete first          |
| `outputs`            | string[] | What this agent produces                    |
| `read_permissions`   | string[] | KB sections it can read                     |
| `write_permissions`  | string[] | KB sections it can write                    |
| `success_criteria`   | string[] | When is this agent's work done              |
| `source_prompt_file` | string   | Path to original .md prompt                 |

### E4. `agents/quality-standards.json` — Single object

Extract operational quality rules from ai_assistants_system_config:

```json
{
  "pre_send_validation": [...],
  "content_requirements": [...],
  "personalization_framework": {
    "research_checklist": [...],
    "personalization_levels": {...}
  },
  "follow_up_cadence": {...}
}
```

---

## Phase F: Content Data Files

### F1. `content/writing-formulas.json` — Array (4 records)

Source: jfa `ai_assistants_system_config.writing_formulas`

Fields: `id`, `name`, `structure`, `usage`, `example`.
Records: STAR Method, Problem-Agitate-Solve, AIDA Model, Before-After-Bridge.

### F2. `content/message-templates.json` — Single object

Source: jfa `ai_assistants_system_config.message_components` + `response_templates`

Structure: `effective_openings`, `compelling_closings`, `credibility_builders`, `response_templates` (interview thank you, rejection response, follow-up cadence).

### F3. `content/platform-constraints.json` — Single object

Source: jfa `ai_assistants_system_config.platform_constraints`

Structure: `linkedin` (connection_request, message, inmail), `email` (subject, body), `application_forms`.

---

## Phase G: Meta Files

### G1. `_meta/manifest.json` — Single object

Registry of all knowledge base files:

```json
{
  "version": "1.0",
  "last_updated": "2026-02-27",
  "files": [
    {
      "path": "career/positions.json",
      "version": "1.0",
      "source_repos": ["pgp"],
      "record_count": 16,
      "privacy_level": "career-public",
      "phase2_table": "positions",
      "phase3_nodes": ["Role"],
      "description": "Complete work history with highlights and technologies"
    }
  ]
}
```

---

## Database & Graph Mapping Table

| Knowledge Base File                 | Phase 2 PostgreSQL Table | Phase 2 Vector Store (documents.source_type) | Phase 3 Neo4j Node(s) | Phase 3 Neo4j Relationship(s)                                                       |
| ----------------------------------- | ------------------------ | -------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `career/profile.json`               | `profiles` (new)         | `profile_summary`                            | `Person`              | --                                                                                  |
| `career/positions.json`             | `positions`              | `position`, `position_highlight`             | `Role`                | `Person-HELD_ROLE->Role`, `Role-AT_COMPANY->Company`                                |
| `career/education.json`             | `education`              | `education`                                  | `Education`           | `Person-ATTENDED->Education`                                                        |
| `career/skills.json`                | `skills`                 | `skill_narrative`                            | `Skill`               | `Skill-RELATED_TO->Skill`                                                           |
| `career/certifications.json`        | `certifications`         | `certification`                              | `Certification`       | `Person-EARNED->Certification`                                                      |
| `career/projects.json`              | `projects`               | `project`                                    | `Project`             | `Role-DELIVERED->Project`, `Project-USED_SKILL->Skill`, `Project-ACHIEVED->Outcome` |
| `career/publications.json`          | `publications`           | `publication`                                | `Publication`         | `Person-AUTHORED->Publication`                                                      |
| `career/recommendations.json`       | `recommendations` (new)  | `recommendation`                             | --                    | --                                                                                  |
| `career/honors.json`                | `honors` (new)           | `honor`                                      | `Outcome`             | `Person-ACHIEVED->Outcome`                                                          |
| `career/volunteering.json`          | `volunteering` (new)     | `volunteering`                               | `Role` (volunteer)    | `Person-HELD_ROLE->Role`                                                            |
| `career/courses.json`               | `courses` (new)          | --                                           | --                    | --                                                                                  |
| `career/companies.json`             | `companies` (new)        | `company_profile`                            | `Company`             | `Company-IN_INDUSTRY->Industry`                                                     |
| `brand/identity.json`               | `documents` (metadata)   | `brand_identity`                             | --                    | --                                                                                  |
| `brand/values.json`                 | `documents` (metadata)   | `brand_value`                                | --                    | --                                                                                  |
| `brand/personality.json`            | `documents` (metadata)   | `personality_trait`                          | --                    | --                                                                                  |
| `brand/communication-styles.json`   | `documents` (metadata)   | `communication_style`                        | --                    | --                                                                                  |
| `brand/brand-narratives.json`       | `documents` (metadata)   | `brand_narrative`                            | --                    | --                                                                                  |
| `strategy/job-search.json`          | `documents` (metadata)   | `job_search_config`                          | --                    | --                                                                                  |
| `strategy/career-objectives.json`   | `documents` (metadata)   | `career_objective`                           | --                    | --                                                                                  |
| `strategy/audience-frameworks.json` | `documents` (metadata)   | `audience_framework`                         | --                    | --                                                                                  |
| `strategy/target-market.json`       | `documents` (metadata)   | `target_market`                              | `Company` (targets)   | --                                                                                  |
| `agents/*`                          | `documents` (metadata)   | -- (operational)                             | --                    | --                                                                                  |
| `content/*`                         | `documents` (metadata)   | -- (operational)                             | --                    | --                                                                                  |

---

## Privacy Filter: Explicit Exclusions

### EXCLUDED from pgp entirely:

- `social_profile` section (polyamory, religion, politics, dating data)
- `boundaries` section (used as extraction policy, not stored as data)
- `personal.family.relationship_status` ("polyamorous")
- `personal.family.spouse.description/dynamic` (private details)
- `personal.family.children.ages` (specific child ages)
- `relationships.family.spouse/children/extended_family` details
- `relationships.friendships` details
- `timeline` entries: home invasion/stabbing, marriage, birth of daughters
- `cultural_context.identity_factors` containing "Atheist"/"Liberal"
- `cultural_context.formative_experiences` about home invasion

### INCLUDED with filtering:

- `personal.primary_roles` → only "Technology Professional", "Entrepreneur", "Creator" (exclude "Father", "Husband")
- `goals.objectives_by_category.financial` → generalized (no dollar amounts)
- `goals.objectives_by_category.family` → generalized (no specific details)
- `cultural_context.communities` → all (career-relevant)

---

## Data Transformation Rules

1. **Date normalization:** All dates → `YYYY-MM` format using existing logic from `ingest-linkedin.ts`
2. **Courses flattening:** pgp nested-by-discipline `courses{}` → flat array with `discipline` field
3. **Skills merge:** pgp `professional.skills[]` (flat) + `expertise.technical_skills{}` (categorized) + `expertise.domain_knowledge{}` → unified categorized array, deduplicated
4. **Values merge:** pgp `values.primary[]` + `values.ethical_principles[]` + jfa `personal_brand.core_values[]` → merged with jfa descriptions (richer)
5. **Position highlights:** Split description text on `+` character → `highlights[]` array
6. **Recommendations flattening:** Nested `recommender.{name, company, title}` → flat `recommender_name`, `recommender_company`, `recommender_title`
7. **Privacy filtering:** See privacy rules above, applied during extraction

---

## Deduplication Strategy

LinkedIn CSVs in `data/linkedin/` and pgp knowledge base overlap (pgp was populated from LinkedIn). Strategy:

- **pgp is the enriched source** for knowledge base files (richer descriptions, more fields)
- **LinkedIn CSVs remain the ingest pipeline source** for `data/career-data.json`
- **Knowledge base files supplement** career-data.json with data LinkedIn lacks (brand, personality, strategy)
- **Future pipeline merge priority:** knowledge base value > LinkedIn CSV value (knowledge base is manually curated)

---

## Future: Pipeline Integration (NOT EXECUTED IN THIS PLAN)

When the pipeline is updated under a separate plan, here is how it should consume these files:

### `scripts/ingest-linkedin.ts` changes:

1. After parsing LinkedIn CSVs, load all `data/knowledge/career/*.json` files
2. For each entity type, merge knowledge base records with LinkedIn records:
   - Match by company+title (positions), school+degree (education), name (skills)
   - Knowledge base values take priority over LinkedIn values
3. Output enriched `data/career-data.json`

### `scripts/generate-resume.ts` changes:

1. Load `brand/personality.json`, `brand/values.json`, `brand/communication-styles.json`
2. Load `strategy/job-search.json` for target role context
3. Inject brand voice, personality, and strategy context into the Claude system prompt
4. This replaces the currently hardcoded `SYSTEM_PROMPT` brand guidelines

---

## Execution Order

| Step | Phase | Description                                                                | Dependency                 |
| ---- | ----- | -------------------------------------------------------------------------- | -------------------------- |
| 1    | A     | Infrastructure: .gitignore, directories, types, config                     | None                       |
| 2    | B1-B2 | `career/profile.json` + `career/companies.json`                            | Step 1                     |
| 3    | B3    | `career/positions.json` (largest, most critical)                           | Step 2 (needs company IDs) |
| 4    | B4-B6 | Remaining career files (education, skills, certs, projects, etc.)          | Step 1                     |
| 5    | C     | All brand files (identity, values, personality, communication, narratives) | Step 1                     |
| 6    | D     | All strategy files (job-search, objectives, audiences, target-market)      | Step 1                     |
| 7    | E     | All agent config files (workflow, permissions, definitions, quality)       | Step 1                     |
| 8    | F     | All content files (writing formulas, templates, platform constraints)      | Step 1                     |
| 9    | G     | `_meta/manifest.json`                                                      | Steps 2-8 complete         |

Steps 4-8 are independent and can be parallelized.

---

## Verification

After all files are created:

1. **Schema validation:** Every JSON file must parse without errors. Run `node -e "JSON.parse(require('fs').readFileSync('path'))"` on each file.
2. **Type checking:** Verify each file conforms to its TypeScript interface in `lib/knowledge-types.ts` by writing a simple validation script.
3. **Cross-reference integrity:** All `company_id` references in positions.json must exist in companies.json. All `position_id` references in projects.json must exist in positions.json. All `associated_education_id` in courses.json must exist in education.json.
4. **Privacy audit:** Grep all knowledge base files for excluded terms: "polyamorous", "Atheist", "Liberal", "$60,000", "$1M", "stabbed", "home invasion", specific child ages. Must find zero matches.
5. **Completeness check:** `_meta/manifest.json` must list every JSON file in `data/knowledge/`. Record counts must match actual array lengths.
6. **Content spot-check:** Read `career/positions.json` and verify all 16+ positions are present with correct dates and descriptions.

---

## Critical Files

| File                                                                                                | Action                              |
| --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/home/praeducer/dev/paulprae-com/.gitignore`                                                       | Update glob pattern                 |
| `/home/praeducer/dev/paulprae-com/lib/knowledge-types.ts`                                           | CREATE — all KB interfaces          |
| `/home/praeducer/dev/paulprae-com/lib/config.ts`                                                    | Add KNOWLEDGE_PATHS                 |
| `/home/praeducer/dev/paulprae-com/data/knowledge/**/*.json`                                         | CREATE — 25 knowledge base files    |
| `/home/praeducer/dev/pgp/paul_prae_knowledge_base.json`                                             | READ ONLY — primary data source     |
| `/home/praeducer/dev/job-finding-assistant/inputs/knowledge-bases/job_search_knowledge_base.json`   | READ ONLY — strategy data source    |
| `/home/praeducer/dev/job-finding-assistant/inputs/knowledge-bases/ai_assistants_system_config.json` | READ ONLY — agent config source     |
| `/home/praeducer/dev/job-finding-assistant/AI_assistants/*.md`                                      | READ ONLY — agent definition source |

---

## Summary of Deliverables

- **6 directories** under `data/knowledge/` (career, brand, strategy, agents, content, \_meta)
- **25 JSON files** total across all directories
- **1 TypeScript interface file** (`lib/knowledge-types.ts`)
- **2 config updates** (`.gitignore`, `lib/config.ts`)
- Data extracted from **2 source repos** (pgp, job-finding-assistant)
- Privacy-filtered with **explicit exclusion rules**
- Every file designed for **trivial PostgreSQL upload** and **vector embedding generation**
- Cross-reference IDs ready for **Neo4j graph ingestion**
