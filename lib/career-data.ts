import fs from "fs";
import path from "path";
import type { CareerData } from "./types";

/**
 * Load career data from the generated JSON file.
 * Returns null if the file doesn't exist (pipeline hasn't run yet).
 */
export function loadCareerData(): CareerData | null {
  try {
    const filePath = path.join(process.cwd(), "data/generated/career-data.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CareerData;
  } catch {
    return null;
  }
}
