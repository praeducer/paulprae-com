import fs from "fs";
import type { CareerData } from "./types";
import { PATHS } from "./config";

/**
 * Load career data from the generated JSON file.
 * Returns null if the file doesn't exist (pipeline hasn't run yet).
 */
export function loadCareerData(): CareerData | null {
  try {
    const raw = fs.readFileSync(PATHS.careerDataOutput, "utf-8");
    return JSON.parse(raw) as CareerData;
  } catch {
    return null;
  }
}
