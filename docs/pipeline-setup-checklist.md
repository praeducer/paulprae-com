# Pipeline Setup Checklist

> **Purpose:** Step-by-step checklist for setting up and running the paulprae.com resume generation pipeline on a fresh machine. Covers data acquisition, API authentication, and first pipeline run.
>
> **Last updated:** 2026-02-28
> **Estimated time:** 15-20 minutes (plus LinkedIn data export wait time)

---

## Prerequisites

Before starting, ensure you have:
- Node.js 20+ installed ([nodejs.org](https://nodejs.org/en/download/) or via nvm)
- Git configured and this repo cloned
- A terminal in the project root directory

If running from WSL with Claude Code, all `npm` commands should be run via:
```bash
wsl bash -lc "source ~/.nvm/nvm.sh && cd /home/praeducer/dev/paulprae-com && <command>"
```

---

## Checklist

### 1. Install Node.js Dependencies

```bash
npm install
```

This installs all packages from `package.json` including the Anthropic SDK, PapaParse, Zod, and tsx.

---

### 2. Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **Settings > API Keys**: [direct link](https://console.anthropic.com/settings/keys)
4. Click **Create Key**, name it something like `paulprae-com-pipeline`
5. Copy the key (starts with `sk-ant-...`)

> **Billing:** The pipeline uses Claude Opus 4.6 with max effort. A single resume generation costs approximately $0.50-$2.00 in API credits depending on thinking depth. Ensure your account has credits: [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing)

---

### 3. Create `.env.local` (Secure API Key Storage)

Create the file in the project root:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and replace `your_key_here` with your actual API key:

```
ANTHROPIC_API_KEY=sk-ant-api03-...your-actual-key...
```

**Security notes:**
- `.env.local` is in `.gitignore` — it will **never** be committed to git
- Do not share this key or paste it in chat/issues/PRs
- Store a backup in a password manager (1Password, Bitwarden, etc.)
- If compromised, immediately rotate at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- The key is only used by local build scripts (`scripts/generate-resume.ts`), never exposed in the deployed site

---

### 4. Export Your LinkedIn Data

1. Go to [linkedin.com/mypreferences/d/download-my-data](https://www.linkedin.com/mypreferences/d/download-my-data)
2. Select **"Download larger data archive"** (the smaller export doesn't include full position descriptions)
3. Click **Request archive**
4. Wait for LinkedIn's email (usually 10 minutes to 24 hours)
5. Download and unzip the archive

---

### 5. Place LinkedIn CSV Files

Copy the CSV files from your LinkedIn export into:

```
data/sources/linkedin/
```

The pipeline recognizes these files (case-insensitive):

| File | Required? | What it contains |
|------|-----------|-----------------|
| `Positions.csv` | **Required** | Work experience |
| `Education.csv` | Recommended | Degrees, schools |
| `Skills.csv` | Recommended | LinkedIn skill endorsements |
| `Profile.csv` | Recommended | Name, headline, summary |
| `Email Addresses.csv` | Recommended | Contact email |
| `Certifications.csv` | Optional | Professional certifications |
| `Projects.csv` | Optional | Project portfolio |
| `Publications.csv` | Optional | Published works |
| `Languages.csv` | Optional | Language proficiencies |
| `Recommendations_Received.csv` | Optional | Peer recommendations |
| `Honors.csv` | Optional | Awards, honors |
| `Volunteering.csv` | Optional | Volunteer experience |
| `Courses.csv` | Optional | Course completions |

At minimum, you need `Positions.csv` or `Education.csv` for the pipeline to succeed.

**Security note:** LinkedIn CSVs are `.gitignore`d and will not be committed to git. They stay local to your machine.

---

### 6. Install Export Dependencies (Optional — for PDF/DOCX)

If you want PDF and DOCX exports (not just the web resume), install:

**On Windows (PowerShell):**
```powershell
winget install --id JohnMacFarlane.Pandoc --exact
winget install --id Typst.Typst --exact
```

**On Ubuntu/WSL:**
```bash
sudo apt-get install -y pandoc
# Typst: install via cargo or download binary
cargo install typst-cli
# OR download from https://github.com/typst/typst/releases
```

**On macOS:**
```bash
brew install pandoc typst
```

Verify installation:
```bash
pandoc --version
typst --version
```

> Skip this step if you only need the web resume. The pipeline will warn but not fail if Pandoc/Typst are missing (only the export step will be skipped).

---

### 7. Run the Pipeline

**Full pipeline (ingest → generate → export → build):**
```bash
npm run pipeline
```

**Or run steps individually:**
```bash
npm run ingest      # Parse LinkedIn CSVs + knowledge base → career-data.json
npm run generate    # Call Claude API → resume.md
npm run export      # Convert to PDF + DOCX (requires pandoc + typst)
npm run build       # Build static site → out/
```

**Expected output:**
- `data/generated/career-data.json` — Structured career data (committed to git)
- `data/generated/resume.md` — AI-generated resume (committed to git)
- `data/generated/resume.pdf` — PDF resume (gitignored)
- `data/generated/resume.docx` — DOCX resume (gitignored)
- `out/` — Static website (gitignored, deployed via Vercel)

---

### 8. Preview Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your resume.

---

## Repeating on a Fresh Machine

1. Clone the repo: `git clone https://github.com/praeducer/paulprae-com.git`
2. `npm install`
3. Copy `.env.local` from your password manager (or create new key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys))
4. Place LinkedIn CSVs in `data/sources/linkedin/` (re-export if needed from [LinkedIn](https://www.linkedin.com/mypreferences/d/download-my-data))
5. Install pandoc + typst (see step 6)
6. `npm run pipeline`

The knowledge base (`data/sources/knowledge/`) is committed to git, so it transfers automatically with the repo.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `tsx not found` | Run `npm install` first, or use `npx tsx` |
| `ANTHROPIC_API_KEY not found` | Create `.env.local` per step 3 |
| `No CSV files found` | Place LinkedIn CSVs in `data/sources/linkedin/` per step 5 |
| `API Error: 401` | Check your API key in `.env.local` |
| `API Error: 429` | Rate limited — wait 60 seconds and retry |
| `pandoc not found` | Install per step 6, or skip export step |
| UNC path / CMD.EXE errors | Run via WSL: `wsl bash -lc "source ~/.nvm/nvm.sh && cd /home/praeducer/dev/paulprae-com && npm run pipeline"` |
