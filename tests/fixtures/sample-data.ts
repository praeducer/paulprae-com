/**
 * Test fixtures — reusable sample data for the pipeline test suite.
 *
 * Design decisions:
 * - Minimal but realistic: enough fields to exercise normalizers, not so many
 *   that tests are noisy. Each fixture covers the happy path + 1-2 edge cases.
 * - Typed to match LinkedIn CSV interfaces exactly (PapaParse returns these).
 * - CareerData fixture is a valid, Zod-passing object for integration tests.
 */

import { stripHtmlComments } from "../../lib/markdown.js";
import type {
  CareerData,
  KnowledgeEntry,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInSkill,
  LinkedInCertification,
  LinkedInProject,
  LinkedInPublication,
  LinkedInProfile,
  LinkedInEmail,
  LinkedInLanguage,
  LinkedInRecommendation,
  LinkedInHonor,
  LinkedInVolunteering,
  LinkedInCourse,
} from "../../lib/types.js";

// ─── LinkedIn CSV Row Fixtures ──────────────────────────────────────────────

export const SAMPLE_POSITIONS: LinkedInPosition[] = [
  {
    "Company Name": "Acme AI Corp",
    Title: "Principal AI Engineer",
    Description: "Led AI platform development for enterprise clients.",
    Location: "San Francisco, CA",
    "Started On": "Jan 2023",
    "Finished On": "",
  },
  {
    "Company Name": "DataCo",
    Title: "Senior ML Engineer",
    Description: "Built and deployed ML pipelines at scale.",
    Location: "Austin, TX",
    "Started On": "Mar 2020",
    "Finished On": "Dec 2022",
  },
  // Edge case: empty entry that should be filtered
  {
    "Company Name": "",
    Title: "",
    Description: "",
    Location: "",
    "Started On": "",
    "Finished On": "",
  },
];

export const SAMPLE_EDUCATION: LinkedInEducation[] = [
  {
    "School Name": "Georgia Institute of Technology",
    "Degree Name": "Bachelor of Science",
    Notes: "Computer Science",
    "Started On": "2012",
    "Finished On": "2016",
    Activities: "ACM, Hackathon Club",
  },
];

export const SAMPLE_SKILLS: LinkedInSkill[] = [
  { Name: "Python" },
  { Name: "TypeScript" },
  { Name: "Machine Learning" },
  { Name: "" }, // Edge case: empty skill should be filtered
  { Name: "  AWS  " }, // Edge case: whitespace should be trimmed
];

export const SAMPLE_CERTIFICATIONS: LinkedInCertification[] = [
  {
    Name: "AWS Solutions Architect",
    Url: "https://aws.amazon.com/cert",
    Authority: "Amazon Web Services",
    "Started On": "Jun 2023",
    "Finished On": "",
    "License Number": "ABC123",
  },
];

export const SAMPLE_PROJECTS: LinkedInProject[] = [
  {
    Title: "AI Resume Generator",
    Description: "Generates resumes from career data using Claude AI.",
    Url: "https://github.com/example/project",
    "Started On": "Jan 2024",
    "Finished On": "",
  },
];

export const SAMPLE_PUBLICATIONS: LinkedInPublication[] = [
  {
    Name: "Scaling AI Pipelines in Healthcare",
    "Published On": "Mar 2022",
    Description: "Technical paper on ML deployment in healthcare settings.",
    Publisher: "IEEE",
    Url: "https://example.com/paper",
  },
];

export const SAMPLE_PROFILE: LinkedInProfile[] = [
  {
    "First Name": "Paul",
    "Last Name": "Prae",
    Headline: "Principal AI Engineer & Architect",
    Summary: "Building AI systems that matter.",
    Industry: "Technology",
    "Geo Location": "Indianapolis, Indiana, United States",
  },
];

export const SAMPLE_EMAILS: LinkedInEmail[] = [
  { "Email Address": "paul@example.com", Confirmed: "Yes", Primary: "Yes" },
  { "Email Address": "alt@example.com", Confirmed: "Yes", Primary: "No" },
  { "Email Address": "unconfirmed@example.com", Confirmed: "No", Primary: "No" },
];

export const SAMPLE_LANGUAGES: LinkedInLanguage[] = [{ Name: "English", Proficiency: "Native" }];

export const SAMPLE_RECOMMENDATIONS: LinkedInRecommendation[] = [
  {
    Recommender: "Jane Doe",
    Text: "Paul is an exceptional engineer and leader.",
    Date: "Jan 2024",
    Status: "VISIBLE",
  },
];

export const SAMPLE_HONORS: LinkedInHonor[] = [
  {
    Title: "Innovation Award",
    Issuer: "Acme Corp",
    "Issued On": "Dec 2023",
    Description: "Recognized for AI platform innovation.",
  },
];

export const SAMPLE_VOLUNTEERING: LinkedInVolunteering[] = [
  {
    Organization: "Code for America",
    Role: "Technical Lead",
    Cause: "Science and Technology",
    "Started On": "Jan 2020",
    "Finished On": "",
    Description: "Led civic tech projects.",
  },
];

export const SAMPLE_COURSES: LinkedInCourse[] = [
  {
    Name: "Deep Learning Specialization",
    Number: "DL-001",
    "Associated With": "Georgia Institute of Technology",
  },
];

// ─── Knowledge Base Fixtures ────────────────────────────────────────────────

export const SAMPLE_KNOWLEDGE_ENTRY: KnowledgeEntry = {
  category: "achievement",
  title: "AI Platform Launch",
  content:
    "Led the launch of an AI platform serving 500+ enterprise clients, reducing inference latency by 40%.",
  tags: ["ai", "leadership", "enterprise"],
  relatedPositions: ["Principal AI Engineer at Acme AI Corp"],
};

export const SAMPLE_KNOWLEDGE_NON_ENTRY = {
  id: "pos-1",
  company_id: "comp-1",
  technologies: ["Python", "PyTorch"],
  sort_order: 1,
};

// ─── Complete CareerData Fixture ────────────────────────────────────────────

export const SAMPLE_CAREER_DATA: CareerData = {
  profile: {
    name: "Paul Prae",
    headline: "Principal AI Engineer & Architect",
    summary: "Building AI systems that matter.",
    location: "Indianapolis, Indiana, United States",
    email: "paul@example.com",
    linkedin: "https://linkedin.com/in/paulprae",
    website: "https://paulprae.com",
  },
  positions: [
    {
      title: "Principal AI Engineer",
      company: "Acme AI Corp",
      location: "San Francisco, CA",
      startDate: "2023-01",
      endDate: null,
      description: "Led AI platform development for enterprise clients.",
      highlights: [],
    },
    {
      title: "Senior ML Engineer",
      company: "DataCo",
      location: "Austin, TX",
      startDate: "2020-03",
      endDate: "2022-12",
      description: "Built and deployed ML pipelines at scale.",
      highlights: [],
    },
  ],
  education: [
    {
      school: "Georgia Institute of Technology",
      degree: "Bachelor of Science",
      field: "",
      startDate: "2012",
      endDate: "2016",
      notes: "Computer Science",
      activities: "ACM, Hackathon Club",
    },
  ],
  skills: ["Python", "TypeScript", "Machine Learning", "AWS"],
  certifications: [
    {
      name: "AWS Solutions Architect",
      authority: "Amazon Web Services",
      date: "2023-06",
      licenseNumber: "ABC123",
      url: "https://aws.amazon.com/cert",
    },
  ],
  projects: [
    {
      title: "AI Resume Generator",
      description: "Generates resumes from career data using Claude AI.",
      url: "https://github.com/example/project",
      startDate: "2024-01",
    },
  ],
  publications: [
    {
      name: "Scaling AI Pipelines in Healthcare",
      publisher: "IEEE",
      date: "2022-03",
      url: "https://example.com/paper",
      description: "Technical paper on ML deployment in healthcare settings.",
    },
  ],
  languages: [{ name: "English", proficiency: "Native" }],
  recommendations: [
    {
      recommender: "Jane Doe",
      text: "Paul is an exceptional engineer and leader.",
      date: "2024-01",
    },
  ],
  honors: [
    {
      title: "Innovation Award",
      issuer: "Acme Corp",
      date: "2023-12",
      description: "Recognized for AI platform innovation.",
    },
  ],
  volunteering: [
    {
      organization: "Code for America",
      role: "Technical Lead",
      cause: "Science and Technology",
      startDate: "2020-01",
      endDate: null,
      description: "Led civic tech projects.",
    },
  ],
  courses: [
    {
      name: "Deep Learning Specialization",
      number: "DL-001",
      associatedWith: "Georgia Institute of Technology",
    },
  ],
  knowledge: [SAMPLE_KNOWLEDGE_ENTRY],
};

// ─── Sample Resume Markdown ─────────────────────────────────────────────────

export const SAMPLE_RESUME_MD = `<!-- This file is GENERATED by the AI pipeline. Do not edit directly. -->
<!-- To regenerate: npm run generate -->
<!-- To modify output: edit scripts/generate-resume.ts -->
<!-- Generated: 2026-02-28T12:00:00.000Z | Model: claude-opus-4-6 | Tokens: 2500 -->

# Paul Prae

**Principal AI Engineer & Architect** | Indianapolis, IN | paul@example.com | linkedin.com/in/paulprae | paulprae.com

---

## Professional Summary

Seasoned AI engineering leader with 10+ years of experience architecting and delivering enterprise-scale AI/ML systems. Deep expertise in healthcare domain (Arine, BCBS, Humana ecosystem) and Fortune 500 delivery track record with AWS, Microsoft, and Slalom. Combines full-stack technical depth across data engineering, ML systems, and cloud infrastructure with strategic leadership to drive measurable business impact.

---

## Professional Experience

### Principal AI Engineer
**Acme AI Corp** | San Francisco, CA | Jan 2023 – Present

- Architected enterprise AI platform serving 500+ clients, reducing inference latency by 40%
- Led team of 8 engineers in designing and deploying production ML pipelines
- Established engineering standards and CI/CD practices for ML model deployment

### Senior ML Engineer
**DataCo** | Austin, TX | Mar 2020 – Dec 2022

- Built and deployed ML pipelines processing 10M+ records daily
- Reduced model training time by 60% through infrastructure optimization
- Mentored junior engineers and led technical design reviews

---

## Education

### Bachelor of Science
**Georgia Institute of Technology** | 2012 – 2016
Computer Science

---

## Technical Skills

**AI/ML:** PyTorch, TensorFlow, LangChain, Claude API, OpenAI API, Hugging Face
**Cloud & Infrastructure:** AWS, Azure, GCP, Kubernetes, Docker, Terraform
**Programming Languages:** Python, TypeScript, Rust, Go, SQL
**Data Engineering:** Apache Spark, Airflow, dbt, PostgreSQL, Redis
**Leadership & Strategy:** Technical Architecture, Team Building, Agile, OKRs

---

## Certifications

- **AWS Solutions Architect** — Amazon Web Services (Jun 2023)

---

## Projects

### AI Resume Generator
Generates resumes from career data using Claude AI. Built with TypeScript, Next.js, and the Anthropic API.

---

## Publications

- **Scaling AI Pipelines in Healthcare** — IEEE (Mar 2022): Technical paper on ML deployment in healthcare settings.
`;

/** Resume markdown stripped of HTML comments (as page.tsx renders it). */
export const SAMPLE_RESUME_CLEAN = stripHtmlComments(SAMPLE_RESUME_MD);
