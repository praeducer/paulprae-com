#!/usr/bin/env python3
"""Knowledge base security, privacy, and quality audit."""

import json
import re
import os
import sys

KB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sources", "knowledge")


def load_files():
    files = {}
    for root, dirs, fnames in os.walk(KB):
        for fname in sorted(fnames):
            if not fname.endswith(".json") or fname == "example.json":
                continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, KB).replace("\\", "/")
            with open(fpath) as f:
                files[rel] = json.load(f)
    return files


def read_content(files_dict):
    content_map = {}
    for root, dirs, fnames in os.walk(KB):
        for fname in sorted(fnames):
            if not fname.endswith(".json") or fname == "example.json":
                continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, KB).replace("\\", "/")
            with open(fpath) as f:
                content_map[rel] = f.read()
    return content_map


def check_privacy_terms(content_map):
    """Check for excluded privacy terms."""
    EXCLUDED = [
        r"polyamorous", r"polyamory", r"atheist",
        r"\$60,000", r"\$60000", r"\$1M\b", r"\$1,000,000",
        r"stabbed", r"stabbing", r"home invasion",
        r"ethical non-monogamy", r"open relationship",
        r"OkCupid", r"Tinder", r"Bumble", r"Hinge",
        r"social_profile",
        r"(?<![_a-z])boundaries(?![_a-z])",  # standalone, not inside key names like ethical_boundaries
    ]
    clean = True
    for rel, content in sorted(content_map.items()):
        for term in EXCLUDED:
            if re.search(term, content, re.IGNORECASE):
                print(f"  [FAIL] {rel}: contains \"{term}\"")
                clean = False
    if clean:
        print("  [PASS] No excluded privacy terms found")
    return clean


def check_pii(content_map):
    """Check for email, phone, SSN exposure."""
    email_pat = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
    phone_pat = re.compile(r"(?<!\d)(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)")
    ssn_pat = re.compile(r"\d{3}-\d{2}-\d{4}")
    clean = True
    for rel, content in sorted(content_map.items()):
        for e in email_pat.findall(content):
            print(f"  [FAIL] {rel}: email exposed: {e}")
            clean = False
        if phone_pat.search(content):
            print(f"  [FAIL] {rel}: phone number exposed")
            clean = False
        if ssn_pat.search(content):
            print(f"  [FAIL] {rel}: SSN pattern found")
            clean = False
    if clean:
        print("  [PASS] No email, phone, or SSN exposure")
    return clean


def check_family_details(content_map):
    """Check that family details are properly generalized."""
    patterns = [
        (r"stay-at-home\s+(?:parent|mom|dad|mother|father)", "stay-at-home family role"),
        (r"\bwife\b|\bhusband\b", "specific spouse reference"),
        (r"\bdaughters?\b|\bsons?\b", "specific child gender"),
        (r"\bfather\b|\bmother\b", "specific parent role"),
        (r"\d+\s+(?:year|month)\s+old", "specific age"),
    ]
    clean = True
    for rel, content in sorted(content_map.items()):
        for pattern, desc in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                print(f"  [FAIL] {rel}: {desc} ({len(matches)}x)")
                clean = False
    if clean:
        print("  [PASS] Family details properly generalized")
    return clean


def check_secrets(content_map):
    """Check for hardcoded secrets and credentials."""
    patterns = [
        (r"ghp_[a-zA-Z0-9]{36}", "GitHub token"),
        (r"sk-[a-zA-Z0-9]{20,}", "API key"),
        (r"Bearer\s+[a-zA-Z0-9._-]{20,}", "Bearer token"),
        (r"-----BEGIN.*KEY-----", "Private key"),
        (r"AKIA[0-9A-Z]{16}", "AWS access key"),
        (r"password\s*[:=]\s*\S+", "Hardcoded password"),
    ]
    clean = True
    for rel, content in sorted(content_map.items()):
        for pattern, desc in patterns:
            if re.search(pattern, content):
                print(f"  [FAIL] {rel}: {desc} found")
                clean = False
    if clean:
        print("  [PASS] No secrets or credentials detected")
    return clean


def check_xrefs(files):
    """Check cross-reference integrity and duplicate IDs."""
    errors = []

    if "career/companies.json" in files and "career/positions.json" in files:
        cids = {c["id"] for c in files["career/companies.json"]}
        for p in files["career/positions.json"]:
            if p.get("company_id") and p["company_id"] not in cids:
                errors.append(f"positions: company_id \"{p['company_id']}\" missing")

    if "career/positions.json" in files and "career/projects.json" in files:
        pids = {p["id"] for p in files["career/positions.json"]}
        for proj in files["career/projects.json"]:
            if proj.get("position_id") and proj["position_id"] not in pids:
                errors.append(f"projects: position_id \"{proj['position_id']}\" missing")

    if "career/education.json" in files and "career/courses.json" in files:
        eids = {e["id"] for e in files["career/education.json"]}
        for c in files["career/courses.json"]:
            if c.get("associated_education_id") and c["associated_education_id"] not in eids:
                errors.append(f"courses: education_id \"{c['associated_education_id']}\" missing")

    for rel, data in files.items():
        if isinstance(data, list) and data and isinstance(data[0], dict) and "id" in data[0]:
            seen = set()
            for item in data:
                if item["id"] in seen:
                    errors.append(f"{rel}: duplicate id \"{item['id']}\"")
                seen.add(item["id"])

    if errors:
        for e in errors:
            print(f"  [FAIL] {e}")
    else:
        print("  [PASS] All cross-references resolve, no duplicate IDs")
    return len(errors) == 0


def check_completeness(files):
    """Check all expected files are present."""
    expected = [
        "career/profile.json", "career/companies.json", "career/positions.json",
        "career/education.json", "career/skills.json", "career/certifications.json",
        "career/projects.json", "career/publications.json", "career/recommendations.json",
        "career/honors.json", "career/volunteering.json", "career/courses.json",
        "brand/identity.json", "brand/values.json", "brand/personality.json",
        "brand/communication-styles.json", "brand/brand-narratives.json",
        "strategy/job-search.json", "strategy/career-objectives.json",
        "strategy/audience-frameworks.json", "strategy/target-market.json",
        "agents/workflow-architecture.json", "agents/permissions-matrix.json",
        "agents/agent-definitions.json", "agents/quality-standards.json",
        "content/writing-formulas.json", "content/message-templates.json",
        "content/platform-constraints.json",
    ]
    missing = [f for f in expected if f not in files]
    if missing:
        for m in missing:
            print(f"  [FAIL] Missing: {m}")
    else:
        print(f"  [PASS] All {len(expected)} expected files present")
    return len(missing) == 0


def check_data_quality(files):
    """Check for empty arrays/objects."""
    clean = True
    for rel, data in sorted(files.items()):
        if isinstance(data, list) and len(data) == 0:
            print(f"  [FAIL] {rel}: empty array")
            clean = False
        elif isinstance(data, dict) and len(data) == 0:
            print(f"  [FAIL] {rel}: empty object")
            clean = False
    if clean:
        print("  [PASS] No empty files, all JSON valid")
    return clean


def main():
    print("========================================")
    print("  KNOWLEDGE BASE AUDIT REPORT")
    print("========================================")
    print()

    files = load_files()
    content_map = read_content(files)

    results = []

    print("[1] PRIVACY EXCLUSION TERMS")
    results.append(check_privacy_terms(content_map))

    print()
    print("[2] PII EXPOSURE (email, phone, SSN)")
    results.append(check_pii(content_map))

    print()
    print("[3] FAMILY DETAIL SPECIFICITY")
    results.append(check_family_details(content_map))

    print()
    print("[4] SECRETS & CREDENTIALS")
    results.append(check_secrets(content_map))

    print()
    print("[5] CROSS-REFERENCE INTEGRITY")
    results.append(check_xrefs(files))

    print()
    print("[6] FILE COMPLETENESS")
    results.append(check_completeness(files))

    print()
    print("[7] DATA QUALITY")
    results.append(check_data_quality(files))

    print()
    print("========================================")
    if all(results):
        print("  ALL CHECKS PASSED")
    else:
        failed = sum(1 for r in results if not r)
        print(f"  {failed} CHECK(S) FAILED - see above")
    print("========================================")

    print()
    print("RECORD COUNTS:")
    for rel in sorted(files.keys()):
        data = files[rel]
        count = f"{len(data)} records" if isinstance(data, list) else "single object"
        print(f"  {rel}: {count}")

    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
