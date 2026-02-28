/**
 * Type definitions for the structured knowledge base.
 *
 * Organized by domain:
 *   career/   — positions, education, skills, companies, etc.
 *   brand/    — identity, values, personality, communication styles
 *   strategy/ — job search config, career objectives, audience frameworks
 *   agents/   — AI agent workflow, permissions, definitions
 *   content/  — writing formulas, message templates, platform constraints
 *
 * Design constraints:
 *   - Every array type uses stable `id` fields for cross-referencing
 *   - All dates normalized to "YYYY-MM" (or "YYYY") for PostgreSQL DATE compatibility
 *   - Flat enough for trivial JSON→SQL upload via Supabase client
 *   - Cross-reference IDs prepare for Neo4j graph relationships
 */

// ─── Career Types ───────────────────────────────────────────────────────────

export interface KBProfile {
  name: string;
  headline: string;
  summary: string;
  location: { primary: string; secondary: string };
  email: string;
  linkedin: string;
  website: string;
  github: string;
  blog: string;
  presentations: string;
  academic: string;
  years_experience: number;
  current_role: string;
  current_company: string;
}

export interface KBCompany {
  id: string;
  name: string;
  industry: string;
  size: "startup" | "mid-market" | "enterprise";
  type: "employer" | "client" | "own-business" | "nonprofit";
  website: string | null;
  description: string;
}

export interface KBPosition {
  id: string;
  title: string;
  company: string;
  company_id: string;
  location: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  employment_type: "full-time" | "contract" | "self-employed" | "internship";
  description: string;
  highlights: string[];
  technologies: string[];
  industries: string[];
  sort_order: number;
}

export interface KBEducation {
  id: string;
  school: string;
  degree: string;
  field: string;
  specialization: string;
  start_date: string;
  end_date: string;
  activities: string;
  honors: string[];
  certificates: string[];
  description: string;
}

export interface KBSkill {
  id: string;
  name: string;
  category:
    | "ai_ml"
    | "cloud_platforms"
    | "programming"
    | "databases"
    | "technologies"
    | "web_development"
    | "domain_healthcare"
    | "domain_business"
    | "domain_data"
    | "leadership";
  proficiency: "expert" | "advanced" | "intermediate";
  years_experience: number | null;
  is_featured: boolean;
  related_skills: string[];
}

export interface KBCertification {
  id: string;
  name: string;
  authority: string;
  issue_date: string;
  expiry_date: string | null;
  license_number: string | null;
  url: string | null;
}

export interface KBProject {
  id: string;
  title: string;
  description: string;
  url: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "ongoing";
  technologies: string[];
  outcomes: string[];
  position_id: string | null;
  project_type:
    | "entrepreneurship"
    | "research"
    | "consulting"
    | "hackathon"
    | "presentation"
    | "open-source"
    | "academic"
    | "internal";
}

export interface KBPublication {
  id: string;
  name: string;
  publisher: string;
  published_date: string;
  url: string | null;
  description: string;
}

export interface KBRecommendation {
  id: string;
  recommender_name: string;
  recommender_company: string;
  recommender_title: string;
  text: string;
  date: string;
  themes: string[];
}

export interface KBHonor {
  id: string;
  title: string;
  organization: string;
  date: string;
  description: string;
  category: "Competition" | "Professional Recognition" | "Academic Achievement";
}

export interface KBVolunteering {
  id: string;
  organization: string;
  role: string;
  cause: string;
  start_date: string;
  end_date: string | null;
  description: string;
}

export interface KBCourse {
  id: string;
  name: string;
  code: string;
  category: string;
  discipline: string;
  institution: string;
  associated_education_id: string;
}

// ─── Brand Types ────────────────────────────────────────────────────────────

export interface KBValue {
  name: string;
  description: string;
  ethical_principle: string;
}

export interface KBBrandIdentity {
  mission: { description: string; core_areas: Record<string, string[]> };
  vision: { description: string; focus_areas: Record<string, string[]> };
  causes: string[];
  life_philosophy: { mission_areas: Record<string, string[]> };
  company_websites: Record<string, string>;
}

export interface KBPersonality {
  writing_style: string;
  tone_preferences: string[];
  humor_style: string;
  decision_making: string;
  enthusiasm_expression: string;
  core_traits: { primary: string[]; communication: string[] };
  leadership_style: string[];
  personal_interests: {
    creative_pursuits: string[];
    outdoor_activities: string[];
  };
  communities: string[];
}

export interface KBCommunicationStyles {
  professional: {
    style_adaptations: string;
    tone_preferences: string;
    typical_formats: string[];
  };
  personal: {
    style_adaptations: string;
    tone_preferences: string;
    typical_formats: string[];
  };
  social_media: {
    style: string;
    tone: string;
    platforms: string[];
    themes: string[];
    engagement: string[];
  };
  creative: {
    style_adaptations: string;
    interests: string[];
    approaches: string[];
    characteristics: string[];
    narrative_themes: string[];
  };
  core_principles: Record<string, string>;
  tone_guidelines: Record<string, string>;
  ethical_boundaries: Record<string, string>;
}

// ─── Strategy Types ─────────────────────────────────────────────────────────

export interface KBJobSearch {
  target_roles: { primary: string[]; note: string };
  target_industries: { primary: string[] };
  target_audience: { titles: string[] };
  job_preferences: {
    compensation: {
      annual_salary: number;
      bonus: number;
      total_compensation: number;
      currency: string;
    };
    employment_type: string;
    location_preferences: string;
    work_arrangements: string[];
  };
  core_skills_by_category: Record<string, string[]>;
}

export interface KBCareerObjectives {
  current_focus: {
    projects: string[];
    career_objectives: string[];
    learning_objectives: string[];
  };
  objectives_by_category: {
    financial: string[];
    career: string[];
    family: string[];
    entrepreneurship: string[];
    lifestyle: string[];
  };
  short_term: string[];
  long_term: string[];
  legacy: string[];
}

export interface KBAudienceFramework {
  audience_type: string;
  primary_concerns: string[];
  messaging_focus: string;
  preferred_length: string;
  key_elements: string[];
}

export interface KBTargetMarket {
  target_companies: string[];
  target_industries: string[];
  positioning_statement: string;
  competitive_advantages: string[];
}

// ─── Agent Types ────────────────────────────────────────────────────────────

export interface KBWorkflowStage {
  stage: number | string;
  name: string;
  purpose: string;
  outputs: string[];
  prerequisites: (number | string)[];
  file: string;
}

export interface KBAgentPermission {
  agent: string;
  read: string[];
  write: string[];
}

export interface KBAgentDefinition {
  id: string;
  name: string;
  stage: string;
  role: string;
  purpose: string;
  prerequisites: string[];
  outputs: string[];
  read_permissions: string[];
  write_permissions: string[];
  success_criteria: string[];
  source_prompt_file: string;
}

// ─── Content Types ──────────────────────────────────────────────────────────

export interface KBWritingFormula {
  id: string;
  name: string;
  structure: string;
  usage: string;
  example: string;
}

export interface KBMessageTemplates {
  effective_openings: Record<string, string>;
  compelling_closings: Record<string, string>;
  credibility_builders: Record<string, string>;
  response_templates: {
    interview_thank_you: {
      timing: string;
      structure: string[];
      length: string;
    };
    rejection_response: {
      timing: string;
      structure: string[];
      length: string;
    };
    follow_up_cadence: Record<string, string>;
  };
}

export interface KBPlatformConstraints {
  linkedin: {
    connection_request: {
      character_limit: number;
      best_practices: string[];
    };
    message: { character_limit: number; best_practices: string[] };
    inmail: {
      character_limit: number;
      subject_limit: number;
      best_practices: string[];
    };
  };
  email: {
    subject_line: { character_limit: number; best_practices: string[] };
    body: { recommended_length: string; best_practices: string[] };
  };
  application_forms: {
    text_fields: { typical_limit: string; best_practices: string[] };
    cover_letter_upload: { typical_limit: string; best_practices: string[] };
  };
}

// ─── Meta Types ─────────────────────────────────────────────────────────────

export interface KBManifestEntry {
  path: string;
  version: string;
  source_repos: string[];
  record_count: number | null;
  privacy_level: "public" | "career-public" | "internal";
  phase2_table: string | null;
  phase3_nodes: string[];
  description: string;
}

export interface KBManifest {
  version: string;
  last_updated: string;
  files: KBManifestEntry[];
}
