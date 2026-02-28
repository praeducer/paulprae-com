// resume-pdf.typ — Typst stylesheet for PDF resume export
//
// This stylesheet controls visual presentation (fonts, margins, heading
// hierarchy, colors) when the Markdown resume is compiled to PDF.
// Pandoc generates Typst markup from resume.md, this file is prepended
// to style it, then Typst compiles the result to PDF.
//
// Co-located with export-resume.ts which invokes it.
// To change resume CONTENT or STRUCTURE, edit scripts/generate-resume.ts.
// To change PDF VISUAL STYLE, edit this file.

// ─── Page Setup ──────────────────────────────────────────────────────────────

#set page(
  paper: "us-letter",
  margin: (top: 0.5in, bottom: 0.5in, left: 0.6in, right: 0.6in),
)

// ─── Typography ──────────────────────────────────────────────────────────────

#set text(
  font: ("Inter", "Helvetica Neue", "Arial", "sans-serif"),
  size: 10pt,
  fill: rgb("#1a1a1a"),
  lang: "en",
)

#set par(
  leading: 0.6em,
  justify: false,
)

// ─── Headings ────────────────────────────────────────────────────────────────

// H1 — Candidate name (large, bold)
#show heading.where(level: 1): it => {
  set text(size: 22pt, weight: "bold", fill: rgb("#111111"))
  set block(above: 0.3em, below: 0.2em)
  it
}

// H2 — Section headers (e.g., Professional Experience, Education)
#show heading.where(level: 2): it => {
  set text(size: 12pt, weight: "bold", fill: rgb("#111111"), tracking: 0.03em)
  set block(above: 0.8em, below: 0.3em)
  block(
    width: 100%,
    {
      upper(it.body)
      v(2pt)
      line(length: 100%, stroke: 0.5pt + rgb("#cccccc"))
    }
  )
}

// H3 — Job titles, degree names
#show heading.where(level: 3): it => {
  set text(size: 10.5pt, weight: "bold", fill: rgb("#222222"))
  set block(above: 0.6em, below: 0.15em)
  it
}

// ─── Horizontal Rules ────────────────────────────────────────────────────────
// Pandoc converts --- to #horizontalrule in Typst output.
// We suppress them since H2 headings already have their own underline.
// Using a custom command avoids interfering with line() elements in headings.

#let horizontalrule = v(0.3em)

// ─── Lists ───────────────────────────────────────────────────────────────────

#set list(
  indent: 0.3em,
  body-indent: 0.5em,
  marker: [•],
)

// ─── Links ───────────────────────────────────────────────────────────────────

#show link: it => {
  set text(fill: rgb("#2563eb"))
  it
}

// ─── Strong/Bold Text ────────────────────────────────────────────────────────
// Company names and dates appear as **bold** in the markdown

#show strong: it => {
  set text(weight: "bold", fill: rgb("#222222"))
  it
}

// ─── Block Quotes ────────────────────────────────────────────────────────────
// Not typically used in resumes, but style defensively

#show quote: it => {
  set text(style: "italic", fill: rgb("#555555"))
  it
}

// ─── Page Break Avoidance ────────────────────────────────────────────────────
// Prevent orphaned headings (heading at bottom of page, content on next)

#show heading: set block(breakable: false)
