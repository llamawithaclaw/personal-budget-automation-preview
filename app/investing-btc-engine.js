/* Deterministic Investing / BTC engine. Market/live data are explicit assumptions. */
(function attachInvestingBtcEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InvestingBtcEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function investingBtcFactory() {
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 12) => Number(Math.round(num(value) + 'e' + digits) + 'e-' + digits);
  const sum = (values) => values.reduce((total, value) => total + num(value), 0);

  const workbookParityDefaults = {
    market: { btcPrice: 60000 },
    investing: {
      btcHoldings: 0.08333333,
      totalCurrentValue: 40000,
      totalCostBasis: 35000,
      allocationDesiredTotal: 1,
      allocationDesiredDollarsTotal: 42000,
      allocationActualDollarsTotal: 40000,
      allocationActualPctTotal: 1,
      spotCryptoDollarGap: 1000,
      estimatedTotalMonthlyIncome: 8000,
      projectedTotal5Pct: 500000,
      projectedTotal12Pct: 1000000,
      monthlyInvestingRate: 900,
      remainingDailyInvestingRate: 30,
    },
    btc: {
      sections: [
        { btc: 0.04, weightedPrice: 50000, costBasis: 2000, monthlyPayment: 100, value: 2400 },
        { btc: 0.04333333, weightedPrice: 46154, costBasis: 2000, monthlyPayment: 150, value: 2600 },
      ],
      ccTotalDebt: 0,
      ccBtcAcquired: 0,
      externalTotalBtc: 0.08333333,
      startingBtc: 0.05,
      lednCurrentBalance: 0,
      lednCollateralBtc: 0,
    },
  };

  function calculateInvestingBtc(input = {}) {
    const cfg = {
      market: { ...workbookParityDefaults.market, ...(input.market || {}) },
      investing: { ...workbookParityDefaults.investing, ...(input.investing || {}) },
      btc: { ...workbookParityDefaults.btc, ...(input.btc || {}) },
    };
    const btcPrice = num(cfg.market.btcPrice);
    const btcHoldings = num(cfg.investing.btcHoldings);
    const btcValue = btcHoldings * btcPrice;
    const spotCryptoActualPct = num(cfg.investing.allocationActualDollarsTotal) ? btcValue / num(cfg.investing.allocationActualDollarsTotal) : 0;
    const estimatedTotalYearlyIncome = num(cfg.investing.estimatedTotalMonthlyIncome) * 12;
    const realMonthlyIncome = num(cfg.investing.estimatedTotalMonthlyIncome) * 0.38;
    const realYearlyIncome = realMonthlyIncome * 12;
    const perPaycheckInvestingRate = (num(cfg.investing.monthlyInvestingRate) * 12) / 26;
    const dailyInvestingRate = (num(cfg.investing.monthlyInvestingRate) * 12) / 365;

    const sections = cfg.btc.sections || [];
    const totalBtc = sum(sections.map((s) => s.btc));
    const weightedAvgExecutePrice = totalBtc ? sum(sections.map((s) => num(s.btc) * num(s.weightedPrice))) / totalBtc : 0;
    const totalCostBasis = sum(sections.map((s) => s.costBasis));
    const monthlyPayment = sum(sections.map((s) => s.monthlyPayment));
    const currentValue = sum(sections.map((s) => s.value));
    const unrealizedPl = currentValue - totalCostBasis;
    const percentGainLoss = totalCostBasis ? unrealizedPl / totalCostBasis : 0;
    const ccDebtInBtc = btcPrice ? num(cfg.btc.ccTotalDebt) / btcPrice : 0;
    const freeBtcDifference = num(cfg.btc.ccBtcAcquired) - ccDebtInBtc;
    const remainingStack = btcHoldings - ccDebtInBtc;
    const lednLtv = (num(cfg.btc.lednCollateralBtc) && btcPrice) ? num(cfg.btc.lednCurrentBalance) / (num(cfg.btc.lednCollateralBtc) * btcPrice) : 0;
    const ltv70PriceThreshold = num(cfg.btc.lednCollateralBtc) ? num(cfg.btc.lednCurrentBalance) / (0.7 * num(cfg.btc.lednCollateralBtc)) : 0;

    return {
      investing: {
        btcPrice: round(btcPrice),
        btcHoldings: round(btcHoldings),
        btcValue: round(btcValue),
        totalCurrentValue: round(cfg.investing.totalCurrentValue),
        totalCostBasis: round(cfg.investing.totalCostBasis),
        allocationDesiredTotal: round(cfg.investing.allocationDesiredTotal),
        allocationDesiredDollarsTotal: round(cfg.investing.allocationDesiredDollarsTotal),
        allocationActualDollarsTotal: round(cfg.investing.allocationActualDollarsTotal),
        allocationActualPctTotal: round(cfg.investing.allocationActualPctTotal),
        allocationDiffTotal: round(num(cfg.investing.allocationActualDollarsTotal) - num(cfg.investing.allocationDesiredDollarsTotal)),
        spotCryptoActualValue: round(btcValue),
        spotCryptoActualPct: round(spotCryptoActualPct),
        spotCryptoDollarGap: round(cfg.investing.spotCryptoDollarGap),
        estimatedTotalMonthlyIncome: round(cfg.investing.estimatedTotalMonthlyIncome),
        estimatedTotalYearlyIncome: round(estimatedTotalYearlyIncome),
        realMonthlyIncome: round(realMonthlyIncome),
        realYearlyIncome: round(realYearlyIncome),
        projectedTotal5Pct: round(cfg.investing.projectedTotal5Pct),
        projectedTotal12Pct: round(cfg.investing.projectedTotal12Pct),
        monthlyInvestingRate: round(cfg.investing.monthlyInvestingRate),
        perPaycheckInvestingRate: round(perPaycheckInvestingRate),
        dailyInvestingRate: round(dailyInvestingRate),
        remainingDailyInvestingRate: round(cfg.investing.remainingDailyInvestingRate),
      },
      btc: {
        totalBtc: round(totalBtc),
        weightedAvgExecutePrice: round(weightedAvgExecutePrice),
        totalCostBasis: round(totalCostBasis),
        monthlyPayment: round(monthlyPayment),
        currentValue: round(currentValue),
        unrealizedPl: round(unrealizedPl),
        percentGainLoss: round(percentGainLoss),
        ccTotalDebt: round(cfg.btc.ccTotalDebt),
        ccUnrealizedPl: round((cfg.btc.sections || [])[2]?.value - (cfg.btc.sections || [])[2]?.costBasis),
        ccDebtInBtc: round(ccDebtInBtc),
        ccBtcAcquired: round(cfg.btc.ccBtcAcquired),
        freeBtcDifference: round(freeBtcDifference),
        remainingStack: round(remainingStack),
        externalTotalBtc: round(cfg.btc.externalTotalBtc),
        startingBtc: round(cfg.btc.startingBtc),
        lednCurrentBalance: round(cfg.btc.lednCurrentBalance),
        lednLtv: round(lednLtv),
        ltv70PriceThreshold: round(ltv70PriceThreshold),
      },
    };
  }

  return { calculateInvestingBtc, workbookParityDefaults };
});
