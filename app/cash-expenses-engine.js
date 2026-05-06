/* Deterministic Cash / Expenses reconciliation engine inspired by the workbook. */
(function attachCashExpensesEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CashExpensesEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function cashExpensesFactory() {
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 12) => Number(Math.round(num(value) + 'e' + digits) + 'e-' + digits);
  const sum = (values) => values.reduce((total, value) => total + num(value), 0);

  const workbookParityDefaults = {
    expenses: {
      actuals: {
        spendDepositActualTotal: 9392.702999999998,
        aggregateActualTotal: 11660.682999999997,
        savingsMiscActual: 151.09,
        medicalActual: 0,
        vehicleActual: 53,
        houseActual: 278.05,
        vacationActual: 304.86,
        giftsActual: 15,
      },
      paycheckInflows: {
        spendDepositInflow: 8287.495268693121,
        savingsMiscInflow: 817.0787281882705,
        vehicleInflow: 110.02624750167521,
        houseInflow: 258.45522315785024,
        vacationInflow: 350.90826156772374,
        giftsInflow: 175.57923397788389,
        taxes1099Inflow: 0,
      },
    },
    cash: {
      liquidAssets: [
        { name: 'bank_1', value: 8378.52 },
        { name: 'bank_2', value: 712.59 },
        { name: 'bank_3', value: 0 },
        { name: 'bank_4', value: 0 },
        { name: 'bank_5', value: 6202 },
        { name: 'bank_6', value: 30 },
        { name: 'bank_7', value: 60 },
      ],
      ledgerBalances: {
        spendDeposit: -2275.2400000000007,
        savingsMisc: 9552.799999999999,
        vehicle: 4426.289999999999,
        house: 722.11,
        vacation: 714.5100000000002,
        gifts: 377.26,
        taxes1099: 55.78,
      },
    },
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
