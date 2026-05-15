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
- `lib/db.ts`
- `lib/openai_client.ts`
- `lib/r2_documents.ts`
- `lib/auth_options.ts`

## Notes

This project starts from a clean YOMITORI-specific scaffold and reuses only the generic TENsNAP infrastructure patterns.

