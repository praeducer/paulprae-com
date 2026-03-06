# UX Improvement Plan — paulprae.com Chat Interface

**Goal:** Earn the trust of recruiters, hiring managers, and deep technical experts that Paul is a strong fit for Principal/Staff/Senior Manager engineering and architecture roles.

**Branch:** `feat/phase2-implementation`
**Scope:** Chat UI, system prompts, color system, typography, spacing, interaction patterns

---

## 1. Header Redesign

**Problem:** "paulprae.com" as the header text looks like a URL, not a professional identity. It undermines the authority needed for principal-level positioning.

**Screenshot evidence:** The header shows "paulprae.com" in bold with "View Resume" and "PDF" links to the right. The resume page already uses "Paul Prae" as the header with the headline beside it — the chat page should be consistent.

### Changes

| File                              | Change                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/ChatHome.tsx:191` | Replace `paulprae.com` with `Paul Prae`                                                                                                  |
| `app/components/ChatHome.tsx:191` | Add subtitle line: `Principal AI Engineer & Solutions Architect` in muted text below the name (visible on sm+ screens, hidden on mobile) |
| `app/components/ChatHome.tsx`     | Match the resume page header pattern: name left-aligned, subtitle beside it on desktop                                                   |

**Design decision:** Use the real name (not domain) as the header. This matches LinkedIn, executive portfolio sites, and the resume page's own header. The subtitle reinforces the seniority level immediately. The domain is already in the browser URL bar.

```
Before: paulprae.com                    View Resume -> | PDF
After:  Paul Prae                       View Resume -> | PDF
        Principal AI Engineer & Solutions Architect
```

---

## 2. Color System Overhaul — Trust Palette

**Problem:** Multiple clashing blues in dark mode. The user message bubble background (`bg-blue-600` = `#2563eb`), send button (`bg-blue-600`), subtitle text (`text-blue-600`), and the dark mode page background (`dark:bg-slate-950` = `#020617`) create visual dissonance. The bright blue bubbles look like notification badges, not professional communication.

### Color Psychology for Trust

Research-backed findings for recruiter/hiring contexts:

- **Deep navy/slate blue** conveys competence, stability, authority (LinkedIn, IBM, corporate law firms)
- **Teal/blue-green accents** convey innovation + trustworthiness (Stripe, Vercel, modern tech)
- **Warm neutrals** (slate over pure gray) feel approachable while maintaining authority
- **Avoid saturated primary blue** as the dominant interactive color in dark mode — it reads as "consumer app" not "executive platform"

### New Color Tokens

Define a consistent color system using CSS custom properties in `globals.css`. This replaces scattered Tailwind blue-600 references with a single source of truth.

```css
/* globals.css — add to :root */
:root {
  --brand-primary: #1e40af; /* blue-800: deep navy — headers, primary actions */
  --brand-accent: #3b82f6; /* blue-500: accessible links and accents on light bg */
  --user-bubble: #1e3a5f; /* custom deep navy — user message background (dark) */
  --user-bubble-light: #1e40af; /* blue-800 — user message background (light) */
  --focus-ring: #60a5fa; /* blue-400: visible on both light and dark */
}

@media (prefers-color-scheme: dark) {
  :root {
    --user-bubble: #1e3a5f; /* muted navy, not electric blue */
    --brand-accent: #93c5fd; /* blue-300: passes WCAG AA on dark backgrounds */
  }
}
```

### Specific Component Changes

| Component                      | Current                            | New                                  | Rationale                                                                                                                       |
| ------------------------------ | ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| User message bubble            | `bg-blue-600` (#2563eb)            | `bg-blue-700` (#1d4ed8)              | Deeper blue — 6.0:1 contrast (AA+), professional, distinct from dark bg. Research: Stripe navy pattern, LinkedIn blue authority |
| User message bubble (dark)     | same                               | `dark:bg-blue-800` (#1e40af)         | Even deeper in dark mode — 8.0:1 contrast (AAA), blends with slate-950 without clashing                                         |
| User message text              | `text-white`                       | `text-white`                         | Keep — passes WCAG AAA on blue-700 and blue-800                                                                                 |
| Send button                    | `bg-blue-600`                      | `bg-blue-700` (#1d4ed8)              | Matches user bubble — cohesive interactive color                                                                                |
| Send button hover              | `bg-blue-700`                      | `bg-blue-600` (#2563eb)              | Hover lightens (reveal pattern)                                                                                                 |
| Subtitle "Principal AI..."     | `text-blue-600 dark:text-blue-400` | `text-slate-500 dark:text-slate-400` | Muted — subtitle shouldn't compete with header                                                                                  |
| Focus rings                    | `ring-blue-500`                    | `ring-blue-400`                      | Better visibility on dark backgrounds                                                                                           |
| Quick action chip hover border | `hover:border-slate-300`           | Keep                                 | Neutral is correct for chips                                                                                                    |

### Accessibility Verification

All new color combinations must pass WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text):

- White text on `#1e40af` (blue-800): contrast ratio ~8.5:1 (AAA pass)
- White text on `#1e3a8a` (blue-900): contrast ratio ~10.2:1 (AAA pass)
- `#93c5fd` (blue-300) on `#020617` (slate-950): contrast ratio ~9.8:1 (AAA pass)

---

## 3. Response Density & Spacing

**Problem:** The AI response text is crowded — wall-of-text with no breathing room. The screenshot shows 9+ numbered items with dense paragraphs, bold text, and category headers, all crammed into a single response bubble.

### Typography & Spacing Changes

| Element                        | Current                | New                                                        | Rationale                                              |
| ------------------------------ | ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Assistant bubble padding       | `px-4 py-2.5`          | `px-5 py-4`                                                | More breathing room — matches professional chat tools  |
| Assistant bubble max-width     | `max-w-[85%]`          | `max-w-[80%]`                                              | Slightly narrower — easier line length for readability |
| User bubble padding            | `px-4 py-2.5`          | `px-4 py-3`                                                | Slight vertical increase for balance                   |
| Message gap (between messages) | Implicit (flex column) | Add `gap-5` to messages container                          | Consistent vertical rhythm                             |
| Prose inside assistant bubble  | No prose styling       | Add `prose prose-sm prose-slate dark:prose-invert` wrapper | Typography plugin handles headings, lists, spacing     |
| Line height in bubbles         | Default `text-sm`      | `text-sm leading-relaxed`                                  | 1.625 line height for readability                      |

### Markdown Rendering in Bubbles

The `MarkdownTextPrimitive` already renders markdown, but the bubble needs prose styling to space it properly:

```tsx
// ChatHome.tsx — AssistantMessage bubble inner div
<div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-900
  prose prose-sm prose-slate max-w-none
  prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
  prose-p:my-2 prose-ul:my-2 prose-li:my-0.5
  dark:bg-slate-800 dark:text-slate-100 dark:prose-invert">
```

---

## 4. Response Conciseness — System Prompt Updates

**Problem:** The AI generates exhaustive lists (9+ products, 60+ cover letter variants) instead of curated, high-quality responses. Recruiters want the highlight reel, not the encyclopedia.

### Career Chat Prompt Changes (`lib/prompts/career-chat.system.md`)

Add/modify these guidelines in the Response Guidelines section:

```markdown
# Response Length & Format

- **Default to concise, curated responses.** Show the top 3-5 most relevant items unless the user explicitly asks for more.
- **Lead with the strongest examples.** Rank by recency, impact, and relevance to the user's question. Prefer roles at AWS, Microsoft, Arine, and Slalom over earlier career positions.
- **Use bullet points for lists, not numbered paragraphs.** Each item should be 1-2 sentences max in an initial response.
- **Offer to elaborate.** After a concise answer, add: "Would you like me to go deeper on any of these?" or "I can provide more detail on any of these."
- **Maximum initial response:** 200-300 words for overview questions, 400-500 words for deep dives.
- **Never list more than 5 items** in an initial response unless the user explicitly asks for "all" or specifies a number.
```

Modify G7 (existing) to be more explicit:

```markdown
- **G7: Keep answers concise and curated.** Show the top 3-5 most impactful examples ranked by recency and relevance. Expand with detail only when asked to elaborate. Never dump a complete list when a best-of selection serves the user better.
```

### Job Tools Prompt Changes (`lib/prompts/job-tools.system.md`)

Add a critical new rule at the top of the Content Type Instructions section:

```markdown
# Output Rules

- **Generate exactly ONE version** of any content (cover letter, email, pitch, etc.) unless the user explicitly asks for multiple variants or options.
- **Never generate more than 3 variants** even if asked for "options" — quality over quantity.
- **If the user wants revisions**, iterate on the single version rather than producing new ones from scratch.
```

### `maxOutputTokens` Tuning

| Mode                     | Current | New  | Rationale                                      |
| ------------------------ | ------- | ---- | ---------------------------------------------- |
| Chat (streaming)         | 4096    | 2048 | Recruiter Q&A shouldn't need 3000+ words       |
| Tools (streaming)        | 4096    | 2048 | One cover letter is ~400 words = ~550 tokens   |
| Resume generation (tool) | 4096    | 4096 | Keep — resume generation needs the full budget |

Change in `route.ts` line 361:

```typescript
maxOutputTokens: validMode === "chat" ? 2048 : 2048,
```

(Resume tool-calling `generateText` at line 305 keeps its own `maxOutputTokens: 4096`.)

---

## 5. Tooltip & Interaction Feedback

**Problem:** Copy and Regenerate icons below assistant messages have no tooltips. Users don't know what the refresh icon does and are afraid to click it.

### Changes

| Element           | Change                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| Copy button       | Add `title="Copy to clipboard"` attribute                                    |
| Regenerate button | Add `title="Regenerate response"` attribute                                  |
| Both buttons      | Increase hit target: add `min-h-[32px] min-w-[32px]` for touch accessibility |

```tsx
// ChatHome.tsx — ActionBarPrimitive.Copy
<button
  type="button"
  title="Copy to clipboard"
  className="rounded-md p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center ..."
  aria-label="Copy message"
>

// ChatBarPrimitive.Reload
<button
  type="button"
  title="Regenerate response"
  className="rounded-md p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center ..."
  aria-label="Regenerate response"
>
```

---

## 6. Welcome State & Professional Positioning

**Problem:** The welcome hero works but could be stronger for executive positioning.

### Changes

| Element            | Current                                       | New                                                                              |
| ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| Subtitle           | "Principal AI Engineer & Solutions Architect" | Keep (moves to header too)                                                       |
| Description        | Long paragraph                                | Tighten to 2 lines max                                                           |
| Quick action chips | 5 generic actions                             | Rewrite for recruiter-specific language                                          |
| CTA hint           | "Ask about Paul's experience..."              | "Ask about Paul's experience, or paste a job description for a tailored resume." |

### Quick Action Chip Rewrites

```typescript
const CHAT_ACTIONS = [
  { label: "Quick overview", prompt: "Give me a 3-sentence overview of Paul's background." },
  {
    label: "Core expertise",
    prompt: "What are Paul's top 3 technical strengths with specific examples?",
  },
  { label: "Recent work", prompt: "What has Paul built most recently at Arine?" },
  {
    label: "Tailored resume",
    prompt: "I'd like a tailored version of Paul's resume. I'll share the job description.",
  },
  { label: "Download resume", prompt: "Where can I download Paul's resume?" },
];
```

The key change: prompts now include implicit constraints ("3-sentence", "top 3", "most recently") that guide concise responses.

---

## 7. Cover Letter / Tools Mode Guard

**Problem:** The tools page can generate 60+ cover letter variants in a single response.

### Root Cause

The tools mode uses no function-calling tools — it's pure text streaming. The model interprets "generate a cover letter" loosely and may produce multiple variants, especially when the system prompt's writing formulas provide many templates.

### Fix (multi-layered)

1. **System prompt rule** (see Section 4): "Generate exactly ONE version"
2. **Reduce `maxOutputTokens`** for tools mode to 2048 (see Section 4)
3. **Add `stopWhen: stepCountIs(1)`** — already set, but verify it's working
4. **Temperature reduction**: Lower from 0.7 to 0.5 for tools mode (less creative variation)

```typescript
temperature: validMode === "tools" ? 0.5 : 0.7,
```

---

## 8. Dark Mode Consistency

**Problem:** Multiple blue tones clash in dark mode. The assistant bubble (`bg-slate-800`), user bubble (`bg-blue-600`), and page background (`bg-slate-950`) create three distinct tonal layers that don't harmonize.

### Changes

- User bubble: `bg-blue-600` -> `bg-blue-900 dark:bg-blue-900` (deep navy blends with dark theme)
- Assistant bubble: `bg-slate-100 dark:bg-slate-800` -> `bg-slate-100 dark:bg-slate-800/80` (slightly transparent for depth)
- Quick action chips dark border: `dark:border-slate-700` -> `dark:border-slate-700/60` (softer edge)
- Header border: Already using `/60` opacity — consistent

---

## 9. Message Container Spacing

**Problem:** Messages stack too tightly. No visual breathing room between conversation turns.

### Changes

Add explicit gap to the `ThreadPrimitive.Messages` wrapper:

```tsx
// ChatHome.tsx — wrap messages in a container with vertical spacing
<div className="space-y-5">
  <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
</div>
```

If `ThreadPrimitive.Messages` doesn't support a wrapper div, add margin to each message root:

```tsx
// UserMessage
<MessagePrimitive.Root className="flex justify-end mb-5">

// AssistantMessage
<MessagePrimitive.Root className="flex justify-start group mb-5">
```

---

## 10. Composer Placeholder Text

**Problem:** "Ask about Paul's experience..." is generic. For a recruiter-facing tool, the placeholder should hint at the tool's unique value.

### Change

```
Before: "Ask about Paul's experience..."
After:  "Ask about Paul's experience, or paste a job description..."
```

This immediately signals the tailored resume feature — the highest-value interaction for recruiters.

---

## Implementation Order

Execute in this order to minimize risk and maximize impact:

| Priority | Item                                    | Effort | Impact                                         |
| -------- | --------------------------------------- | ------ | ---------------------------------------------- |
| P0       | System prompt conciseness rules (Sec 4) | 15 min | Critical — fixes wall-of-text and 60+ variants |
| P0       | maxOutputTokens reduction (Sec 4)       | 2 min  | Critical — hard limit on response length       |
| P1       | Header redesign (Sec 1)                 | 10 min | High — first thing users see                   |
| P1       | Color system overhaul (Sec 2)           | 20 min | High — fixes dark mode clash                   |
| P1       | Tooltip on action buttons (Sec 5)       | 5 min  | High — removes user confusion                  |
| P2       | Response spacing & prose (Sec 3)        | 15 min | Medium — readability                           |
| P2       | Message container spacing (Sec 9)       | 5 min  | Medium — breathing room                        |
| P2       | Quick action rewrites (Sec 6)           | 10 min | Medium — guides concise responses              |
| P3       | Dark mode refinements (Sec 8)           | 10 min | Low — polish                                   |
| P3       | Composer placeholder (Sec 10)           | 2 min  | Low — polish                                   |

**Total estimated file changes:** 4 files (ChatHome.tsx, globals.css, career-chat.system.md, job-tools.system.md, route.ts)

---

## Files to Modify

| File                                | Sections                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `app/components/ChatHome.tsx`       | Header, UserMessage, AssistantMessage, ChatComposer, QuickActions import |
| `app/components/QuickActions.tsx`   | CHAT_ACTIONS prompts                                                     |
| `app/globals.css`                   | CSS custom properties for brand colors                                   |
| `lib/prompts/career-chat.system.md` | G7 update, new Response Length section                                   |
| `lib/prompts/job-tools.system.md`   | New Output Rules section                                                 |
| `app/api/chat/route.ts`             | maxOutputTokens, temperature per mode                                    |

## Files NOT to Modify

- `app/layout.tsx` — no changes needed
- `app/resume/page.tsx` — already well-designed, serves as the design reference
- `proxy.ts` — no UX relevance
- `vercel.json` — no UX relevance
