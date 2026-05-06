/* Deterministic planning spine inspired by the Budget / Pay_Calc / Calculations workbook sheets. */
(function attachPlanningEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BudgetPlanningEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function planningFactory() {
  const round = (value, digits = 12) => Number(Math.round(Number(value || 0) + 'e' + digits) + 'e-' + digits);
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const sum = (values) => values.reduce((total, value) => total + num(value), 0);

  const workbookParityDefaults = {
    paychecksPerYear: 26,
    spouseHourlyRate: 41.6,
    spouseMonthlyHoursFactor: 12,
    weeksPerYear: 52,
    spouseNetBiweekly: 773.3574400000001,
    primaryNetBiweeklyBase: 3820.48,
    primaryNetAdjustment: 298.33,
    primaryGrossAnnual: 158293,
    fixedRecurringTotal: 7802.333124847223,
    fundsTotal: 2925.147030125945,
    separateMonthlyIncomeMe: 0,
    separateMonthlyIncomeSpouse: 0,
    netBasicPayTotal: 9880.43,
    separateNetPayTotal: 0,
    allocationPercents: [
      { category: 'Spend/Deposit', percent: 0.8387788050411896 },
      { category: 'Savings Misc', percent: 0.08269667698554318 },
      { category: 'Vehicle', percent: 0.011135775214406176 },
      { category: 'House', percent: 0.026158297073897618 },
      { category: 'Vacation', percent: 0.03551548480862915 },
      { category: 'Gifts', percent: 0.01777040411984943, includeInAllocatedTotal: false },
    ],
    perDiemNetYtdAfterTaxes: 2119.5956122492007,
    perDiemSpouseYtd: 4219.0200000000004,
    elapsedPaychecks: 8.928571428571429,
    perDiemBudgetedNet: 1533.4084196780022,
    perDiemProjectedDiffOther: -7821.5072,
    taxScenario: {
      netAfterDeductionsTaxes: 3796.076577125747,
      totalDeductionTaxRate: 0.38554525769468373,
      primaryFullTimeTaxableIncome: 152686.62,
      spousePerDiemTaxable: 4219.0200000000004,
      realizedGainsLosses: -3000,
      standardDeduction: 32200,
      totalEstimatedTaxBeforeCredits: 16198.9008,
      taxCreditsOrPaid: 4400,
    },
  };

  function calculatePlanning(input = {}) {
    const cfg = { ...workbookParityDefaults, ...input };
    cfg.taxScenario = { ...workbookParityDefaults.taxScenario, ...(input.taxScenario || {}) };
    const paychecksPerYear = num(cfg.paychecksPerYear, 26);
    const primaryNetBiweekly = num(cfg.primaryNetBiweeklyBase) + num(cfg.primaryNetAdjustment);
    const primaryGrossBiweekly = num(cfg.primaryGrossBiweekly, num(cfg.primaryGrossAnnual) / paychecksPerYear);
    const spouseNetBiweekly = num(cfg.spouseNetBiweekly);
    const totalNetBiweekly = sum([spouseNetBiweekly, primaryNetBiweekly, cfg.otherNetBiweekly]);
    const netToGrossRatio = primaryGrossBiweekly ? primaryNetBiweekly / primaryGrossBiweekly : 0;
    const totalNetYearly = totalNetBiweekly * paychecksPerYear;
    const totalNetMonthly = totalNetYearly / 12;
    const fixedRecurringTotal = num(cfg.fixedRecurringTotal);
    const fundsTotal = num(cfg.fundsTotal);
    const totalMonthlyNeed = fixedRecurringTotal + fundsTotal;
    const monthlyRemaining = totalNetMonthly - totalMonthlyNeed;
    const annualBasicNeed = totalMonthlyNeed * 12;
    const currentNetAnnual = (totalNetMonthly + num(cfg.separateMonthlyIncomeMe) + num(cfg.separateMonthlyIncomeSpouse)) * 12;
    const annualNetDifference = currentNetAnnual - annualBasicNeed;
    const currentGrossAnnual = num(cfg.primaryGrossAnnual) + (num(cfg.spouseHourlyRate) * num(cfg.spouseMonthlyHoursFactor, 12) * num(cfg.weeksPerYear, 52));
    const grossIncomeNeeded = currentGrossAnnual + Math.abs(netToGrossRatio ? annualNetDifference / netToGrossRatio : 0);
    const grossBasicNeed = netToGrossRatio ? annualBasicNeed / netToGrossRatio : 0;
    const monthlyGrossDeficit = netToGrossRatio ? monthlyRemaining / netToGrossRatio : 0;

    const netBasicPayTotal = num(cfg.netBasicPayTotal);
    const separateNetPayTotal = num(cfg.separateNetPayTotal);
    const paycheckSplit = (cfg.allocationPercents || []).map((row) => ({
      category: row.category,
      percent: num(row.percent),
      amount: num(row.percent) * netBasicPayTotal,
      includeInAllocatedTotal: row.includeInAllocatedTotal !== false,
    }));
    const allocatedPaycheckTotal = sum(paycheckSplit.filter((r, index) => cfg.allocationPercents[index].includeInAllocatedTotal !== false).map((r) => r.amount));
    const paycheckAllocationDifference = (netBasicPayTotal + separateNetPayTotal) - allocatedPaycheckTotal;

    const elapsedPaychecks = num(cfg.elapsedPaychecks);
    const perDiemNetYtdAfterTaxes = num(cfg.perDiemNetYtdAfterTaxes);
    const perDiemSpouseYtd = num(cfg.perDiemSpouseYtd);
    const projectedNet = elapsedPaychecks ? (perDiemNetYtdAfterTaxes / elapsedPaychecks) * paychecksPerYear : 0;
    const projectedSpousePerDiem = elapsedPaychecks ? (perDiemSpouseYtd / elapsedPaychecks) * paychecksPerYear : 0;
    const budgetedNet = num(cfg.perDiemBudgetedNet, (num(cfg.separateMonthlyIncomeMe) * 12) + (-annualNetDifference));
    const budgetedSpousePerDiem = spouseNetBiweekly * paychecksPerYear;
    const projectedDiff = projectedNet - budgetedNet;
    const combinedProjectedDiff = projectedDiff + num(cfg.perDiemProjectedDiffOther);

    const tax = cfg.taxScenario;
    const agi = sum([tax.primaryFullTimeTaxableIncome, tax.spousePerDiemTaxable]);
    const totalTaxableIncome = agi + num(tax.realizedGainsLosses) - num(tax.standardDeduction);
    const estimatedAnnualTaxLiability = num(tax.totalEstimatedTaxBeforeCredits) - num(tax.taxCreditsOrPaid);
    const targetWithholdingPerPaycheck = paychecksPerYear ? estimatedAnnualTaxLiability / paychecksPerYear : 0;

    return {
      income: {
        spouseNetBiweekly: round(spouseNetBiweekly),
        primaryNetBiweekly: round(primaryNetBiweekly),
        primaryGrossBiweekly: round(primaryGrossBiweekly),
        totalNetBiweekly: round(totalNetBiweekly),
        netToGrossRatio: round(netToGrossRatio),
        totalNetMonthly: round(totalNetMonthly),
        totalNetYearly: round(totalNetYearly),
        currentGrossAnnual: round(currentGrossAnnual),
      },
      need: {
        fixedRecurringTotal: round(fixedRecurringTotal),
        fundsTotal: round(fundsTotal),
        totalMonthlyNeed: round(totalMonthlyNeed),
        monthlyRemaining: round(monthlyRemaining),
        annualBasicNeed: round(annualBasicNeed),
        currentNetAnnual: round(currentNetAnnual),
        annualNetDifference: round(annualNetDifference),
        grossIncomeNeeded: round(grossIncomeNeeded),
        grossBasicNeed: round(grossBasicNeed),
        monthlyGrossDeficit: round(monthlyGrossDeficit),
      },
      paycheck: {
        netBasicPayTotal: round(netBasicPayTotal),
        separateNetPayTotal: round(separateNetPayTotal),
        combinedPayTotal: round(netBasicPayTotal + separateNetPayTotal),
        paycheckSplit: paycheckSplit.map((r) => ({ ...r, percent: round(r.percent), amount: round(r.amount) })),
        allocatedPaycheckTotal: round(allocatedPaycheckTotal),
        paycheckAllocationDifference: round(paycheckAllocationDifference),
      },
      perDiem: {
        netYtdAfterTaxes: round(perDiemNetYtdAfterTaxes),
        paycheckCount: round(elapsedPaychecks),
        projectedNet: round(projectedNet),
        projectedSpousePerDiem: round(projectedSpousePerDiem),
        budgetedNet: round(budgetedNet),
        budgetedSpousePerDiem: round(budgetedSpousePerDiem),
        projectedDiff: round(projectedDiff),
        combinedProjectedDiff: round(combinedProjectedDiff),
      },
      tax: {
        netAfterDeductionsTaxesScenario: round(tax.netAfterDeductionsTaxes),
        totalDeductionTaxRate: round(tax.totalDeductionTaxRate),
        primaryFullTimeTaxableIncome: round(tax.primaryFullTimeTaxableIncome),
        spousePerDiemTaxable: round(tax.spousePerDiemTaxable),
        agi: round(agi),
        realizedGainsLosses: round(tax.realizedGainsLosses),
        standardDeduction: round(tax.standardDeduction),
        totalTaxableIncome: round(totalTaxableIncome),
        estimatedAnnualTaxLiability: round(estimatedAnnualTaxLiability),
        targetWithholdingPerPaycheck: round(targetWithholdingPerPaycheck),
        spouseGrossMinusHealthInsurance: round(spouseNetBiweekly),
      },
    };
  }

  return { calculatePlanning, workbookParityDefaults };
});
