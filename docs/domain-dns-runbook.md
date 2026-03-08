# Domain DNS Runbook — paulprae.com

This runbook is the canonical DNS operations guide for `paulprae.com`.
It intentionally excludes sensitive values (verification tokens, internal panel URLs, account IDs).

## Scope

- Configure apex and `www` to point at Vercel
- Preserve email and blog records
- Verify propagation and service health
- Troubleshoot and roll back safely

Deployment workflow details (build/push behavior) are documented in `README.md`.

## Service Boundaries

| Role         | Service                 | Notes                                |
| ------------ | ----------------------- | ------------------------------------ |
| Site hosting | Vercel                  | Server-rendered Next.js + CDN        |
| DNS          | DreamHost               | Authoritative DNS for `paulprae.com` |
| Email        | Office 365 / Outlook    | Mail flow for `@paulprae.com`        |
| Blog         | Ghost (`prae.ghost.io`) | `blog.paulprae.com` endpoint         |

## Target DNS State

### Records for web routing

| Name  | Type  | Value source            | Purpose                            |
| ----- | ----- | ----------------------- | ---------------------------------- |
| `@`   | A     | Vercel Domains settings | Apex domain to Vercel              |
| `www` | CNAME | Vercel Domains settings | `www` to Vercel (redirect to apex) |

Use the exact values shown in Vercel under project **Settings -> Domains**.

### Records to keep unchanged

| Name           | Type  | Value (pattern)                                  | Why                           |
| -------------- | ----- | ------------------------------------------------ | ----------------------------- |
| `@`            | MX    | `*.mail.protection.outlook.com`                  | Inbound email                 |
| `@`            | TXT   | `MS=ms...`                                       | Microsoft domain verification |
| `@`            | TXT   | `v=spf1 include:spf.protection.outlook.com -all` | SPF sender authorization      |
| `autodiscover` | CNAME | `autodiscover.outlook.com.`                      | Mail client auto-config       |
| `blog`         | CNAME | `prae.ghost.io.`                                 | Blog routing                  |
| `@`            | NS    | DNS provider nameservers                         | Authoritative DNS             |

### Legacy records to remove

Remove stale test/cdn/portfolio records that no longer point to active infrastructure.
Do not remove anything tied to MX, SPF, autodiscover, blog, or NS.

## Verification

### In Vercel

1. Open project **Settings -> Domains**.
2. Refresh both `paulprae.com` and `www.paulprae.com`.
3. Confirm both report **Valid Configuration**.
4. Confirm SSL certificate is active after validation.

### CLI checks

```bash
# Apex resolves
dig paulprae.com A

# www resolves via CNAME
dig www.paulprae.com CNAME

# Redirect behavior
curl -I https://www.paulprae.com

# Apex response
curl -I https://paulprae.com

# Resume artifact is served
curl -I https://paulprae.com/Paul-Prae-Resume.pdf
```

### Email and blog checks

```bash
dig paulprae.com MX
dig paulprae.com TXT
dig blog.paulprae.com CNAME
curl -I https://blog.paulprae.com
```

Also send a real inbound and outbound email test to verify deliverability.

## Troubleshooting

| Symptom                        | Check                                                       |
| ------------------------------ | ----------------------------------------------------------- |
| Domain still invalid in Vercel | Confirm apex A and `www` CNAME exactly match Vercel targets |
| SSL not active                 | Wait for DNS validation to complete, then re-check Vercel   |
| Mail issues                    | Confirm MX/SPF/autodiscover are present and unchanged       |
| Blog unavailable               | Confirm `blog` CNAME still points to `prae.ghost.io.`       |

If propagation seems inconsistent, compare responses from local resolver and public resolver (e.g., `@8.8.8.8`).

## Rollback

If routing must be reverted quickly:

1. Restore previous apex A record from DNS history/provider logs.
2. Restore previous `www` CNAME target from DNS history/provider logs.
3. Do not alter MX, SPF, autodiscover, blog, or NS during rollback.
