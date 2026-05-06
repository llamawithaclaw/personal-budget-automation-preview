# Sanitized GitHub Pages Prototype

Purpose: make the budget app easy to review and comment on without exposing real financial data.

## Recommended posture

- Publish only the static app shell, docs, and sanitized fixtures.
- Default profile mode should remain Demo / sample.
- Never commit real bank CSVs, exported profiles, PDFs, account balances, tax details, or workbook-derived private rows beyond sanitized fixtures.
- Real use remains local: run the app from a local folder and import an encrypted profile.

## Safe-to-publish contents

- `app/`
- `fixtures/*sample*.csv` and other sanitized templates
- `README.md`
- selected docs that do not contain real private data

## Exclude

- `private-data/`
- real institution exports
- real profile `.json` / `.encjson` files
- generated personal PDFs
- any screenshots with real account data

## Review workflow

1. Publish the sanitized prototype to GitHub Pages.
2. Review from the URL in Demo mode.
3. Track feedback as issues or short notes.
4. Keep real data testing on the local copy only.
