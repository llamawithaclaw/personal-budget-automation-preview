# Privacy and Data Handling

This project is designed to be local-first.

## Do not commit real financial data

Do not commit:
- bank/card CSV exports
- normalized transaction CSVs with real data
- exported profile JSON files
- generated budget report PDFs
- screenshots containing real account details

## Safe to commit

Safe project materials include:
- app source code
- documentation
- sanitized fixture CSVs
- synthetic screenshots
- schema templates

## Ignored private locations/patterns

The root `.gitignore` excludes:

- `projects/personal-budget-automation/private-data/`
- `projects/personal-budget-automation/**/*.private.csv`
- `projects/personal-budget-automation/**/*.private.json`
- `projects/personal-budget-automation/**/*profile*.json`
- `projects/personal-budget-automation/**/*report*.pdf`
- `projects/personal-budget-automation/raw-bank-csvs/`

## Recommended local storage

Use either:

```text
projects/personal-budget-automation/private-data/
```

or a private folder outside the git workspace entirely, such as:

```text
~/Documents/Budget Reports/
```

## Export naming suggestion

Use names like:

```text
2026-05/monthly-snapshot-2026-05.private.csv
2026-05/budget-profile-2026-05.private.json
2026-05/budget-report-2026-05.pdf
```
