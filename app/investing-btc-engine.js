/* Deterministic Investing / BTC engine. Market/live data are explicit assumptions. */
(function attachInvestingBtcEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InvestingBtcEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function investingBtcFactory() {
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 12) => Number(Math.round(num(value) + 'e' + digits) + 'e-' + digits);
  const sum = (values) => values.reduce((total, value) => total + num(value), 0);

  const workbookParityDefaults = {
    market: { btcPrice: 81401.14 },
    investing: {
      btcHoldings: 2.3268065200000003,
      totalCurrentValue: 396578.86747514282,
      totalCostBasis: 455790.63502159994,
      allocationDesiredTotal: 1.0000000000000002,
      allocationDesiredDollarsTotal: 396578.86747514294,
      allocationActualDollarsTotal: 396578.86747514282,
      allocationActualPctTotal: 0.9999999999999999,
      spotCryptoDollarGap: -30773.156297375681,
      estimatedTotalMonthlyIncome: 10522.4575,
      projectedTotal5Pct: 2383705.6851172005,
      projectedTotal12Pct: 9170831.660093075,
      monthlyInvestingRate: 3194.6125,
      remainingDailyInvestingRate: 48.210201643835603,
    },
    btc: {
      sections: [
        { btc: 0.03021335, weightedPrice: 39307.466878624844, costBasis: 1189.58, monthlyPayment: 0, value: 2459.4011332190003 },
        { btc: 0.75878382, weightedPrice: 99060.31109254068, costBasis: 133109.3, monthlyPayment: 1013.3816666666667, value: 61765.867961554803 },
        { btc: 0.78807645299999995, weightedPrice: 95722.598473925231, costBasis: 80933.95, monthlyPayment: 714.8372, value: 64150.321681356414 },
        { btc: 0.16269591999999999, weightedPrice: 101583, costBasis: 47437.06, monthlyPayment: 0, value: 13243.633361348799 },
        { btc: 0.44092851999999999, weightedPrice: 92992.926466234479, costBasis: 41003.233179999996, monthlyPayment: 0, value: 35892.084186512802 },
      ],
      ccTotalDebt: 71483.72,
      ccBtcAcquired: 0.78807645299999995,
      externalTotalBtc: 2.8925782,
      startingBtc: 1.9316224200000001,
      lednCurrentBalance: 43410.549668249325,
      lednCollateralBtc: 2.2033181900000001,
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
