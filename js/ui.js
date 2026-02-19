/**
 * SSMUH Yield Calculator - UI / DOM / Animations / Accordion Rendering
 */

const UI = {
  // ── Formatting helpers ─────────────────────────────────────
  formatCurrency(value) {
    if (value == null || isNaN(value)) return '$0';
    const abs = Math.abs(Math.round(value));
    const formatted = abs.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return value < 0 ? `(${formatted})` : formatted;
  },

  formatPct(value) {
    if (value == null || isNaN(value)) return '0.0%';
    return value.toFixed(1) + '%';
  },

  parseCurrency(str) {
    if (!str) return 0;
    return parseFloat(String(str).replace(/[^0-9.\-]/g, '')) || 0;
  },

  formatCurrencyInput(input) {
    const raw = input.value.replace(/[^0-9]/g, '');
    if (raw === '') { input.value = ''; return; }
    input.value = parseInt(raw, 10).toLocaleString('en-CA');
  },

  setCurrencyField(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ? Math.round(value).toLocaleString('en-CA') : '';
  },

  // ── Toast notification ─────────────────────────────────────
  toast(message) {
    const el = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    msg.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  },
  _toastTimer: null,

  // ── Accordion toggle ───────────────────────────────────────
  toggleAccordion(sectionKey) {
    const accordion = document.querySelector(`.accordion[data-section="${sectionKey}"]`);
    if (!accordion) return;
    const body = accordion.querySelector('.accordion-body');
    const chevron = accordion.querySelector('.accordion-chevron');
    if (!body) return;

    const isHidden = body.classList.contains('hidden');
    body.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('rotate-180', isHidden);
  },

  // ── Render line-item rows for breakdowns ───────────────────
  renderBreakdownRows(containerId, items, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const showZeros = document.getElementById('showZeros') ? document.getElementById('showZeros').checked : true;

    for (const [key, item] of Object.entries(items)) {
      if (!showZeros && item.amount === 0) continue;

      const row = document.createElement('div');
      row.className = 'breakdown-row flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group';
      row.dataset.key = key;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'text-sm text-gray-700 flex items-center gap-1.5';
      labelSpan.textContent = item.label || key;

      // Info icon linking to source document
      if (item.sourceUrl) {
        const infoLink = document.createElement('a');
        infoLink.href = item.sourceUrl;
        infoLink.target = '_blank';
        infoLink.rel = 'noopener noreferrer';
        infoLink.className = 'info-source-icon inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-800 cursor-pointer transition-colors flex-shrink-0';
        infoLink.title = 'View source: official municipal document';
        infoLink.innerHTML = '<svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>';
        infoLink.addEventListener('click', (e) => e.stopPropagation());
        labelSpan.appendChild(infoLink);
      }

      if (item.modified) {
        const badge = document.createElement('span');
        badge.className = 'text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium';
        badge.textContent = 'Modified';
        labelSpan.appendChild(badge);
      }

      // Per-unit rate indicator
      if (item.perUnit != null && opts && opts.showPerUnit) {
        const rate = document.createElement('span');
        rate.className = 'text-xs text-gray-400';
        rate.textContent = `($${item.perUnit.toLocaleString()}/unit)`;
        labelSpan.appendChild(rate);
      }

      const valueWrap = document.createElement('div');
      valueWrap.className = 'flex items-center gap-1';

      if (opts && opts.editable) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'breakdown-value-input w-24 text-right text-sm py-0.5 px-2 border border-transparent rounded hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent font-medium text-gray-800';
        input.value = this.formatCurrency(item.amount).replace('$', '').trim();
        input.dataset.sectionKey = opts.sectionKey || '';
        input.dataset.itemKey = key;
        input.addEventListener('focus', function () { this.select(); });
        input.addEventListener('blur', function () {
          const num = UI.parseCurrency(this.value);
          this.value = num.toLocaleString('en-CA');
          if (opts.onEdit) opts.onEdit(key, num);
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') this.blur();
        });
        const dollar = document.createElement('span');
        dollar.className = 'text-sm text-gray-400';
        dollar.textContent = '$';
        valueWrap.appendChild(dollar);
        valueWrap.appendChild(input);
      } else {
        const val = document.createElement('span');
        val.className = 'text-sm font-medium text-gray-800';
        val.textContent = this.formatCurrency(item.amount);
        valueWrap.appendChild(val);
      }

      row.appendChild(labelSpan);
      row.appendChild(valueWrap);
      container.appendChild(row);
    }
  },

  // ── Update header totals (the right-side $ on each accordion) ──
  updateSectionTotals(deal) {
    document.getElementById('landTotal').textContent = this.formatCurrency(deal.landAcquisition.total);
    document.getElementById('hardTotal').textContent = this.formatCurrency(deal.hardCosts.total);
    document.getElementById('contingencyTotal').textContent = this.formatCurrency(deal.contingency.amount);
    document.getElementById('municipalTotal').textContent = this.formatCurrency(deal.municipalFees.total);
    document.getElementById('financingTotal').textContent = this.formatCurrency(deal.financing.total);
    document.getElementById('revenueNetTotal').textContent = this.formatCurrency(deal.revenue.total);

    // Soft cost label with delta display
    const s = deal.softCosts;
    let softLabel = `Soft Costs: ${s.pctOfHard.toFixed(1)}%`;
    if (s.delta !== 0) {
      const sign = s.delta > 0 ? '+' : '-';
      softLabel += ` ${sign} $${Math.abs(s.delta).toLocaleString()}`;
      // Show revised % only when there's a delta
      document.getElementById('softTotal').textContent = `${this.formatCurrency(s.total)} (${s.revisedPct.toFixed(1)}%)`;
    } else {
      document.getElementById('softTotal').textContent = this.formatCurrency(s.total);
    }
    document.getElementById('softCostLabel').textContent = softLabel;

    // Municipal badge
    const muni = Defaults.municipalities[deal.municipalFees.municipality];
    document.getElementById('muniLabel').textContent = muni ? muni.label : deal.municipalFees.municipality;

    // Total SF display
    document.getElementById('totalSFDisplay').textContent = deal.projectInfo.totalSF.toLocaleString('en-CA');
  },

  // ── Render all breakdowns ──────────────────────────────────
  renderAllBreakdowns(deal, callbacks) {
    // Hard costs
    this.renderBreakdownRows('hardCostBreakdown', deal.hardCosts.breakdown, {
      editable: true,
      sectionKey: 'hard',
      onEdit: callbacks.onHardCostEdit,
    });

    // Soft costs
    this.renderBreakdownRows('softCostBreakdown', deal.softCosts.breakdown, {
      editable: true,
      sectionKey: 'soft',
      onEdit: callbacks.onSoftCostEdit,
    });

    // Municipal — DCC
    const dcc = {};
    const other = {};
    for (const [k, v] of Object.entries(deal.municipalFees.breakdown)) {
      if (v.category === 'dcc') dcc[k] = v;
      else other[k] = v;
    }
    this.renderBreakdownRows('dccBreakdown', dcc, {
      editable: true,
      showPerUnit: true,
      sectionKey: 'municipal',
      onEdit: callbacks.onMunicipalEdit,
    });
    this.renderBreakdownRows('otherMuniBreakdown', other, {
      editable: true,
      showPerUnit: true,
      sectionKey: 'municipal',
      onEdit: callbacks.onMunicipalEdit,
    });

    // Update municipality-level source links
    const muni = Defaults.municipalities[deal.municipalFees.municipality];
    const dccLink = document.getElementById('dccSourceLink');
    const feesLink = document.getElementById('feesSourceLink');
    if (dccLink) {
      if (muni && muni.sourceUrl) {
        dccLink.href = muni.sourceUrl;
        dccLink.classList.remove('hidden');
      } else {
        dccLink.classList.add('hidden');
      }
    }
    if (feesLink) {
      if (muni && muni.feesUrl) {
        feesLink.href = muni.feesUrl;
        feesLink.classList.remove('hidden');
      } else {
        feesLink.classList.add('hidden');
      }
    }

    // Financing summary
    this.renderFinancingSummary(deal);

    // Revenue summary
    this.renderRevenueSummary(deal);
  },

  renderFinancingSummary(deal) {
    const f = deal.financing.breakdown;
    const el = document.getElementById('financingSummary');
    if (!el) return;
    el.innerHTML = `
      <div class="flex justify-between"><span>Loan Amount (${(f.ltv * 100).toFixed(0)}% LTV)</span><span class="font-medium">${this.formatCurrency(f.loanAmount)}</span></div>
      <div class="flex justify-between"><span>Land Interest (Day 1, ${f.constructionPeriod}mo)</span><span class="font-medium">${this.formatCurrency(f.landInterest || 0)}</span></div>
      <div class="flex justify-between"><span>Construction Interest (S-curve)</span><span class="font-medium">${this.formatCurrency(f.constructionInterest || 0)}</span></div>
      <div class="flex justify-between text-gray-400 text-xs"><span>Total Interest</span><span>${this.formatCurrency(f.interestCost)}</span></div>
      <div class="flex justify-between"><span>Commitment Fee (${f.commitmentFee.pct}%)</span><span class="font-medium">${this.formatCurrency(f.commitmentFee.amount)}</span></div>
      <div class="flex justify-between"><span>Lender Legal</span><span class="font-medium">${this.formatCurrency(f.lenderLegal.amount)}</span></div>
      <div class="flex justify-between border-t border-gray-300 pt-1 mt-1 font-semibold"><span>Total Financing</span><span>${this.formatCurrency(deal.financing.total)}</span></div>
    `;
  },

  renderRevenueSummary(deal) {
    const r = deal.revenue.breakdown;
    const el = document.getElementById('revenueSummary');
    if (!el) return;
    el.innerHTML = `
      <div class="flex justify-between"><span>Gross Sales (${deal.projectInfo.numUnits} units)</span><span class="font-medium">${this.formatCurrency(r.grossSales)}</span></div>
      <div class="flex justify-between text-red-600"><span>Realtor Commission (${r.realtorCommission.pct}%)</span><span class="font-medium">(${this.formatCurrency(r.realtorCommission.amount)})</span></div>
      <div class="flex justify-between text-red-600"><span>Legal Fees</span><span class="font-medium">(${this.formatCurrency(r.legalPerSale.amount)})</span></div>
      ${r.marketingCosts.amount > 0 ? `<div class="flex justify-between text-red-600"><span>Marketing</span><span class="font-medium">(${this.formatCurrency(r.marketingCosts.amount)})</span></div>` : ''}
      <div class="flex justify-between border-t border-gray-300 pt-1 mt-1 font-semibold"><span>Net Revenue</span><span>${this.formatCurrency(r.netRevenue)}</span></div>
    `;
  },

  // ── Results Card Rendering ─────────────────────────────────
  showResults() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsCard').classList.remove('hidden');
  },

  hideResults() {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('resultsCard').classList.add('hidden');
  },

  renderResults(deal) {
    this.showResults();
    const r = deal.results;

    const container = document.getElementById('resultsContainer');
    const houseIcon = document.getElementById('houseIcon');
    const yieldValue = document.getElementById('yieldValue');
    const yieldStatus = document.getElementById('yieldStatus');
    const yieldGap = document.getElementById('yieldGap');

    // Reset
    container.className = 'bg-white rounded-lg shadow-sm border-2 p-8 transition-all duration-300';
    houseIcon.className = 'text-7xl transition-all duration-300';
    houseIcon.style.opacity = '';
    houseIcon.style.filter = '';
    yieldGap.classList.add('hidden');
    document.getElementById('whatToChange').classList.add('hidden');

    if (r.pass) {
      container.classList.add('border-green-400');
      yieldValue.className = 'text-6xl font-bold text-green-600';
      yieldStatus.innerHTML = '<span class="text-green-600">&#10003; Deal Passes!</span>';
      houseIcon.classList.add('animate-bounce-once');
      document.getElementById('saveDealBtn').textContent = 'Save This Deal';
      document.getElementById('saveDealBtn').className = 'w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors';
    } else {
      container.classList.add('border-red-400');
      yieldValue.className = 'text-6xl font-bold text-red-600';
      yieldStatus.innerHTML = '<span class="text-red-600">&#9888; Below 20% Target</span>';
      const gap = 20 - r.yieldPct;
      yieldGap.textContent = `${gap.toFixed(1)}% below target`;
      yieldGap.className = 'mt-1 text-sm text-red-500';
      yieldGap.classList.remove('hidden');

      document.getElementById('whatToChange').classList.remove('hidden');
      document.getElementById('changeCosts').textContent = `Reduce total costs by ${this.formatCurrency(r.costReduction)}`;
      document.getElementById('changeRevenue').textContent = `OR increase net revenue by ${this.formatCurrency(r.revenueIncrease)}`;
      document.getElementById('saveDealBtn').textContent = 'Save Anyway';
      document.getElementById('saveDealBtn').className = 'w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors';

      this.triggerExplosion();
    }

    yieldValue.textContent = this.formatPct(r.yieldPct);
    document.getElementById('resultCostBeforeFinancing').textContent = this.formatCurrency(r.totalCostBeforeFinancing);
    document.getElementById('resultFinancingCosts').textContent = this.formatCurrency(deal.financing.total);
    document.getElementById('resultTotalCost').textContent = this.formatCurrency(r.totalProjectCost);
    document.getElementById('resultNetRevenue').textContent = this.formatCurrency(r.netRevenue);

    const profitEl = document.getElementById('resultProfit');
    profitEl.textContent = this.formatCurrency(r.profit);
    profitEl.className = r.profit >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600';

    const ppuEl = document.getElementById('resultProfitPerUnit');
    ppuEl.textContent = this.formatCurrency(r.profitPerUnit);
    ppuEl.className = r.profitPerUnit >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600';

    document.getElementById('resultROI').textContent = this.formatPct(r.roiOnEquity);
    document.getElementById('resultBreakEven').textContent = this.formatCurrency(r.breakEvenPricePerUnit);

    // Detailed breakdown
    this.renderDetailedBreakdown(deal);
  },

  renderDetailedBreakdown(deal) {
    const el = document.getElementById('detailedBreakdown');
    if (!el) return;

    const fmt = (v) => this.formatCurrency(v);
    const pct = (v, total) => total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '0%';
    const tpc = deal.results.totalProjectCost;

    const makeTable = (title, rows) => {
      let html = `<div><div class="font-semibold text-gray-800 mb-1">${title}</div><table class="w-full text-xs">`;
      for (const [label, amount] of rows) {
        const isBold = label.startsWith('TOTAL') || label.startsWith('NET');
        const cls = isBold ? 'font-bold border-t border-gray-300' : '';
        html += `<tr class="${cls}"><td class="py-0.5 pr-2">${label}</td><td class="text-right py-0.5">${fmt(amount)}</td><td class="text-right py-0.5 text-gray-400 w-14">${pct(amount, tpc)}</td></tr>`;
      }
      html += `</table></div>`;
      return html;
    };

    const costRows = [
      ['Land Acquisition', deal.landAcquisition.total],
      ['Hard Costs', deal.hardCosts.total],
      ['Soft Costs', deal.softCosts.total],
      ['Contingency', deal.contingency.amount],
      ['Municipal Fees', deal.municipalFees.total],
      ['TOTAL BEFORE FINANCING', deal.results.totalCostBeforeFinancing],
      ['Financing Costs', deal.financing.total],
      ['TOTAL PROJECT COST', tpc],
    ];

    const gr = deal.revenue.breakdown.grossSales;
    const revRows = [
      ['Gross Sales', gr],
      ['Realtor Commission', -deal.revenue.breakdown.realtorCommission.amount],
      ['Legal Fees', -deal.revenue.breakdown.legalPerSale.amount],
      ['Marketing', -deal.revenue.breakdown.marketingCosts.amount],
      ['NET REVENUE', deal.revenue.total],
    ];

    el.innerHTML = makeTable('Cost Breakdown', costRows) + makeTable('Revenue Breakdown', revRows);
  },

  // ── Explosion animation ────────────────────────────────────
  triggerExplosion() {
    const houseIcon = document.getElementById('houseIcon');
    const canvas = document.getElementById('explosionCanvas');
    const area = document.getElementById('animationArea');

    canvas.width = area.offsetWidth;
    canvas.height = area.offsetHeight;
    canvas.classList.remove('hidden');

    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const particles = [];
    const colors = ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#991b1b'];
    for (let i = 0; i < 25; i++) {
      const angle = (Math.PI * 2 * i) / 25;
      const speed = 2 + Math.random() * 4;
      particles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, size: 3 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], life: 1, decay: 0.01 + Math.random() * 0.02 });
    }

    const container = document.getElementById('resultsContainer');
    container.classList.add('screen-shake');
    setTimeout(() => container.classList.remove('screen-shake'), 500);
    setTimeout(() => houseIcon.classList.add('explode-out'), 100);

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (alive) {
        requestAnimationFrame(animate);
      } else {
        canvas.classList.add('hidden');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        houseIcon.classList.remove('explode-out');
        houseIcon.style.opacity = '0.3';
        houseIcon.style.filter = 'grayscale(1)';
      }
    }
    animate();
  },

  // ── Deal History ───────────────────────────────────────────
  renderHistory() {
    const deals = Storage.getDeals();
    const section = document.getElementById('historySection');
    const tbody = document.getElementById('historyBody');

    if (deals.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    document.getElementById('emptyHistory').classList.add('hidden');
    tbody.innerHTML = '';

    for (const deal of deals) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors';
      tr.dataset.dealId = deal.id;
      const sc = deal.results.pass ? 'text-green-600' : 'text-red-600';
      const st = deal.results.pass ? '&#10003; Pass' : '&#10007; Fail';
      tr.innerHTML = `
        <td class="py-3 pr-4 text-gray-600">${deal.date}</td>
        <td class="py-3 pr-4 font-medium text-gray-900">${this.escapeHtml(deal.projectName || 'Untitled')}</td>
        <td class="py-3 pr-4 text-right">${deal.projectInfo ? deal.projectInfo.numUnits : (deal.inputs ? deal.inputs.numUnits : '-')}</td>
        <td class="py-3 pr-4 text-right font-semibold ${sc}">${this.formatPct(deal.results.yieldPct)}</td>
        <td class="py-3 pr-4 text-right">${this.formatCurrency(deal.results.totalProjectCost)}</td>
        <td class="py-3 pr-4 text-right ${sc}">${this.formatCurrency(deal.results.profit)}</td>
        <td class="py-3 pr-4 text-center ${sc}">${st}</td>
        <td class="py-3 text-center"><button class="delete-deal text-gray-400 hover:text-red-600 transition-colors" data-id="${deal.id}" title="Delete">&#10005;</button></td>
      `;
      tbody.appendChild(tr);
    }
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ── Validation ─────────────────────────────────────────────
  showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.classList.add('border-red-500', 'ring-2', 'ring-red-200');
    const existing = input.parentElement.querySelector('.field-error');
    if (existing) existing.remove();
    if (message) {
      const err = document.createElement('p');
      err.className = 'field-error text-red-500 text-xs mt-1';
      err.textContent = message;
      input.parentElement.appendChild(err);
    }
  },

  clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('.border-red-500').forEach(el => el.classList.remove('border-red-500', 'ring-2', 'ring-red-200'));
  },

  // ── Flash an input briefly to show it synced ───────────────
  flashField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('field-flash');
    setTimeout(() => el.classList.remove('field-flash'), 600);
  },
};
