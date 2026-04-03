# Chat Response Examples

Example outputs from the AI chat assistant at [paulprae.com](https://paulprae.com).

These were generated using the `generate_tailored_resume` tool — triggered by clicking the "Tailored resume" chip in the chat and pasting a job description. They show the range and quality of the AI's tailoring capability across different role types and emphasis strategies.

## Tailored Resume Examples

| File                                                                                                                                   | Role                      | Company        | Emphasis                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| [`tailored-resume-acentra-health-mgr-ai-solutions.md`](tailored-resume-acentra-health-mgr-ai-solutions.md)                             | Manager of AI Solutions   | Acentra Health | Healthcare AI governance, HIPAA, cross-functional delivery                          |
| [`tailored-resume-acentra-health-mgr-ai-solutions-trust-variant.md`](tailored-resume-acentra-health-mgr-ai-solutions-trust-variant.md) | Manager of AI Solutions   | Acentra Health | Trust & Ethics Signals section — non-standard consolidation of credibility evidence |
| [`tailored-resume-autonomize-ai-sr-solutions-engineer.md`](tailored-resume-autonomize-ai-sr-solutions-engineer.md)                     | Senior Solutions Engineer | Autonomize AI  | Agentic workflows, payer/provider healthcare, pre-sales engineering                 |

## How to Reproduce

1. Open [paulprae.com](https://paulprae.com)
2. Click the **Tailored resume** quick action chip
3. Paste a job description and send
4. The `generate_tailored_resume` tool runs (~8–15s) and streams the result

For CLI-based tailoring (full 2-page resume, not chat bubble), use:

```bash
npm run tailored -- --jd "path/to/jd.txt"
```

See [`scripts/generate-tailored-resume.ts`](../../scripts/generate-tailored-resume.ts) for the pipeline version.

## What These Demonstrate

- **Grounding rules** — every claim traces to a specific company, role, and date in `career-data.json`. No hallucinated metrics or fabricated employers.
- **Format adaptation** — chat bubble output is constrained to ~500 words (3 positions, compact skills line). The CLI pipeline produces a full 2-page resume.
- **Role-specific emphasis** — the AI selects different positions and highlights different skills depending on the JD. Compare the Acentra Health v1 (Slalom for consulting delivery) vs Autonomize AI (AWS for pre-sales engineering).
- **Trust variant** — the second Acentra Health response demonstrates a non-standard "Trust & Ethics Signals" section that consolidates credibility evidence normally buried across roles.
