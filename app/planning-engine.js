/* Deterministic planning spine inspired by the Budget / Pay_Calc / Calculations workbook sheets. */
(function attachPlanningEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BudgetPlanningEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function planningFactory() {
  const round = (value, digits = 12) => Number(Math.round(Number(value || 0) + 'e' + digits) + 'e-' + digits);
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const sum = (values) => values.reduce((total, value) => total + num(value), 0);

  const workbookParityDefaults = {
    paychecksPerYear: 24, spouseHourlyRate: 0, spouseMonthlyHoursFactor: 12, weeksPerYear: 52, spouseNetBiweekly: 0, primaryNetBiweeklyBase: 2600, primaryNetAdjustment: 0, primaryGrossAnnual: 96000, fixedRecurringTotal: 2100, fundsTotal: 1400, separateMonthlyIncomeMe: 0, separateMonthlyIncomeSpouse: 0, netBasicPayTotal: 5200, separateNetPayTotal: 0, allocationPercents: [{ category: 'Operating', percent: 0.65 }, { category: 'Savings', percent: 0.15 }, { category: 'Investing', percent: 0.15 }, { category: 'Giving', percent: 0.05 }], perDiemNetYtdAfterTaxes: 0, perDiemSpouseYtd: 0, elapsedPaychecks: 8, perDiemBudgetedNet: 0, perDiemProjectedDiffOther: 0, taxScenario: { netAfterDeductionsTaxes: 0, totalDeductionTaxRate: 0.25, primaryFullTimeTaxableIncome: 80000, spousePerDiemTaxable: 0, realizedGainsLosses: 0, standardDeduction: 30000, totalEstimatedTaxBeforeCredits: 18000, taxCreditsOrPaid: 0 }
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
