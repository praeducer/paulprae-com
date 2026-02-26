/**
 * Type definitions for the LinkedIn-to-Resume pipeline.
 *
 * Three groups:
 * A. Raw LinkedIn CSV row types (exact column names from LinkedIn data export)
 * B. Normalized CareerData (canonical intermediate representation)
 * C. Pipeline result types
 *
 * LinkedIn CSV schema sources:
 * - paulprae.com TDD §3 (validated against Paul's actual export)
 * - Reactive Resume LinkedIn parser (https://docs.rxresu.me)
 * - LinkedIn "Download Your Data" archive structure
 */

// ─── A. Raw LinkedIn CSV Row Types ───────────────────────────────────────────
// Column names match LinkedIn export headers exactly (spaces + title case).
// PapaParse returns objects keyed by these header strings.

export interface LinkedInPosition {
  "Company Name": string;
  "Title": string;
  "Description": string;
  "Location": string;
  "Started On": string;
  "Finished On": string;
}

export interface LinkedInEducation {
  "School Name": string;
  "Degree Name": string;
  "Notes": string;
  "Started On": string;
  "Finished On": string;
  "Activities": string;
}

export interface LinkedInSkill {
  "Name": string;
}

export interface LinkedInCertification {
  "Name": string;
  "Url": string;
  "Authority": string;
  "Started On": string;
  "Finished On": string;
  "License Number": string;
}

export interface LinkedInProject {
  "Title": string;
  "Description": string;
  "Url": string;
  "Started On": string;
  "Finished On": string;
}

export interface LinkedInPublication {
  "Name": string;
  "Published On": string;
  "Description": string;
  "Publisher": string;
  "Url": string;
}

export interface LinkedInProfile {
  "First Name": string;
  "Last Name": string;
  "Headline": string;
  "Summary": string;
  "Industry": string;
  "Geo Location": string;
}

export interface LinkedInLanguage {
  "Name": string;
  "Proficiency": string;
}

export interface LinkedInRecommendation {
  "Recommender": string;
  "Text": string;
  "Date": string;
  "Status": string;
}

export interface LinkedInHonor {
  "Title": string;
  "Issuer": string;
  "Issued On": string;
  "Description": string;
}

export interface LinkedInVolunteering {
  "Organization": string;
  "Role": string;
  "Cause": string;
  "Started On": string;
  "Finished On": string;
  "Description": string;
}

export interface LinkedInCourse {
  "Name": string;
  "Number": string;
  "Associated With": string;
}

export interface LinkedInEmail {
  "Email Address": string;
  "Confirmed": string;
  "Primary": string;
}

// ─── B. Normalized CareerData ────────────────────────────────────────────────
// The canonical intermediate representation per TDD §5.1.
// Written to data/career-data.json by ingest, consumed by generate.

export interface CareerProfile {
  name: string;
  headline: string;
  summary: string;
  location: string;
  email: string;
  linkedin: string;
  website: string;
}

export interface CareerPosition {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  description: string;
  highlights: string[];
}

export interface CareerEducation {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  notes: string;
  activities: string;
}

export interface CareerCertification {
  name: string;
  authority: string;
  date: string;
  licenseNumber?: string;
  url?: string;
}

export interface CareerProject {
  title: string;
  description: string;
  url?: string;
  startDate: string;
  endDate?: string;
}

export interface CareerPublication {
  name: string;
  publisher: string;
  date: string;
  url?: string;
  description: string;
}

export interface CareerLanguage {
  name: string;
  proficiency: string;
}

export interface CareerRecommendation {
  recommender: string;
  text: string;
  date: string;
}

export interface CareerHonor {
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface CareerVolunteering {
  organization: string;
  role: string;
  cause: string;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface CareerCourse {
  name: string;
  number: string;
  associatedWith: string;
}

export interface CareerData {
  profile: CareerProfile;
  positions: CareerPosition[];
  education: CareerEducation[];
  skills: string[];
  certifications: CareerCertification[];
  projects: CareerProject[];
  publications: CareerPublication[];
  languages: CareerLanguage[];
  recommendations: CareerRecommendation[];
  honors: CareerHonor[];
  volunteering: CareerVolunteering[];
  courses: CareerCourse[];
}

// ─── C. Pipeline Result Types ────────────────────────────────────────────────

export interface IngestResult {
  success: boolean;
  careerData: CareerData | null;
  errors: string[];
  warnings: string[];
  stats: {
    csvFilesFound: number;
    csvFilesParsed: number;
    positions: number;
    education: number;
    skills: number;
    certifications: number;
    projects: number;
    publications: number;
  };
}

export interface GenerationResult {
  success: boolean;
  markdownLength: number;
  model: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}
