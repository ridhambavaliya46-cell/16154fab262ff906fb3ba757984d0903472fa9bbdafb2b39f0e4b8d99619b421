# Sensitive repository data remediation

The tracked `data/db.json` file is ignored for future changes but was committed before the ignore rule existed. It contains user-like account, resume, and job-description data. This change does not print, modify, delete, or rewrite that file or Git history.

Before sharing the repository publicly or with a third party:

1. Preserve a private encrypted backup only if the data owner has approved retention.
2. Replace the working-tree fixture with the synthetic `data/db.example.json` shape, or remove the legacy JSON fixture if Supabase is the only runtime data source.
3. Remove `data/db.json` from the index with an explicitly reviewed `git rm --cached data/db.json` change.
4. Purge the path from all Git history with an approved history-rewrite procedure such as `git filter-repo`, then force-update every affected remote clone according to the repository owner’s process.
5. Rotate any credentials that may have been stored alongside the data, and ask affected users whether stored personal data must be deleted from the live database/storage as well.
6. Re-run `git ls-files data/db.json`, secret scanning, `npm run lint`, `npm run test:unit`, `npm test`, `npm run test:server`, and `npm run build` before publishing.

The cleanup is intentionally a separate owner-approved operation because removing a tracked file and rewriting history affects collaborators and cannot be safely inferred from an application code change.
