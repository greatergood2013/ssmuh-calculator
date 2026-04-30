/**
 * SSMUH Yield Calculator — Export Module
 *
 * Handles PDF (print-to-PDF via new window), Email (mailto), and Excel (SheetJS).
 * All exports are static snapshots of the current calculated deal state.
 */

const Export = {

  // ── Shared helpers ─────────────────────────────────────────
  _fmt(value) {
    if (value == null || isNaN(value)) return '$0';
    const abs = Math.abs(Math.round(value));
    const str = abs.toLocaleString('en-CA');
    return value < 0 ? `($${str})` : `$${str}`;
  },

  _pct(value) {
    if (value == null || isNaN(value)) return '0.0%';
    return value.toFixed(1) + '%';
  },

  _effectiveCosts(deal) {
    const ai = deal.allIn || false;
    const ov = deal.allInOverrides || {};
    return {
      soft:        (!ai || ov.soft)        ? deal.softCosts.total    : 0,
      contingency: (!ai || ov.contingency) ? deal.contingency.amount : 0,
      municipal:   (!ai || ov.municipal)   ? deal.municipalFees.total : 0,
      financing:   (!ai || ov.financing)   ? deal.financing.total    : 0,
    };
  },

  _meta(deal) {
    const buildTypeLabels = {
      fourplex: 'Fourplex', duplex: 'Duplex', sixplex: 'Sixplex',
      townhouse: 'Townhouse', eightplex: 'Eightplex',
    };
    const muni = Defaults.municipalities[deal.projectInfo.municipality];
    return {
      name:      deal.projectInfo.name || 'Untitled Project',
      typeLabel: buildTypeLabels[deal.projectInfo.buildType] || deal.projectInfo.buildType,
      muniLabel: muni ? muni.label : deal.projectInfo.municipality,
      date:      new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
  },

  // ── PDF ────────────────────────────────────────────────────
  toPDF(deal) {
    if (!deal || !deal.results || !deal.results.totalProjectCost) {
      UI.toast('Please calculate the project first.');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      UI.toast('Allow pop-ups to export PDF, then try again.');
      return;
    }
    win.document.write(this._buildPrintDocument(deal));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 350);
  },

  _buildPrintDocument(deal) {
    const r   = deal.results;
    const eff = this._effectiveCosts(deal);
    const m   = this._meta(deal);
    const pass = r.yieldPct >= 20;
    const yieldColour = pass ? '#15803d' : '#b91c1c';
    const profitColour = r.profit >= 0 ? '#15803d' : '#b91c1c';

    const tpc = r.totalProjectCost;
    const pctOfTotal = v => tpc > 0 ? (v / tpc * 100).toFixed(1) + '%' : '—';

    // Cost rows: [label, amount, style: 'normal'|'indent'|'subtotal'|'total']
    const costRows = [
      ['Land Acquisition',          deal.landAcquisition.total,                              'bold'],
      ['&nbsp;&nbsp;Purchase Price', deal.landAcquisition.breakdown.purchasePrice.amount,    'indent'],
      ['&nbsp;&nbsp;Legal / DD',     deal.landAcquisition.breakdown.legalDD.amount,          'indent'],
      ['&nbsp;&nbsp;Closing Costs',  deal.landAcquisition.breakdown.closingCostsAmount.amount,'indent'],
      ['Hard Costs',                 deal.hardCosts.total,                                   'bold'],
      ['Soft Costs',                 eff.soft,                                               'bold'],
      ['Contingency',                eff.contingency,                                        'bold'],
      ['Municipal Fees',             eff.municipal,                                          'bold'],
      ['Cost Before Financing',      r.totalCostBeforeFinancing,                             'subtotal'],
      ['Financing Costs',            eff.financing,                                          'bold'],
      ['Total Project Cost',         tpc,                                                    'total'],
    ];

    const costRowsHtml = costRows.map(([lbl, amt, style]) => {
      const isTotal    = style === 'total';
      const isSubtotal = style === 'subtotal';
      const isIndent   = style === 'indent';
      const tr = isTotal
        ? `style="background:#f3f4f6;font-weight:700;border-top:2px solid #374151;"`
        : isSubtotal
        ? `style="font-weight:600;border-top:1px solid #d1d5db;color:#374151;"`
        : '';
      const labelStyle = isIndent ? `style="color:#6b7280;font-size:9.5pt;"` : '';
      const pctCell = isIndent ? '' : `<td style="text-align:right;padding:4px 6px;color:#9ca3af;font-size:9pt;">${pctOfTotal(amt)}</td>`;
      return `<tr ${tr}><td style="padding:4px 8px;" ${labelStyle}>${lbl}</td><td style="text-align:right;padding:4px 8px;font-variant-numeric:tabular-nums;">${this._fmt(amt)}</td>${isIndent ? '<td></td>' : pctCell}</tr>`;
    }).join('');

    const revRows = [
      ['Gross Sales',                  deal.revenue.breakdown.grossSales,                  false],
      ['Less: Realtor Commission',     -deal.revenue.breakdown.realtorCommission.amount,   false],
      ['Less: Legal Fees',             -deal.revenue.breakdown.legalPerSale.amount,        false],
      ...(deal.revenue.breakdown.marketingCosts.amount > 0
        ? [['Less: Marketing', -deal.revenue.breakdown.marketingCosts.amount, false]] : []),
      ['Net Revenue',                  r.netRevenue,                                       'total'],
    ];

    const revRowsHtml = revRows.map(([lbl, amt, style]) => {
      const isTotal = style === 'total';
      const tr = isTotal ? `style="background:#f3f4f6;font-weight:700;border-top:2px solid #374151;"` : '';
      const colour = !isTotal && amt < 0 ? `style="text-align:right;padding:4px 8px;color:#b91c1c;font-variant-numeric:tabular-nums;"` : `style="text-align:right;padding:4px 8px;font-variant-numeric:tabular-nums;"`;
      const display = amt === 0 && !isTotal ? ' style="display:none"' : '';
      return `<tr ${tr}${display}><td style="padding:4px 8px;">${lbl}</td><td ${colour}>${this._fmt(Math.abs(amt))}</td></tr>`;
    }).join('');

    const allInBanner = deal.allIn
      ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:9.5pt;color:#92400e;">
           ⚠ All-in pricing mode active — hard costs treated as fully inclusive. Excluded sections shown as $0.
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SSMUH Analysis — ${m.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background: white; }
  @page { margin: 0.75in; }
  @media print { @page { margin: 0.75in; } }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: middle; }

  .page-header { border-bottom: 3px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 18px; }
  .page-header h1 { font-size: 20pt; font-weight: 800; color: #1d4ed8; line-height: 1; }
  .page-header .subtitle { color: #6b7280; font-size: 9pt; margin-top: 2px; }
  .meta-bar { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 10px; }
  .meta-item { font-size: 9.5pt; }
  .meta-label { color: #6b7280; }
  .meta-value { font-weight: 600; }

  .yield-box { text-align: center; border-radius: 8px; padding: 14px 20px; margin-bottom: 18px;
               background: ${pass ? '#f0fdf4' : '#fef2f2'};
               border: 2px solid ${yieldColour}; }
  .yield-label { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
  .yield-number { font-size: 40pt; font-weight: 800; color: ${yieldColour}; line-height: 1.1; }
  .yield-status { font-size: 12pt; font-weight: 700; color: ${yieldColour}; margin-top: 2px; }

  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
  .metric { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; }
  .metric-label { font-size: 8.5pt; color: #6b7280; }
  .metric-value { font-size: 12pt; font-weight: 700; margin-top: 2px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .section-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
                   color: #374151; background: #f3f4f6; padding: 5px 8px; margin-bottom: 0; }
  .section-table th { font-size: 8.5pt; color: #6b7280; font-weight: 600; padding: 4px 8px;
                      text-align: right; border-bottom: 1px solid #e5e7eb; }
  .section-table th:first-child { text-align: left; }

  .fin-block { margin-top: 14px; }
  .fin-row { display: flex; justify-content: space-between; font-size: 9.5pt; padding: 3px 8px; }
  .fin-row.total { font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 5px; margin-top: 2px; }
  .fin-label { color: #6b7280; }

  .page-footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;
                 font-size: 8pt; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<div class="page-header">
  <h1>SSMUH Yield Calculator</h1>
  <div class="subtitle">Small-Scale Multi-Unit Housing — Financial Analysis</div>
  <div class="meta-bar">
    <div class="meta-item"><span class="meta-label">Project: </span><span class="meta-value">${m.name}</span></div>
    <div class="meta-item"><span class="meta-label">Type: </span><span class="meta-value">${m.typeLabel}</span></div>
    <div class="meta-item"><span class="meta-label">Municipality: </span><span class="meta-value">${m.muniLabel}</span></div>
    <div class="meta-item"><span class="meta-label">Units: </span><span class="meta-value">${deal.projectInfo.numUnits}</span></div>
    <div class="meta-item"><span class="meta-label">SF / Unit: </span><span class="meta-value">${deal.projectInfo.sfPerUnit.toLocaleString('en-CA')}</span></div>
    <div class="meta-item"><span class="meta-label">Date: </span><span class="meta-value">${m.date}</span></div>
  </div>
</div>

${allInBanner}

<div class="yield-box">
  <div class="yield-label">Project Yield</div>
  <div class="yield-number">${this._pct(r.yieldPct)}</div>
  <div class="yield-status">${pass ? '✓ Passes 20% Target' : '✗ Below 20% Target'}</div>
</div>

<div class="metrics-grid">
  <div class="metric"><div class="metric-label">Total Project Cost</div><div class="metric-value">${this._fmt(tpc)}</div></div>
  <div class="metric"><div class="metric-label">Net Revenue</div><div class="metric-value">${this._fmt(r.netRevenue)}</div></div>
  <div class="metric"><div class="metric-label">Profit</div><div class="metric-value" style="color:${profitColour}">${this._fmt(r.profit)}</div></div>
  <div class="metric"><div class="metric-label">Profit / Unit</div><div class="metric-value" style="color:${profitColour}">${this._fmt(r.profitPerUnit)}</div></div>
  <div class="metric"><div class="metric-label">ROI on Equity</div><div class="metric-value">${this._pct(r.roiOnEquity)}</div></div>
  <div class="metric"><div class="metric-label">Break-even / Unit</div><div class="metric-value">${this._fmt(r.breakEvenPricePerUnit)}</div></div>
</div>

<div class="two-col">
  <div>
    <div class="section-title">Cost Breakdown</div>
    <table class="section-table">
      <thead><tr>
        <th style="text-align:left;">Category</th>
        <th>Amount</th>
        <th>% of Total</th>
      </tr></thead>
      <tbody>${costRowsHtml}</tbody>
    </table>
  </div>

  <div>
    <div class="section-title">Revenue Breakdown</div>
    <table class="section-table">
      <thead><tr>
        <th style="text-align:left;">Item</th>
        <th>Amount</th>
      </tr></thead>
      <tbody>${revRowsHtml}</tbody>
    </table>

    <div class="fin-block">
      <div class="section-title">Financing Assumptions</div>
      <div class="fin-row"><span class="fin-label">Equity contribution</span><span>${deal.financing.breakdown.equityPct}%</span></div>
      <div class="fin-row"><span class="fin-label">Interest rate</span><span>${deal.financing.breakdown.interestRate}%</span></div>
      <div class="fin-row"><span class="fin-label">Construction period</span><span>${deal.financing.breakdown.constructionPeriod} months</span></div>
      <div class="fin-row"><span class="fin-label">Loan amount (${(deal.financing.breakdown.ltv * 100).toFixed(0)}% LTV)</span><span>${this._fmt(deal.financing.breakdown.loanAmount)}</span></div>
      <div class="fin-row total"><span>Total Financing Cost</span><span>${this._fmt(eff.financing)}</span></div>
    </div>
  </div>
</div>

<div class="page-footer">
  SSMUH Yield Calculator &nbsp;|&nbsp; For preliminary analysis only. This is not investment or financial advice. &nbsp;|&nbsp; ${m.date}
</div>

</body>
</html>`;
  },

  // ── Email ──────────────────────────────────────────────────
  toEmail(deal) {
    if (!deal || !deal.results || !deal.results.totalProjectCost) {
      UI.toast('Please calculate the project first.');
      return;
    }
    const m = this._meta(deal);
    const subject = `SSMUH Analysis: ${m.name}`;
    const body    = this._buildEmailBody(deal, m);
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  _buildEmailBody(deal, m) {
    const r   = deal.results;
    const eff = this._effectiveCosts(deal);
    const pass = r.yieldPct >= 20;
    const sep  = '─'.repeat(44);
    const line = (label, value, pad = 30) => `${label.padEnd(pad)}${value}`;

    const rows = [
      'SSMUH YIELD CALCULATOR — DEAL ANALYSIS',
      '='.repeat(44),
      '',
      line('Project:',      m.name),
      line('Type:',         `${m.typeLabel} (${deal.projectInfo.numUnits} units, ${deal.projectInfo.sfPerUnit.toLocaleString()} SF/unit)`),
      line('Municipality:', m.muniLabel),
      line('Date:',         m.date),
      '',
      sep,
      'RESULTS',
      sep,
      line('Project Yield:', this._pct(r.yieldPct) + `  ${pass ? '✓ PASSES 20% TARGET' : '✗ BELOW 20% TARGET'}`),
      '',
      line('Total Project Cost:',   this._fmt(r.totalProjectCost)),
      line('Net Revenue:',          this._fmt(r.netRevenue)),
      line('Profit:',               this._fmt(r.profit)),
      line('Profit per Unit:',      this._fmt(r.profitPerUnit)),
      line('ROI on Equity:',        this._pct(r.roiOnEquity)),
      line('Break-even / Unit:',    this._fmt(r.breakEvenPricePerUnit)),
      '',
      sep,
      'COST BREAKDOWN',
      sep,
      line('Land Acquisition:',     this._fmt(deal.landAcquisition.total)),
      line('Hard Costs:',           this._fmt(deal.hardCosts.total)),
      line('Soft Costs:',           this._fmt(eff.soft)),
      line('Contingency:',          this._fmt(eff.contingency)),
      line('Municipal Fees:',       this._fmt(eff.municipal)),
      line('Cost Before Financing:', this._fmt(r.totalCostBeforeFinancing)),
      line('Financing Costs:',      this._fmt(eff.financing)),
      line('TOTAL PROJECT COST:',   this._fmt(r.totalProjectCost)),
      '',
      sep,
      'REVENUE BREAKDOWN',
      sep,
      line('Gross Sales:',                  this._fmt(deal.revenue.breakdown.grossSales)),
      line('Less: Realtor Commission:',     this._fmt(deal.revenue.breakdown.realtorCommission.amount)),
      line('Less: Legal Fees:',             this._fmt(deal.revenue.breakdown.legalPerSale.amount)),
      ...(deal.revenue.breakdown.marketingCosts.amount > 0
        ? [line('Less: Marketing:', this._fmt(deal.revenue.breakdown.marketingCosts.amount))] : []),
      line('NET REVENUE:',                  this._fmt(r.netRevenue)),
      '',
      sep,
      'FINANCING',
      sep,
      line('Equity:',             deal.financing.breakdown.equityPct + '%'),
      line('Interest Rate:',      deal.financing.breakdown.interestRate + '%'),
      line('Construction Period:', deal.financing.breakdown.constructionPeriod + ' months'),
      line('Loan Amount:',        this._fmt(deal.financing.breakdown.loanAmount)),
      line('Total Financing:',    this._fmt(eff.financing)),
      '',
      ...(deal.allIn ? ['⚠ All-in mode was active — hard costs treated as fully inclusive.', ''] : []),
      sep,
      'For preliminary analysis only. Not investment or financial advice.',
    ];

    return rows.join('\n');
  },

  // ── Excel ──────────────────────────────────────────────────
  toExcel(deal) {
    if (!deal || !deal.results || !deal.results.totalProjectCost) {
      UI.toast('Please calculate the project first.');
      return;
    }
    if (typeof XLSX === 'undefined') {
      UI.toast('Loading Excel library…');
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.onload  = () => this._generateExcel(deal);
      script.onerror = () => UI.toast('Could not load Excel library. Check your connection.');
      document.head.appendChild(script);
      return;
    }
    this._generateExcel(deal);
  },

  _generateExcel(deal) {
    const wb   = this._buildWorkbook(deal);
    const safe = (deal.projectInfo.name || 'deal').replace(/[^a-z0-9\-_]/gi, '_').slice(0, 40);
    XLSX.writeFile(wb, `${safe}_ssmuh_analysis.xlsx`);
    UI.toast('Excel file downloaded.');
  },

  _buildWorkbook(deal) {
    const r   = deal.results;
    const eff = this._effectiveCosts(deal);
    const m   = this._meta(deal);
    const pass = r.yieldPct >= 20;
    const tpc = r.totalProjectCost;

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Summary ───────────────────────────────────
    const summary = [
      ['SSMUH Yield Calculator — Deal Analysis'],
      [],
      ['Project',        m.name],
      ['Type',           m.typeLabel],
      ['Municipality',   m.muniLabel],
      ['Units',          deal.projectInfo.numUnits],
      ['SF per Unit',    deal.projectInfo.sfPerUnit],
      ['Total SF',       deal.projectInfo.totalSF],
      ['Date',           m.date],
      ['All-in Mode',    deal.allIn ? 'Yes' : 'No'],
      [],
      ['RESULTS'],
      ['Project Yield',  r.yieldPct / 100],
      ['Status',         pass ? 'PASSES — ≥ 20%' : 'BELOW 20% TARGET'],
      [],
      ['KEY METRICS',    'Amount'],
      ['Total Project Cost',    tpc],
      ['Net Revenue',           r.netRevenue],
      ['Profit',                r.profit],
      ['Profit per Unit',       r.profitPerUnit],
      ['ROI on Equity',         r.roiOnEquity / 100],
      ['Break-even / Unit',     r.breakEvenPricePerUnit],
      [],
      ['COST BREAKDOWN',  'Amount', '% of Total Project Cost'],
      ['Land Acquisition',               deal.landAcquisition.total,    tpc > 0 ? deal.landAcquisition.total / tpc : 0],
      ['  Land Purchase Price',          deal.landAcquisition.breakdown.purchasePrice.amount,     ''],
      ['  Legal / Due Diligence',        deal.landAcquisition.breakdown.legalDD.amount,            ''],
      ['  Closing Costs',                deal.landAcquisition.breakdown.closingCostsAmount.amount,  ''],
      ['Hard Costs',                     deal.hardCosts.total,           tpc > 0 ? deal.hardCosts.total / tpc : 0],
      ['Soft Costs',                     eff.soft,                       tpc > 0 ? eff.soft / tpc : 0],
      ['Contingency',                    eff.contingency,                tpc > 0 ? eff.contingency / tpc : 0],
      ['Municipal Fees',                 eff.municipal,                  tpc > 0 ? eff.municipal / tpc : 0],
      ['Cost Before Financing',          r.totalCostBeforeFinancing,     tpc > 0 ? r.totalCostBeforeFinancing / tpc : 0],
      ['Financing Costs',                eff.financing,                  tpc > 0 ? eff.financing / tpc : 0],
      ['TOTAL PROJECT COST',             tpc,                            1],
      [],
      ['REVENUE BREAKDOWN', 'Amount'],
      ['Gross Sales',                    deal.revenue.breakdown.grossSales],
      ['Less: Realtor Commission',       -deal.revenue.breakdown.realtorCommission.amount],
      ['Less: Legal Fees',               -deal.revenue.breakdown.legalPerSale.amount],
      ['Less: Marketing',                -deal.revenue.breakdown.marketingCosts.amount],
      ['NET REVENUE',                    r.netRevenue],
      [],
      ['FINANCING',         'Value'],
      ['Equity (%)',                      deal.financing.breakdown.equityPct / 100],
      ['Interest Rate (%)',               deal.financing.breakdown.interestRate / 100],
      ['Construction Period (months)',    deal.financing.breakdown.constructionPeriod],
      ['Loan Amount',                     deal.financing.breakdown.loanAmount],
      ['Total Interest Cost',             deal.financing.breakdown.interestCost || 0],
      ['Commitment Fee',                  deal.financing.breakdown.commitmentFee.amount],
      ['Lender Legal Fees',               deal.financing.breakdown.lenderLegal.amount],
      ['Total Financing Cost',            eff.financing],
      [],
      ['For preliminary analysis only. Not investment or financial advice.'],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 22 }];

    // Apply number formats to key cells (row indices below are 0-based)
    this._applyXlsxFormats(wsSummary, summary);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ── Sheet 2: Hard Cost Breakdown ───────────────────────
    const hardTotal = deal.hardCosts.total;
    const hardRows = [
      ['Hard Cost Distribution'],
      ['Item', 'Amount', '% of Hard Costs'],
      ...Object.values(deal.hardCosts.breakdown).map(item => [
        item.label, item.amount, hardTotal > 0 ? item.amount / hardTotal : 0,
      ]),
      ['TOTAL', hardTotal, 1],
    ];
    const wsHard = XLSX.utils.aoa_to_sheet(hardRows);
    wsHard['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }];
    this._applyXlsxFormats(wsHard, hardRows);
    XLSX.utils.book_append_sheet(wb, wsHard, 'Hard Costs');

    // ── Sheet 3: Soft Cost Breakdown ───────────────────────
    const softTotal = deal.softCosts.total;
    const softRows = [
      ['Soft Cost Distribution'],
      ['Item', 'Amount', '% of Soft Costs'],
      ...Object.values(deal.softCosts.breakdown).map(item => [
        item.label, item.amount, softTotal > 0 ? item.amount / softTotal : 0,
      ]),
      ['TOTAL', softTotal, 1],
    ];
    const wsSoft = XLSX.utils.aoa_to_sheet(softRows);
    wsSoft['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }];
    this._applyXlsxFormats(wsSoft, softRows);
    XLSX.utils.book_append_sheet(wb, wsSoft, 'Soft Costs');

    // ── Sheet 4: Municipal Fees ────────────────────────────
    const muniRows = [
      ['Municipal Fees — ' + m.muniLabel],
      ['Item', 'Amount', 'Per Unit'],
      ...Object.values(deal.municipalFees.breakdown).map(item => [
        item.label, item.amount, item.perUnit != null ? item.perUnit : '',
      ]),
      ['TOTAL', deal.municipalFees.total, ''],
    ];
    const wsMuni = XLSX.utils.aoa_to_sheet(muniRows);
    wsMuni['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }];
    this._applyXlsxFormats(wsMuni, muniRows);
    XLSX.utils.book_append_sheet(wb, wsMuni, 'Municipal Fees');

    return wb;
  },

  // Apply currency and percentage number formats to cells that contain numbers
  _applyXlsxFormats(ws, aoa) {
    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < aoa[r].length; c++) {
        const v = aoa[r][c];
        if (typeof v !== 'number') continue;
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        // Column C (index 2) in summary/breakdown sheets is a proportion → percentage format
        // Everything else that looks like a proportion (0 < v ≤ 1, col ≥ 1) → percentage
        // Large numbers → currency format
        if (c >= 1 && Math.abs(v) <= 1 && v !== 0) {
          ws[addr].z = '0.0%';
        } else if (Math.abs(v) > 1) {
          ws[addr].z = '"$"#,##0';
        }
      }
    }
  },
};
