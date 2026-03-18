# AI Reference Library

This is a curated, platform-agnostic document library for AI assistants and LLM workflows.

Primary consumers include stakeholders across recruiting and delivery: recruiters, hiring managers, peers, colleagues, and startup collaborators.

## Current structure

```text
data/generated/reference-library/
├── README.md
├── INDEX.md
├── resumes/
├── case-studies/
└── stakeholder-qa/
```

## Operating rules

- Keep this tree flat and easy to scan.
- Store only approved, public-safe, stakeholder-safe documents.
- Keep filenames human-readable and stable for retrieval.
- Update `INDEX.md` every time files are added, removed, or replaced.
- Ignore Windows `:Zone.Identifier` artifacts.

## Naming guidance

- Resumes: `Paul-Prae-Resume-YYYYMMDD.<ext>`
- Stakeholder Q/A: `faq-<topic>-<yyyy-mm>.md`
- Case studies: preserve descriptive source filenames

## LLM/platform compatibility

This library is designed to be ingestion-ready for:

- Anthropic Claude
- AWS Bedrock
- Google Gemini / Vertex AI

Each document should stand alone, include clear context, and avoid private data.
