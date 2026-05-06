# Monthly Budget Workflow

A practical monthly routine for using the local budget app.

## Privacy first

This project is local-first. Real bank CSVs, profile JSON exports, and generated reports may contain sensitive financial data.

Do **not** commit real exports, reports, or profile files to git.

## One-time setup

1. Open the local app:
   - `projects/personal-budget-automation/app/index.html`
   - or run a local server from the project folder.
2. Load or create category rules.
3. Enter monthly category targets.
4. Click **Save local**.
5. Optionally click **Export profile** and store the JSON somewhere private.

## Monthly routine

### 1. Choose the report month

Set **Report month** to the month you are reviewing.

### 2. Import transactions

1. Download CSV exports from your bank/card institutions.
2. In the app, choose the closest **Import preset**.
3. Upload the CSV files.
4. Confirm transactions appear in the standardized **Transactions Import** table.

### 3. Review uncategorized transactions

Use **Uncategorized Review** to assign categories/classes.

Classes:
- `variable` — normal flexible spending, e.g. groceries, dining, gas
- `fixed` — recurring bills, e.g. mortgage, insurance, utilities
- `transfer` — account movement, not real spending
- `savings` — saving/investing transfers
- `debt` — debt payoff
- `income` — paychecks or other income

### 4. Check monthly targets

Update targets if needed. The app will show actual vs target by category and call out overages.

### 5. Import prior baseline

If you have last month's exported snapshot/profile:

- import the prior **Monthly Snapshot CSV**, or
- import the prior **profile JSON**

This auto-fills prior-month comparison fields.

### 6. Add debt payoff info

If relevant, fill in:
- starting debt balance
- current debt balance
- planned payoff this month
- actual payoff this month

### 7. Generate report

Click **Generate PDF / Print** and save as PDF from the browser print dialog.

### 8. Export month-end files

Recommended private exports:
- profile JSON — full local app state
- monthly snapshot CSV — lightweight month-over-month baseline for next month
- normalized transactions CSV — clean ledger
- Google Sheets CSVs — if maintaining a Sheets companion workbook

## Suggested private folder structure outside git

```text
Budget Reports/
  2026-05/
    raw-bank-csvs/
    budget-profile-2026-05.json
    monthly-snapshot-2026-05.csv
    normalized-transactions-2026-05.csv
    budget-report-2026-05.pdf
```

## Recommended month-end checklist

- [ ] All bank/card CSVs imported
- [ ] Uncategorized transactions reviewed
- [ ] Transfers/savings/debt correctly classified
- [ ] Targets reviewed
- [ ] Prior month baseline imported
- [ ] Debt tracker updated if applicable
- [ ] PDF report generated
- [ ] Profile JSON exported privately
- [ ] Monthly snapshot CSV saved for next month

## v0.4 workbook-flow routine

1. **Dashboard** — confirm the active month/profile mode and review the app's attention list.
2. **Income + paycheck foundation** — enter or revise income assumptions, deductions, withholding, and paycheck cadence.
3. **Budget Blueprint** — maintain the category/subcategory structure that acts as the monthly budget source of truth. Include fixed, variable, giving, savings/investing, and debt rows.
4. **Monthly targets** — let targets derive from the blueprint by default; only override for temporary month-specific changes.
5. **Track expenses** — use manual transaction entry for one-offs and CSV import for bank/card exports.
6. **Categorize/review** — review uncategorized rows; adjust advanced rules only when defaults are insufficient.
7. **Reconcile** — derive Cash/Expenses from live data, review account balances, debt, net worth, portfolio/BTC, and trades.
8. **Close month** — save the monthly snapshot, inspect charts and written summary, print/save PDF if useful, and export an encrypted profile for backup.

Privacy rule: publish/demo builds should use sanitized fixtures only. Real profiles, CSVs, exported PDFs, and plain JSON exports should stay local/private.
