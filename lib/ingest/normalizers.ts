/**
 * lib/ingest/normalizers.ts — LinkedIn CSV row → CareerData normalizers.
 *
 * Each function transforms raw LinkedIn CSV rows (PapaParse output)
 * into the corresponding CareerData interface shape.
 */

import { normalizeDate, normalizeDateOrNull, safeString } from "./utils.js";
import type {
  CareerPosition,
  CareerEducation,
  CareerCertification,
  CareerProject,
  CareerPublication,
  CareerProfile,
  CareerLanguage,
  CareerRecommendation,
  CareerHonor,
  CareerVolunteering,
  CareerCourse,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInSkill,
  LinkedInCertification,
  LinkedInProject,
  LinkedInPublication,
  LinkedInProfile,
  LinkedInLanguage,
  LinkedInRecommendation,
  LinkedInHonor,
  LinkedInVolunteering,
  LinkedInCourse,
  LinkedInEmail,
} from "../types.js";

export function normalizePositions(rows: LinkedInPosition[]): CareerPosition[] {
  return rows
    .filter((r) => safeString(r["Company Name"]) || safeString(r["Title"]))
    .map((r) => ({
      title: safeString(r["Title"]),
      company: safeString(r["Company Name"]),
      location: safeString(r["Location"]),
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDateOrNull(r["Finished On"]),
      description: safeString(r["Description"]),
      highlights: [],
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function normalizeEducation(rows: LinkedInEducation[]): CareerEducation[] {
  return rows
    .filter((r) => safeString(r["School Name"]))
    .map((r) => ({
      school: safeString(r["School Name"]),
      degree: safeString(r["Degree Name"]),
      field: "",
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDate(r["Finished On"]),
      notes: safeString(r["Notes"]),
      activities: safeString(r["Activities"]),
    }));
}

export function normalizeSkills(rows: LinkedInSkill[]): string[] {
  return rows.map((r) => safeString(r["Name"])).filter((name) => name.length > 0);
}

export function normalizeCertifications(rows: LinkedInCertification[]): CareerCertification[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      authority: safeString(r["Authority"]),
      date: normalizeDate(r["Started On"]),
      licenseNumber: safeString(r["License Number"]) || undefined,
      url: safeString(r["Url"]) || undefined,
    }));
}

export function normalizeProjects(rows: LinkedInProject[]): CareerProject[] {
  return rows
    .filter((r) => safeString(r["Title"]))
    .map((r) => ({
      title: safeString(r["Title"]),
      description: safeString(r["Description"]),
      url: safeString(r["Url"]) || undefined,
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDate(r["Finished On"]) || undefined,
    }));
}

export function normalizePublications(rows: LinkedInPublication[]): CareerPublication[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      publisher: safeString(r["Publisher"]),
      date: normalizeDate(r["Published On"]),
      url: safeString(r["Url"]) || undefined,
      description: safeString(r["Description"]),
    }));
}

export function normalizeProfile(rows: LinkedInProfile[]): CareerProfile {
  const row = rows[0];
  if (!row) {
    return {
      name: "",
      headline: "",
      summary: "",
      location: "",
      email: "",
      linkedin: "",
      website: "",
    };
  }
  return {
    name: `${safeString(row["First Name"])} ${safeString(row["Last Name"])}`.trim(),
    headline: safeString(row["Headline"]),
    summary: safeString(row["Summary"]),
    location: safeString(row["Geo Location"]),
    email: "",
    linkedin: "",
    website: "",
  };
}

/** Extract primary confirmed email from Email Addresses.csv */
export function extractEmail(rows: LinkedInEmail[]): string {
  // Prefer primary + confirmed, then any confirmed, then first available
  const primary = rows.find(
    (r) =>
      safeString(r["Primary"]).toLowerCase() === "yes" &&
      safeString(r["Confirmed"]).toLowerCase() === "yes",
  );
  if (primary) return safeString(primary["Email Address"]);

  const confirmed = rows.find((r) => safeString(r["Confirmed"]).toLowerCase() === "yes");
  if (confirmed) return safeString(confirmed["Email Address"]);

  const first = rows[0];
  return first ? safeString(first["Email Address"]) : "";
}

export function normalizeLanguages(rows: LinkedInLanguage[]): CareerLanguage[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      proficiency: safeString(r["Proficiency"]),
    }));
}

export function normalizeRecommendations(rows: LinkedInRecommendation[]): CareerRecommendation[] {
  return rows
    .filter((r) => safeString(r["Text"]))
    .map((r) => ({
      recommender: safeString(r["Recommender"]),
      text: safeString(r["Text"]),
      date: normalizeDate(r["Date"]),
    }));
}

export function normalizeHonors(rows: LinkedInHonor[]): CareerHonor[] {
  return rows
    .filter((r) => safeString(r["Title"]))
    .map((r) => ({
      title: safeString(r["Title"]),
      issuer: safeString(r["Issuer"]),
      date: normalizeDate(r["Issued On"]),
      description: safeString(r["Description"]),
    }));
}

export function normalizeVolunteering(rows: LinkedInVolunteering[]): CareerVolunteering[] {
  return rows
    .filter((r) => safeString(r["Organization"]))
    .map((r) => ({
      organization: safeString(r["Organization"]),
      role: safeString(r["Role"]),
      cause: safeString(r["Cause"]),
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDateOrNull(r["Finished On"]),
      description: safeString(r["Description"]),
    }));
}

export function normalizeCourses(rows: LinkedInCourse[]): CareerCourse[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      number: safeString(r["Number"]),
      associatedWith: safeString(r["Associated With"]),
    }));
}
