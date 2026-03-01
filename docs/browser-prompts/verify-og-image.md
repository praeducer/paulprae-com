# Verify OG Image — Browser Automation Prompt

> **Purpose:** Test how paulprae.com's Open Graph image renders across social platforms.
> **Tool:** Send this prompt to Claude in Chrome (browser automation).

---

## Prompt

```
Go to https://www.opengraph.xyz/ and test the URL https://paulprae.com

1. Find the URL input field and enter: https://paulprae.com
2. Click the submit/preview button
3. Wait for results to load (may take 5-10 seconds)
4. Take a screenshot of the results showing the preview cards
5. Report what you see:
   - Does the OG image (dark slate background with "Paul Prae" in white) appear?
   - Is the title "Paul Prae — Principal AI Engineer & Architect" shown?
   - Is the description showing?
   - Are there preview cards for Google, Facebook, Twitter/X, LinkedIn, Discord, and Slack?
6. If any issues: note which platform previews look wrong and what's missing

After opengraph.xyz, also test with:
- https://cards-dev.twitter.com/validator (if still available)
- Or just report the opengraph.xyz results

Expected result: All previews show the dark OG image with "Paul Prae" name, "Principal AI Engineer & Architect" title, and "paulprae.com" URL.
```
