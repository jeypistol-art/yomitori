# YOMITORI DocuTask

書類を、要約・タスク・リマインド・証跡へ。

## Local setup

```powershell
npm install
npm run dev
```

## Main stack

- Next.js
- OpenNext Cloudflare
- Cloudflare R2
- Neon PostgreSQL
- NextAuth Google
- OpenAI API
- Stripe

## Important files

- `migrations/001_initial.sql`
- `docs/`
- `docs/YOMITORI_DocuTask_production_readiness_checklist.md`
- `lib/db.ts`
- `lib/openai_client.ts`
- `lib/r2_documents.ts`
- `lib/auth_options.ts`
- `lib/email_delivery.ts`
- `lib/reminder_dispatcher.ts`

## Reminder email job

Scheduled reminders are processed by:

```powershell
Invoke-WebRequest -Method POST -Uri "http://localhost:3100/api/jobs/send-reminders" -Headers @{ Authorization = "Bearer $env:NOTIFICATION_JOB_SECRET" }
```

Set `EMAIL_FROM` and either `RESEND_API_KEY` or SMTP settings. Use `EMAIL_DELIVERY_MODE=log` for local dry runs.

## Notes

This project starts from a clean YOMITORI-specific scaffold and reuses only the generic TENsNAP infrastructure patterns.
