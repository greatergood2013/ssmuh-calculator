/**
 * SSMUH Yield Calculator - Enhanced Calculation Engine
 *
 * Supports hierarchical cost breakdowns with delta-tracking overrides,
 * triple-entry construction cost sync, and municipality-specific fees.
 */

const Calculator = {

  // ── Create a blank deal model with defaults ────────────────
  createDealModel(opts) {
    const numUnits  = (opts && opts.numUnits)  || 4;
    const buildType = (opts && opts.buildType) || 'fourplex';
    const sfPerUnit = Defaults.sfPerUnit[buildType] || 1100;
    const totalSF   = sfPerUnit * numUnits;
    const municipality = (opts && opts.municipality) || 'victoria';

    return {
      projectInfo: {
        name: '',
        municipality: municipality,
        buildType: buildType,
        numUnits: numUnits,
        sfPerUnit: sfPerUnit,
        totalSF: totalSF,
      },

      landAcquisition: {
        total: 0,
        breakdown: {
          purchasePrice:      { amount: 0, label: 'Land Purchase Price' },
          legalDD:            { amount: 15000, label: 'Legal / Due Diligence' },
          closingCostsPct:    1.5,
          closingCostsAmount: { amount: 0, label: 'Closing Costs' },
        },
      },

      hardCosts: {
        total: 0,
        inputMethod: 'perUnit',  // 'perSF' | 'perUnit' | 'total'
        costPerSF: Defaults.costPerSF.baseline,
        costPerUnit: Defaults.costPerSF.baseline * sfPerUnit,
        breakdown: this._initHardCostBreakdown(),
      },

      softCosts: {
        total: 0,
        basePct: 0,    // Computed dynamically from line items in _calcSoftCosts
        delta: 0,
        revisedPct: 0,
        breakdown: this._initSoftCostBreakdown(),
      },

      contingency: {
        pct: 10,
        amount: 0,
      },

      municipalFees: {
        total: 0,
        municipality: municipality,
        breakdown: this._initMunicipalBreakdown(municipality),
      },

      financing: {
        total: 0,
        breakdown: {
          ltv:               1 - Defaults.financing.equityPct / 100,
          equityPct:         Defaults.financing.equityPct,
          loanAmount:        0,
          interestRate:      Defaults.financing.interestRate,
          constructionPeriod: Defaults.financing.constructionPeriod,
          interestCost:      0,
          commitmentFee:     { pct: Defaults.financing.commitmentFeePct, amount: 0, label: 'Commitment Fee' },
          lenderLegal:       { amount: Defaults.financing.lenderLegal, label: 'Lender Legal Fees' },
        },
      },

      revenue: {
        total: 0,
        breakdown: {
          pricePerUnit:       0,
          grossSales:         0,
          realtorCommission:  { pct: Defaults.revenue.realtorCommissionPct, amount: 0, label: 'Realtor Commission' },
          legalPerSale:       { fixed: Defaults.revenue.legalPerSale, amount: 0, label: 'Legal Fees' },
          marketingCosts:     { amount: Defaults.revenue.marketingCosts, label: 'Marketing Costs' },
          netRevenue:         0,
        },
      },

      results: {
        totalProjectCost: 0,
        netRevenue: 0,
        profit: 0,
        yieldPct: 0,
        pass: false,
        profitPerUnit: 0,
        costPerUnit: 0,
        roiOnEquity: 0,
        breakEvenPricePerUnit: 0,
        costReduction: 0,
        revenueIncrease: 0,
      },
    };
  },

  _initHardCostBreakdown() {
    const b = {};
    for (const [key, def] of Object.entries(Defaults.hardCostDistribution)) {
      b[key] = { pct: def.pct, amount: 0, modified: false, label: def.label };
    }
    return b;
  },

  _initSoftCostBreakdown() {
    const b = {};
    for (const [key, def] of Object.entries(Defaults.softCostBreakdown)) {
      b[key] = {
        pct:      def.pct,
        fixed:    def.fixed,
        formula:  def.formula || null,
        amount:   def.fixed || 0,
        modified: false,
        label:    def.label,
      };
    }
    return b;
  },

  _initMunicipalBreakdown(municipality) {
    const muni = Defaults.municipalities[municipality] || Defaults.municipalities.victoria;
    const b = {};
    for (const [key, def] of Object.entries(muni.dcc)) {
      b[key] = { perUnit: def.perUnit, amount: 0, label: def.label, category: 'dcc', sourceUrl: def.sourceUrl || null };
    }
    for (const [key, def] of Object.entries(muni.other)) {
      b[key] = {
        perUnit: def.perUnit || null,
        fixed:   def.fixed  || null,
        amount:  0,
        label:   def.label,
        category: 'other',
        sourceUrl: def.sourceUrl || null,
      };
    }
    return b;
  },

  // ── Switch municipality — reload fee schedule ──────────────
  applyMunicipality(deal, municipalityKey) {
    deal.municipalFees.municipality = municipalityKey;
    deal.projectInfo.municipality = municipalityKey;
    deal.municipalFees.breakdown = this._initMunicipalBreakdown(municipalityKey);
  },

  // ── Triple-Entry Construction Cost Sync ────────────────────
  syncConstructionCosts(deal) {
    const h = deal.hardCosts;
    const numUnits = deal.projectInfo.numUnits;
    const totalSF  = deal.projectInfo.totalSF;

    switch (h.inputMethod) {
      case 'perSF':
        h.total = h.costPerSF * totalSF;
        h.costPerUnit = numUnits > 0 ? h.total / numUnits : 0;
        break;
      case 'perUnit':
        h.total = h.costPerUnit * numUnits;
        h.costPerSF = totalSF > 0 ? h.total / totalSF : 0;
        break;
      case 'total':
        h.costPerUnit = numUnits > 0 ? h.total / numUnits : 0;
        h.costPerSF = totalSF > 0 ? h.total / totalSF : 0;
        break;
    }

    // Distribute across sub-items
    this._distributeHardCosts(deal);
  },

  _distributeHardCosts(deal) {
    const total = deal.hardCosts.total;
    for (const item of Object.values(deal.hardCosts.breakdown)) {
      if (!item.modified) {
        item.amount = Math.round(total * item.pct);
      }
    }
  },

  // ── Master Calculation ─────────────────────────────────────
  calculate(deal) {
    this._calcLand(deal);
    this.syncConstructionCosts(deal);
    this._calcSoftCosts(deal);
    this._calcContingency(deal);
    this._calcMunicipal(deal);
    this._calcFinancing(deal);
    this._calcRevenue(deal);
    this._calcResults(deal);
    return deal;
  },

  // ── Land Acquisition ───────────────────────────────────────
  _calcLand(deal) {
    const b = deal.landAcquisition.breakdown;
    b.closingCostsAmount.amount = b.purchasePrice.amount * (b.closingCostsPct / 100);
    deal.landAcquisition.total = b.purchasePrice.amount + b.legalDD.amount + b.closingCostsAmount.amount;
  },

  // ── Soft Costs with delta tracking ─────────────────────────
  _calcSoftCosts(deal) {
    const hardTotal = deal.hardCosts.total;
    const s = deal.softCosts;
    let total = 0;
    let baseTotal = 0;
    let deltaSum = 0;

    for (const [key, item] of Object.entries(s.breakdown)) {
      // Formula-based items
      if (item.formula === 'buildingPermit') {
        const defaultAmt = Defaults.calculateBuildingPermit(hardTotal);
        if (!item.modified) item.amount = Math.round(defaultAmt);
        const baseAmt = defaultAmt;
        if (item.modified) deltaSum += item.amount - baseAmt;
        baseTotal += baseAmt;
      } else if (item.formula === 'devPermit') {
        const defaultAmt = Defaults.calculateDevPermit(hardTotal);
        if (!item.modified) item.amount = Math.round(defaultAmt);
        const baseAmt = defaultAmt;
        if (item.modified) deltaSum += item.amount - baseAmt;
        baseTotal += baseAmt;
      } else if (item.fixed != null && item.pct == null) {
        // Fixed-amount items (legal)
        const baseAmt = Defaults.softCostBreakdown[key] ? (Defaults.softCostBreakdown[key].fixed || 0) : 0;
        if (!item.modified) item.amount = item.fixed;
        if (item.modified) deltaSum += item.amount - baseAmt;
        baseTotal += baseAmt;
      } else if (item.pct != null) {
        // Percentage of hard costs
        const baseAmt = hardTotal * (item.pct / 100);
        if (!item.modified) item.amount = Math.round(baseAmt);
        if (item.modified) deltaSum += item.amount - Math.round(baseAmt);
        baseTotal += baseAmt;
      }

      total += item.amount;
    }

    s.total = total;
    s.delta = Math.round(deltaSum);
    // basePct is now computed from the actual default line items (not a static label)
    s.basePct = hardTotal > 0 ? (baseTotal / hardTotal) * 100 : 0;
    s.revisedPct = hardTotal > 0 ? (total / hardTotal) * 100 : 0;
  },

  // ── Contingency ────────────────────────────────────────────
  _calcContingency(deal) {
    const base = deal.hardCosts.total + deal.softCosts.total + deal.municipalFees.total;
    deal.contingency.amount = Math.round(base * (deal.contingency.pct / 100));
  },

  // ── Municipal Fees ─────────────────────────────────────────
  _calcMunicipal(deal) {
    const numUnits = deal.projectInfo.numUnits;
    let total = 0;

    for (const item of Object.values(deal.municipalFees.breakdown)) {
      if (item.perUnit != null) {
        item.amount = item.perUnit * numUnits;
      } else if (item.fixed != null) {
        item.amount = item.fixed;
      }
      total += item.amount;
    }

    deal.municipalFees.total = total;
  },

  // ── Financing (S-curve draw model) ─────────────────────────
  //
  // Land cost carries interest from Day 1 for the full construction period.
  // Construction + soft + contingency + municipal costs are drawn over an
  // S-curve (logistic function) across the construction period, so interest
  // accrues proportionally as funds are drawn.
  //
  // The S-curve uses 12 monthly buckets. Each month's incremental draw
  // earns interest for the remaining months.
  //
  _calcFinancing(deal) {
    const landTotal = deal.landAcquisition.total;
    const constructionSubtotal =
      deal.hardCosts.total +
      deal.softCosts.total +
      deal.contingency.amount +
      deal.municipalFees.total;

    const totalProjectSubtotal = landTotal + constructionSubtotal;

    const f = deal.financing.breakdown;
    f.ltv = 1 - f.equityPct / 100;
    f.loanAmount = totalProjectSubtotal * f.ltv;

    const months = f.constructionPeriod;
    const monthlyRate = (f.interestRate / 100) / 12;

    // ── Land interest: full amount from Day 1 ──────────────
    const landLoan = landTotal * f.ltv;
    f.landInterest = landLoan * monthlyRate * months;

    // ── Construction interest via S-curve draw ─────────────
    // S-curve cumulative draw fraction at month i (logistic):
    //   S(t) = 1 / (1 + e^(-k*(t - midpoint)))
    //   Normalized so S(0)=0, S(months)=1
    const constructionLoan = constructionSubtotal * f.ltv;
    const k = 6 / months;            // Steepness — tuned for typical construction
    const midpoint = months / 2;

    function sCurveRaw(t) {
      return 1 / (1 + Math.exp(-k * (t - midpoint)));
    }
    const s0 = sCurveRaw(0);
    const sN = sCurveRaw(months);

    // Normalized S-curve: 0 at t=0, 1 at t=months
    function sCurve(t) {
      return (sCurveRaw(t) - s0) / (sN - s0);
    }

    // Accumulate interest: each month's incremental draw earns interest
    // for the remaining months
    let constructionInterest = 0;
    for (let m = 1; m <= months; m++) {
      const drawnThisMonth = constructionLoan * (sCurve(m) - sCurve(m - 1));
      const remainingMonths = months - m;
      // Interest on this tranche for remaining months + half-month for the draw month
      constructionInterest += drawnThisMonth * monthlyRate * (remainingMonths + 0.5);
    }
    f.constructionInterest = constructionInterest;

    f.interestCost = f.landInterest + f.constructionInterest;
    f.commitmentFee.amount = Math.round(f.loanAmount * (f.commitmentFee.pct / 100));

    deal.financing.total = f.interestCost + f.commitmentFee.amount + f.lenderLegal.amount;
  },

  // ── Revenue ────────────────────────────────────────────────
  _calcRevenue(deal) {
    const r = deal.revenue.breakdown;
    const numUnits = deal.projectInfo.numUnits;

    r.grossSales = numUnits * r.pricePerUnit;
    r.realtorCommission.amount = r.grossSales * (r.realtorCommission.pct / 100);
    r.legalPerSale.amount = numUnits * r.legalPerSale.fixed;

    const deductions = r.realtorCommission.amount + r.legalPerSale.amount + r.marketingCosts.amount;
    r.netRevenue = r.grossSales - deductions;
    deal.revenue.total = r.netRevenue;
  },

  // ── Final Results ──────────────────────────────────────────
  _calcResults(deal) {
    const costBeforeFinancing =
      deal.landAcquisition.total +
      deal.hardCosts.total +
      deal.softCosts.total +
      deal.contingency.amount +
      deal.municipalFees.total;

    const totalCost = costBeforeFinancing + deal.financing.total;

    const netRevenue = deal.revenue.total;
    const profit = netRevenue - totalCost;
    const yieldPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const numUnits = deal.projectInfo.numUnits;
    const equityAmount = totalCost * (deal.financing.breakdown.equityPct / 100);

    // What would need to change
    const targetTPC = netRevenue / 1.20;
    const costReduction = totalCost - targetTPC;
    const targetNetRevenue = 1.20 * totalCost;
    const revenueIncrease = targetNetRevenue - netRevenue;

    deal.results = {
      totalCostBeforeFinancing: costBeforeFinancing,
      totalProjectCost:     totalCost,
      netRevenue:           netRevenue,
      profit:               profit,
      yieldPct:             yieldPct,
      pass:                 yieldPct >= 20,
      profitPerUnit:        numUnits > 0 ? profit / numUnits : 0,
      costPerUnit:          numUnits > 0 ? totalCost / numUnits : 0,
      roiOnEquity:          equityAmount > 0 ? (profit / equityAmount) * 100 : 0,
      breakEvenPricePerUnit: numUnits > 0 ? (totalCost / numUnits) / (1 - deal.revenue.breakdown.realtorCommission.pct / 100) : 0,
      costReduction:        costReduction,
      revenueIncrease:      revenueIncrease,
    };
  },

  // ── Reset helpers ──────────────────────────────────────────
  resetSoftCosts(deal) {
    deal.softCosts.breakdown = this._initSoftCostBreakdown();
    deal.softCosts.delta = 0;
  },

  resetHardCosts(deal) {
    deal.hardCosts.breakdown = this._initHardCostBreakdown();
    this._distributeHardCosts(deal);
  },

  resetMunicipalFees(deal) {
    deal.municipalFees.breakdown = this._initMunicipalBreakdown(deal.municipalFees.municipality);
  },
};
