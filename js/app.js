/**
 * SSMUH Yield Calculator - Main Application Logic (Enhanced)
 *
 * Orchestrates the deal model, form ↔ model sync, accordion interactions,
 * triple-entry construction cost sync, and municipality switching.
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let deal = null;   // Current deal model

  // Breakdown edit callbacks (passed to UI)
  const editCallbacks = {
    onHardCostEdit:  handleHardBreakdownEdit,
    onSoftCostEdit:  handleSoftBreakdownEdit,
    onMunicipalEdit: handleMunicipalBreakdownEdit,
  };

  // ── Initialisation ─────────────────────────────────────────
  function init() {
    deal = Calculator.createDealModel();
    syncModelFromForm();
    recalcAndRender();
    // Initialize soft cost triple-entry fields with computed defaults
    updateSoftTripleEntryFields();

    bindCurrencyFormatting();
    bindAccordions();
    bindTripleEntry();
    bindSoftTripleEntry();
    bindFormInputs();
    bindButtons();
    bindMunicipalitySelector();
    bindBuildTypeSelector();
    bindShowZerosToggle();

    UI.renderHistory();
  }

  // ── Currency input auto-formatting ─────────────────────────
  function bindCurrencyFormatting() {
    document.querySelectorAll('.currency-input').forEach(input => {
      input.addEventListener('input', () => UI.formatCurrencyInput(input));
      UI.formatCurrencyInput(input);
    });
  }

  // ── Accordion click handlers ───────────────────────────────
  function bindAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const target = header.dataset.target;
        if (target) UI.toggleAccordion(target);
      });
    });
  }

  // ── Triple-Entry Construction Cost Sync ────────────────────
  function bindTripleEntry() {
    // Method selector buttons
    document.querySelectorAll('.cost-method-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cost-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        deal.hardCosts.inputMethod = btn.dataset.method;
      });
    });

    // Cost per SF — flash sync fields only on change (blur/tab), recalc on both
    function handleCostPerSF(e) {
      const val = parseFloat(document.getElementById('costPerSF').value) || 0;
      deal.hardCosts.costPerSF = val;
      deal.hardCosts.inputMethod = 'perSF';
      setActiveMethod('perSF');
      // Clear modified flags — triple-entry always overrides line item edits
      for (const item of Object.values(deal.hardCosts.breakdown)) item.modified = false;
      Calculator.syncConstructionCosts(deal);
      if (e.type === 'change') {
        UI.setCurrencyField('costPerUnit', deal.hardCosts.costPerUnit);
        UI.setCurrencyField('totalConstruction', deal.hardCosts.total);
        UI.flashField('costPerUnit');
        UI.flashField('totalConstruction');
      }
      recalcAndRender({ updateSoftFields: true });
    }
    document.getElementById('costPerSF').addEventListener('change', handleCostPerSF);
    document.getElementById('costPerSF').addEventListener('input', handleCostPerSF);

    // Cost per Unit
    function handleCostPerUnit(e) {
      deal.hardCosts.costPerUnit = UI.parseCurrency(document.getElementById('costPerUnit').value);
      deal.hardCosts.inputMethod = 'perUnit';
      setActiveMethod('perUnit');
      // Clear modified flags — triple-entry always overrides line item edits
      for (const item of Object.values(deal.hardCosts.breakdown)) item.modified = false;
      Calculator.syncConstructionCosts(deal);
      if (e.type === 'change') {
        document.getElementById('costPerSF').value = Math.round(deal.hardCosts.costPerSF);
        UI.setCurrencyField('totalConstruction', deal.hardCosts.total);
        UI.flashField('costPerSF');
        UI.flashField('totalConstruction');
      }
      recalcAndRender({ updateSoftFields: true });
    }
    document.getElementById('costPerUnit').addEventListener('change', handleCostPerUnit);
    document.getElementById('costPerUnit').addEventListener('input', handleCostPerUnit);

    // Total construction
    function handleTotalConstruction(e) {
      deal.hardCosts.total = UI.parseCurrency(document.getElementById('totalConstruction').value);
      deal.hardCosts.inputMethod = 'total';
      setActiveMethod('total');
      // Clear modified flags — triple-entry always overrides line item edits
      for (const item of Object.values(deal.hardCosts.breakdown)) item.modified = false;
      Calculator.syncConstructionCosts(deal);
      if (e.type === 'change') {
        document.getElementById('costPerSF').value = Math.round(deal.hardCosts.costPerSF);
        UI.setCurrencyField('costPerUnit', deal.hardCosts.costPerUnit);
        UI.flashField('costPerSF');
        UI.flashField('costPerUnit');
      }
      recalcAndRender({ updateSoftFields: true });
    }
    document.getElementById('totalConstruction').addEventListener('change', handleTotalConstruction);
    document.getElementById('totalConstruction').addEventListener('input', handleTotalConstruction);

    // Units and SF changes re-sync
    function handleNumUnits() {
      deal.projectInfo.numUnits = parseInt(document.getElementById('numUnits').value, 10) || 4;
      deal.projectInfo.totalSF = deal.projectInfo.sfPerUnit * deal.projectInfo.numUnits;
      Calculator.syncConstructionCosts(deal);
      updateTripleEntryFields();
      recalcAndRender({ updateSoftFields: true });
    }
    document.getElementById('numUnits').addEventListener('change', handleNumUnits);
    document.getElementById('numUnits').addEventListener('input', handleNumUnits);

    function handleSfPerUnit() {
      deal.projectInfo.sfPerUnit = UI.parseCurrency(document.getElementById('sfPerUnit').value);
      deal.projectInfo.totalSF = deal.projectInfo.sfPerUnit * deal.projectInfo.numUnits;
      Calculator.syncConstructionCosts(deal);
      updateTripleEntryFields();
      recalcAndRender({ updateSoftFields: true });
    }
    document.getElementById('sfPerUnit').addEventListener('change', handleSfPerUnit);
    document.getElementById('sfPerUnit').addEventListener('input', handleSfPerUnit);
  }

  function setActiveMethod(method) {
    document.querySelectorAll('.cost-method-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.cost-method-btn[data-method="${method}"]`);
    if (btn) btn.classList.add('active');
  }

  function updateTripleEntryFields() {
    document.getElementById('costPerSF').value = Math.round(deal.hardCosts.costPerSF);
    UI.setCurrencyField('costPerUnit', deal.hardCosts.costPerUnit);
    UI.setCurrencyField('totalConstruction', deal.hardCosts.total);
  }

  // ── Triple-Entry Soft Cost Sync ──────────────────────────────
  function bindSoftTripleEntry() {
    // Method selector buttons
    document.querySelectorAll('.soft-method-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.soft-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        deal.softCosts.inputMethod = btn.dataset.method;
      });
    });

    // % of Hard Costs
    function handleSoftPct(e) {
      const val = parseFloat(document.getElementById('softCostPct').value) || 0;
      deal.softCosts.pctOfHard = val;
      deal.softCosts.inputMethod = 'pctOfHard';
      setSoftActiveMethod('pctOfHard');
      // Clear modified flags — triple-entry always overrides line item edits
      for (const item of Object.values(deal.softCosts.breakdown)) item.modified = false;
      Calculator.syncSoftCosts(deal);
      if (e.type === 'change') {
        UI.setCurrencyField('softCostPerUnit', deal.softCosts.costPerUnit);
        UI.setCurrencyField('softCostTotal', deal.softCosts.total);
        UI.flashField('softCostPerUnit');
        UI.flashField('softCostTotal');
      }
      recalcAndRender();
    }
    document.getElementById('softCostPct').addEventListener('change', handleSoftPct);
    document.getElementById('softCostPct').addEventListener('input', handleSoftPct);

    // Cost per Unit
    function handleSoftPerUnit(e) {
      deal.softCosts.costPerUnit = UI.parseCurrency(document.getElementById('softCostPerUnit').value);
      deal.softCosts.inputMethod = 'perUnit';
      setSoftActiveMethod('perUnit');
      // Clear modified flags — triple-entry always overrides line item edits
      for (const item of Object.values(deal.softCosts.breakdown)) item.modified = false;
      Calculator.syncSoftCosts(deal);
      if (e.type === 'change') {
        document.getElementById('softCostPct').value = deal.softCosts.pctOfHard.toFixed(1);
        UI.setCurrencyField('softCostTotal', deal.softCosts.total);
        UI.flashField('softCostPct');
        UI.flashField('softCostTotal');
      }
      recalcAndRender();
    }
    document.getElementById('softCostPerUnit').addEventListener('change', handleSoftPerUnit);
    document.getElementById('softCostPerUnit').addEventListener('input', handleSoftPerUnit);

    // Total Soft Costs
    function handleSoftTotal(e) {
      deal.softCosts.total = UI.parseCurrency(document.getElementById('softCostTotal').value);
      deal.softCosts.inputMethod = 'total';
      setSoftActiveMethod('total');
      // Clear modified flags — triple-entry always overrides line item edits
      for (const item of Object.values(deal.softCosts.breakdown)) item.modified = false;
      Calculator.syncSoftCosts(deal);
      if (e.type === 'change') {
        document.getElementById('softCostPct').value = deal.softCosts.pctOfHard.toFixed(1);
        UI.setCurrencyField('softCostPerUnit', deal.softCosts.costPerUnit);
        UI.flashField('softCostPct');
        UI.flashField('softCostPerUnit');
      }
      recalcAndRender();
    }
    document.getElementById('softCostTotal').addEventListener('change', handleSoftTotal);
    document.getElementById('softCostTotal').addEventListener('input', handleSoftTotal);
  }

  function setSoftActiveMethod(method) {
    document.querySelectorAll('.soft-method-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.soft-method-btn[data-method="${method}"]`);
    if (btn) btn.classList.add('active');
  }

  function updateSoftTripleEntryFields() {
    document.getElementById('softCostPct').value = deal.softCosts.pctOfHard.toFixed(1);
    UI.setCurrencyField('softCostPerUnit', deal.softCosts.costPerUnit);
    UI.setCurrencyField('softCostTotal', deal.softCosts.total);
  }

  // ── Bind main form inputs ──────────────────────────────────
  // We bind both 'change' (fires on tab/enter/blur) and 'input' (fires on
  // each keystroke) so that section totals update in real-time as the user
  // types, giving immediate feedback before they hit Calculate.
  function bindFormInputs() {
    // Helper: bind both 'input' and 'change' to cover immediate + blur
    function bindLive(id, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', handler);
      el.addEventListener('input', handler);
    }

    // Land fields
    ['landCost', 'legalDD', 'closingCosts'].forEach(id => {
      bindLive(id, () => { syncLandFromForm(); recalcAndRender(); });
    });

    // Contingency
    bindLive('contingencyPct', () => {
      deal.contingency.pct = parseFloat(document.getElementById('contingencyPct').value) || 0;
      recalcAndRender();
    });

    // Financing fields
    ['equityPct', 'interestRate', 'constructionPeriod', 'commitmentFeePct', 'lenderLegal'].forEach(id => {
      bindLive(id, () => { syncFinancingFromForm(); recalcAndRender(); });
    });

    // Revenue fields
    ['salePricePerUnit', 'realtorCommission', 'legalPerSale', 'marketingCosts'].forEach(id => {
      bindLive(id, () => { syncRevenueFromForm(); recalcAndRender(); });
    });
  }

  // ── Municipality selector ──────────────────────────────────
  function bindMunicipalitySelector() {
    document.getElementById('municipality').addEventListener('change', () => {
      const key = document.getElementById('municipality').value;
      Calculator.applyMunicipality(deal, key);
      recalcAndRender();
      UI.toast(`Municipal fees updated to ${Defaults.municipalities[key].label}`);
    });
  }

  // ── Build type selector ────────────────────────────────────
  function bindBuildTypeSelector() {
    document.getElementById('buildType').addEventListener('change', () => {
      const bt = document.getElementById('buildType').value;
      deal.projectInfo.buildType = bt;
      deal.projectInfo.sfPerUnit = Defaults.sfPerUnit[bt] || 1100;
      deal.projectInfo.totalSF = deal.projectInfo.sfPerUnit * deal.projectInfo.numUnits;
      UI.setCurrencyField('sfPerUnit', deal.projectInfo.sfPerUnit);
      Calculator.syncConstructionCosts(deal);
      updateTripleEntryFields();
      recalcAndRender();
    });
  }

  // ── Show/Hide zeros ────────────────────────────────────────
  function bindShowZerosToggle() {
    document.getElementById('showZeros').addEventListener('change', () => {
      renderBreakdowns();
    });
  }

  // ── Breakdown line-item edits ──────────────────────────────
  function handleHardBreakdownEdit(key, value) {
    const item = deal.hardCosts.breakdown[key];
    if (!item) return;
    item.amount = value;
    item.modified = true;
    recalcAndRender({ updateSoftFields: true });
    // Refresh triple-entry fields to reflect new total from breakdown edits
    updateTripleEntryFields();
  }

  function handleSoftBreakdownEdit(key, value) {
    const item = deal.softCosts.breakdown[key];
    if (!item) return;
    item.amount = value;
    item.modified = true;
    recalcAndRender();
    // Refresh triple-entry fields to reflect new total from breakdown edits
    updateSoftTripleEntryFields();
  }

  function handleMunicipalBreakdownEdit(key, value) {
    const item = deal.municipalFees.breakdown[key];
    if (!item) return;
    item.amount = value;
    // Recalc per-unit rate from new amount
    if (item.perUnit != null && deal.projectInfo.numUnits > 0) {
      item.perUnit = value / deal.projectInfo.numUnits;
    }
    recalcAndRender();
  }

  // ── Sync form → model ─────────────────────────────────────
  function syncModelFromForm() {
    syncLandFromForm();
    syncHardCostsFromForm();
    syncSoftCostsFromForm();
    syncFinancingFromForm();
    syncRevenueFromForm();
    deal.contingency.pct = parseFloat(document.getElementById('contingencyPct').value) || 10;
  }

  function syncLandFromForm() {
    deal.landAcquisition.breakdown.purchasePrice.amount = UI.parseCurrency(document.getElementById('landCost').value);
    deal.landAcquisition.breakdown.legalDD.amount = UI.parseCurrency(document.getElementById('legalDD').value);
    deal.landAcquisition.breakdown.closingCostsPct = parseFloat(document.getElementById('closingCosts').value) || 0;
  }

  function syncHardCostsFromForm() {
    deal.projectInfo.numUnits = parseInt(document.getElementById('numUnits').value, 10) || 4;
    deal.projectInfo.sfPerUnit = UI.parseCurrency(document.getElementById('sfPerUnit').value) || 1100;
    deal.projectInfo.totalSF = deal.projectInfo.sfPerUnit * deal.projectInfo.numUnits;

    deal.hardCosts.costPerSF = parseFloat(document.getElementById('costPerSF').value) || 275;
    deal.hardCosts.costPerUnit = UI.parseCurrency(document.getElementById('costPerUnit').value);
    deal.hardCosts.total = UI.parseCurrency(document.getElementById('totalConstruction').value);
  }

  function syncSoftCostsFromForm() {
    deal.softCosts.pctOfHard = parseFloat(document.getElementById('softCostPct').value) || 0;
    deal.softCosts.costPerUnit = UI.parseCurrency(document.getElementById('softCostPerUnit').value);
    deal.softCosts.total = UI.parseCurrency(document.getElementById('softCostTotal').value);
  }

  function syncFinancingFromForm() {
    deal.financing.breakdown.equityPct = parseFloat(document.getElementById('equityPct').value) || 25;
    deal.financing.breakdown.interestRate = parseFloat(document.getElementById('interestRate').value) || 7.5;
    deal.financing.breakdown.constructionPeriod = parseInt(document.getElementById('constructionPeriod').value, 10) || 14;
    deal.financing.breakdown.commitmentFee.pct = parseFloat(document.getElementById('commitmentFeePct').value) || 1;
    deal.financing.breakdown.lenderLegal.amount = UI.parseCurrency(document.getElementById('lenderLegal').value);
  }

  function syncRevenueFromForm() {
    deal.revenue.breakdown.pricePerUnit = UI.parseCurrency(document.getElementById('salePricePerUnit').value);
    deal.revenue.breakdown.realtorCommission.pct = parseFloat(document.getElementById('realtorCommission').value) || 3.5;
    deal.revenue.breakdown.legalPerSale.fixed = UI.parseCurrency(document.getElementById('legalPerSale').value);
    deal.revenue.breakdown.marketingCosts.amount = UI.parseCurrency(document.getElementById('marketingCosts').value);
  }

  // ── Load deal model → form fields ─────────────────────────
  function loadFormFromModel() {
    // Project info
    document.getElementById('projectName').value = deal.projectInfo.name || '';
    document.getElementById('buildType').value = deal.projectInfo.buildType || 'fourplex';
    document.getElementById('municipality').value = deal.projectInfo.municipality || 'victoria';
    document.getElementById('numUnits').value = deal.projectInfo.numUnits;
    UI.setCurrencyField('sfPerUnit', deal.projectInfo.sfPerUnit);

    // Land
    UI.setCurrencyField('landCost', deal.landAcquisition.breakdown.purchasePrice.amount);
    UI.setCurrencyField('legalDD', deal.landAcquisition.breakdown.legalDD.amount);
    document.getElementById('closingCosts').value = deal.landAcquisition.breakdown.closingCostsPct;

    // Hard costs
    document.getElementById('costPerSF').value = Math.round(deal.hardCosts.costPerSF);
    UI.setCurrencyField('costPerUnit', deal.hardCosts.costPerUnit);
    UI.setCurrencyField('totalConstruction', deal.hardCosts.total);
    setActiveMethod(deal.hardCosts.inputMethod);

    // Soft costs triple-entry
    document.getElementById('softCostPct').value = deal.softCosts.pctOfHard.toFixed(1);
    UI.setCurrencyField('softCostPerUnit', deal.softCosts.costPerUnit);
    UI.setCurrencyField('softCostTotal', deal.softCosts.total);
    setSoftActiveMethod(deal.softCosts.inputMethod);

    // Contingency
    document.getElementById('contingencyPct').value = deal.contingency.pct;

    // Financing
    document.getElementById('equityPct').value = deal.financing.breakdown.equityPct;
    document.getElementById('interestRate').value = deal.financing.breakdown.interestRate;
    document.getElementById('constructionPeriod').value = deal.financing.breakdown.constructionPeriod;
    document.getElementById('commitmentFeePct').value = deal.financing.breakdown.commitmentFee.pct;
    UI.setCurrencyField('lenderLegal', deal.financing.breakdown.lenderLegal.amount);

    // Revenue
    UI.setCurrencyField('salePricePerUnit', deal.revenue.breakdown.pricePerUnit);
    document.getElementById('realtorCommission').value = deal.revenue.breakdown.realtorCommission.pct;
    UI.setCurrencyField('legalPerSale', deal.revenue.breakdown.legalPerSale.fixed);
    UI.setCurrencyField('marketingCosts', deal.revenue.breakdown.marketingCosts.amount);
  }

  // ── Master recalc + re-render ──────────────────────────────
  function recalcAndRender(opts) {
    Calculator.calculate(deal);
    UI.updateSectionTotals(deal);
    renderBreakdowns();
    // Optionally update soft cost triple-entry fields
    // (when hard costs or project size change, soft costs need to stay in sync)
    if (opts && opts.updateSoftFields) {
      updateSoftTripleEntryFields();
    }
  }

  function renderBreakdowns() {
    UI.renderAllBreakdowns(deal, editCallbacks);
  }

  // ── Validation ─────────────────────────────────────────────
  function validate() {
    UI.clearFieldErrors();
    let valid = true;

    if (!deal.landAcquisition.breakdown.purchasePrice.amount || deal.landAcquisition.breakdown.purchasePrice.amount <= 0) {
      UI.showFieldError('landCost', 'Land cost is required');
      valid = false;
    }
    if (!deal.hardCosts.total || deal.hardCosts.total <= 0) {
      UI.showFieldError('totalConstruction', 'Construction cost is required');
      valid = false;
    }
    if (!deal.revenue.breakdown.pricePerUnit || deal.revenue.breakdown.pricePerUnit <= 0) {
      UI.showFieldError('salePricePerUnit', 'Sale price is required');
      valid = false;
    }
    const units = deal.projectInfo.numUnits;
    if (units < 2 || units > 8) {
      UI.showFieldError('numUnits', 'Must be between 2 and 8 units');
      valid = false;
    }
    return valid;
  }

  // ── Button handlers ────────────────────────────────────────
  function bindButtons() {
    document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
    document.getElementById('saveDealBtn').addEventListener('click', handleSave);
    document.getElementById('adjustBtn').addEventListener('click', () => {
      document.getElementById('landCost').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('newAnalysisBtn').addEventListener('click', handleNew);
    document.getElementById('clearHistoryBtn').addEventListener('click', handleClearHistory);
    document.getElementById('historyBody').addEventListener('click', handleHistoryClick);

    // Victoria Defaults
    document.getElementById('victoriaDefaultsBtn').addEventListener('click', handleVictoriaDefaults);

    // Reset buttons
    document.getElementById('resetHardCosts').addEventListener('click', () => {
      Calculator.resetHardCosts(deal);
      updateTripleEntryFields();
      recalcAndRender({ updateSoftFields: true });
      UI.toast('Hard cost distribution reset');
    });
    document.getElementById('resetSoftCosts').addEventListener('click', () => {
      Calculator.resetSoftCosts(deal);
      updateSoftTripleEntryFields();
      recalcAndRender();
      UI.toast('Soft costs reset to defaults');
    });
    document.getElementById('resetMunicipal').addEventListener('click', () => {
      Calculator.resetMunicipalFees(deal);
      recalcAndRender();
      UI.toast('Municipal fees reset');
    });
  }

  function handleCalculate() {
    syncModelFromForm();
    recalcAndRender();
    if (!validate()) return;

    UI.renderResults(deal);

    if (window.innerWidth < 1024) {
      document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleSave() {
    if (!deal.results.totalProjectCost) return;

    deal.projectInfo.name = document.getElementById('projectName').value.trim() || 'Untitled';

    // Deep clone for storage
    const saved = JSON.parse(JSON.stringify(deal));
    Storage.saveDeal({
      projectName: saved.projectInfo.name,
      projectInfo: saved.projectInfo,
      dealSnapshot: saved,
      results: saved.results,
    });

    UI.renderHistory();

    const btn = document.getElementById('saveDealBtn');
    const orig = btn.textContent;
    btn.textContent = 'Saved!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
  }

  function handleNew() {
    deal = Calculator.createDealModel();
    loadFormFromModel();
    document.getElementById('landCost').value = '';
    document.getElementById('salePricePerUnit').value = '';
    UI.hideResults();
    UI.clearFieldErrors();
    recalcAndRender();
    // Update soft cost triple-entry fields after recalc sets natural defaults
    updateSoftTripleEntryFields();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleVictoriaDefaults() {
    deal = Calculator.createDealModel({
      numUnits: deal.projectInfo.numUnits,
      buildType: deal.projectInfo.buildType,
      municipality: 'victoria',
    });
    // Preserve user's land cost and sale price
    const landCost = UI.parseCurrency(document.getElementById('landCost').value);
    const salePrice = UI.parseCurrency(document.getElementById('salePricePerUnit').value);
    if (landCost > 0) deal.landAcquisition.breakdown.purchasePrice.amount = landCost;
    if (salePrice > 0) deal.revenue.breakdown.pricePerUnit = salePrice;

    document.getElementById('municipality').value = 'victoria';
    loadFormFromModel();
    if (landCost > 0) UI.setCurrencyField('landCost', landCost);
    if (salePrice > 0) UI.setCurrencyField('salePricePerUnit', salePrice);
    recalcAndRender();
    updateSoftTripleEntryFields();
    UI.toast('Victoria-area defaults applied');
  }

  function handleClearHistory() {
    if (!confirm('Clear all saved deals? This cannot be undone.')) return;
    Storage.clearAll();
    UI.renderHistory();
  }

  function handleHistoryClick(e) {
    const deleteBtn = e.target.closest('.delete-deal');
    if (deleteBtn) {
      e.stopPropagation();
      if (confirm('Delete this deal?')) {
        Storage.deleteDeal(deleteBtn.dataset.id);
        UI.renderHistory();
      }
      return;
    }

    const row = e.target.closest('tr[data-deal-id]');
    if (row) {
      const saved = Storage.getDealById(row.dataset.dealId);
      if (saved && saved.dealSnapshot) {
        deal = saved.dealSnapshot;
        // Ensure softCosts has the new triple-entry fields (backward compat)
        if (deal.softCosts.baseTotal === undefined) deal.softCosts.baseTotal = 0;
        if (deal.softCosts.inputMethod === undefined) deal.softCosts.inputMethod = 'pctOfHard';
        if (deal.softCosts.pctOfHard === undefined) deal.softCosts.pctOfHard = 0;
        if (deal.softCosts.costPerUnit === undefined) deal.softCosts.costPerUnit = 0;
        loadFormFromModel();
        recalcAndRender();
        updateSoftTripleEntryFields();
        handleCalculate();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // ── Boot ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
