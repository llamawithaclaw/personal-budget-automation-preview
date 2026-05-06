# Personal Budget Automation

Local-first budget automation project, separate from BTC Helper and manuscript work.

Goal: preserve the current spreadsheet's strengths while adding repeatable planning, import, categorization, monthly snapshot, and report generation workflows.

## Current prototype status

The app is now a v0.5 local-first budget cockpit prototype. It is still not a full Google Sheets replacement, but this iteration adds a tabbed workbook shell, deeper demo-data sanitization for public preview, a richer category → subcategory → item Budget Blueprint, and faster spreadsheet-like manual transaction entry.

Current workflow modes:

1. **Dashboard** — one cockpit view for cash flow, savings, net worth, BTC/investment exposure, and next review items.
2. **Plan** — income/paycheck assumptions plus a category/subcategory/item Budget Blueprint with monthly and yearly targets that drives monthly category targets.
3. **Track** — spreadsheet-like manual transaction entry, institution CSV imports, and optional advanced categorization rules.
4. **Reconcile** — cash/expenses, accounts, debt, uncategorized transactions, and month-over-month baselines.
5. **Invest** — portfolio/BTC tracking, allocation-gap visibility, taxable trades, and net worth.
6. **Close Month** — monthly snapshot, charts, print/PDF output, profile export, and Google Sheets companion CSVs.

## Planning parity check

Run the workbook planning-spine parity test from this project root:

```bash
node scripts/test-planning-parity.js
node scripts/test-cash-expenses-parity.js
node scripts/test-investing-btc-parity.js
node scripts/test-trades-parity.js
node scripts/test-import-presets.js
```

The first planning fixture validates core `Budget`, `Pay_Calc`, and `Calculations` outputs within `0.01` tolerance. The Cash/Expenses fixture validates reconciliation outputs from `Expenses` and `Cash` within `0.01` tolerance. The Investing/BTC fixture validates deterministic investment and BTC-tracking outputs using explicit market assumptions. The Trades fixture validates taxable-sale cost basis, proceeds, realized gain/loss, and capital-loss summary outputs. The import preset fixture test validates sanitized Chase-style, Amex-style, Capital One-style, and Apple Card-style CSV handling.

In the local/private app, the Planning Spine panel exposes friendly editable assumption fields, allocation rows, an allocation review table, and an advanced JSON view. Public preview builds should stay on synthetic demo defaults and must not expose private workbook-derived baselines.

## Initial direction

- Keep the spreadsheet as the source-of-truth/reference model during early development.
- Build a local HTML app for monthly inputs, CSV imports, rules-based transaction categorization, planning modules, and PDF report generation.
- Avoid cloud sync by default; all financial data should remain local unless explicitly changed later.
- Treat the app as a companion/prototype until formula parity is validated domain by domain.

## Proposed modules

- `app/` — local HTML/CSS/JS budget tool
- `scripts/` — import/report/build helpers
- `docs/` — design notes and spreadsheet audit
- `fixtures/` — sanitized sample CSV templates only; no real financial data

## Quick start

Open the local prototype:

```bash
cd /home/clawdbot/.openclaw/workspace-personal/projects/personal-budget-automation
python3 -m http.server 8765
```

Then visit:

```text
http://127.0.0.1:8765/app/
```

You can also open `app/index.html` directly in a browser, though a local server is usually smoother for testing.

## Monthly workflow

1. Dashboard: confirm profile mode, month, and what needs attention.
2. Plan: update income/paycheck assumptions and the Budget Blueprint categories/subcategories. Monthly targets derive from the blueprint unless manually overridden.
3. Track: manually enter expenses or import current-month institution CSVs; keep category rules advanced unless needed.
4. Reconcile: review uncategorized rows, cash/accounts, debt, net worth, and investment/BTC/trade trackers.
5. Close Month / Report: save the monthly snapshot, inspect charts/summary language, print/save PDF, and export private profile backups or companion CSVs.

See `docs/MONTHLY_WORKFLOW.md` for the practical monthly routine.

For formula/dependency findings and replacement scope, see:

- `docs/WORKBOOK_FORMULA_AUDIT_2026-05-05.md`
- `docs/SPREADSHEET_PARITY_ROADMAP.md`
- `docs/PLANNING_PARITY_EXTRACT_2026-05-05.md`
- `docs/BUDGET_PAYCALC_PARITY_SPEC.md`
- `docs/CASH_EXPENSES_PARITY_EXTRACT_2026-05-05.md`
- `docs/CASH_EXPENSES_PARITY_SPEC.md`
- `docs/INVESTING_BTC_PARITY_EXTRACT_2026-05-05.md`
- `docs/INVESTING_BTC_PARITY_SPEC.md`
