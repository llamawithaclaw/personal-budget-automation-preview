/* Deterministic Cash / Expenses reconciliation engine inspired by the workbook. */
(function attachCashExpensesEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CashExpensesEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function cashExpensesFactory() {
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 12) => Number(Math.round(num(value) + 'e' + digits) + 'e-' + digits);
  const sum = (values) => values.reduce((total, value) => total + num(value), 0);

  const workbookParityDefaults = {
    expenses: { actuals: { spendDepositActualTotal: 3600, aggregateActualTotal: 4200, savingsMiscActual: 500, medicalActual: 100, vehicleActual: 220, houseActual: 1600, vacationActual: 0, giftsActual: 100 }, paycheckInflows: { spendDepositInflow: 5200, savingsMiscInflow: 500, vehicleInflow: 220, houseInflow: 1600, vacationInflow: 0, giftsInflow: 100, taxes1099Inflow: 0 } },
    cash: { liquidAssets: [{ name: 'checking_demo', value: 4200 }, { name: 'emergency_demo', value: 8000 }], ledgerBalances: { spendDeposit: 4200, savingsMisc: 8000, vehicle: 0, house: 0, vacation: 0, gifts: 0, taxes1099: 0 } }
  };

  function calculateCashExpenses(input = {}) {
    const cfg = {
      expenses: {
        actuals: { ...workbookParityDefaults.expenses.actuals, ...(input.expenses?.actuals || {}) },
        paycheckInflows: { ...workbookParityDefaults.expenses.paycheckInflows, ...(input.expenses?.paycheckInflows || {}) },
      },
      cash: {
        liquidAssets: input.cash?.liquidAssets || workbookParityDefaults.cash.liquidAssets,
        ledgerBalances: { ...workbookParityDefaults.cash.ledgerBalances, ...(input.cash?.ledgerBalances || {}) },
      },
    };

    const actuals = cfg.expenses.actuals;
    const inflows = cfg.expenses.paycheckInflows;
    const diffs = {
      spendDepositDiff: num(inflows.spendDepositInflow) - num(actuals.aggregateActualTotal),
      savingsMiscDiff: num(inflows.savingsMiscInflow) - num(actuals.savingsMiscActual),
      medicalDiff: -num(actuals.medicalActual),
      vehicleDiff: num(inflows.vehicleInflow) - num(actuals.vehicleActual),
      houseDiff: num(inflows.houseInflow) - num(actuals.houseActual),
      vacationDiff: num(inflows.vacationInflow) - num(actuals.vacationActual),
      giftsDiff: num(inflows.giftsInflow) - num(actuals.giftsActual),
      taxes1099Diff: num(inflows.taxes1099Inflow),
    };

    const totalActualLiquidAssets = sum((cfg.cash.liquidAssets || []).map((asset) => asset.value));
    const ledger = cfg.cash.ledgerBalances;
    const theoreticalLiquidAssets = sum([
      Math.abs(num(ledger.spendDeposit)),
      Math.abs(num(ledger.savingsMisc)),
      Math.abs(num(ledger.vehicle)),
      Math.abs(num(ledger.house)),
      Math.abs(num(ledger.vacation)),
      Math.abs(num(ledger.gifts)),
      Math.abs(num(ledger.taxes1099)),
    ]);
    const reconciliationDiff = totalActualLiquidAssets - theoreticalLiquidAssets;

    return {
      expenses: {
        actuals: Object.fromEntries(Object.entries(actuals).map(([k, v]) => [k, round(v)])),
        paycheckInflows: Object.fromEntries(Object.entries(inflows).map(([k, v]) => [k, round(v)])),
        diffs: Object.fromEntries(Object.entries(diffs).map(([k, v]) => [k, round(v)])),
      },
      cash: {
        liquidAssets: (cfg.cash.liquidAssets || []).map((asset) => ({ ...asset, value: round(asset.value) })),
        ledgerBalances: Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, round(v)])),
        totalActualLiquidAssets: round(totalActualLiquidAssets),
        theoreticalLiquidAssets: round(theoreticalLiquidAssets),
        reconciliationDiff: round(reconciliationDiff),
      },
    };
  }

  return { calculateCashExpenses, workbookParityDefaults };
});
