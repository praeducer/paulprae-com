# Approved Content (Lean)

This directory is intentionally simple for a one-person, part-time workflow.

Use it to store approved files you want to curate and ingest next.

## Current structure

```text
data/generated/approved-content/
├── README.md
├── INDEX.md
└── artifacts/
    ├── resumes/
    ├── case-studies/
    └── recruiter-qa/
```

## Rules

- Keep the tree flat. Avoid deep nesting unless there is a clear operational need.
- Only store approved, recruiter-safe, public-safe content.
- Keep original filenames unless normalization is useful for search.
- Add new entries to `INDEX.md` when files are added or replaced.

## Naming guidance

- Resumes: `Paul-Prae-Resume-YYYYMMDD.<ext>`
- Recruiter clarifications: `faq-<topic>-<yyyy-mm>.md`
- Case studies: keep human-readable source filenames

## Deferred on purpose

The previous `datasets/`, `few-shot/`, and `metadata/` scaffolding was removed to reduce maintenance overhead. Add those back later only when automated eval workflows are actually active.
