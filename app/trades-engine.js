/* Deterministic taxable trades engine. Workbook cells stay in fixtures/tests, not runtime logic. */
(function attachTradesEngine(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TradesEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function tradesFactory() {
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round = (value, digits = 12) => Number(Math.round(num(value) + 'e' + digits) + 'e-' + digits);
  const div0 = '#DIV/0!';

  const workbookParityDefaults = {
    maxCapitalLosses: -3000,
    years: {
      2026: [
        { dateSerial: 46050, asset: 'IBRX', shares: 720, averageSharePrice: 4.85, executePrice: 6.04, proceeds: 4435.06 },
        { dateSerial: 46066, asset: 'IBRX', shares: 220, averageSharePrice: 4.85, costBasis: 1067, executePrice: 7.12, proceeds: 1566.36 },
        { dateSerial: 46066, asset: 'GLDM', shares: 28.475499, costBasis: 2446.77, executePrice: 99.26, proceeds: 2826.48, netGainLoss: 379.71 },
        { dateSerial: 46066, asset: 'MSTR', shares: 11.162969, averageSharePrice: 154.91577554322689, costBasis: 1729.32, executePrice: 133.15, proceeds: 1486.35, netGainLoss: -242.97 },
        { dateSerial: 46066, asset: 'BTC', shares: 0.68855345, averageSharePrice: 102816.47, proceeds: 47265.46 },
        { dateSerial: 46097, asset: 'GLDM', shares: 67, averageSharePrice: 85.93, costBasis: 5757.31, executePrice: 99.16 },
        { dateSerial: 46108, asset: 'STRC', shares: 75, averageSharePrice: 99.86, costBasis: 7489.5, executePrice: 99.8, proceeds: 7484.99, netGainLoss: -4.510000000000218 },
      ],
      2027: [],
    },
  };

  function calculateTrade(trade = {}) {
    const shares = num(trade.shares);
    let costBasis = Number.isFinite(Number(trade.costBasis)) ? num(trade.costBasis) : null;
    let averageSharePrice = Number.isFinite(Number(trade.averageSharePrice)) ? num(trade.averageSharePrice) : null;
    let proceeds = Number.isFinite(Number(trade.proceeds)) ? num(trade.proceeds) : null;
    let executePrice = Number.isFinite(Number(trade.executePrice)) ? num(trade.executePrice) : null;
    let netGainLoss = Number.isFinite(Number(trade.netGainLoss)) ? num(trade.netGainLoss) : null;

    if (costBasis === null && averageSharePrice !== null) costBasis = shares * averageSharePrice;
    if (averageSharePrice === null && costBasis !== null && shares) averageSharePrice = costBasis / shares;
    if (proceeds === null && executePrice !== null) proceeds = executePrice * shares;
    if (executePrice === null && proceeds !== null && shares) executePrice = proceeds / shares;
    if (costBasis === null && proceeds !== null && netGainLoss !== null) costBasis = proceeds - netGainLoss;
    if (proceeds === null && costBasis !== null && netGainLoss !== null) proceeds = costBasis + netGainLoss;
    if (netGainLoss === null && proceeds !== null && costBasis !== null) netGainLoss = proceeds - costBasis;

    costBasis = costBasis ?? 0;
    proceeds = proceeds ?? 0;
    averageSharePrice = averageSharePrice ?? (shares ? costBasis / shares : 0);
    executePrice = executePrice ?? (shares ? proceeds / shares : 0);
    netGainLoss = netGainLoss ?? (proceeds - costBasis);
    const percentGainLoss = costBasis ? netGainLoss / costBasis : div0;

    return {
      ...trade,
      shares: round(shares),
      averageSharePrice: round(averageSharePrice),
      costBasis: round(costBasis),
      executePrice: round(executePrice),
      proceeds: round(proceeds),
      netGainLoss: round(netGainLoss),
      percentGainLoss: percentGainLoss === div0 ? div0 : round(percentGainLoss),
    };
  }

  function calculateYear(year, trades = [], maxCapitalLosses = -3000) {
    const calculatedTrades = trades.map(calculateTrade);
    const totalCostBasis = calculatedTrades.reduce((sum, trade) => sum + num(trade.costBasis), 0);
    const totalProceeds = calculatedTrades.reduce((sum, trade) => sum + num(trade.proceeds), 0);
    const netRealizedGainLoss = totalProceeds - totalCostBasis;
    const totalPercentGainLoss = totalCostBasis ? netRealizedGainLoss / totalCostBasis : div0;
    return {
      year: Number(year),
      trades: calculatedTrades,
      summary: {
        totalCostBasis: round(totalCostBasis),
        totalProceeds: round(totalProceeds),
        netRealizedGainLoss: round(netRealizedGainLoss),
        maxCapitalLosses: round(maxCapitalLosses),
        totalPercentGainLoss: totalPercentGainLoss === div0 ? div0 : round(totalPercentGainLoss),
      },
    };
  }

  function calculateTrades(input = {}) {
    const cfg = {
      maxCapitalLosses: input.maxCapitalLosses ?? workbookParityDefaults.maxCapitalLosses,
      years: input.years || workbookParityDefaults.years,
    };
    const years = Object.fromEntries(Object.entries(cfg.years).map(([year, trades]) => [year, calculateYear(year, trades, cfg.maxCapitalLosses)]));
    return { years };
  }

  return { calculateTrade, calculateTrades, workbookParityDefaults };
});
