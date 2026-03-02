import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { loadCareerData } from "../lib/career-data";

describe("loadCareerData", () => {
  const dataPath = path.join(process.cwd(), "data/generated/career-data.json");
  const dataExists = fs.existsSync(dataPath);

  it.skipIf(!dataExists)("returns CareerData object when data file exists", () => {
    const data = loadCareerData();
    expect(data).not.toBeNull();
    expect(data!.profile).toBeDefined();
    expect(data!.profile.name).toBeTruthy();
    expect(data!.positions).toBeInstanceOf(Array);
    expect(data!.education).toBeInstanceOf(Array);
    expect(data!.skills).toBeInstanceOf(Array);
  });

  it("exports a function that returns CareerData or null", () => {
    expect(typeof loadCareerData).toBe("function");
    const result = loadCareerData();
    // Result is either a valid CareerData object or null
    expect(result === null || typeof result === "object").toBe(true);
  });
});
