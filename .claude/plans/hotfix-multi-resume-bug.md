# Hotfix Plan: Multiple Tailored Resumes in One Session

**Status:** Investigating — do NOT touch main until repro confirmed.
**Branch to use:** `fix/multi-resume-tool-call` (create fresh from main)

---

## Bug

Generating more than one tailored resume in the same chat session without refreshing fails after the first one.

---

## What I Ruled Out (pre-sleep analysis)

All of these are confirmed correct via Node simulation:

| Check                                                 | Result                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `convertToModelMessages` with `step-start` parts      | Correctly splits tool-call and text into separate model messages |
| `pruneMessages({ toolCalls: "before-last-message" })` | Cleanly removes tool history, no empty content arrays            |
| `stepCountIs(2)` scope                                | Counts per-request steps only, not historical                    |
| Message length / body size limits                     | Well within bounds for 2–3 turns                                 |
| Rate limit (20 req/60s)                               | Not hit by 2 consecutive resume requests                         |

---

## Remaining Suspects (need live repro to confirm)

### Suspect 1 — Empty content array after prune (low probability but catastrophic if true)

If the real UIMessage from `useChat` after a tool-calling session differs from the simulation format (e.g., no `step-start` parts, or a different part schema), `pruneMessages` could leave an assistant message with `content: []`. Anthropic rejects this with a 400.

**How to confirm:** Open DevTools → Network → second `/api/chat` request → look at the response status and body.

**Fix (defensive — add regardless):**

```typescript
// In route.ts, after pruneMessages:
const modelMessages = pruneMessages({ ... }).filter(m => m.content.length > 0);
```

### Suspect 2 — Claude doesn't re-invoke the tool (most likely)

After the first resume, the pruned history shows a text message with the previous tailored resume. Claude may decide the request is already satisfied and respond with text rather than calling `generate_tailored_resume` again. This is a behavioral failure, not a code error — the response would appear to work but give a text answer instead of a new resume.

**How to confirm:** Check if the second response:

- Shows thinking dots for 8–15s (tool invoking) → tool IS called, fail is elsewhere
- Shows thinking dots for <3s and responds immediately → tool NOT called, this is the suspect

**Fix:** Update `lib/prompts/career-chat.system.md` to explicitly instruct tool re-invocation:

Current line:

```
- **Tailored resume presentation:** When the `generate_tailored_resume` tool returns a result, present the tailored resume formatted as markdown...
```

Add after it:

```
- **Multiple tailored resumes:** If a user provides a second (or third) job description in the same conversation, call `generate_tailored_resume` again with the new JD. Each JD warrants its own fresh tool call — do not reuse or summarize the previous tailored resume.
```

Then run `npm run build:prompts` to regenerate `lib/generated/system-prompts.ts`.

### Suspect 3 — `@assistant-ui/react-ai-sdk` message state corruption

If `getVercelAIMessages` (used in `setMessages`) converts `ThreadMessage` back to `UIMessage` in a way that loses the `step-start` separators or tool part metadata, subsequent requests would send a malformed message history.

**How to confirm:** Open DevTools → Network → second `/api/chat` request → check the `messages` array in the request body. Specifically:

- Does the assistant message from turn 1 have `step-start` parts?
- Does it have a `tool-generate_tailored_resume` part with `state: "output-available"`?
- Does it have a `text` part?

If the message only has the text part (no tool parts), the history is clean and suspects 1 and 3 are ruled out.

---

## Morning Sequence

**Step 1 — Reproduce** (5 min)

1. Open https://paulprae.com
2. Click "Tailored resume" chip → paste any job description → send
3. Wait for first resume to appear
4. In the composer, type: `Please tailor my resume for this role: [paste a different JD]` → send
5. Observe: does the thinking indicator show for 8–15s? Does a new resume appear?

**Step 2 — Capture** (2 min)
Open DevTools → Network → filter `/api/chat` → look at:

- Request body of the SECOND request: check `messages` array structure
- Response status of the SECOND request: is it 200, 400, 500?

**Step 3 — Fix** (based on findings)

**If response is 200 but no tool call** → Suspect 2. Fix the system prompt.
**If response is 400/500** → Suspect 1. Add the `.filter(m => m.content.length > 0)` defensive guard.
**If messages are malformed in request body** → Suspect 3. Investigate `getVercelAIMessages`.

**Step 4 — Regardless of findings, add the defensive guard** — it costs nothing:

File: `app/api/chat/route.ts`, line ~318:

```typescript
const rawModelMessages = await convertToModelMessages(messages);
const modelMessages = pruneMessages({
  messages: rawModelMessages,
  toolCalls: "before-last-message",
  reasoning: "before-last-message",
}).filter((m) => m.content.length > 0); // guard against empty messages after pruning
```

**Step 5 — If system prompt fix needed** (`lib/prompts/career-chat.system.md`):
After updating, run:

```bash
npm run build:prompts
npm test
```

**Step 6 — Deploy**

```bash
git checkout -b fix/multi-resume-tool-call main
# make changes
git commit -m "fix: allow multiple tailored resume tool calls in one session"
gh pr create ...
```

---

## Also-do in the morning (quick)

- Merge PR #29 once CI is green → https://github.com/praeducer/paulprae-com/pull/29
- Cache health check → send two chat messages at paulprae.com, check Vercel logs
- Cron warmup → get CRON_SECRET from https://vercel.com/praeducers-projects/paulprae-com/settings/environment-variables
