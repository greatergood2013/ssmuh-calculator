/**
 * SSMUH Yield Calculator - Smart Defaults & Industry Data
 *
 * Sources:
 *   - Altus 2025 Canadian Cost Guide (Vancouver Residential)
 *   - J.P.'s actual Victoria-area pro formas
 *   - Greater Victoria municipality DCC fee schedules
 */

const Defaults = {
  // ── SF per unit by building type ────────────────────────────
  sfPerUnit: {
    fourplex:   1100,
    sixplex:    950,
    townhouse:  1300,
    duplex:     1400,
    eightplex:  900,
  },

  // ── Altus 2025 Cost per SF (Victoria/Vancouver area) ───────
  costPerSF: {
    conservative: 250,
    baseline:     275,  // Default for 4-6 unit wood-frame
    midRange:     320,
    high:         365,
  },

  // ── Hard Cost Distribution (% of total hard costs) ─────────
  hardCostDistribution: {
    foundation:       { pct: 0.12, label: 'Foundation & Concrete' },
    framing:          { pct: 0.25, label: 'Framing & Structure' },
    exteriorEnvelope: { pct: 0.18, label: 'Exterior Envelope' },
    interiorFinishes: { pct: 0.20, label: 'Interior Finishes' },
    mechanical:       { pct: 0.12, label: 'Mechanical (HVAC/Plumbing)' },
    electrical:       { pct: 0.08, label: 'Electrical' },
    siteWorks:        { pct: 0.05, label: 'Site Works & Landscaping' },
  },

  // ── Soft Cost Distribution (% of hard costs unless fixed) ──
  softCostBreakdown: {
    architecture:   { pct: 6.0,  fixed: null, label: 'Architecture / Engineering' },
    devConsultant:  { pct: 7.1,  fixed: null, label: 'Development Consultant' },
    legal:          { pct: null, fixed: 10000, label: 'Legal Fees' },
    insurance:      { pct: 1.1,  fixed: null, label: 'Insurance (Construction)' },
    propertyTax:    { pct: 0.6,  fixed: null, label: 'Property Tax (During Const.)' },
    devPermit:      { pct: null, fixed: null, label: 'Development Permit', formula: 'devPermit' },
    buildingPermit: { pct: null, fixed: null, label: 'Building Permit', formula: 'buildingPermit' },
    marketing:      { pct: 1.1,  fixed: null, label: 'Marketing / Renderings' },
  },

  baseSoftCostPct: 15, // Overall target percentage before overrides

  // ── Municipality DCC Rates (per unit) ──────────────────────
  // sourceUrl: link to the official municipal DCC bylaw / rate schedule / calculator
  municipalities: {
    victoria: {
      label: 'Victoria',
      sourceUrl: 'https://www.victoria.ca/city-government/bylaw-services/development-cost-charges-bylaw',
      feesUrl:   'https://www.victoria.ca/building-business/permits-development-construction/rezoning-development/summary-fees',
      dcc: {
        transit:   { perUnit: 3732, label: 'DCC - Transit',  sourceUrl: 'https://www.victoria.ca/media/file/development-cost-charges-bylaw-24-053' },
        water:     { perUnit: 910,  label: 'DCC - Water',    sourceUrl: 'https://www.victoria.ca/media/file/development-cost-charges-bylaw-24-053' },
        drainage:  { perUnit: 781,  label: 'DCC - Drainage', sourceUrl: 'https://www.victoria.ca/media/file/development-cost-charges-bylaw-24-053' },
        sewer:     { perUnit: 1357, label: 'DCC - Sewer',    sourceUrl: 'https://www.victoria.ca/media/file/development-cost-charges-bylaw-24-053' },
        parks:     { perUnit: 3694, label: 'DCC - Parks',     sourceUrl: 'https://www.victoria.ca/media/file/development-cost-charges-bylaw-24-053' },
      },
      other: {
        waterConnection:  { perUnit: 6000, label: 'Water Connection', sourceUrl: 'https://www.victoria.ca/home-property/utilities/utility-rates-billing' },
        sewerConnection:  { perUnit: 0,    label: 'Sewer Connection', sourceUrl: 'https://www.victoria.ca/home-property/utilities/utility-rates-billing' },
        rezoning:         { fixed: 2000,   label: 'Rezoning Fee',     sourceUrl: 'https://www.victoria.ca/building-business/permits-development-construction/rezoning-development/summary-fees' },
        subdivision:      { perUnit: 385,  label: 'Subdivision Fee',  sourceUrl: 'https://www.victoria.ca/building-business/permits-development-construction/rezoning-development/subdivision-land' },
      },
    },
    saanich: {
      label: 'Saanich',
      sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/development-cost-charges.html',
      feesUrl:   'https://www.saanich.ca/EN/main/local-government/departments/engineering-department/service-connection-fees-additional-charges.html',
      dcc: {
        transit:   { perUnit: 3200, label: 'DCC - Transit',  sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/development-cost-charges.html' },
        water:     { perUnit: 850,  label: 'DCC - Water',    sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/development-cost-charges.html' },
        drainage:  { perUnit: 650,  label: 'DCC - Drainage', sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/development-cost-charges.html' },
        sewer:     { perUnit: 1200, label: 'DCC - Sewer',    sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/development-cost-charges.html' },
        parks:     { perUnit: 3100, label: 'DCC - Parks',     sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/development-cost-charges.html' },
      },
      other: {
        waterConnection:  { perUnit: 5500, label: 'Water Connection', sourceUrl: 'https://www.saanich.ca/EN/main/local-government/departments/engineering-department/service-connection-fees-additional-charges.html' },
        sewerConnection:  { perUnit: 0,    label: 'Sewer Connection', sourceUrl: 'https://www.saanich.ca/EN/main/local-government/departments/engineering-department/service-connection-fees-additional-charges.html' },
        rezoning:         { fixed: 2000,   label: 'Rezoning Fee',     sourceUrl: 'https://www.saanich.ca/EN/main/local-government/zoning/rezoning-process.html' },
        subdivision:      { perUnit: 350,  label: 'Subdivision Fee',  sourceUrl: 'https://www.saanich.ca/EN/main/local-government/development-applications/subdivisions/costs.html' },
      },
    },
    langford: {
      label: 'Langford',
      sourceUrl: 'https://webapps.langford.ca/lodccc/LODCCCalc.html',
      feesUrl:   'https://langford.ca/wp-content/uploads/2023/04/Fees-Combined-for-Website-20240423.pdf',
      dcc: {
        transit:   { perUnit: 2800, label: 'DCC - Transit',  sourceUrl: 'https://webapps.langford.ca/lodccc/LODCCCalc.html' },
        water:     { perUnit: 750,  label: 'DCC - Water',    sourceUrl: 'https://webapps.langford.ca/lodccc/LODCCCalc.html' },
        drainage:  { perUnit: 600,  label: 'DCC - Drainage', sourceUrl: 'https://webapps.langford.ca/lodccc/LODCCCalc.html' },
        sewer:     { perUnit: 1100, label: 'DCC - Sewer',    sourceUrl: 'https://webapps.langford.ca/lodccc/LODCCCalc.html' },
        parks:     { perUnit: 2800, label: 'DCC - Parks',     sourceUrl: 'https://webapps.langford.ca/lodccc/LODCCCalc.html' },
      },
      other: {
        waterConnection:  { perUnit: 5000, label: 'Water Connection', sourceUrl: 'https://langford.ca/residents/resident-resources/water-sewer-2/' },
        sewerConnection:  { perUnit: 0,    label: 'Sewer Connection', sourceUrl: 'https://langford.ca/residents/resident-resources/water-sewer-2/' },
        rezoning:         { fixed: 1800,   label: 'Rezoning Fee',     sourceUrl: 'https://langford.ca/wp-content/uploads/2023/04/Fees-Combined-for-Website-20240423.pdf' },
        subdivision:      { perUnit: 300,  label: 'Subdivision Fee',  sourceUrl: 'https://langford.ca/builders/subdividing/' },
      },
    },
    colwood: {
      label: 'Colwood',
      sourceUrl: 'https://www.colwood.ca/city-services/development-services/development-cost-charges-dccs',
      feesUrl:   'https://www.colwood.ca/city-hall/bylaws/1814/development-fees-and-charges',
      calculatorUrl: 'https://www.colwood.ca/city-services/development-services/development-cost-charges-estimator',
      dcc: {
        transit:   { perUnit: 2600, label: 'DCC - Transit',  sourceUrl: 'https://www.colwood.ca/sites/default/files/2025-01/DEVELOPMENT%20COST%20CHARGES%20(January%202025).pdf' },
        water:     { perUnit: 700,  label: 'DCC - Water',    sourceUrl: 'https://www.colwood.ca/sites/default/files/2025-01/DEVELOPMENT%20COST%20CHARGES%20(January%202025).pdf' },
        drainage:  { perUnit: 550,  label: 'DCC - Drainage', sourceUrl: 'https://www.colwood.ca/sites/default/files/2025-01/DEVELOPMENT%20COST%20CHARGES%20(January%202025).pdf' },
        sewer:     { perUnit: 1000, label: 'DCC - Sewer',    sourceUrl: 'https://www.colwood.ca/sites/default/files/2025-01/DEVELOPMENT%20COST%20CHARGES%20(January%202025).pdf' },
        parks:     { perUnit: 2600, label: 'DCC - Parks',     sourceUrl: 'https://www.colwood.ca/sites/default/files/2025-01/DEVELOPMENT%20COST%20CHARGES%20(January%202025).pdf' },
      },
      other: {
        waterConnection:  { perUnit: 4800, label: 'Water Connection', sourceUrl: 'https://www.colwood.ca/city-services/building-permits-inspections/new-construction' },
        sewerConnection:  { perUnit: 0,    label: 'Sewer Connection', sourceUrl: 'https://www.colwood.ca/city-services/finance/property-tax/sewer-user-fee' },
        rezoning:         { fixed: 1500,   label: 'Rezoning Fee',     sourceUrl: 'https://www.colwood.ca/city-hall/bylaws/1814/development-fees-and-charges' },
        subdivision:      { perUnit: 280,  label: 'Subdivision Fee',  sourceUrl: 'https://www.colwood.ca/city-services/development-services/development-and-land-use-application-forms/subdivision-process' },
      },
    },
    esquimalt: {
      label: 'Esquimalt',
      sourceUrl: 'https://www.esquimalt.ca/government-bylaws/bylaws-enforcement/bylaws/development-application-procedures-and-fees-bylaw-1',
      feesUrl:   'https://www.esquimalt.ca/media/file/bylaw-2791-development-application-procedures-and-fees-consolidated-march-4-20241pdf',
      dcc: {
        transit:   { perUnit: 3500, label: 'DCC - Transit',  sourceUrl: 'https://www.esquimalt.ca/media/file/bylaw-2791-development-application-procedures-and-fees-consolidated-march-4-20241pdf' },
        water:     { perUnit: 900,  label: 'DCC - Water',    sourceUrl: 'https://www.esquimalt.ca/media/file/bylaw-2791-development-application-procedures-and-fees-consolidated-march-4-20241pdf' },
        drainage:  { perUnit: 750,  label: 'DCC - Drainage', sourceUrl: 'https://www.esquimalt.ca/media/file/bylaw-2791-development-application-procedures-and-fees-consolidated-march-4-20241pdf' },
        sewer:     { perUnit: 1300, label: 'DCC - Sewer',    sourceUrl: 'https://www.esquimalt.ca/media/file/bylaw-2791-development-application-procedures-and-fees-consolidated-march-4-20241pdf' },
        parks:     { perUnit: 3400, label: 'DCC - Parks',     sourceUrl: 'https://www.esquimalt.ca/media/file/bylaw-2791-development-application-procedures-and-fees-consolidated-march-4-20241pdf' },
      },
      other: {
        waterConnection:  { perUnit: 5800, label: 'Water Connection', sourceUrl: 'https://www.esquimalt.ca/government-bylaws/bylaws-enforcement/bylaws/subdivision-and-development-servicing-bylaw-schedules' },
        sewerConnection:  { perUnit: 0,    label: 'Sewer Connection', sourceUrl: 'https://www.esquimalt.ca/government-bylaws/bylaws-enforcement/bylaws/subdivision-and-development-servicing-bylaw-schedules' },
        rezoning:         { fixed: 2000,   label: 'Rezoning Fee',     sourceUrl: 'https://www.esquimalt.ca/business-development/building-zoning/rezoning' },
        subdivision:      { perUnit: 360,  label: 'Subdivision Fee',  sourceUrl: 'https://www.esquimalt.ca/government-bylaws/bylaws-enforcement/bylaws/subdivision-and-development-servicing-bylaw-schedules' },
      },
    },
    custom: {
      label: 'Custom (Manual Entry)',
      sourceUrl: null,
      feesUrl:   null,
      dcc: {
        transit:   { perUnit: 0, label: 'DCC - Transit' },
        water:     { perUnit: 0, label: 'DCC - Water' },
        drainage:  { perUnit: 0, label: 'DCC - Drainage' },
        sewer:     { perUnit: 0, label: 'DCC - Sewer' },
        parks:     { perUnit: 0, label: 'DCC - Parks' },
      },
      other: {
        waterConnection:  { perUnit: 0, label: 'Water Connection' },
        sewerConnection:  { perUnit: 0, label: 'Sewer Connection' },
        rezoning:         { fixed: 0,   label: 'Rezoning Fee' },
        subdivision:      { perUnit: 0, label: 'Subdivision Fee' },
      },
    },
  },

  // ── Financing defaults ─────────────────────────────────────
  financing: {
    equityPct:          25,
    interestRate:       7.5,
    constructionPeriod: 14,
    commitmentFeePct:   1.0,
    lenderLegal:        5000,
  },

  // ── Revenue defaults ───────────────────────────────────────
  revenue: {
    realtorCommissionPct: 3.5,
    legalPerSale:         2500,
    marketingCosts:       0,
  },

  // ── Building Permit Formula (Victoria) ─────────────────────
  calculateBuildingPermit(constructionValue) {
    const baseRate = 0.01;       // 1% of construction value
    return constructionValue * baseRate;
  },

  calculateDevPermit(constructionValue) {
    const dpRate = 0.000929;     // 0.0929% of construction value
    return constructionValue * dpRate;
  },
};
