const STORAGE_KEY = 'personal-budget-automation-profile-v1';

const state = {
  transactions: [],
  rules: [],
  targets: new Map(),
  targetsSource: 'blueprint',
  blueprint: [],
  accounts: [],
  netWorthItems: [],
  paycheck: {},
  planning: {},
  cashExpenses: {},
  cashExpensesSource: 'baseline',
  investingBtc: {},
  trades: {},
  monthlySnapshots: [],
  importHistory: [],
  lastImportReview: null,
  profileMode: 'demo',
  viewMode: 'edit',
};

const importPresets = {
  auto: {},
  chase_checking: {
    date: ['posting_date', 'transaction_date', 'date'],
    posted_date: ['posting_date', 'post_date'],
    description: ['description', 'details'],
    amount: ['amount'],
    type: ['type'],
  },
  amex: {
    date: ['date'],
    posted_date: ['date'],
    description: ['description', 'appears_on_your_statement_as'],
    amount: ['amount'],
    account: ['account_#', 'account_number'],
    amount_sign: 'expenses_positive',
  },
  capital_one: {
    date: ['transaction_date'],
    posted_date: ['posted_date'],
    description: ['description', 'merchant'],
    debit: ['debit'],
    credit: ['credit'],
    category: ['category'],
  },
  apple_card: {
    date: ['transaction_date'],
    posted_date: ['clearing_date'],
    description: ['description', 'merchant'],
    amount: ['amount_usd', 'amount'],
    category: ['category'],
    amount_sign: 'expenses_positive',
  },
};

const sampleRules = [
  { priority: 100, match_type: 'contains', pattern: 'KROGER', category: 'Groceries', subcategory: '', class: 'variable', direction_hint: 'expense', account_hint: '', active: true },
  { priority: 100, match_type: 'contains', pattern: 'SHELL', category: 'Gas', subcategory: '', class: 'variable', direction_hint: 'expense', account_hint: '', active: true },
  { priority: 100, match_type: 'contains', pattern: 'RESTAURANT', category: 'Dining Out', subcategory: '', class: 'variable', direction_hint: 'expense', account_hint: '', active: true },
  { priority: 100, match_type: 'contains', pattern: 'PAYROLL', category: 'Income', subcategory: 'Paycheck', class: 'income', direction_hint: 'income', account_hint: '', active: true },
  { priority: 100, match_type: 'contains', pattern: 'TRANSFER', category: 'Transfer', subcategory: '', class: 'transfer', direction_hint: '', account_hint: '', active: true },
];

const $ = (id) => document.getElementById(id);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (quoted && ch === '"' && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (!quoted && ch === ',') { row.push(cell); cell = ''; continue; }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0].map((h) => normalizeHeader(h));
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function cleanMoney(value) {
  if (value === undefined || value === null || value === '') return 0;
  const text = String(value).replace(/[$,()]/g, '').trim();
  const n = Number(text);
  if (Number.isNaN(n)) return 0;
  return String(value).includes('(') && String(value).includes(')') ? -Math.abs(n) : n;
}

const planningFieldMap = [
  ['planPrimaryGrossAnnual', 'primaryGrossAnnual'],
  ['planPrimaryNetBiweeklyBase', 'primaryNetBiweeklyBase'],
  ['planPrimaryNetAdjustment', 'primaryNetAdjustment'],
  ['planSpouseHourlyRate', 'spouseHourlyRate'],
  ['planSpouseNetBiweekly', 'spouseNetBiweekly'],
  ['planPaychecksPerYear', 'paychecksPerYear'],
  ['planFixedRecurringTotal', 'fixedRecurringTotal'],
  ['planFundsTotal', 'fundsTotal'],
  ['planNetBasicPayTotal', 'netBasicPayTotal'],
  ['planTaxBeforeCredits', 'taxScenario.totalEstimatedTaxBeforeCredits'],
  ['planTaxCreditsOrPaid', 'taxScenario.taxCreditsOrPaid'],
];

function planningDefaultsJson() {
  return JSON.stringify(window.BudgetPlanningEngine?.workbookParityDefaults || {}, null, 2);
}

function investingBtcDefaultsJson() {
  return JSON.stringify(window.InvestingBtcEngine?.workbookParityDefaults || {}, null, 2);
}

function ensureInvestingBtcAssumptionsText() {
  if ($('investingBtcAssumptionsInput') && !$('investingBtcAssumptionsInput').value.trim()) $('investingBtcAssumptionsInput').value = investingBtcDefaultsJson();
}

function investingBtcAssumptionsObject() {
  ensureInvestingBtcAssumptionsText();
  try {
    const parsed = JSON.parse($('investingBtcAssumptionsInput').value || '{}');
    $('investingBtcStatus').textContent = 'Investing/BTC assumptions parsed successfully.';
    return parsed;
  } catch (error) {
    $('investingBtcStatus').textContent = `Investing/BTC JSON error: ${error.message}`;
    return window.InvestingBtcEngine?.workbookParityDefaults || {};
  }
}

function investingBtcSnapshot() {
  if (!window.InvestingBtcEngine) return {};
  state.investing_btc_assumptions = investingBtcAssumptionsObject();
  state.investingBtc = window.InvestingBtcEngine.calculateInvestingBtc(state.investing_btc_assumptions);
  return state.investingBtc;
}

function renderInvestingBtcSummary() {
  const ib = investingBtcSnapshot();
  const metrics = [
    ['BTC value', money(ib.investing?.btcValue || 0), `${ib.investing?.btcHoldings || 0} BTC @ ${money(ib.investing?.btcPrice || 0)}`],
    ['Investment value', money(ib.investing?.totalCurrentValue || 0), 'Workbook current value'],
    ['BTC P/L', money(ib.btc?.unrealizedPl || 0), `${pct((ib.btc?.percentGainLoss || 0) * 100)} gain/loss`],
    ['Allocation gap', money(ib.investing?.allocationDiffTotal || 0), 'Actual minus desired allocation'],
    ['Ledn LTV', pct((ib.btc?.lednLtv || 0) * 100), `70% threshold ${money(ib.btc?.ltv70PriceThreshold || 0)}`],
  ];
  $('investingBtcSummary').innerHTML = metrics.map(([label, value, note]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');
  const rows = [
    ['BTC price', ib.investing?.btcPrice],
    ['BTC holdings', ib.investing?.btcHoldings],
    ['Spot crypto allocation', `${pct((ib.investing?.spotCryptoActualPct || 0) * 100)}`],
    ['Allocation desired total', ib.investing?.allocationDesiredDollarsTotal],
    ['Allocation actual total', ib.investing?.allocationActualDollarsTotal],
    ['Allocation gap', ib.investing?.allocationDiffTotal],
    ['Spot crypto dollar gap', ib.investing?.spotCryptoDollarGap],
    ['Monthly investing rate', ib.investing?.monthlyInvestingRate],
    ['Daily investing rate', ib.investing?.dailyInvestingRate],
    ['Total BTC tracked', ib.btc?.totalBtc],
    ['Weighted avg execute price', ib.btc?.weightedAvgExecutePrice],
    ['BTC cost basis', ib.btc?.totalCostBasis],
    ['BTC current value', ib.btc?.currentValue],
    ['CC debt in BTC terms', ib.btc?.ccDebtInBtc],
    ['Remaining stack', ib.btc?.remainingStack],
  ];
  $('investingBtcTable').innerHTML = `<table><thead><tr><th>Output</th><th>Value</th></tr></thead><tbody>${rows.map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td>${typeof v === 'string' ? escapeHtml(v) : money(v || 0)}</td></tr>`).join('')}</tbody></table>`;
}

function investingBtcToCsv() {
  const ib = investingBtcSnapshot();
  const rows = [
    ['metric','value'],
    ['btc_price', ib.investing?.btcPrice || 0],
    ['btc_holdings', ib.investing?.btcHoldings || 0],
    ['btc_value', ib.investing?.btcValue || 0],
    ['total_current_value', ib.investing?.totalCurrentValue || 0],
    ['total_cost_basis', ib.investing?.totalCostBasis || 0],
    ['spot_crypto_actual_pct', ib.investing?.spotCryptoActualPct || 0],
    ['monthly_investing_rate', ib.investing?.monthlyInvestingRate || 0],
    ['total_btc', ib.btc?.totalBtc || 0],
    ['weighted_avg_execute_price', ib.btc?.weightedAvgExecutePrice || 0],
    ['btc_cost_basis', ib.btc?.totalCostBasis || 0],
    ['btc_current_value', ib.btc?.currentValue || 0],
    ['btc_unrealized_pl', ib.btc?.unrealizedPl || 0],
    ['ledn_ltv', ib.btc?.lednLtv || 0],
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function cashExpensesDefaultsJson() {
  return JSON.stringify(window.CashExpensesEngine?.workbookParityDefaults || {}, null, 2);
}

function ensureCashExpensesAssumptionsText() {
  if ($('cashExpensesAssumptionsInput') && !$('cashExpensesAssumptionsInput').value.trim()) $('cashExpensesAssumptionsInput').value = cashExpensesDefaultsJson();
}

function sumCategories(map, names) {
  return names.reduce((total, name) => total + Number(map.get(name) || 0), 0);
}

function deriveCashExpensesAssumptions() {
  const base = cashExpensesAssumptionsObject();
  const snap = calculateSnapshot();
  const categoryMap = snap.byCategory || new Map();
  const planning = planningSnapshot();
  const split = planning.paycheck?.paycheckSplit || [];
  const amountFor = (category) => split.find((row) => row.category === category)?.amount || 0;
  const live = JSON.parse(JSON.stringify(base));
  live.expenses ||= {};
  live.expenses.actuals ||= {};
  live.expenses.paycheckInflows ||= {};
  live.cash ||= {};
  live.expenses.actuals.aggregateActualTotal = snap.expenses;
  live.expenses.actuals.spendDepositActualTotal = snap.expenses;
  live.expenses.actuals.savingsMiscActual = snap.savingsTransfers;
  live.expenses.actuals.medicalActual = sumCategories(categoryMap, ['Medical', 'Healthcare', 'Health']);
  live.expenses.actuals.vehicleActual = sumCategories(categoryMap, ['Vehicle', 'Gas', 'Auto']);
  live.expenses.actuals.houseActual = sumCategories(categoryMap, ['House', 'Housing', 'Utilities']);
  live.expenses.actuals.vacationActual = sumCategories(categoryMap, ['Vacation', 'Travel']);
  live.expenses.actuals.giftsActual = sumCategories(categoryMap, ['Gifts', 'Giving']);
  live.expenses.paycheckInflows.spendDepositInflow = amountFor('Spend/Deposit') || planning.paycheck?.netBasicPayTotal || snap.income;
  live.expenses.paycheckInflows.savingsMiscInflow = amountFor('Savings Misc') || amountFor('Savings') || snap.savingsInput;
  live.expenses.paycheckInflows.vehicleInflow = amountFor('Vehicle');
  live.expenses.paycheckInflows.houseInflow = amountFor('House');
  live.expenses.paycheckInflows.vacationInflow = amountFor('Vacation');
  live.expenses.paycheckInflows.giftsInflow = amountFor('Gifts');
  live.cash.liquidAssets = (state.accounts.length ? state.accounts : parseAccounts($('accountsInput').value)).map((account) => ({ name: account.name, value: account.balance }));
  $('cashExpensesAssumptionsInput').value = JSON.stringify(live, null, 2);
  $('cashExpensesStatus').textContent = 'Derived Cash/Expenses assumptions from imported transactions, Planning Spine, and accounts.';
  return live;
}

function setCashExpensesSource(source, detail = '') {
  state.cashExpensesSource = source;
  const badge = $('cashExpensesSourceBadge');
  if (!badge) return;
  badge.className = `source-badge ${source}`;
  const labels = { baseline: 'Workbook baseline', derived: 'Derived from live data', manual: 'Manual override' };
  badge.textContent = detail ? `${labels[source] || source}: ${detail}` : (labels[source] || source);
}

function cashExpensesAssumptionsObject() {
  ensureCashExpensesAssumptionsText();
  try {
    const parsed = JSON.parse($('cashExpensesAssumptionsInput').value || '{}');
    $('cashExpensesStatus').textContent = 'Cash/Expenses assumptions parsed successfully.';
    return parsed;
  } catch (error) {
    $('cashExpensesStatus').textContent = `Cash/Expenses JSON error: ${error.message}`;
    return window.CashExpensesEngine?.workbookParityDefaults || {};
  }
}

function cashExpensesSnapshot() {
  if (!window.CashExpensesEngine) return {};
  state.cash_expenses_assumptions = cashExpensesAssumptionsObject();
  state.cashExpenses = window.CashExpensesEngine.calculateCashExpenses(state.cash_expenses_assumptions);
  setCashExpensesSource(state.cashExpensesSource || 'baseline');
  return state.cashExpenses;
}

function renderCashExpensesSummary() {
  const cx = cashExpensesSnapshot();
  const metrics = [
    ['Expense diff', money(cx.expenses?.diffs?.spendDepositDiff || 0), 'Spend/deposit inflow minus actuals'],
    ['Savings diff', money(cx.expenses?.diffs?.savingsMiscDiff || 0), 'Savings misc inflow minus actuals'],
    ['Actual liquid', money(cx.cash?.totalActualLiquidAssets || 0), 'Workbook cash total'],
    ['Cash reconcile', money(cx.cash?.reconciliationDiff || 0), 'Actual minus theoretical'],
  ];
  $('cashExpensesSummary').innerHTML = metrics.map(([label, value, note]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');
  const rows = [
    ['Spend/Deposit', cx.expenses?.paycheckInflows?.spendDepositInflow, cx.expenses?.actuals?.aggregateActualTotal, cx.expenses?.diffs?.spendDepositDiff],
    ['Savings Misc', cx.expenses?.paycheckInflows?.savingsMiscInflow, cx.expenses?.actuals?.savingsMiscActual, cx.expenses?.diffs?.savingsMiscDiff],
    ['Vehicle', cx.expenses?.paycheckInflows?.vehicleInflow, cx.expenses?.actuals?.vehicleActual, cx.expenses?.diffs?.vehicleDiff],
    ['House', cx.expenses?.paycheckInflows?.houseInflow, cx.expenses?.actuals?.houseActual, cx.expenses?.diffs?.houseDiff],
    ['Vacation', cx.expenses?.paycheckInflows?.vacationInflow, cx.expenses?.actuals?.vacationActual, cx.expenses?.diffs?.vacationDiff],
    ['Gifts', cx.expenses?.paycheckInflows?.giftsInflow, cx.expenses?.actuals?.giftsActual, cx.expenses?.diffs?.giftsDiff],
  ];
  $('cashExpensesTable').innerHTML = `<table><thead><tr><th>Category</th><th>Inflow</th><th>Actual</th><th>Diff</th></tr></thead><tbody>${rows.map(([cat, inflow, actual, diff]) => `<tr><td>${escapeHtml(cat)}</td><td>${money(inflow || 0)}</td><td>${money(actual || 0)}</td><td>${money(diff || 0)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="3">Theoretical liquid assets</th><th>${money(cx.cash?.theoreticalLiquidAssets || 0)}</th></tr><tr><th colspan="3">Reconciliation diff</th><th>${money(cx.cash?.reconciliationDiff || 0)}</th></tr></tfoot></table>`;
}

function cashExpensesToCsv() {
  const cx = cashExpensesSnapshot();
  const rows = [
    ['metric','value'],
    ['spend_deposit_diff', cx.expenses?.diffs?.spendDepositDiff || 0],
    ['savings_misc_diff', cx.expenses?.diffs?.savingsMiscDiff || 0],
    ['vehicle_diff', cx.expenses?.diffs?.vehicleDiff || 0],
    ['house_diff', cx.expenses?.diffs?.houseDiff || 0],
    ['vacation_diff', cx.expenses?.diffs?.vacationDiff || 0],
    ['gifts_diff', cx.expenses?.diffs?.giftsDiff || 0],
    ['total_actual_liquid_assets', cx.cash?.totalActualLiquidAssets || 0],
    ['theoretical_liquid_assets', cx.cash?.theoreticalLiquidAssets || 0],
    ['reconciliation_diff', cx.cash?.reconciliationDiff || 0],
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function getPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts.slice(0, -1)) current = current[part] ||= {};
  current[parts.at(-1)] = value;
}

function allocationsToText(rows = []) {
  return rows.map((row) => `${row.category},${Math.round(Number(row.percent || 0) * 1000000) / 10000}%,${row.includeInAllocatedTotal === false ? 'no' : 'yes'}`).join('\n');
}

function parsePlanningAllocations(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [category, percentRaw, includeRaw] = parseCsv(line)[0] || [];
    if (!category || String(category).toLowerCase() === 'category') continue;
    const raw = String(percentRaw || '').trim();
    const percent = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    rows.push({ category: String(category).trim(), percent: Number.isFinite(percent) ? percent : 0, includeInAllocatedTotal: !['no', 'false', '0', 'exclude'].includes(String(includeRaw || 'yes').trim().toLowerCase()) });
  }
  return rows;
}

function setPlanningFieldsFromObject(obj) {
  for (const [id, path] of planningFieldMap) if ($(id)) $(id).value = getPath(obj, path) ?? '';
  if ($('planningAllocationsInput')) $('planningAllocationsInput').value = allocationsToText(obj.allocationPercents || []);
}

function assumptionsFromPlanningFields(base) {
  const assumptions = JSON.parse(JSON.stringify(base || {}));
  for (const [id, path] of planningFieldMap) {
    const value = $(id)?.value;
    if (value !== undefined && value !== '') setPath(assumptions, path, Number(value));
  }
  if ($('planningAllocationsInput')) assumptions.allocationPercents = parsePlanningAllocations($('planningAllocationsInput').value);
  return assumptions;
}

function ensurePlanningAssumptionsText() {
  if ($('planningAssumptionsInput') && !$('planningAssumptionsInput').value.trim()) {
    $('planningAssumptionsInput').value = planningDefaultsJson();
    setPlanningFieldsFromObject(window.BudgetPlanningEngine?.workbookParityDefaults || {});
  }
}

function planningAssumptionsObject() {
  ensurePlanningAssumptionsText();
  try {
    const parsed = JSON.parse($('planningAssumptionsInput').value || '{}');
    const assumptions = assumptionsFromPlanningFields(parsed);
    $('planningAssumptionsInput').value = JSON.stringify(assumptions, null, 2);
    $('planningStatus').textContent = 'Planning assumptions parsed successfully.';
    return assumptions;
  } catch (error) {
    $('planningStatus').textContent = `Planning JSON error: ${error.message}`;
    return assumptionsFromPlanningFields(window.BudgetPlanningEngine?.workbookParityDefaults || {});
  }
}

function planningSnapshot() {
  if (!window.BudgetPlanningEngine) return {};
  state.planning_assumptions = planningAssumptionsObject();
  state.planning = window.BudgetPlanningEngine.calculatePlanning(state.planning_assumptions);
  return state.planning;
}

function flattenPlanningRows(planning) {
  if (!planning || !planning.income) return [];
  return [
    ['total_net_monthly', planning.income.totalNetMonthly],
    ['total_net_yearly', planning.income.totalNetYearly],
    ['total_monthly_need', planning.need.totalMonthlyNeed],
    ['monthly_remaining', planning.need.monthlyRemaining],
    ['annual_basic_need', planning.need.annualBasicNeed],
    ['annual_net_difference', planning.need.annualNetDifference],
    ['gross_income_needed', planning.need.grossIncomeNeeded],
    ['gross_basic_need', planning.need.grossBasicNeed],
    ['net_basic_pay_total', planning.paycheck.netBasicPayTotal],
    ['paycheck_allocation_difference', planning.paycheck.paycheckAllocationDifference],
    ['estimated_annual_tax_liability', planning.tax.estimatedAnnualTaxLiability],
    ['target_withholding_per_paycheck', planning.tax.targetWithholdingPerPaycheck],
  ];
}

function renderPlanningAllocationTable(planning) {
  const rows = planning?.paycheck?.paycheckSplit || [];
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${pct(row.percent * 100)}</td><td>${money(row.amount)}</td><td>${row.includeInAllocatedTotal === false ? 'Excluded' : 'Included'}</td></tr>`).join('');
  const footer = `<tfoot><tr><th colspan="2">Allocated total</th><th>${money(planning?.paycheck?.allocatedPaycheckTotal || 0)}</th><th></th></tr><tr><th colspan="2">Paycheck difference</th><th>${money(planning?.paycheck?.paycheckAllocationDifference || 0)}</th><th></th></tr></tfoot>`;
  $('planningAllocationTable').innerHTML = `<table><thead><tr><th>Category</th><th>Percent</th><th>Per paycheck</th><th>Status</th></tr></thead><tbody>${body || '<tr><td colspan="4">No allocation rows yet.</td></tr>'}</tbody>${footer}</table>`;
}

function renderPlanningSpineSummary() {
  const planning = planningSnapshot();
  const rows = flattenPlanningRows(planning);
  $('planningSpineSummary').innerHTML = rows.map(([label, value]) => `<div class="blueprint-row"><span>${escapeHtml(label.replaceAll('_', ' '))}</span><strong>${money(Number(value))}</strong></div>`).join('');
  renderPlanningAllocationTable(planning);
}

function planningSpineToCsv() {
  return flattenPlanningRows(planningSnapshot()).map(([k, v]) => `${csvCell(k)},${csvCell(v)}`).join('\n');
}

function paycheckSnapshot() {
  const gross = Number($('payGrossInput')?.value || 0);
  const paychecks = Number($('paychecksInput')?.value || 26);
  const pretax = Number($('payPretaxInput')?.value || 0);
  const posttax = Number($('payPosttaxInput')?.value || 0);
  const taxRate = Number($('payTaxRateInput')?.value || 0) / 100;
  const extraWithholding = Number($('payExtraWithholdingInput')?.value || 0);
  const taxable = Math.max(0, gross - pretax);
  const estimatedTax = taxable * taxRate + extraWithholding;
  const net = gross - pretax - estimatedTax - posttax;
  const monthlyNet = paychecks ? (net * paychecks) / 12 : 0;
  const annualNet = net * paychecks;
  const blueprintTotal = state.blueprint.reduce((s, r) => s + Number(r.monthly_target || 0), 0);
  const monthlySurplus = monthlyNet - blueprintTotal;
  state.paycheck = { gross, paychecks, pretax, posttax, tax_rate_pct: taxRate * 100, extra_withholding: extraWithholding, taxable, estimated_tax: estimatedTax, net, monthly_net: monthlyNet, annual_net: annualNet, monthly_surplus: monthlySurplus };
  return state.paycheck;
}

function renderPaycheckSummary() {
  const p = paycheckSnapshot();
  const rows = [
    ['Net per paycheck', money(p.net)],
    ['Monthly net', money(p.monthly_net)],
    ['Annual net', money(p.annual_net)],
    ['Estimated tax / check', money(p.estimated_tax)],
    ['Budget surplus / deficit', money(p.monthly_surplus)],
  ];
  $('paycheckSummary').innerHTML = rows.map(([label, value]) => `<div class="blueprint-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function paycheckToCsv() {
  const p = paycheckSnapshot();
  return Object.entries(p).map(([k, v]) => `${csvCell(k)},${csvCell(v)}`).join('\n');
}

function tradeRowsFromText(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [yearRaw, dateSerialRaw, assetRaw, sharesRaw, avgRaw, costRaw, executeRaw, proceedsRaw, netRaw] = parseCsv(line)[0] || [];
    if (!yearRaw || String(yearRaw).toLowerCase() === 'year') continue;
    rows.push({
      year: String(yearRaw).trim(),
      dateSerial: String(dateSerialRaw ?? '').trim(),
      asset: String(assetRaw || '').trim(),
      shares: String(sharesRaw ?? '').trim(),
      averageSharePrice: String(avgRaw ?? '').trim(),
      costBasis: String(costRaw ?? '').trim(),
      executePrice: String(executeRaw ?? '').trim(),
      proceeds: String(proceedsRaw ?? '').trim(),
      netGainLoss: String(netRaw ?? '').trim(),
    });
  }
  return rows;
}

function tradeRowsToText(rows) {
  const headers = ['Year','DateSerial','Asset','Shares','Avg Share $','Cost Basis','Execute Price','Proceeds','Net G/L'];
  return [headers.join(','), ...rows.map((row) => [row.year, row.dateSerial, row.asset, row.shares, row.averageSharePrice, row.costBasis, row.executePrice, row.proceeds, row.netGainLoss].map(csvCell).join(','))].join('\n');
}

function tradeDefaultsText() {
  const defaults = window.TradesEngine?.workbookParityDefaults || { years: {} };
  const rows = ['Year,DateSerial,Asset,Shares,Avg Share $,Cost Basis,Execute Price,Proceeds,Net G/L'];
  for (const [year, trades] of Object.entries(defaults.years || {})) {
    for (const trade of trades) rows.push([year, trade.dateSerial || '', trade.asset || '', trade.shares || '', trade.averageSharePrice ?? '', trade.costBasis ?? '', trade.executePrice ?? '', trade.proceeds ?? '', trade.netGainLoss ?? ''].map(csvCell).join(','));
  }
  return rows.join('\n');
}

function parseTrades(text) {
  const years = {};
  for (const row of tradeRowsFromText(text)) {
    const year = row.year;
    years[year] ||= [];
    years[year].push({
      dateSerial: cleanMoney(row.dateSerial),
      asset: row.asset,
      shares: cleanMoney(row.shares),
      averageSharePrice: row.averageSharePrice === '' ? undefined : cleanMoney(row.averageSharePrice),
      costBasis: row.costBasis === '' ? undefined : cleanMoney(row.costBasis),
      executePrice: row.executePrice === '' ? undefined : cleanMoney(row.executePrice),
      proceeds: row.proceeds === '' ? undefined : cleanMoney(row.proceeds),
      netGainLoss: row.netGainLoss === '' ? undefined : cleanMoney(row.netGainLoss),
    });
  }
  return years;
}

function tradesSnapshot() {
  if (!window.TradesEngine) return { years: {} };
  const years = parseTrades($('tradesInput')?.value || '');
  state.trades = window.TradesEngine.calculateTrades({ years });
  return state.trades;
}

function renderTradesEditor() {
  const rows = tradeRowsFromText($('tradesInput')?.value || '');
  if (!$('tradesEditor')) return;
  const columns = [
    ['year', 'Year'], ['dateSerial', 'Date'], ['asset', 'Asset'], ['shares', 'Shares'], ['averageSharePrice', 'Avg $'], ['costBasis', 'Basis'], ['executePrice', 'Exec $'], ['proceeds', 'Proceeds'], ['netGainLoss', 'G/L'],
  ];
  const body = rows.map((row, index) => `<tr>${columns.map(([key, label]) => `<td><input data-trade-row="${index}" data-trade-field="${key}" aria-label="${escapeHtml(label)}" value="${escapeHtml(row[key] ?? '')}" /></td>`).join('')}<td><button data-remove-trade="${index}">Remove</button></td></tr>`).join('');
  $('tradesEditor').innerHTML = `<table><thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}<th></th></tr></thead><tbody>${body}</tbody></table>`;
}

function syncTradesTableToText() {
  const rows = tradeRowsFromText($('tradesInput').value);
  $('tradesEditor').querySelectorAll('input[data-trade-row]').forEach((input) => {
    const idx = Number(input.dataset.tradeRow);
    const field = input.dataset.tradeField;
    rows[idx] ||= {};
    rows[idx][field] = input.value;
  });
  $('tradesInput').value = tradeRowsToText(rows);
}

function addTradeRow() {
  const rows = tradeRowsFromText($('tradesInput').value);
  rows.push({ year: $('reportMonth').value.slice(0, 4) || new Date().getFullYear(), dateSerial: '', asset: '', shares: '', averageSharePrice: '', costBasis: '', executePrice: '', proceeds: '', netGainLoss: '' });
  $('tradesInput').value = tradeRowsToText(rows);
  render({ autosave: true });
}

function removeTradeRow(index) {
  const rows = tradeRowsFromText($('tradesInput').value);
  rows.splice(Number(index), 1);
  $('tradesInput').value = tradeRowsToText(rows);
  render({ autosave: true });
}

function renderTradesSummary() {
  const trades = tradesSnapshot();
  renderTradesEditor();
  const yearRows = Object.values(trades.years || {}).sort((a, b) => a.year - b.year).map((year) => {
    const s = year.summary;
    const pctValue = typeof s.totalPercentGainLoss === 'string' ? s.totalPercentGainLoss : pct(s.totalPercentGainLoss * 100);
    return `<div class="blueprint-row"><span>${escapeHtml(year.year)} net realized G/L</span><strong>${money(s.netRealizedGainLoss)}</strong></div><div class="blueprint-row"><span>${escapeHtml(year.year)} cost basis / proceeds</span><strong>${money(s.totalCostBasis)} / ${money(s.totalProceeds)}</strong></div><div class="blueprint-row"><span>${escapeHtml(year.year)} total % G/L</span><strong>${escapeHtml(pctValue)}</strong></div>`;
  }).join('');
  $('tradesSummary').innerHTML = yearRows || '<p>No trades entered yet.</p>';
}

function tradesToCsv() {
  const trades = tradesSnapshot();
  const rows = [['year','date_serial','asset','shares','average_share_price','cost_basis','execute_price','proceeds','net_gain_loss','percent_gain_loss']];
  for (const year of Object.values(trades.years || {}).sort((a,b)=>a.year-b.year)) {
    for (const trade of year.trades) rows.push([year.year, trade.dateSerial || '', trade.asset || '', trade.shares, trade.averageSharePrice, trade.costBasis, trade.executePrice, trade.proceeds, trade.netGainLoss, trade.percentGainLoss]);
    rows.push([year.year, '', 'TOTAL', '', '', year.summary.totalCostBasis, '', year.summary.totalProceeds, year.summary.netRealizedGainLoss, year.summary.totalPercentGainLoss]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function simpleRowsFromText(text, fields, skipFirst) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = parseCsv(line)[0] || [];
    if (skipFirst && String(cells[0] || '').toLowerCase() === skipFirst) continue;
    rows.push(Object.fromEntries(fields.map((field, i) => [field, String(cells[i] ?? '').trim()])));
  }
  return rows;
}

function simpleRowsToText(rows, fields) {
  return rows.map((row) => fields.map((field) => csvCell(row[field] ?? '')).join(',')).join('\n');
}

function renderSimpleEditor({ containerId, textId, fields, labels, removeAttr }) {
  const container = $(containerId);
  if (!container) return;
  const rows = simpleRowsFromText($(textId).value, fields);
  const body = rows.map((row, index) => `<tr>${fields.map((field, i) => `<td><input data-editor-row="${index}" data-editor-field="${field}" aria-label="${escapeHtml(labels[i])}" value="${escapeHtml(row[field] ?? '')}" /></td>`).join('')}<td><button data-${removeAttr}="${index}">Remove</button></td></tr>`).join('');
  container.innerHTML = `<table><thead><tr>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}<th></th></tr></thead><tbody>${body}</tbody></table>`;
}

function syncSimpleEditorToText({ containerId, textId, fields }) {
  const rows = simpleRowsFromText($(textId).value, fields);
  $(containerId).querySelectorAll('input[data-editor-row]').forEach((input) => {
    const idx = Number(input.dataset.editorRow);
    rows[idx] ||= {};
    rows[idx][input.dataset.editorField] = input.value;
  });
  $(textId).value = simpleRowsToText(rows, fields);
}

function addSimpleRow({ textId, fields, defaults }) {
  const rows = simpleRowsFromText($(textId).value, fields);
  rows.push({ ...Object.fromEntries(fields.map((f) => [f, ''])), ...defaults });
  $(textId).value = simpleRowsToText(rows, fields);
  render({ autosave: true });
}

function removeSimpleRow({ textId, fields, index }) {
  const rows = simpleRowsFromText($(textId).value, fields);
  rows.splice(Number(index), 1);
  $(textId).value = simpleRowsToText(rows, fields);
  render({ autosave: true });
}

const blueprintEditor = { containerId: 'blueprintEditor', textId: 'blueprintInput', fields: ['category','subcategory','class','monthly_target'], labels: ['Category','Subcategory','Class','Monthly Target'], removeAttr: 'remove-blueprint' };
const targetsEditor = { containerId: 'targetsEditor', textId: 'targetsInput', fields: ['category','monthly_target'], labels: ['Category','Monthly Target'], removeAttr: 'remove-target' };
const accountEditor = { containerId: 'accountsEditor', textId: 'accountsInput', fields: ['name','type','balance','bucket'], labels: ['Account','Type','Balance','Bucket'], removeAttr: 'remove-account' };
const netWorthEditor = { containerId: 'netWorthEditor', textId: 'netWorthInput', fields: ['name','kind','class','value','is_btc'], labels: ['Name','Kind','Class','Value','BTC?'], removeAttr: 'remove-net-worth' };

function parseNetWorthItems(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, kind, klass, valueRaw, btcRaw] = parseCsv(line)[0] || [];
    if (!name || String(name).toLowerCase() === 'name') continue;
    const normalizedKind = String(kind || 'asset').trim().toLowerCase();
    rows.push({ name: String(name).trim(), kind: normalizedKind, class: String(klass || '').trim().toLowerCase(), value: Math.abs(cleanMoney(valueRaw)), is_btc: ['yes', 'true', '1', 'btc'].includes(String(btcRaw || '').trim().toLowerCase()) });
  }
  return rows;
}

function netWorthSnapshot() {
  const items = parseNetWorthItems($('netWorthInput')?.value || '');
  state.netWorthItems = items;
  const assets = items.filter((i) => i.kind === 'asset').reduce((s, i) => s + i.value, 0);
  const liabilities = items.filter((i) => i.kind === 'liability').reduce((s, i) => s + i.value, 0);
  const btc = items.filter((i) => i.is_btc || i.class === 'btc').reduce((s, i) => s + i.value, 0);
  const netWorth = assets - liabilities;
  const btcAssetPct = assets ? (btc / assets) * 100 : NaN;
  const leverage = assets ? liabilities / assets : NaN;
  return { items, assets, liabilities, btc, netWorth, btcAssetPct, leverage };
}

function renderNetWorthSummary() {
  renderSimpleEditor(netWorthEditor);
  const nw = netWorthSnapshot();
  const rows = [
    ['Assets', money(nw.assets)],
    ['Liabilities', money(nw.liabilities)],
    ['Net worth', money(nw.netWorth)],
    ['BTC / assets', Number.isFinite(nw.btcAssetPct) ? pct(nw.btcAssetPct) : '—'],
    ['Leverage', Number.isFinite(nw.leverage) ? `${Math.round(nw.leverage * 1000) / 1000}` : '—'],
  ];
  const classTotals = new Map();
  for (const item of nw.items.filter((i) => i.kind === 'asset')) classTotals.set(item.class || 'other', (classTotals.get(item.class || 'other') || 0) + item.value);
  $('netWorthSummary').innerHTML = rows.map(([label, value]) => `<div class="blueprint-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('') + [...classTotals.entries()].map(([klass, value]) => `<div class="blueprint-row"><span>${escapeHtml(klass)} assets</span><strong>${money(value)}</strong></div>`).join('');
}

function netWorthToCsv() {
  const headers = ['name','kind','class','value','is_btc'];
  return objectsToCsv(state.netWorthItems.length ? state.netWorthItems : parseNetWorthItems($('netWorthInput').value), headers);
}

function parseAccounts(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, type, balanceRaw, bucket] = parseCsv(line)[0] || [];
    if (!name || String(name).toLowerCase() === 'account') continue;
    rows.push({ name: String(name).trim(), type: String(type || 'account').trim().toLowerCase(), balance: cleanMoney(balanceRaw), bucket: String(bucket || '').trim() });
  }
  return rows;
}

function renderCashSummary() {
  renderSimpleEditor(accountEditor);
  const rows = parseAccounts($('accountsInput')?.value || '');
  state.accounts = rows;
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const byType = new Map();
  for (const row of rows) byType.set(row.type, (byType.get(row.type) || 0) + row.balance);
  const typeRows = [...byType.entries()].sort((a,b)=>b[1]-a[1]).map(([type, amount]) => `<div class="blueprint-row"><span>${escapeHtml(type)}</span><strong>${money(amount)}</strong></div>`).join('');
  const accountRows = rows.map((row) => `<div class="blueprint-row"><span>${escapeHtml(row.name)} <small>${escapeHtml(row.bucket || row.type)}</small></span><strong>${money(row.balance)}</strong></div>`).join('');
  $('cashSummary').innerHTML = `<div class="blueprint-row"><span>Total liquid/accounts</span><strong>${money(total)}</strong></div>${typeRows}${accountRows}`;
}

function accountsToCsv() {
  const headers = ['name','type','balance','bucket'];
  return objectsToCsv(state.accounts.length ? state.accounts : parseAccounts($('accountsInput').value), headers);
}

function parseBlueprint(text, income = 0) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = parseCsv(line)[0] || [];
    const [category, second, third, fourth] = cells;
    if (!category || String(category).toLowerCase() === 'category') continue;
    const legacyThreeColumn = cells.length < 4;
    const subcategory = legacyThreeColumn ? '' : String(second || '').trim();
    const klass = legacyThreeColumn ? second : third;
    const targetRaw = legacyThreeColumn ? third : fourth;
    const raw = String(targetRaw || '').trim();
    const isPct = raw.endsWith('%');
    const pctValue = isPct ? Number(raw.slice(0, -1)) : null;
    const monthlyTarget = isPct ? (Number(income || 0) * pctValue / 100) : Math.max(0, cleanMoney(raw));
    rows.push({
      category: String(category).trim(),
      subcategory,
      class: String(klass || inferClass(category, 'expense')).trim().toLowerCase(),
      monthly_target: monthlyTarget,
      allocation_pct: Number(income || 0) ? (monthlyTarget / Number(income)) * 100 : null,
      raw_target: raw
    });
  }
  return rows;
}

function normalizeBlueprintText(text) {
  const lines = [];
  let changed = false;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = parseCsv(line)[0] || [];
    if (cells.length === 3 && String(cells[0] || '').toLowerCase() !== 'category') {
      lines.push([cells[0], '', cells[1], cells[2]].map(csvCell).join(','));
      changed = true;
    } else {
      lines.push(line);
    }
  }
  return { text: lines.join('\n'), changed };
}

function blueprintToTargets(rows) {
  return new Map(rows.filter((r) => !['income', 'transfer'].includes(r.class)).map((r) => [r.category, r.monthly_target]));
}

function syncTargetsFromBlueprint(rows) {
  if (state.targetsSource !== 'blueprint') return;
  state.targets = blueprintToTargets(rows);
  const text = [...state.targets.entries()].map(([category, target]) => `${csvCell(category)},${csvCell(target)}`).join('\n');
  if ($('targetsInput') && $('targetsInput').value !== text) $('targetsInput').value = text;
}

function blueprintToRules(rows) {
  return rows.map((row, index) => ({ priority: 500 + index, match_type: 'contains', pattern: row.category.toUpperCase(), category: row.category, subcategory: '', class: row.class, direction_hint: row.class === 'income' ? 'income' : 'expense', account_hint: '', active: true }));
}

function renderBlueprintSummary() {
  const normalized = normalizeBlueprintText($('blueprintInput')?.value || '');
  if (normalized.changed) $('blueprintInput').value = normalized.text;
  renderSimpleEditor(blueprintEditor);
  const income = Number($('blueprintIncomeInput')?.value || $('incomeInput')?.value || 0);
  const rows = parseBlueprint($('blueprintInput')?.value || '', income);
  state.blueprint = rows;
  syncTargetsFromBlueprint(rows);
  const total = rows.reduce((s, r) => s + r.monthly_target, 0);
  const byClass = new Map();
  const byCategory = new Map();
  for (const row of rows) {
    byClass.set(row.class, (byClass.get(row.class) || 0) + row.monthly_target);
    byCategory.set(row.category, (byCategory.get(row.category) || 0) + row.monthly_target);
  }
  const classRows = [...byClass.entries()].map(([klass, amount]) => `<div class="blueprint-row"><span>${escapeHtml(klass)}</span><strong>${money(amount)}</strong></div>`).join('');
  const categoryRows = [...byCategory.entries()].slice(0, 8).map(([category, amount]) => `<div class="blueprint-row"><span>${escapeHtml(category)}</span><strong>${money(amount)}</strong></div>`).join('');
  $('blueprintSummary').innerHTML = `<div class="blueprint-row"><span>Total allocated</span><strong>${money(total)}</strong></div>${income ? `<div class="blueprint-row"><span>Remaining vs income</span><strong>${money(income - total)}</strong></div>` : ''}<h3>By class</h3>${classRows}<h3>Top categories</h3>${categoryRows}`;
}

function parseTargets(text) {
  const targets = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [category, amount] = parseCsv(line)[0] || [];
    if (!category || String(category).toLowerCase() === 'category') continue;
    targets.set(String(category).trim(), Math.max(0, cleanMoney(amount)));
  }
  return targets;
}

function pickField(raw, keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    if (raw[normalized] !== undefined && raw[normalized] !== '') return raw[normalized];
  }
  return '';
}

function field(raw, preset, canonical, fallbackKeys) {
  return pickField(raw, [...(preset[canonical] || []), ...fallbackKeys]);
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text;
}

function normalizeTransaction(raw, sourceName, presetName = 'auto') {
  const preset = importPresets[presetName] || importPresets.auto;
  const debit = cleanMoney(field(raw, preset, 'debit', ['debit', 'withdrawal', 'charge', 'paid_out']));
  const credit = cleanMoney(field(raw, preset, 'credit', ['credit', 'deposit', 'payment', 'paid_in']));
  let amount = cleanMoney(field(raw, preset, 'amount', ['amount', 'transaction_amount', 'amount_usd']));
  if (!amount && (debit || credit)) amount = credit ? Math.abs(credit) : -Math.abs(debit);
  const type = String(field(raw, preset, 'type', ['type', 'transaction_type'])).toLowerCase();
  if (preset.amount_sign === 'expenses_positive' && amount) amount = -amount;
  if (amount > 0 && /sale|debit|withdrawal|purchase|card/i.test(type)) amount = -Math.abs(amount);
  const description = field(raw, preset, 'description', ['description', 'description_raw', 'memo', 'name', 'payee', 'transaction', 'merchant', 'details']) || '';
  const date = normalizeDate(field(raw, preset, 'date', ['date', 'transaction_date', 'posted_date', 'post_date']) || '');
  const postedDate = normalizeDate(field(raw, preset, 'posted_date', ['posted_date', 'post_date', 'posting_date', 'clearing_date']) || date);
  const importedCategory = field(raw, preset, 'category', ['category']);
  return {
    date,
    posted_date: postedDate,
    description_raw: description,
    description_clean: cleanDescription(description),
    amount,
    direction: amount >= 0 ? 'income' : 'expense',
    account: field(raw, preset, 'account', ['account', 'account_name', 'account_number', 'account_']) || '',
    institution: raw.institution || sourceName.replace(/\.csv$/i, ''),
    category: importedCategory || '',
    subcategory: '',
    class: importedCategory ? inferClass(importedCategory, amount >= 0 ? 'income' : 'expense') : '',
    rule_id: importedCategory ? 'institution_import' : '',
    notes: '',
    review_status: importedCategory ? 'imported_category' : 'uncategorized',
    manual_category: importedCategory || '',
    manual_subcategory: '',
    manual_class: importedCategory ? inferClass(importedCategory, amount >= 0 ? 'income' : 'expense') : '',
  };
}

function addManualTransaction() {
  const date = $('manualTxDate')?.value || ($('reportMonth')?.value ? `${$('reportMonth').value}-01` : new Date().toISOString().slice(0, 10));
  const description = $('manualTxDescription')?.value?.trim() || 'Manual transaction';
  const rawAmount = cleanMoney($('manualTxAmount')?.value || 0);
  const klass = $('manualTxClass')?.value || inferClass($('manualTxCategory')?.value || '', rawAmount >= 0 ? 'income' : 'expense');
  const expenseLike = !['income'].includes(klass);
  const amount = expenseLike ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const category = $('manualTxCategory')?.value?.trim() || (expenseLike ? 'Uncategorized' : 'Income');
  const tx = {
    date,
    posted_date: date,
    description_raw: description,
    description_clean: cleanDescription(description),
    amount,
    direction: amount >= 0 ? 'income' : 'expense',
    account: 'Manual',
    institution: 'Manual entry',
    category,
    subcategory: $('manualTxSubcategory')?.value?.trim() || '',
    class: klass,
    rule_id: 'manual_entry',
    notes: '',
    review_status: 'manual_entry',
    manual_category: category,
    manual_subcategory: $('manualTxSubcategory')?.value?.trim() || '',
    manual_class: klass,
  };
  state.transactions.push(tx);
  ['manualTxDescription','manualTxAmount','manualTxCategory','manualTxSubcategory'].forEach((id) => { if ($(id)) $(id).value = ''; });
  if ($('manualTxStatus')) $('manualTxStatus').textContent = `Added ${description} for ${money(Math.abs(amount))}.`;
  render({ autosave: true });
}

function cleanDescription(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function inferClass(category, direction) {
  const text = String(category || '').toLowerCase();
  if (direction === 'income' || text.includes('income') || text.includes('payroll')) return 'income';
  if (text.includes('transfer') || text.includes('payment') || text.includes('credit card payment')) return 'transfer';
  if (text.includes('saving') || text.includes('invest') || text.includes('btc') || text.includes('ira')) return 'savings';
  if (text.includes('debt') || text.includes('loan')) return 'debt';
  if (['rent', 'mortgage', 'insurance', 'utilities', 'subscription'].some((word) => text.includes(word))) return 'fixed';
  return direction === 'expense' ? 'variable' : direction;
}

function normalizeRule(raw, index) {
  return {
    id: `rule_${index + 1}`,
    priority: Number(raw.priority || 1000),
    match_type: String(raw.match_type || 'contains').toLowerCase(),
    pattern: String(raw.pattern || '').toUpperCase().trim(),
    category: raw.category || 'Uncategorized',
    subcategory: raw.subcategory || '',
    class: String(raw.class || raw.transaction_class || '').toLowerCase(),
    direction_hint: String(raw.direction_hint || '').toLowerCase(),
    account_hint: String(raw.account_hint || '').toLowerCase(),
    active: !['false', '0', 'no', 'inactive'].includes(String(raw.active || 'true').toLowerCase()),
  };
}

function applyRules() {
  const rules = [...state.rules].filter((r) => r.active && r.pattern).sort((a, b) => a.priority - b.priority);
  for (const tx of state.transactions) {
    if (tx.manual_category) {
      tx.category = tx.manual_category;
      tx.subcategory = tx.manual_subcategory || '';
      tx.class = tx.manual_class || inferClass(tx.manual_category, tx.direction);
      tx.rule_id = 'manual';
      tx.review_status = 'manually_categorized';
      continue;
    }
    tx.category = '';
    tx.subcategory = '';
    tx.rule_id = '';
    tx.review_status = 'uncategorized';
    for (const rule of rules) {
      if (rule.direction_hint && rule.direction_hint !== tx.direction) continue;
      if (rule.account_hint && !tx.account.toLowerCase().includes(rule.account_hint)) continue;
      if (matchesRule(tx.description_clean, rule)) {
        tx.category = rule.category;
        tx.subcategory = rule.subcategory;
        tx.class = rule.class || inferClass(rule.category, tx.direction);
        tx.rule_id = rule.id;
        tx.review_status = 'auto_categorized';
        break;
      }
    }
  }
}

function matchesRule(description, rule) {
  if (rule.match_type === 'exact') return description === rule.pattern;
  if (rule.match_type === 'starts_with') return description.startsWith(rule.pattern);
  if (rule.match_type === 'regex') {
    try { return new RegExp(rule.pattern, 'i').test(description); } catch { return false; }
  }
  return description.includes(rule.pattern);
}

function selectedMonthTransactions() {
  const month = $('reportMonth').value;
  if (!month) return state.transactions;
  return state.transactions.filter((tx) => String(tx.date || tx.posted_date).startsWith(month));
}

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
}

function pct(n) {
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 10) / 10}%`;
}

function profileModeLabel(mode = state.profileMode) {
  return mode === 'real' ? 'Real profile' : mode === 'workbook_baseline' ? 'Workbook baseline' : 'Demo mode';
}

function profileModeHint(mode = state.profileMode) {
  if (mode === 'real') return 'Real profile: use encrypted export for sensitive data. Sample loaders are disabled.';
  if (mode === 'workbook_baseline') return 'Workbook baseline: parity fixtures and workbook-derived assumptions, not a live personal profile.';
  return 'Demo mode: safe for samples and smoke tests. Do not treat reports/history as real.';
}

function setProfileMode(mode, { autosave = true } = {}) {
  state.profileMode = ['demo', 'real', 'workbook_baseline'].includes(mode) ? mode : 'demo';
  syncProfileModeUi();
  if (autosave) saveProfileToLocal(`Switched to ${profileModeLabel()}.`);
}

function syncProfileModeUi() {
  const select = $('profileModeSelect');
  if (!select) return;
  select.value = state.profileMode;
  const banner = $('profileModeBanner');
  banner.className = `mode-banner ${state.profileMode}`;
  banner.textContent = profileModeHint();
  $('profileModeHint').textContent = profileModeHint();
}

function setViewMode(mode, { autosave = true } = {}) {
  state.viewMode = mode === 'report' ? 'report' : 'edit';
  syncViewModeUi();
  if (autosave) saveProfileToLocal(`Switched to ${state.viewMode === 'report' ? 'Report' : 'Edit'} Mode.`);
}

function syncViewModeUi() {
  const mode = state.viewMode === 'report' ? 'report' : 'edit';
  document.body.classList.toggle('report-mode', mode === 'report');
  document.body.classList.toggle('edit-mode', mode !== 'report');
  const select = $('viewModeSelect');
  if (select) select.value = mode;
}

function clearWorkingData() {
  state.transactions = [];
  state.targets = new Map();
  state.accounts = [];
  state.netWorthItems = [];
  state.blueprint = [];
  $('targetsInput').value = '';
  $('accountsInput').value = '';
  $('netWorthInput').value = '';
  $('tradesInput').value = '';
  $('incomeInput').value = '';
  $('savingsInput').value = '';
}

function startRealProfile() {
  if (!confirm('Start a real profile? This clears demo transactions, targets, accounts, and net worth rows in this browser profile.')) return;
  clearWorkingData();
  setProfileMode('real', { autosave: false });
  render({ autosave: true });
  setSaveStatus('Started real profile. Use encrypted export for backups.');
}

function startDemoProfile() {
  setProfileMode('demo', { autosave: false });
  render({ autosave: true });
  setSaveStatus('Started demo mode. Sample data and fixture workflows are safe here.');
}

function priorBaseline() {
  const spending = Number($('priorSpendingInput').value || 0);
  const income = Number($('priorIncomeInput').value || 0);
  const savings = Number($('priorSavingsInput').value || 0);
  const debt = Number($('priorDebtInput').value || 0);
  return {
    spending,
    income,
    savings,
    debt,
    savingsRate: income ? (savings / income) * 100 : NaN,
    hasAny: Boolean(spending || income || savings || debt),
  };
}

function calculateDelta(current, prior) {
  if (!prior) return { absolute: null, percent: null };
  const absolute = current - prior;
  const percent = prior ? (absolute / prior) * 100 : null;
  return { absolute, percent };
}

function debtSnapshot() {
  const start = Number($('debtStartInput').value || 0);
  const current = Number($('debtCurrentInput').value || 0);
  const planned = Number($('debtPlannedInput').value || 0);
  const actual = Number($('debtActualInput').value || 0);
  const progress = start && current ? Math.max(0, start - current) : 0;
  const progressPct = start ? (progress / start) * 100 : NaN;
  const planVariance = actual - planned;
  return {
    start,
    current,
    planned,
    actual,
    progress,
    progressPct,
    planVariance,
    hasAny: Boolean(start || current || planned || actual),
  };
}

function calculateSnapshot() {
  const txs = selectedMonthTransactions();
  const incomeInput = Number($('incomeInput').value || 0);
  const savingsInput = Number($('savingsInput').value || 0);
  const incomeFromTransactions = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const income = incomeInput || incomeFromTransactions;
  const spendableExpenses = txs.filter((t) => t.amount < 0 && !['transfer', 'savings', 'debt'].includes(t.class));
  const fixedExpenses = Math.abs(spendableExpenses.filter((t) => t.class === 'fixed').reduce((s, t) => s + t.amount, 0));
  const variableExpenses = Math.abs(spendableExpenses.filter((t) => t.class !== 'fixed').reduce((s, t) => s + t.amount, 0));
  const transfers = Math.abs(txs.filter((t) => t.amount < 0 && t.class === 'transfer').reduce((s, t) => s + t.amount, 0));
  const debtPayments = Math.abs(txs.filter((t) => t.amount < 0 && t.class === 'debt').reduce((s, t) => s + t.amount, 0));
  const savingsTransfers = Math.abs(txs.filter((t) => t.amount < 0 && t.class === 'savings').reduce((s, t) => s + t.amount, 0));
  const expenses = fixedExpenses + variableExpenses;
  const net = income - expenses;
  const savingsRate = income ? (savingsInput / income) * 100 : NaN;
  const uncategorized = txs.filter((t) => !t.category).length;
  const byCategory = new Map();
  const variances = [];
  for (const tx of spendableExpenses) {
    const cat = tx.category || 'Uncategorized';
    byCategory.set(cat, (byCategory.get(cat) || 0) + Math.abs(tx.amount));
  }
  for (const [category, target] of state.targets.entries()) {
    const actual = byCategory.get(category) || 0;
    variances.push({ category, target, actual, variance: actual - target });
  }
  for (const [category, actual] of byCategory.entries()) {
    if (!state.targets.has(category)) variances.push({ category, target: null, actual, variance: null });
  }
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const largestOverage = variances.filter((v) => v.target !== null && v.variance > 0).sort((a, b) => b.variance - a.variance)[0];
  const prior = priorBaseline();
  const comparison = {
    prior,
    spending: calculateDelta(expenses, prior.spending),
    income: calculateDelta(income, prior.income),
    savings: calculateDelta(savingsInput, prior.savings),
    savingsRate: Number.isFinite(prior.savingsRate) && Number.isFinite(savingsRate) ? savingsRate - prior.savingsRate : null,
  };
  const debt = debtSnapshot();
  return { txs, income, expenses, fixedExpenses, variableExpenses, transfers, debtPayments, savingsTransfers, net, savingsInput, savingsRate, uncategorized, byCategory, topCategory, variances, largestOverage, comparison, debt };
}

function render({ autosave = false } = {}) {
  applyRules();
  syncProfileModeUi();
  syncViewModeUi();
  const snap = calculateSnapshot();
  $('snapshotSubtitle').textContent = `${snap.txs.length} transaction(s) in current view · ${snap.uncategorized} uncategorized`;
  renderMetrics(snap);
  renderPlanningSpineSummary();
  renderBlueprintSummary();
  renderCashExpensesSummary();
  renderCashSummary();
  renderNetWorthSummary();
  renderInvestingBtcSummary();
  renderTradesSummary();
  renderPaycheckSummary();
  renderDashboard(snap);
  renderImportReview();
  renderSummary(snap);
  renderCharts(snap);
  renderSnapshotLedger();
  renderTrendChart();
  renderTargetsEditor();
  renderCategories(snap);
  renderReview(snap.txs);
  renderTransactions(snap.txs);
  if (autosave) saveProfileToLocal('Autosaved locally.');
}

function attentionItems(snap) {
  const currentMonth = $('reportMonth').value;
  const savedMonths = new Set(sortedSnapshots().map((s) => s.month));
  const items = [];
  if (state.profileMode === 'demo') items.push({ level: 'warn', title: 'Demo mode is active', detail: 'Reports and saved history should not be treated as real financial records.' });
  if (snap.uncategorized) items.push({ level: 'bad', title: `${snap.uncategorized} uncategorized transaction(s)`, detail: 'Review categories/classes before using the report.' });
  if (!snap.comparison.prior.hasAny && sortedSnapshots().length < 2) items.push({ level: 'warn', title: 'No prior-month baseline', detail: 'Import or save history to make month-over-month comparisons useful.' });
  if (currentMonth && !savedMonths.has(currentMonth)) items.push({ level: 'warn', title: 'Current month not saved to history', detail: 'Save the monthly snapshot after review to preserve the trend ledger.' });
  if (state.cashExpensesSource === 'baseline' && state.profileMode === 'real') items.push({ level: 'warn', title: 'Cash/Expenses still on workbook baseline', detail: 'Derive from live data or mark a manual override for real reporting.' });
  if (!state.transactions.length && state.profileMode === 'real') items.push({ level: 'warn', title: 'No transactions imported', detail: 'Import bank/card CSVs to make the monthly snapshot real.' });
  if (!items.length) items.push({ level: 'good', title: 'Nothing urgent', detail: 'Core review checks look clean for the current profile state.' });
  return items;
}

function renderDashboard(snap) {
  const nw = netWorthSnapshot();
  const ib = state.investingBtc || investingBtcSnapshot();
  const trades = state.trades || tradesSnapshot();
  const tradeYear = trades.years?.[$('reportMonth').value.slice(0, 4)] || Object.values(trades.years || {})[0];
  const metrics = [
    ['Net cash flow', money(snap.net), `${money(snap.income)} income − ${money(snap.expenses)} spending`, snap.net >= 0 ? 'good' : 'bad'],
    ['Savings rate', pct(snap.savingsRate), `${money(snap.savingsInput)} saved/invested`, Number(snap.savingsRate) >= 15 ? 'good' : 'warn'],
    ['Net worth', money(nw.netWorth), `${money(nw.assets)} assets · ${money(nw.liabilities)} liabilities`, nw.netWorth >= 0 ? 'good' : 'bad'],
    ['BTC exposure', money(ib.investing?.btcValue || nw.btc || 0), `${pct((ib.investing?.spotCryptoActualPct || 0) * 100)} of tracked allocation`, 'neutral'],
    ['Trades realized G/L', money(tradeYear?.summary?.netRealizedGainLoss || 0), `${tradeYear?.year || 'No'} taxable-sale year`, (tradeYear?.summary?.netRealizedGainLoss || 0) >= 0 ? 'good' : 'warn'],
  ];
  $('dashboardMetrics').innerHTML = metrics.map(([label, value, note, tone]) => `<article class="dashboard-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');
  $('attentionList').innerHTML = attentionItems(snap).map((item) => `<article class="attention-item ${item.level}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></article>`).join('');
  const lines = [
    `Profile: ${profileModeLabel()} · ${$('reportMonth').value || 'no month selected'}.`,
    `Spending is ${money(snap.expenses)} with ${money(snap.variableExpenses)} variable and ${money(snap.fixedExpenses)} fixed.`,
    Number.isFinite(snap.savingsRate) ? `Savings rate is ${pct(snap.savingsRate)}.` : 'Savings rate needs income/savings inputs.',
    `Monthly history has ${sortedSnapshots().length} saved snapshot(s).`,
  ];
  $('operatingSummary').innerHTML = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

function renderMetrics(snap) {
  const metrics = [
    ['Income', money(snap.income), 'Manual input or imported credits'],
    ['Spending', money(snap.expenses), 'Excludes transfers, savings, debt'],
    ['Variable / fixed', `${money(snap.variableExpenses)} / ${money(snap.fixedExpenses)}`, 'Variable vs fixed spending'],
    ['Savings rate', pct(snap.savingsRate), 'Savings ÷ income'],
  ];
  $('metrics').innerHTML = metrics.map(([label, value, note]) => `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
}

function renderSummary(snap) {
  const lines = [];
  if (!snap.txs.length) lines.push('Import transactions to generate a plain-English monthly summary.');
  else {
    lines.push(`This month shows ${money(snap.expenses)} in budget spending against ${money(snap.income)} of income, excluding transfers, savings, and debt payments.`);
    if (snap.transfers || snap.savingsTransfers || snap.debtPayments) lines.push(`Excluded non-spending outflows: ${money(snap.transfers)} transfers, ${money(snap.savingsTransfers)} savings/investing, and ${money(snap.debtPayments)} debt payments.`);
    if (snap.topCategory) lines.push(`Largest spending category: ${snap.topCategory[0]} at ${money(snap.topCategory[1])}.`);
    if (snap.comparison.prior.hasAny) lines.push(...comparisonLines(snap));
    if (snap.largestOverage) lines.push(`${snap.largestOverage.category} exceeded target by ${money(snap.largestOverage.variance)}.`);
    if (snap.debt.hasAny) lines.push(...debtLines(snap.debt));
    if (Number.isFinite(snap.savingsRate)) lines.push(`Savings rate is ${pct(snap.savingsRate)} based on the savings/investing amount entered above.`);
    if (snap.uncategorized) lines.push(`${snap.uncategorized} transaction(s) still need review before the report is final.`);
  }
  $('summary').innerHTML = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

function comparisonLines(snap) {
  const lines = [];
  const spending = snap.comparison.spending;
  if (snap.comparison.prior.spending && spending.percent !== null) {
    const direction = spending.absolute >= 0 ? 'up' : 'down';
    lines.push(`Spending was ${direction} ${pct(Math.abs(spending.percent))} vs last month (${money(Math.abs(spending.absolute))} ${direction}).`);
  }
  const income = snap.comparison.income;
  if (snap.comparison.prior.income && income.percent !== null) {
    const direction = income.absolute >= 0 ? 'up' : 'down';
    lines.push(`Income was ${direction} ${pct(Math.abs(income.percent))} vs last month.`);
  }
  const savings = snap.comparison.savings;
  if (snap.comparison.prior.savings && savings.percent !== null) {
    const direction = savings.absolute >= 0 ? 'up' : 'down';
    lines.push(`Savings/investing was ${direction} ${pct(Math.abs(savings.percent))} vs last month.`);
  }
  if (snap.comparison.savingsRate !== null) {
    const direction = snap.comparison.savingsRate >= 0 ? 'improved' : 'declined';
    lines.push(`Savings rate ${direction} from ${pct(snap.comparison.prior.savingsRate)} to ${pct(snap.savingsRate)}.`);
  }
  return lines;
}

function debtLines(debt) {
  const lines = [];
  if (debt.planned || debt.actual) {
    const direction = debt.planVariance >= 0 ? 'ahead of' : 'behind';
    lines.push(`Debt payoff is ${direction} plan by ${money(Math.abs(debt.planVariance))} this month.`);
  }
  if (debt.start && debt.current) {
    lines.push(`Total debt is down ${money(debt.progress)} (${pct(debt.progressPct)}) from the starting balance.`);
  } else if (debt.current) {
    lines.push(`Current debt balance is ${money(debt.current)}.`);
  }
  return lines;
}

function renderCharts(snap) {
  renderCategoryChart(snap);
  renderMixChart(snap);
}

function renderCategoryChart(snap) {
  const entries = [...snap.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) { $('categoryChart').innerHTML = '<p>No spending categories yet.</p>'; return; }
  const max = Math.max(...entries.map(([, total]) => total), 1);
  $('categoryChart').innerHTML = entries.map(([category, total]) => {
    const width = Math.max(2, (total / max) * 100);
    return `<div class="bar-row"><div class="bar-label" title="${escapeHtml(category)}">${escapeHtml(category)}</div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><div class="bar-value">${money(total)}</div></div>`;
  }).join('');
}

function renderMixChart(snap) {
  const total = snap.fixedExpenses + snap.variableExpenses;
  if (!total) { $('mixChart').innerHTML = '<p>No fixed/variable spending yet.</p>'; return; }
  const fixedPct = (snap.fixedExpenses / total) * 100;
  const variablePct = (snap.variableExpenses / total) * 100;
  $('mixChart').innerHTML = `
    <div class="mix-stack">
      <div class="mix-segment mix-fixed" style="width:${fixedPct}%">${fixedPct >= 16 ? pct(fixedPct) : ''}</div>
      <div class="mix-segment mix-variable" style="width:${variablePct}%">${variablePct >= 16 ? pct(variablePct) : ''}</div>
    </div>
    <div class="mix-legend">
      <div><span class="legend-dot mix-fixed"></span>Fixed: ${money(snap.fixedExpenses)} (${pct(fixedPct)})</div>
      <div><span class="legend-dot mix-variable"></span>Variable: ${money(snap.variableExpenses)} (${pct(variablePct)})</div>
    </div>`;
}

function snapshotObject() {
  return Object.fromEntries(snapshotRows().map(([key, value]) => [key, value]));
}

function normalizeSnapshotObject(snapshot) {
  const normalized = { ...snapshot };
  normalized.month = String(normalized.month || '').slice(0, 7);
  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'month' || value === '') continue;
    const n = Number(value);
    if (!Number.isNaN(n)) normalized[key] = n;
  }
  return normalized;
}

function sortedSnapshots() {
  return [...state.monthlySnapshots].map(normalizeSnapshotObject).filter((s) => s.month).sort((a, b) => a.month.localeCompare(b.month));
}

function saveCurrentSnapshotToLedger() {
  const current = normalizeSnapshotObject(snapshotObject());
  if (!current.month) { setSaveStatus('Choose a report month before saving a snapshot.'); return; }
  current.profile_mode = state.profileMode;
  current.profile_mode_label = profileModeLabel();
  if (state.profileMode === 'demo' && !confirm('Save this demo-mode snapshot? It will remain labeled Demo mode and should not be mixed with real history.')) return;
  state.monthlySnapshots = sortedSnapshots().filter((s) => s.month !== current.month);
  state.monthlySnapshots.push(current);
  state.monthlySnapshots = sortedSnapshots();
  render({ autosave: true });
  setSaveStatus(`Saved ${current.month} to monthly history.`);
}

function deleteSnapshotMonth(month) {
  state.monthlySnapshots = sortedSnapshots().filter((s) => s.month !== month);
  render({ autosave: true });
  setSaveStatus(`Removed ${month} from monthly history.`);
}

function renderSnapshotLedger() {
  const snapshots = sortedSnapshots();
  if (!$('snapshotHistoryStatus')) return;
  $('snapshotHistoryStatus').textContent = snapshots.length ? `${snapshots.length} saved monthly snapshot(s).` : 'No saved monthly snapshots yet.';
  if (!snapshots.length) { $('snapshotLedgerTable').innerHTML = '<p>Save monthly snapshots to build a private trend history.</p>'; return; }
  const rows = snapshots.map((s) => `<tr><td>${escapeHtml(s.month)}</td><td><span class="mode-chip ${escapeHtml(s.profile_mode || 'demo')}">${escapeHtml(profileModeLabel(s.profile_mode || 'demo'))}</span></td><td>${money(s.income)}</td><td>${money(s.spending)}</td><td>${pct(Number(s.savings_rate_pct || 0))}</td><td>${money(s.net_worth)}</td><td>${money(s.investing_btc_value)}</td><td><button data-delete-snapshot="${escapeHtml(s.month)}">Remove</button></td></tr>`).join('');
  $('snapshotLedgerTable').innerHTML = `<table><thead><tr><th>Month</th><th>Mode</th><th>Income</th><th>Spending</th><th>Savings rate</th><th>Net worth</th><th>BTC value</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTrendChart() {
  const snapshots = sortedSnapshots();
  if (!$('trendChart')) return;
  if (snapshots.length < 2) { $('trendChart').innerHTML = '<p>Save at least two months to show trends.</p>'; return; }
  const series = [
    ['Spending', 'spending', 'trend-spending'],
    ['Savings rate', 'savings_rate_pct', 'trend-savings'],
    ['Net worth', 'net_worth', 'trend-networth'],
    ['BTC value', 'investing_btc_value', 'trend-btc'],
  ];
  $('trendChart').innerHTML = series.map(([label, key, klass]) => {
    const values = snapshots.map((s) => Number(s[key] || 0));
    const max = Math.max(...values.map((v) => Math.abs(v)), 1);
    const bars = snapshots.map((s, i) => {
      const value = values[i];
      const height = Math.max(3, Math.abs(value) / max * 100);
      const display = key.includes('pct') ? pct(value) : money(value);
      return `<div class="trend-bar-wrap" title="${escapeHtml(s.month)} · ${escapeHtml(display)}"><div class="trend-bar ${klass}" style="height:${height}%"></div><small>${escapeHtml(s.month.slice(5))}</small></div>`;
    }).join('');
    return `<div class="trend-card"><h3>${escapeHtml(label)}</h3><div class="trend-bars">${bars}</div></div>`;
  }).join('');
}

function snapshotsHistoryToCsv() {
  const headers = ['month','profile_mode','profile_mode_label','income','spending','net_cash_flow','savings','savings_rate_pct','fixed_spending','variable_spending','liquid_accounts_total','assets_total','liabilities_total','net_worth','btc_assets','investing_btc_value','investing_btc_unrealized_pl','investing_btc_ledn_ltv','debt_current_balance','uncategorized_transactions'];
  return objectsToCsv(sortedSnapshots(), headers);
}

function renderTargetsEditor() {
  renderSimpleEditor(targetsEditor);
}

function renderCategories(snap) {
  const entries = snap.variances.sort((a, b) => b.actual - a.actual);
  if (!entries.length) { $('categoryTable').innerHTML = '<p>No expense categories yet.</p>'; return; }
  $('categoryTable').innerHTML = `<div class="category-grid">${entries.map((v) => {
    const status = v.target === null ? '' : v.variance > 0 ? 'over' : 'under';
    const note = v.target === null ? 'No target set' : `${money(v.actual)} / ${money(v.target)} · ${v.variance > 0 ? 'over' : 'under'} by ${money(Math.abs(v.variance))}`;
    return `<article class="category-card ${status}"><span>${escapeHtml(v.category)}</span><strong>${money(v.actual)}</strong><small>${escapeHtml(note)}</small></article>`;
  }).join('')}</div>`;
}

function renderReview(txs) {
  const uncategorized = txs.filter((tx) => !tx.category);
  if (!uncategorized.length) { $('reviewTable').innerHTML = '<p>Nothing needs review. Nice.</p>'; return; }
  const knownCategories = [...new Set([...state.targets.keys(), ...state.rules.map((r) => r.category).filter(Boolean)])].sort();
  const classOptions = ['variable', 'fixed', 'transfer', 'savings', 'debt', 'income'];
  const rows = uncategorized.slice(0, 100).map((tx) => {
    const idx = state.transactions.indexOf(tx);
    const options = [''].concat(knownCategories).map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat || 'Choose category')}</option>`).join('');
    const classSelect = classOptions.map((klass) => `<option value="${klass}">${klass}</option>`).join('');
    return `<tr><td>${escapeHtml(tx.date)}</td><td>${escapeHtml(tx.description_clean)}</td><td>${money(tx.amount)}</td><td><div class="review-actions"><select data-review-index="${idx}">${options}</select><input data-new-category="${idx}" placeholder="or new category" /><select data-class-index="${idx}">${classSelect}</select></div></td></tr>`;
  }).join('');
  $('reviewTable').innerHTML = `<table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Assign category</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('reviewTable').querySelectorAll('select[data-review-index]').forEach((el) => el.addEventListener('change', (event) => assignManualCategory(event.target.dataset.reviewIndex, event.target.value)));
  $('reviewTable').querySelectorAll('input[data-new-category]').forEach((el) => el.addEventListener('change', (event) => assignManualCategory(event.target.dataset.newCategory, event.target.value)));
  $('reviewTable').querySelectorAll('select[data-class-index]').forEach((el) => el.addEventListener('change', (event) => assignManualClass(event.target.dataset.classIndex, event.target.value)));
}

function transactionKey(tx) {
  return [tx.date || '', tx.description_clean || tx.description_raw || '', Number(tx.amount || 0).toFixed(2), tx.account || '', tx.institution || ''].join('|').toLowerCase();
}

function importDiagnostics(headers, presetName, imported) {
  const preset = importPresets[presetName] || importPresets.auto;
  const headerSet = new Set(headers.map(normalizeHeader));
  const hasAny = (keys) => keys.some((key) => headerSet.has(normalizeHeader(key)));
  const detected = [];
  const checks = [
    ['date', [...(preset.date || []), 'date', 'transaction_date', 'posted_date', 'post_date']],
    ['description', [...(preset.description || []), 'description', 'description_raw', 'memo', 'name', 'payee', 'transaction', 'merchant', 'details']],
    ['amount', [...(preset.amount || []), 'amount', 'transaction_amount', 'amount_usd']],
    ['debit', [...(preset.debit || []), 'debit', 'withdrawal', 'charge', 'paid_out']],
    ['credit', [...(preset.credit || []), 'credit', 'deposit', 'payment', 'paid_in']],
    ['category', [...(preset.category || []), 'category']],
    ['account', [...(preset.account || []), 'account', 'account_name', 'account_number', 'account_']],
    ['type', [...(preset.type || []), 'type', 'transaction_type']],
  ];
  const present = Object.fromEntries(checks.map(([name, keys]) => [name, hasAny(keys)]));
  for (const [name, isPresent] of Object.entries(present)) if (isPresent) detected.push(name);
  const missing = [];
  if (!present.date) missing.push('date');
  if (!present.description) missing.push('description');
  if (!present.amount && !(present.debit || present.credit)) missing.push('amount/debit-credit');
  let signPolicy = 'signed amount column';
  if (present.debit || present.credit) signPolicy = 'debit/credit split: debits become expenses, credits become inflows';
  else if (preset.amount_sign === 'expenses_positive') signPolicy = 'positive card charges inverted to expenses';
  else if (present.type) signPolicy = 'transaction type may invert purchases/sales to expenses';
  const nonZero = imported.map((tx) => Number(tx.amount || 0)).filter((amount) => amount !== 0);
  const sameSign = nonZero.length >= 3 && (nonZero.every((amount) => amount > 0) || nonZero.every((amount) => amount < 0));
  return {
    detectedColumns: detected,
    missingFields: missing,
    signPolicy,
    suspicious: sameSign ? [`All ${nonZero.length} imported non-zero amounts have the same sign; confirm this matches the institution export.`] : [],
  };
}

function renderImportReview() {
  const review = state.lastImportReview;
  const el = $('importReview');
  if (!el) return;
  if (!review) {
    el.innerHTML = '<p class="save-status">Import review will appear after transaction CSV import.</p>';
    return;
  }
  const warningList = [...(review.warnings || []), ...(review.suspicious || [])];
  const warnings = warningList.length ? `<ul>${warningList.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '<p>No import warnings.</p>';
  const missing = review.missingFields?.length ? review.missingFields.join(', ') : 'none';
  const detected = review.detectedColumns?.length ? review.detectedColumns.join(', ') : 'none';
  el.innerHTML = `<div class="import-review-card"><strong>Last import review</strong><div class="mini-grid"><span>Preset: <b>${escapeHtml(review.preset)}</b></span><span>Files: <b>${escapeHtml(review.files.join(', '))}</b></span><span>Rows read: <b>${review.rowsRead}</b></span><span>Imported: <b>${review.imported}</b></span><span>Duplicates skipped: <b>${review.duplicatesSkipped}</b></span><span>Uncategorized: <b>${review.uncategorized}</b></span><span>Date range: <b>${escapeHtml(review.dateRange || '—')}</b></span><span>Sign policy: <b>${escapeHtml(review.signPolicy || '—')}</b></span><span>Detected fields: <b>${escapeHtml(detected)}</b></span><span>Missing fields: <b>${escapeHtml(missing)}</b></span></div>${warnings}</div>`;
}

function closeMonthWorkflow() {
  const snap = calculateSnapshot();
  const blockers = attentionItems(snap).filter((item) => item.level === 'bad');
  if (blockers.length && !confirm(`Close month with ${blockers.length} unresolved critical item(s)?`)) return;
  if (state.profileMode === 'demo' && !confirm('Close month in Demo mode? The saved snapshot will stay labeled Demo mode.')) return;
  const current = normalizeSnapshotObject(snapshotObject());
  current.profile_mode = state.profileMode;
  current.profile_mode_label = profileModeLabel();
  current.closed_at = new Date().toISOString();
  state.monthlySnapshots = sortedSnapshots().filter((s) => s.month !== current.month);
  state.monthlySnapshots.push(current);
  state.monthlySnapshots = sortedSnapshots();
  setViewMode('report', { autosave: false });
  render({ autosave: true });
  setSaveStatus(`Closed ${current.month}: snapshot saved and Report Mode opened. Export encrypted backup when ready.`);
}

function assignManualCategory(index, category) {
  const tx = state.transactions[Number(index)];
  if (!tx || !category.trim()) return;
  tx.manual_category = category.trim();
  tx.manual_subcategory = '';
  tx.manual_class = inferClass(category, tx.direction);
  render({ autosave: true });
}

function assignManualClass(index, klass) {
  const tx = state.transactions[Number(index)];
  if (!tx || !klass) return;
  tx.manual_class = klass;
  tx.class = klass;
  render({ autosave: true });
}

function profileObject() {
  return {
    version: 1,
    saved_at: new Date().toISOString(),
    profile_mode: state.profileMode,
    profile_mode_label: profileModeLabel(),
    view_mode: state.viewMode,
    report_month: $('reportMonth').value,
    income: $('incomeInput').value,
    savings: $('savingsInput').value,
    prior: {
      spending: $('priorSpendingInput').value,
      income: $('priorIncomeInput').value,
      savings: $('priorSavingsInput').value,
      debt: $('priorDebtInput').value,
    },
    blueprint: state.blueprint,
    blueprint_text: $('blueprintInput').value,
    blueprint_income: $('blueprintIncomeInput').value,
    targets_source: state.targetsSource,
    accounts: state.accounts,
    accounts_text: $('accountsInput').value,
    net_worth_items: state.netWorthItems,
    net_worth_text: $('netWorthInput').value,
    planning: state.planning,
    planning_assumptions_text: $('planningAssumptionsInput').value,
    cash_expenses: state.cashExpenses,
    cash_expenses_source: state.cashExpensesSource,
    cash_expenses_assumptions_text: $('cashExpensesAssumptionsInput').value,
    investing_btc: state.investingBtc,
    investing_btc_assumptions_text: $('investingBtcAssumptionsInput').value,
    trades: state.trades,
    trades_text: $('tradesInput').value,
    paycheck: state.paycheck,
    paycheck_inputs: {
      gross: $('payGrossInput').value,
      paychecks: $('paychecksInput').value,
      pretax: $('payPretaxInput').value,
      posttax: $('payPosttaxInput').value,
      tax_rate_pct: $('payTaxRateInput').value,
      extra_withholding: $('payExtraWithholdingInput').value,
    },
    debt: {
      start: $('debtStartInput').value,
      current: $('debtCurrentInput').value,
      planned: $('debtPlannedInput').value,
      actual: $('debtActualInput').value,
    },
    rules: state.rules,
    targets: [...state.targets.entries()].map(([category, monthly_target]) => ({ category, monthly_target })),
    transactions: state.transactions,
    monthly_snapshots: sortedSnapshots(),
    import_history: state.importHistory,
    last_import_review: state.lastImportReview,
  };
}

function loadProfileObject(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('Invalid profile JSON');
  state.profileMode = ['demo', 'real', 'workbook_baseline'].includes(profile.profile_mode) ? profile.profile_mode : state.profileMode;
  state.viewMode = ['edit', 'report'].includes(profile.view_mode) ? profile.view_mode : state.viewMode;
  if (profile.report_month) $('reportMonth').value = profile.report_month;
  $('incomeInput').value = profile.income ?? '';
  $('savingsInput').value = profile.savings ?? '';
  $('blueprintInput').value = profile.blueprint_text ?? $('blueprintInput').value;
  $('blueprintIncomeInput').value = profile.blueprint_income ?? profile.income ?? '';
  $('accountsInput').value = profile.accounts_text ?? $('accountsInput').value;
  $('netWorthInput').value = profile.net_worth_text ?? $('netWorthInput').value;
  $('planningAssumptionsInput').value = profile.planning_assumptions_text ?? $('planningAssumptionsInput').value;
  try { setPlanningFieldsFromObject(JSON.parse($('planningAssumptionsInput').value || planningDefaultsJson())); } catch {}
  $('cashExpensesAssumptionsInput').value = profile.cash_expenses_assumptions_text ?? $('cashExpensesAssumptionsInput').value;
  state.cashExpensesSource = profile.cash_expenses_source || state.cashExpensesSource || 'baseline';
  $('investingBtcAssumptionsInput').value = profile.investing_btc_assumptions_text ?? $('investingBtcAssumptionsInput').value;
  $('tradesInput').value = profile.trades_text ?? $('tradesInput').value;
  $('payGrossInput').value = profile.paycheck_inputs?.gross ?? '';
  $('paychecksInput').value = profile.paycheck_inputs?.paychecks ?? '26';
  $('payPretaxInput').value = profile.paycheck_inputs?.pretax ?? '';
  $('payPosttaxInput').value = profile.paycheck_inputs?.posttax ?? '';
  $('payTaxRateInput').value = profile.paycheck_inputs?.tax_rate_pct ?? '';
  $('payExtraWithholdingInput').value = profile.paycheck_inputs?.extra_withholding ?? '';
  $('priorSpendingInput').value = profile.prior?.spending ?? '';
  $('priorIncomeInput').value = profile.prior?.income ?? '';
  $('priorSavingsInput').value = profile.prior?.savings ?? '';
  $('priorDebtInput').value = profile.prior?.debt ?? '';
  $('debtStartInput').value = profile.debt?.start ?? '';
  $('debtCurrentInput').value = profile.debt?.current ?? '';
  $('debtPlannedInput').value = profile.debt?.planned ?? '';
  $('debtActualInput').value = profile.debt?.actual ?? '';
  state.blueprint = Array.isArray(profile.blueprint) ? profile.blueprint : parseBlueprint($('blueprintInput').value, $('blueprintIncomeInput').value);
  state.targetsSource = profile.targets_source || (profile.targets?.length ? 'manual' : 'blueprint');
  state.accounts = Array.isArray(profile.accounts) ? profile.accounts : parseAccounts($('accountsInput').value);
  state.netWorthItems = Array.isArray(profile.net_worth_items) ? profile.net_worth_items : parseNetWorthItems($('netWorthInput').value);
  state.paycheck = profile.paycheck || paycheckSnapshot();
  state.rules = Array.isArray(profile.rules) ? profile.rules : sampleRules.map(normalizeRule);
  state.targets = new Map((profile.targets || []).map((t) => [String(t.category), Number(t.monthly_target || 0)]));
  if (state.targets.size && state.targetsSource !== 'blueprint') $('targetsInput').value = [...state.targets.entries()].map(([cat, target]) => `${cat},${target}`).join('\n');
  state.transactions = Array.isArray(profile.transactions) ? profile.transactions : [];
  state.monthlySnapshots = Array.isArray(profile.monthly_snapshots) ? profile.monthly_snapshots.map(normalizeSnapshotObject) : [];
  state.importHistory = Array.isArray(profile.import_history) ? profile.import_history : [];
  state.lastImportReview = profile.last_import_review || state.importHistory.at?.(-1) || null;
  render();
}

function setSaveStatus(message) {
  $('saveStatus').textContent = message;
}

function saveProfileToLocal(message = 'Saved locally.') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profileObject()));
  setSaveStatus(message);
}

function loadProfileFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { setSaveStatus('No local profile found yet.'); return; }
  loadProfileObject(JSON.parse(raw));
  setSaveStatus('Loaded local profile.');
}

function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function deriveProfileKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptProfileObject(profile, password) {
  if (!password) throw new Error('Enter a password before encrypted export.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveProfileKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(profile));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    format: 'personal-budget-automation-encrypted-profile',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: 250000,
    cipher: 'AES-256-GCM',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

async function decryptProfileObject(envelope, password) {
  if (!password) throw new Error('Enter the password used for this encrypted profile.');
  if (envelope?.format !== 'personal-budget-automation-encrypted-profile') throw new Error('Not an encrypted budget profile.');
  const key = await deriveProfileKey(password, base64ToBytes(envelope.salt));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function renderTransactions(txs) {
  const headers = ['date', 'description_clean', 'amount', 'direction', 'category', 'subcategory', 'class', 'institution', 'review_status'];
  const rows = txs.slice(0, 500).map((tx) => `<tr class="${tx.category ? '' : 'uncategorized'}">${headers.map((h) => `<td>${escapeHtml(h === 'amount' ? money(tx[h]) : tx[h])}</td>`).join('')}</tr>`).join('');
  $('transactionsTable').innerHTML = `<thead><tr>${headers.map((h) => `<th>${h.replaceAll('_', ' ')}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function toCsv(rows) {
  const headers = ['date','posted_date','description_raw','description_clean','amount','direction','account','institution','category','subcategory','class','rule_id','notes','review_status'];
  return objectsToCsv(rows, headers);
}

function objectsToCsv(rows, headers) {
  return [headers.join(','), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(','))].join('\n');
}

function rulesToCsv() {
  const headers = ['priority','match_type','pattern','category','subcategory','class','direction_hint','account_hint','active'];
  return objectsToCsv(state.rules, headers);
}

function blueprintToCsv() {
  const headers = ['category','class','monthly_target','allocation_pct'];
  return objectsToCsv(state.blueprint.length ? state.blueprint : parseBlueprint($('blueprintInput').value, $('blueprintIncomeInput').value), headers);
}

function targetsToCsv() {
  return ['category,monthly_target', ...[...state.targets.entries()].map(([cat, target]) => `${csvCell(cat)},${target}`)].join('\n');
}

function snapshotRows() {
  const snap = calculateSnapshot();
  const nw = netWorthSnapshot();
  const planning = planningSnapshot();
  const cx = cashExpensesSnapshot();
  const ib = investingBtcSnapshot();
  return [
    ['month', $('reportMonth').value],
    ['profile_mode', state.profileMode],
    ['profile_mode_label', profileModeLabel()],
    ['income', snap.income],
    ['spending', snap.expenses],
    ['net_cash_flow', snap.net],
    ['fixed_spending', snap.fixedExpenses],
    ['variable_spending', snap.variableExpenses],
    ['excluded_transfers', snap.transfers],
    ['excluded_savings_transfers', snap.savingsTransfers],
    ['excluded_debt_payments', snap.debtPayments],
    ['savings', snap.savingsInput],
    ['savings_rate_pct', Number.isFinite(snap.savingsRate) ? snap.savingsRate : ''],
    ['liquid_accounts_total', state.accounts.reduce((s, a) => s + Number(a.balance || 0), 0)],
    ['assets_total', nw.assets],
    ['liabilities_total', nw.liabilities],
    ['net_worth', nw.netWorth],
    ['btc_assets', nw.btc],
    ['btc_asset_pct', Number.isFinite(nw.btcAssetPct) ? nw.btcAssetPct : ''],
    ['leverage', Number.isFinite(nw.leverage) ? nw.leverage : ''],
    ['paycheck_net', state.paycheck.net || ''],
    ['monthly_net_pay', state.paycheck.monthly_net || ''],
    ['annual_net_pay', state.paycheck.annual_net || ''],
    ['budget_monthly_surplus_deficit', state.paycheck.monthly_surplus || ''],
    ['planning_total_net_monthly', planning.income?.totalNetMonthly || ''],
    ['planning_total_monthly_need', planning.need?.totalMonthlyNeed || ''],
    ['planning_monthly_remaining', planning.need?.monthlyRemaining || ''],
    ['planning_gross_income_needed', planning.need?.grossIncomeNeeded || ''],
    ['cash_expenses_spend_deposit_diff', cx.expenses?.diffs?.spendDepositDiff || ''],
    ['cash_expenses_savings_misc_diff', cx.expenses?.diffs?.savingsMiscDiff || ''],
    ['cash_expenses_total_actual_liquid_assets', cx.cash?.totalActualLiquidAssets || ''],
    ['cash_expenses_theoretical_liquid_assets', cx.cash?.theoreticalLiquidAssets || ''],
    ['cash_expenses_reconciliation_diff', cx.cash?.reconciliationDiff || ''],
    ['investing_btc_price', ib.investing?.btcPrice || ''],
    ['investing_btc_holdings', ib.investing?.btcHoldings || ''],
    ['investing_btc_value', ib.investing?.btcValue || ''],
    ['investing_total_current_value', ib.investing?.totalCurrentValue || ''],
    ['investing_btc_unrealized_pl', ib.btc?.unrealizedPl || ''],
    ['investing_btc_ledn_ltv', ib.btc?.lednLtv || ''],
    ['trades_2026_net_realized_gl', state.trades?.years?.['2026']?.summary?.netRealizedGainLoss ?? ''],
    ['trades_2026_total_proceeds', state.trades?.years?.['2026']?.summary?.totalProceeds ?? ''],
    ['trades_2026_total_cost_basis', state.trades?.years?.['2026']?.summary?.totalCostBasis ?? ''],
    ['uncategorized_transactions', snap.uncategorized],
    ['prior_spending', snap.comparison.prior.spending || ''],
    ['prior_income', snap.comparison.prior.income || ''],
    ['prior_savings', snap.comparison.prior.savings || ''],
    ['spending_change_pct', snap.comparison.spending.percent ?? ''],
    ['income_change_pct', snap.comparison.income.percent ?? ''],
    ['savings_change_pct', snap.comparison.savings.percent ?? ''],
    ['debt_start_balance', snap.debt.start || ''],
    ['debt_current_balance', snap.debt.current || ''],
    ['debt_planned_payoff', snap.debt.planned || ''],
    ['debt_actual_payoff', snap.debt.actual || ''],
    ['debt_plan_variance', snap.debt.hasAny ? snap.debt.planVariance : ''],
    ['debt_progress_pct', Number.isFinite(snap.debt.progressPct) ? snap.debt.progressPct : ''],
  ];
}

function snapshotToCsv() {
  return snapshotRows().map((r) => r.map(csvCell).join(',')).join('\n');
}

function keyValueCsvToObject(text) {
  const rows = parseCsv(text);
  const out = {};
  for (const row of rows) {
    if (!row[0]) continue;
    out[String(row[0]).trim()] = row[1] ?? '';
  }
  return out;
}

function importPriorBaselineFromSnapshotObject(obj) {
  $('priorSpendingInput').value = obj.spending ?? obj.expenses ?? '';
  $('priorIncomeInput').value = obj.income ?? '';
  $('priorSavingsInput').value = obj.savings ?? '';
  $('priorDebtInput').value = obj.debt_actual_payoff ?? obj.debt_planned_payoff ?? '';
}

function importPriorBaselineFromProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('Invalid profile JSON');
  if (Array.isArray(profile.transactions)) {
    const oldTransactions = state.transactions;
    const oldMonth = $('reportMonth').value;
    const oldIncome = $('incomeInput').value;
    const oldSavings = $('savingsInput').value;
    state.transactions = profile.transactions;
    if (profile.report_month) $('reportMonth').value = profile.report_month;
    $('incomeInput').value = profile.income ?? '';
    $('savingsInput').value = profile.savings ?? '';
    const snap = calculateSnapshot();
    $('priorSpendingInput').value = snap.expenses || '';
    $('priorIncomeInput').value = snap.income || '';
    $('priorSavingsInput').value = snap.savingsInput || '';
    $('priorDebtInput').value = snap.debt.actual || '';
    state.transactions = oldTransactions;
    $('reportMonth').value = oldMonth;
    $('incomeInput').value = oldIncome;
    $('savingsInput').value = oldSavings;
  } else {
    $('priorSpendingInput').value = profile.spending ?? profile.expenses ?? '';
    $('priorIncomeInput').value = profile.income ?? '';
    $('priorSavingsInput').value = profile.savings ?? '';
  }
}

async function importPriorBaselineFile(file) {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.json')) importPriorBaselineFromProfile(JSON.parse(text));
  else importPriorBaselineFromSnapshotObject(keyValueCsvToObject(text));
  $('priorImportStatus').textContent = `Imported prior baseline from ${file.name}.`;
  render({ autosave: true });
}

function sheetsReadmeText() {
  return `Personal Budget Automation — Google Sheets Import\n\nRecommended Google Sheets tabs:\n1. Transactions Import\n2. Categories Rules\n3. Monthly Snapshot\n4. Monthly Targets\n\nImport steps:\n- In Google Sheets, create a new workbook.\n- Create the tabs above.\n- Use File → Import → Upload → Replace current sheet for each CSV.\n- Import *_transactions_import.csv into Transactions Import.\n- Import *_categories_rules.csv into Categories Rules.\n- Import *_monthly_snapshot.csv into Monthly Snapshot.\n- Import monthly-category-targets.csv into Monthly Targets if desired.\n\nPrivacy note:\nThese CSVs may contain real financial transaction data. Keep them local/private and do not commit them to git.\n`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function readFileText(file) {
  return await file.text();
}

$('transactionFiles').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  const existingKeys = new Set(state.transactions.map(transactionKey));
  const imported = [];
  let rowsRead = 0;
  let duplicatesSkipped = 0;
  const warnings = [];
  const headers = [];
  for (const file of files) {
    const rows = parseCsv(await readFileText(file));
    if (rows.length < 2) { warnings.push(`${file.name}: no transaction rows found`); continue; }
    headers.push(...rows[0]);
    rowsRead += rows.length - 1;
    for (const raw of rowsToObjects(rows)) {
      const tx = normalizeTransaction(raw, file.name, $('importPreset').value);
      const key = transactionKey(tx);
      if (existingKeys.has(key)) { duplicatesSkipped++; continue; }
      existingKeys.add(key);
      imported.push(tx);
    }
  }
  state.transactions = [...state.transactions, ...imported];
  const allDates = imported.map((tx) => tx.date).filter(Boolean).sort();
  const diagnostics = importDiagnostics(headers, $('importPreset').value, imported);
  const review = {
    imported_at: new Date().toISOString(),
    preset: $('importPreset').value,
    files: files.map((f) => f.name),
    rowsRead,
    imported: imported.length,
    duplicatesSkipped,
    uncategorized: imported.filter((tx) => !tx.category).length,
    dateRange: allDates.length ? `${allDates[0]} to ${allDates[allDates.length - 1]}` : '',
    warnings,
    ...diagnostics,
  };
  state.lastImportReview = review;
  state.importHistory.push(review);
  render({ autosave: true });
});

$('rulesFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const rows = parseCsv(await readFileText(file));
  state.rules = rowsToObjects(rows).map(normalizeRule);
  render({ autosave: true });
});

$('addManualTransaction').addEventListener('click', addManualTransaction);
$('loadSampleRules').addEventListener('click', () => {
  if (state.profileMode === 'real' && !confirm('Load sample rules into a real profile?')) return;
  if (state.profileMode !== 'real') setProfileMode('demo', { autosave: false });
  state.rules = sampleRules.map(normalizeRule);
  render({ autosave: true });
});

$('applyPlanningSpine').addEventListener('click', () => render({ autosave: true }));
$('resetPlanningSpine').addEventListener('click', () => { $('planningAssumptionsInput').value = planningDefaultsJson(); setPlanningFieldsFromObject(window.BudgetPlanningEngine?.workbookParityDefaults || {}); render({ autosave: true }); });
$('exportPlanningSpine').addEventListener('click', () => downloadText(`planning-spine-${$('reportMonth').value || 'baseline'}.csv`, planningSpineToCsv(), 'text/csv'));
$('deriveCashExpenses').addEventListener('click', () => { deriveCashExpensesAssumptions(); setCashExpensesSource('derived'); render({ autosave: true }); });
$('resetCashExpenses').addEventListener('click', () => { $('cashExpensesAssumptionsInput').value = cashExpensesDefaultsJson(); setCashExpensesSource('baseline'); render({ autosave: true }); });
$('exportCashExpenses').addEventListener('click', () => downloadText(`cash-expenses-reconciliation-${$('reportMonth').value || 'baseline'}.csv`, cashExpensesToCsv(), 'text/csv'));
$('cashExpensesAssumptionsInput').addEventListener('input', () => { setCashExpensesSource('manual'); render({ autosave: true }); });
$('resetInvestingBtc').addEventListener('click', () => { $('investingBtcAssumptionsInput').value = investingBtcDefaultsJson(); render({ autosave: true }); });
$('exportInvestingBtc').addEventListener('click', () => downloadText(`investing-btc-${$('reportMonth').value || 'baseline'}.csv`, investingBtcToCsv(), 'text/csv'));
$('investingBtcAssumptionsInput').addEventListener('input', () => render({ autosave: true }));
$('addTradeRow').addEventListener('click', addTradeRow);
$('resetTrades').addEventListener('click', () => { $('tradesInput').value = tradeDefaultsText(); render({ autosave: true }); });
$('exportTrades').addEventListener('click', () => downloadText(`taxable-trades-${$('reportMonth').value || 'all'}.csv`, tradesToCsv(), 'text/csv'));
$('tradesInput').addEventListener('input', () => render({ autosave: true }));
$('tradesEditor').addEventListener('input', () => { syncTradesTableToText(); render({ autosave: true }); });
$('tradesEditor').addEventListener('click', (event) => {
  const index = event.target?.dataset?.removeTrade;
  if (index !== undefined) removeTradeRow(index);
});
$('planningAssumptionsInput').addEventListener('input', () => { try { setPlanningFieldsFromObject(JSON.parse($('planningAssumptionsInput').value || '{}')); } catch {} render({ autosave: true }); });
$('planningAllocationsInput').addEventListener('input', () => render({ autosave: true }));
for (const [id] of planningFieldMap) $(id).addEventListener('input', () => render({ autosave: true }));
$('addAccountRow').addEventListener('click', () => addSimpleRow({ ...accountEditor, defaults: { type: 'checking' } }));
$('applyAccounts').addEventListener('click', () => render({ autosave: true }));
$('exportAccounts').addEventListener('click', () => downloadText(`cash-accounts-${$('reportMonth').value || 'all'}.csv`, accountsToCsv(), 'text/csv'));
$('accountsInput').addEventListener('input', () => render({ autosave: true }));
$('accountsEditor').addEventListener('input', () => { syncSimpleEditorToText(accountEditor); render({ autosave: true }); });
$('accountsEditor').addEventListener('click', (event) => { const index = event.target?.dataset?.removeAccount; if (index !== undefined) removeSimpleRow({ ...accountEditor, index }); });
$('addNetWorthRow').addEventListener('click', () => addSimpleRow({ ...netWorthEditor, defaults: { kind: 'asset', is_btc: 'no' } }));
$('applyNetWorth').addEventListener('click', () => render({ autosave: true }));
$('exportNetWorth').addEventListener('click', () => downloadText(`net-worth-${$('reportMonth').value || 'all'}.csv`, netWorthToCsv(), 'text/csv'));
$('netWorthInput').addEventListener('input', () => render({ autosave: true }));
$('netWorthEditor').addEventListener('input', () => { syncSimpleEditorToText(netWorthEditor); render({ autosave: true }); });
$('netWorthEditor').addEventListener('click', (event) => { const index = event.target?.dataset?.removeNetWorth; if (index !== undefined) removeSimpleRow({ ...netWorthEditor, index }); });
$('applyPaycheck').addEventListener('click', () => render({ autosave: true }));
$('exportPaycheck').addEventListener('click', () => downloadText(`paycheck-plan-${$('reportMonth').value || 'all'}.csv`, paycheckToCsv(), 'text/csv'));
for (const id of ['payGrossInput', 'paychecksInput', 'payPretaxInput', 'payPosttaxInput', 'payTaxRateInput', 'payExtraWithholdingInput']) $(id).addEventListener('input', () => render({ autosave: true }));
$('addBlueprintRow').addEventListener('click', () => addSimpleRow({ ...blueprintEditor, defaults: { class: 'variable' } }));
$('applyBlueprint').addEventListener('click', () => {
  state.blueprint = parseBlueprint($('blueprintInput').value, $('blueprintIncomeInput').value || $('incomeInput').value);
  state.targets = blueprintToTargets(state.blueprint);
  $('targetsInput').value = [...state.targets.entries()].map(([cat, target]) => `${cat},${Math.round(target * 100) / 100}`).join('\n');
  const generatedRules = blueprintToRules(state.blueprint);
  const existingRuleKeys = new Set(state.rules.map((r) => `${r.pattern}|${r.category}`));
  state.rules = [...state.rules, ...generatedRules.filter((r) => !existingRuleKeys.has(`${r.pattern}|${r.category}`))];
  render({ autosave: true });
});
$('exportBlueprint').addEventListener('click', () => downloadText(`budget-blueprint-${$('reportMonth').value || 'all'}.csv`, blueprintToCsv(), 'text/csv'));
$('blueprintIncomeInput').addEventListener('input', () => render({ autosave: true }));
$('blueprintInput').addEventListener('input', () => render({ autosave: true }));
$('blueprintEditor').addEventListener('input', () => { syncSimpleEditorToText(blueprintEditor); render({ autosave: true }); });
$('blueprintEditor').addEventListener('click', (event) => { const index = event.target?.dataset?.removeBlueprint; if (index !== undefined) removeSimpleRow({ ...blueprintEditor, index }); });
$('profileModeSelect').addEventListener('change', (event) => { setProfileMode(event.target.value, { autosave: false }); render({ autosave: true }); });
$('viewModeSelect').addEventListener('change', (event) => { setViewMode(event.target.value, { autosave: false }); render({ autosave: true }); });
$('enterReportMode').addEventListener('click', () => { setViewMode('report', { autosave: false }); render({ autosave: true }); });
$('enterEditMode').addEventListener('click', () => { setViewMode('edit', { autosave: false }); render({ autosave: true }); });
$('reportReturnToEdit').addEventListener('click', () => { setViewMode('edit', { autosave: false }); render({ autosave: true }); });
$('startDemoProfile').addEventListener('click', startDemoProfile);
$('startRealProfile').addEventListener('click', startRealProfile);
$('saveLocal').addEventListener('click', () => saveProfileToLocal());
$('loadLocal').addEventListener('click', loadProfileFromLocal);
$('exportProfile').addEventListener('click', () => {
  if (state.profileMode === 'real' && !confirm('Plain JSON exports may contain sensitive real financial data. Prefer encrypted export. Continue?')) return;
  downloadText(`budget-profile-${$('reportMonth').value || 'all'}.json`, JSON.stringify(profileObject(), null, 2), 'application/json');
});
$('exportEncryptedProfile').addEventListener('click', async () => {
  try {
    const encrypted = await encryptProfileObject(profileObject(), $('profilePassword').value);
    downloadText(`budget-profile-${$('reportMonth').value || 'all'}.encjson`, JSON.stringify(encrypted, null, 2), 'application/json');
    setSaveStatus('Encrypted profile exported. Keep the password safe; it cannot be recovered.');
  } catch (error) {
    setSaveStatus(`Encrypted export failed: ${error.message}`);
  }
});
$('importPriorBaseline').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try { await importPriorBaselineFile(file); }
  catch (error) { $('priorImportStatus').textContent = `Prior import failed: ${error.message}`; }
});
$('importProfile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const encrypted = parsed?.format === 'personal-budget-automation-encrypted-profile';
    const profile = encrypted ? await decryptProfileObject(parsed, $('profilePassword').value) : parsed;
    if (!profile.profile_mode && !confirm('Imported profile has no mode metadata. Treat it as a real profile? Cancel keeps it out.')) return;
    if (!profile.profile_mode) profile.profile_mode = 'real';
    loadProfileObject(profile);
    saveProfileToLocal(encrypted ? 'Imported encrypted profile and saved locally.' : 'Imported profile and saved locally.');
  } catch (error) {
    setSaveStatus(`Import failed: ${error.message}`);
  }
});
$('addTargetRow').addEventListener('click', () => addSimpleRow({ ...targetsEditor, defaults: {} }));
$('applyTargets').addEventListener('click', () => { state.targetsSource = 'manual'; state.targets = parseTargets($('targetsInput').value); render({ autosave: true }); });
$('exportTargets').addEventListener('click', () => downloadText('monthly-category-targets.csv', targetsToCsv(), 'text/csv'));
$('targetsEditor').addEventListener('input', () => { syncSimpleEditorToText(targetsEditor); state.targetsSource = 'manual'; state.targets = parseTargets($('targetsInput').value); render({ autosave: true }); });
$('targetsEditor').addEventListener('click', (event) => { const index = event.target?.dataset?.removeTarget; if (index !== undefined) { state.targetsSource = 'manual'; removeSimpleRow({ ...targetsEditor, index }); state.targets = parseTargets($('targetsInput').value); } });
$('reportMonth').addEventListener('change', () => render({ autosave: true }));
$('incomeInput').addEventListener('input', () => render({ autosave: true }));
$('savingsInput').addEventListener('input', () => render({ autosave: true }));
for (const id of ['priorSpendingInput', 'priorIncomeInput', 'priorSavingsInput', 'priorDebtInput', 'debtStartInput', 'debtCurrentInput', 'debtPlannedInput', 'debtActualInput']) $(id).addEventListener('input', () => render({ autosave: true }));
$('printReport').addEventListener('click', () => { setViewMode('report', { autosave: false }); render({ autosave: true }); setTimeout(() => window.print(), 50); });
$('closeMonth').addEventListener('click', closeMonthWorkflow);
$('exportSnapshot').addEventListener('click', () => downloadText(`monthly-snapshot-${$('reportMonth').value || 'all'}.csv`, snapshotToCsv(), 'text/csv'));
$('saveSnapshotHistory').addEventListener('click', saveCurrentSnapshotToLedger);
$('exportSnapshotHistory').addEventListener('click', () => downloadText(`monthly-snapshot-history-${$('reportMonth').value || 'all'}.csv`, snapshotsHistoryToCsv(), 'text/csv'));
$('snapshotLedgerTable').addEventListener('click', (event) => {
  const month = event.target?.dataset?.deleteSnapshot;
  if (month) deleteSnapshotMonth(month);
});
$('exportNormalized').addEventListener('click', () => {
  downloadText(`normalized-transactions-${$('reportMonth').value || 'all'}.csv`, toCsv(selectedMonthTransactions()), 'text/csv');
});
$('exportSheetsTransactions').addEventListener('click', () => downloadText(`${$('reportMonth').value || 'budget'}_transactions_import.csv`, toCsv(selectedMonthTransactions()), 'text/csv'));
$('exportSheetsRules').addEventListener('click', () => downloadText(`${$('reportMonth').value || 'budget'}_categories_rules.csv`, rulesToCsv(), 'text/csv'));
$('exportSheetsSnapshot').addEventListener('click', () => downloadText(`${$('reportMonth').value || 'budget'}_monthly_snapshot.csv`, snapshotToCsv(), 'text/csv'));
$('exportSheetsReadme').addEventListener('click', () => downloadText('google-sheets-import-readme.txt', sheetsReadmeText(), 'text/plain'));

$('reportMonth').value = new Date().toISOString().slice(0, 7);
ensurePlanningAssumptionsText();
ensureCashExpensesAssumptionsText();
ensureInvestingBtcAssumptionsText();
if (!$('tradesInput').value.trim()) $('tradesInput').value = tradeDefaultsText();
state.rules = sampleRules.map(normalizeRule);
state.targets = parseTargets($('targetsInput').value);
try {
  if (localStorage.getItem(STORAGE_KEY)) loadProfileFromLocal();
  else render();
} catch (error) {
  setSaveStatus(`Local profile ignored: ${error.message}`);
  render();
}
