// LensRoof Core Intelligence Engines:
// 1. Indian Government Real Estate Scheme Stacking & Fine-Print Decision Engine
// 2. Global Cross-Border "Apples-to-Apples" Property Comparator & Hidden Liability Detector

export interface GovtSchemeItem {
  slug: string;
  name: string;
  authority: string;
  stateOrRegion: string;
  category: 'Central Subsidy' | 'State Lottery / FCFS' | 'Stalled Project Rescue' | 'Redevelopment & FSI';
  status: 'ACTIVE_OPEN' | 'UPCOMING_WINDOW' | 'ROLLING_FCFS';
  deadlineLabel: string;
  maxBenefitHeadline: string;
  emdRangeInr: string;
  incomeCapLabel: string;
  schemePricePerCarpetSqFtInr: number | null;
  privateMarketIgrRateSqFtInr: number | null;
  lockInYears: number;
  reraOrPortalUrl: string;
  hiddenCatches: string[];
  disqualificationTraps: string[];
  documentChecklist: string[];
}

export const LIVE_GOVT_SCHEMES: GovtSchemeItem[] = [
  {
    slug: 'pmay-urban-2',
    name: 'PMAY-Urban 2.0 (Interest Subsidy Scheme — ISS)',
    authority: 'Ministry of Housing & Urban Affairs (MoHUA), Govt. of India',
    stateOrRegion: 'Pan-India (Urban Statutory Towns)',
    category: 'Central Subsidy',
    status: 'ACTIVE_OPEN',
    deadlineLabel: 'Rolling Applications · FY 2025–2029',
    maxBenefitHeadline: 'Up to ₹1.80 Lakh Interest Subsidy (4% on first ₹8L loan)',
    emdRangeInr: '₹0 (Applied via Bank / HFC Home Loan)',
    incomeCapLabel: 'EWS ≤ ₹3L · LIG ≤ ₹6L · MIG ≤ ₹9L / yr',
    schemePricePerCarpetSqFtInr: null,
    privateMarketIgrRateSqFtInr: null,
    lockInYears: 5,
    reraOrPortalUrl: 'https://pmaymis.gov.in/PMAYMIS2_2024/PmayDefault.aspx',
    hiddenCatches: [
      'Subsidy is NOT paid upfront as a lump sum — it is credited in 5 equal annual installments (~₹36,000/yr) only if the loan remains active and >50% principal is unpaid.',
      'Property value is strictly capped at ₹35 Lakh and Home Loan at ₹25 Lakh for ISS eligibility.',
      'Family (husband, wife, unmarried children) must NOT own any pucca house anywhere in India.',
    ],
    disqualificationTraps: [
      'Applying after full loan disbursement or with a co-applicant who already owns ancestral pucca property.',
      'Aadhaar not seeded with the primary bank account or mismatch between PAN income and self-declared income.',
    ],
    documentChecklist: [
      'Aadhaar + PAN of all adult family members (mandatory deduplication check)',
      'Income Proof (ITR / Salary Slips / Tahsildar Income Certificate matching current FY)',
      'Registered Agreement for Sale showing property value ≤ ₹35 Lakh & carpet area ≤ 120 sq.m.',
      'Undertaking Affidavit confirming zero pucca house ownership across India',
    ],
  },
  {
    slug: 'mhada-mumbai-lottery',
    name: 'MHADA Mumbai & Konkan Board Housing Lottery',
    authority: 'Maharashtra Housing & Area Development Authority',
    stateOrRegion: 'Mumbai, Thane & Konkan (Maharashtra)',
    category: 'State Lottery / FCFS',
    status: 'ACTIVE_OPEN',
    deadlineLabel: 'Active Windows & FCFS Releases',
    maxBenefitHeadline: '15%–28% Below Private Market IGR Rates (Prime Nodes)',
    emdRangeInr: '₹25,000 – ₹1,50,000 (Refundable in 15–30 days)',
    incomeCapLabel: 'EWS ≤ ₹6L · LIG ≤ ₹9L · MIG ≤ ₹12L · HIG > ₹12L',
    schemePricePerCarpetSqFtInr: 21500,
    privateMarketIgrRateSqFtInr: 28900,
    lockInYears: 5,
    reraOrPortalUrl: 'https://housing.mhada.gov.in/',
    hiddenCatches: [
      'Strict 5-year lock-in from possession: selling or transferring via Power of Attorney before 5 years risks cancellation or heavy regularization penalty.',
      'In peripheral nodes (Virar, Vasai, Taloja), MHADA all-in pricing can come within 5% of private resale flats — always check IGR comps first.',
      'High society maintenance & delayed OC in select 20% Inclusive Housing private-builder quota flats.',
    ],
    disqualificationTraps: [
      'Over 25% of rejections happen due to submitting a non-barcode income certificate instead of an official MahaIT barcoded Tahsildar certificate.',
      'Missing 15-year continuous Maharashtra Domicile Certificate (must be barcoded & issued prior to deadline).',
      'Applying in the wrong income slab (e.g., gross vs taxable ITR mismatch).',
    ],
    documentChecklist: [
      'Barcoded Maharashtra 15-Year Domicile Certificate (Aaple Sarkar / MahaIT)',
      'Previous Financial Year ITR Acknowledgement OR Barcoded Tahsildar Income Certificate',
      'PAN Card + Aadhaar linked to active mobile number for DigiLocker fetch',
      'Caste Validity / Non-Creamy Layer Certificate (if applying under reserved quota)',
    ],
  },
  {
    slug: 'cidco-navi-mumbai-fcfs',
    name: 'CIDCO My Preferred Home (Navi Mumbai / NAINA / Taloja FCFS)',
    authority: 'City and Industrial Development Corporation (CIDCO)',
    stateOrRegion: 'Navi Mumbai, Kharghar, Ulwe, Panvel & Taloja',
    category: 'State Lottery / FCFS',
    status: 'ROLLING_FCFS',
    deadlineLabel: 'First-Come-First-Serve (FCFS) + Phase Draws',
    maxBenefitHeadline: 'Stackable with PMAY-U 2.0 + 1% Female Stamp Duty Waiver',
    emdRangeInr: '₹75,000 – ₹1,50,000 EMD',
    incomeCapLabel: 'EWS ≤ ₹6L · LIG ≤ ₹9L · Open FCFS Categories',
    schemePricePerCarpetSqFtInr: 11800,
    privateMarketIgrRateSqFtInr: 13400,
    lockInYears: 5,
    reraOrPortalUrl: 'https://cidcohomes.com/en/',
    hiddenCatches: [
      'CIDCO charges substantial transfer & lease-conversion fees if reselling after the 5-year lock-in period.',
      'Several Taloja & Dronagiri nodes still face last-mile water tanker dependency and delayed metro feeder connectivity — check live AQI & Google Maps satellite first.',
      'In Ulwe & Kharghar, CIDCO base prices exclude water/electricity infrastructure charges & GST if OC is pending.',
    ],
    disqualificationTraps: [
      'Non-barcoded domicile or income certificate rejected automatically during e-KYC.',
      'Delayed 1st installment payment after allotment letter triggers forfeiture of booking amount.',
    ],
    documentChecklist: [
      'Aaple Sarkar Barcoded 15-Year Maharashtra Domicile Certificate',
      'Barcoded Income Certificate / ITR matching CIDCO notification financial year',
      'PMAY-U 2.0 Registration Receipt (mandatory if claiming EWS subsidy stack)',
      'Cancelled Cheque of applicant bank account for EMD refund protection',
    ],
  },
  {
    slug: 'dda-housing-delhi',
    name: 'DDA Apna Ghar & Sabka Ghar Awaas Yojana (FCFS / E-Auction)',
    authority: 'Delhi Development Authority (DDA)',
    stateOrRegion: 'Dwarka, Rohini, Narela, Loknayakpuram & Jasola (Delhi)',
    category: 'State Lottery / FCFS',
    status: 'ROLLING_FCFS',
    deadlineLabel: 'Rolling FCFS Inventory & E-Auction',
    maxBenefitHeadline: 'Up to 15%–25% Special Rebate in Narela / Siraspur + Clean Freehold Title',
    emdRangeInr: '₹50,000 (EWS) – ₹10,00,000 (HIG)',
    incomeCapLabel: 'EWS ≤ ₹10L (Family) · LIG / MIG / HIG No Income Cap',
    schemePricePerCarpetSqFtInr: 14200,
    privateMarketIgrRateSqFtInr: 18600,
    lockInYears: 0,
    reraOrPortalUrl: 'https://eservices.dda.org.in/',
    hiddenCatches: [
      'Zero resale lock-in (major advantage over MHADA/CIDCO), EXCEPT Narela & outer pockets have low rental demand and high commute times.',
      'Forfeiture of 100% booking amount if you surrender a flat booked under FCFS after allotment.',
      'Inspect actual flat finish & seepage physically before clicking book — DDA allots on "as-is-where-is" basis.',
    ],
    disqualificationTraps: [
      'Booking under FCFS without pre-approved home loan causes 60-day payment default and deposit forfeiture.',
    ],
    documentChecklist: [
      'PAN Card + Aadhaar Card + Bank Passbook (for e-KYC)',
      'EWS Family Income Certificate ≤ ₹10 Lakh (only for EWS category)',
      'Home Loan Pre-Approval Letter (recommended before locking FCFS unit)',
    ],
  },
  {
    slug: 'swamih-fund-2',
    name: 'SWAMIH Fund-2 (Stalled Residential Project Last-Mile Rescue)',
    authority: 'SBICAP Ventures Ltd · Ministry of Finance, Govt. of India',
    stateOrRegion: 'Mumbai MMR, Delhi NCR, Pune, Bengaluru & Pan-India',
    category: 'Stalled Project Rescue',
    status: 'ACTIVE_OPEN',
    deadlineLabel: 'Active ₹15,000 Cr Tranche (1,00,000 Stalled Units)',
    maxBenefitHeadline: 'Verify if a Delayed Tower Has Govt Last-Mile Completion Funding',
    emdRangeInr: 'Buyer Due Diligence Check (Zero Fee)',
    incomeCapLabel: 'RERA-Registered Affordable & Mid-Income Projects (≤ ₹2 Cr/unit)',
    schemePricePerCarpetSqFtInr: null,
    privateMarketIgrRateSqFtInr: null,
    lockInYears: 0,
    reraOrPortalUrl: 'https://www.swamihfund.com/',
    hiddenCatches: [
      'Many builders verbally claim "SWAMIH funding is coming" to collect more money — only trust projects with an officially signed SWAMIH sanction letter & dedicated escrow.',
      'Even after SWAMIH sanction, completion typically takes 18–30 months; check latest MahaRERA QPR physical progress.',
    ],
    disqualificationTraps: [
      'Buying a resale unit in a stalled tower without verifying whether SWAMIH holds first charge over unsold inventory.',
    ],
    documentChecklist: [
      'Project MahaRERA / State RERA Registration Number',
      'Latest CA Form 3 & Engineer Form 2 Quarterly Progress Report',
      'Written confirmation of SBICAP SWAMIH escrow disbursement milestone',
    ],
  },
  {
    slug: 'cluster-redevelopment-33-9',
    name: 'Maharashtra DCPR 33(7) & 33(9) Society & Cluster Redevelopment',
    authority: 'Urban Development Dept, Govt. of Maharashtra & BMC',
    stateOrRegion: 'South Mumbai, Worli, Bandra, Prabhadevi & Suburbs',
    category: 'Redevelopment & FSI',
    status: 'ACTIVE_OPEN',
    deadlineLabel: 'Standing Statutory Entitlement (DCPR 2034)',
    maxBenefitHeadline: '35%–50%+ Extra Free RERA Carpet Area + Monthly Transit Rent & Corpus',
    emdRangeInr: 'Society Member Entitlement Audit',
    incomeCapLabel: 'Existing Cessed / Co-op Housing Society Flat Owners',
    schemePricePerCarpetSqFtInr: null,
    privateMarketIgrRateSqFtInr: null,
    lockInYears: 0,
    reraOrPortalUrl: 'https://portal.mcgm.gov.in/',
    hiddenCatches: [
      'Developers often quote "45% extra usable area" including flowerbeds/niches instead of binding Net RERA Carpet Area in the Development Agreement (DA).',
      'Bank Guarantee (BG) for 24–36 months of transit rent is frequently omitted — if the builder stalls, displaced families stop receiving rent.',
    ],
    disqualificationTraps: [
      'Signing a Development Agreement without a 79A-compliant PMC tender, escrow-backed transit rent BG, and hardship-corpus tax clarity.',
    ],
    documentChecklist: [
      'Society Conveyance Deed / Deemed Conveyance & Property Card (CTS)',
      'Section 79A Government Resolution Compliance Minutes',
      'Draft Development Agreement (DA) for LensRoof Clause Red-Flag Scan',
    ],
  },
];

export interface SchemeSimulationInput {
  city: 'Mumbai' | 'Navi Mumbai / Thane' | 'Pune' | 'Delhi NCR' | 'Bengaluru';
  annualHouseholdIncomeLakh: number;
  propertyBudgetLakh: number;
  isFirstTimeBuyer: boolean;
  hasFemaleCoOwner: boolean;
  isUnderConstruction: boolean;
  category: 'EWS' | 'LIG' | 'MIG' | 'HIG';
}

export function simulateGovtSchemeStack(input: SchemeSimulationInput) {
  const incomeL = Math.max(1, Number(input.annualHouseholdIncomeLakh) || 8);
  const budgetL = Math.max(10, Number(input.propertyBudgetLakh) || 35);
  const isMaharashtra =
    input.city === 'Mumbai' || input.city === 'Navi Mumbai / Thane' || input.city === 'Pune';
  const isDelhi = input.city === 'Delhi NCR';

  const stackedBenefits: Array<{
    schemeName: string;
    eligible: boolean;
    savingsLakhInr: number;
    ruleSummary: string;
    catchWarning: string;
  }> = [];

  // 1. PMAY-Urban 2.0 (ISS): First-time buyer, household income <= ₹9L, property <= ₹35L
  const pmayEligible = input.isFirstTimeBuyer && incomeL <= 9 && budgetL <= 35;
  stackedBenefits.push({
    schemeName: 'PMAY-Urban 2.0 Interest Subsidy (ISS)',
    eligible: pmayEligible,
    savingsLakhInr: pmayEligible ? 1.8 : 0,
    ruleSummary: pmayEligible
      ? 'Eligible! 4% interest subsidy on first ₹8 Lakh loan — up to ₹1.80 Lakh credited across 5 annual installments.'
      : `Not eligible under ISS (requires First-Time Buyer, Income ≤ ₹9L/yr, and Property ≤ ₹35L; your input: ₹${incomeL}L income / ₹${budgetL}L property).`,
    catchWarning: 'Paid in 5 yearly tranches (~₹36k/yr), not upfront. Zero pucca house ownership rule applies to entire family.',
  });

  // 2. State Female Homebuyer Stamp Duty Concession
  const femaleStampRateSaving = isMaharashtra ? 0.01 : isDelhi ? 0.02 : 0;
  const femaleEligible = input.hasFemaleCoOwner && femaleStampRateSaving > 0;
  const femaleSavingLakh = femaleEligible ? Number((budgetL * femaleStampRateSaving).toFixed(2)) : 0;
  stackedBenefits.push({
    schemeName: isMaharashtra
      ? 'Maharashtra 1% Female Homebuyer Stamp Duty Concession'
      : isDelhi
        ? 'Delhi 2% Female Homebuyer Stamp Duty Concession'
        : 'State Female Stamp Duty Rebate',
    eligible: femaleEligible,
    savingsLakhInr: femaleSavingLakh,
    ruleSummary: femaleEligible
      ? `Saves ${(femaleStampRateSaving * 100).toFixed(0)}% stamp duty directly at registration (₹${femaleSavingLakh} Lakh instant cash saving).`
      : input.hasFemaleCoOwner
        ? 'No direct state female stamp duty rebate in this city (check local municipal rebates).'
        : 'Add a female sole/co-owner on the registered deed to unlock 1%–2% instant stamp duty savings.',
    catchWarning: isMaharashtra
      ? 'In Maharashtra, property cannot be resold to a male buyer for 15 years without paying back the 1% concession.'
      : 'Female buyer must be named as primary/sole owner on the sale deed as per state circular.',
  });

  // 3. State Housing Board Lottery / FCFS Discount (MHADA / CIDCO / DDA)
  const boardName = isMaharashtra
    ? input.city === 'Navi Mumbai / Thane'
      ? 'CIDCO My Preferred Home (Navi Mumbai / NAINA)'
      : 'MHADA Housing Lottery (Mumbai / Pune)'
    : isDelhi
      ? 'DDA Housing Scheme (FCFS / E-Auction)'
      : 'State Housing Board Quota';

  const boardDiscountPct =
    input.city === 'Mumbai' ? 0.18 : input.city === 'Navi Mumbai / Thane' ? 0.11 : isDelhi ? 0.15 : 0.08;
  const boardEligible = budgetL <= 180;
  const boardSavingLakh = boardEligible ? Number((budgetL * boardDiscountPct).toFixed(2)) : 0;
  stackedBenefits.push({
    schemeName: `${boardName} vs. Private IGR Market Rate`,
    eligible: boardEligible,
    savingsLakhInr: boardSavingLakh,
    ruleSummary: boardEligible
      ? `Estimated ${(boardDiscountPct * 100).toFixed(0)}% discount vs nearby private IGR sale deeds (~₹${boardSavingLakh} Lakh lower acquisition price).`
      : 'Budget exceeds typical state housing board HIG allotment brackets.',
    catchWarning: isMaharashtra
      ? 'Mandatory 5-year resale lock-in + strict MahaIT barcoded 15-year domicile & income certificate required.'
      : 'Verify actual flat connectivity & water supply before paying non-refundable FCFS booking amount.',
  });

  // 4. GST Relief (1% Affordable Housing GST vs 5% Standard if <= ₹45L & <= 60 sq.m metro)
  const gstReliefEligible = input.isUnderConstruction && budgetL <= 45;
  const gstSavingLakh = gstReliefEligible ? Number((budgetL * 0.04).toFixed(2)) : 0;
  stackedBenefits.push({
    schemeName: 'Affordable Housing GST Rate Reduction (1% vs 5%)',
    eligible: gstReliefEligible,
    savingsLakhInr: gstSavingLakh,
    ruleSummary: gstReliefEligible
      ? `Qualifies for 1% GST instead of 5% standard under-construction GST — saves ₹${gstSavingLakh} Lakh upfront.`
      : input.isUnderConstruction
        ? 'Properties above ₹45 Lakh attract 5% GST (or buy Ready-to-Move with OC for 0% GST!).'
        : 'Ready-to-Move (OC Received) properties already enjoy 0% GST!',
    catchWarning: 'Applicable strictly to under-construction units ≤ ₹45 Lakh and carpet area ≤ 60 sq.m. in metro cities.',
  });

  // 5. Home Loan Tax Deduction (Sec 24b + Sec 80C 5-Year Projected Benefit under Old Regime)
  const sec24SavingLakh = Number((Math.min(2.0, budgetL * 0.065) * 0.3 * 5).toFixed(2));
  stackedBenefits.push({
    schemeName: 'Home Loan Interest Tax Shield (Sec 24(b) · 5-Yr Est.)',
    eligible: true,
    savingsLakhInr: sec24SavingLakh,
    ruleSummary: `Up to ₹2 Lakh/yr home loan interest deduction (Old Tax Regime) — est. ₹${sec24SavingLakh} Lakh tax saved over 5 years.`,
    catchWarning: 'Self-occupied Sec 24(b) deduction applies under Old Tax Regime; let-out properties can offset under both regimes.',
  });

  const totalStackedSavingsLakh = Number(
    stackedBenefits.reduce((acc, b) => acc + b.savingsLakhInr, 0).toFixed(2)
  );
  const netEffectiveCostLakh = Number(Math.max(5, budgetL - totalStackedSavingsLakh).toFixed(2));
  const recommendedSchemes = LIVE_GOVT_SCHEMES.filter((s) =>
    isMaharashtra
      ? ['pmay-urban-2', 'mhada-mumbai-lottery', 'cidco-navi-mumbai-fcfs', 'swamih-fund-2'].includes(s.slug)
      : isDelhi
        ? ['pmay-urban-2', 'dda-housing-delhi', 'swamih-fund-2'].includes(s.slug)
        : ['pmay-urban-2', 'swamih-fund-2'].includes(s.slug)
  );

  return {
    input,
    totalStackedSavingsLakh,
    netEffectiveCostLakh,
    savingsPctOfBudget: Number(((totalStackedSavingsLakh / budgetL) * 100).toFixed(1)),
    stackedBenefits,
    recommendedSchemes,
    disqualificationRiskSummary:
      '20%–30% of state lottery applicants get disqualified for non-barcoded Tahsildar income certificates or wrong financial year ITRs. Run our ₹499 Document Pre-Check before paying EMD.',
  };
}

// =========================================================================
// ENGINE 2: GLOBAL CROSS-BORDER "APPLES-TO-APPLES" PROPERTY COMPARATOR
// Normalizes Mumbai, Dubai, London, Singapore & New York into 1 Standard!
// =========================================================================

export type GlobalCityKey = 'Mumbai' | 'Dubai' | 'London' | 'Singapore' | 'New York';

interface GlobalCityProfile {
  city: GlobalCityKey;
  country: string;
  currency: 'INR' | 'AED' | 'GBP' | 'SGD' | 'USD';
  lat: number;
  lng: number;
  areaConvention: string;
  livableIndoorFactor: number; // fraction of quoted area that is TRUE indoor livable space
  avgQuotedPriceUsdPerSqFt: number;
  foreignBuyerTaxPct: number;
  foreignBuyerTaxLabel: string;
  annualServiceAndTaxPct: number;
  grossRentalYieldPct: number;
  rentalIncomeTaxPct: number;
  ownershipType: string;
  tenantProtectionLevel: string;
  keyPublicRegistries: string[];
  hiddenLiabilities: string[];
}

export const GLOBAL_CITY_PROFILES: Record<GlobalCityKey, GlobalCityProfile> = {
  Mumbai: {
    city: 'Mumbai',
    country: 'India',
    currency: 'INR',
    lat: 19.0094,
    lng: 72.8152,
    areaConvention: 'Brochures quote Super Built-Up (+40% loading); Law mandates RERA Carpet Area',
    livableIndoorFactor: 0.71,
    avgQuotedPriceUsdPerSqFt: 840,
    foreignBuyerTaxPct: 10.2, // 6% Stamp Duty + 4.2% PLC/Club/Legal (add 5% if under-construction)
    foreignBuyerTaxLabel: '6% Maharashtra Stamp Duty + 4.2% Builder Add-Ons (+5% GST if no OC)',
    annualServiceAndTaxPct: 0.9,
    grossRentalYieldPct: 2.8,
    rentalIncomeTaxPct: 21.0, // 30% standard deduction on rent → ~21% effective
    ownershipType: 'Freehold / Co-operative Housing Society Share Certificate',
    tenantProtectionLevel: 'Leave & License (11–36 mo fixed term, strong landlord eviction clarity)',
    keyPublicRegistries: ['MahaRERA Section 11 Portal', 'IGR Maharashtra Registered Sale Deeds', 'BMC Sanctioned Plans'],
    hiddenLiabilities: [
      'Part-OC status (water/sewer charges billed at 2x commercial rate until Full OC)',
      '35%–50% Super Built-Up area inflation masking true indoor sq.ft.',
      'NRI Seller TDS trap: 12.5% LTCG + surcharge under Sec 195 unless Form 13 is filed',
    ],
  },
  Dubai: {
    city: 'Dubai',
    country: 'UAE',
    currency: 'AED',
    lat: 25.0886,
    lng: 55.1467,
    areaConvention: 'Title Deed Total Area INCLUDES balconies & terraces (~18% non-indoor)',
    livableIndoorFactor: 0.82,
    avgQuotedPriceUsdPerSqFt: 690,
    foreignBuyerTaxPct: 6.2, // 4% DLD + 2% agency/trustee
    foreignBuyerTaxLabel: '4% Dubai Land Dept (DLD) Transfer Fee + 2.2% Trustee / Admin',
    annualServiceAndTaxPct: 1.9, // Mollak service charges + district cooling chiller
    grossRentalYieldPct: 6.8,
    rentalIncomeTaxPct: 0.0, // 0% personal rental income tax!
    ownershipType: '100% Freehold Title Deed (Designated Freehold Zones)',
    tenantProtectionLevel: 'RERA Rental Index caps annual rent hikes; strong Ejari tenant renewal rights',
    keyPublicRegistries: ['Dubai Pulse DLD Open Transactions', 'Dubai REST Escrow Verification', 'Mollak Service Charge Index'],
    hiddenLiabilities: [
      'Escalating Mollak service charges (AED 18–35/sq.ft./yr) + separate Empower district chiller demand fees',
      'Balcony & terrace square footage bundled into headline price/sq.ft.',
      'Off-plan payments sent outside DLD Law No. 8 registered Escrow IBAN carry total loss risk',
    ],
  },
  London: {
    city: 'London',
    country: 'United Kingdom',
    currency: 'GBP',
    lat: 51.5054,
    lng: -0.0235,
    areaConvention: 'Gross Internal Area (GIA) — fairly transparent indoor floor measurement',
    livableIndoorFactor: 0.94,
    avgQuotedPriceUsdPerSqFt: 1320,
    foreignBuyerTaxPct: 12.5, // SDLT + 3% Additional Property + 2% Non-UK Resident Surcharge
    foreignBuyerTaxLabel: 'UK SDLT + 2% Non-UK Resident Surcharge + 3% Additional Property Rate',
    annualServiceAndTaxPct: 1.6, // Service charge + ground rent + council tax
    grossRentalYieldPct: 4.5,
    rentalIncomeTaxPct: 20.0, // Non-Resident Landlord Scheme
    ownershipType: 'Leasehold (typically 99–999 yrs) or Share of Freehold',
    tenantProtectionLevel: 'Very Strong Tenant Protection (Renters Rights Act abolishes Section 21 no-fault evictions)',
    keyPublicRegistries: ['HM Land Registry Price Paid API', 'UK EPC Energy & Area Register', 'First-Tier Leasehold Tribunal'],
    hiddenLiabilities: [
      'Short Leasehold Trap (<85 years remaining triggers exponential "marriage value" extension cost)',
      'Missing EWS1 fire-safety / cladding certificate makes flats unmortgageable',
      'Doubling ground rent clauses & uncapped service charge escalations in Canary Wharf / Nine Elms towers',
    ],
  },
  Singapore: {
    city: 'Singapore',
    country: 'Singapore',
    currency: 'SGD',
    lat: 1.2834,
    lng: 103.8607,
    areaConvention: 'Strata Area — INCLUDES air-con ledges, void space & private balconies (~16%)',
    livableIndoorFactor: 0.84,
    avgQuotedPriceUsdPerSqFt: 1680,
    foreignBuyerTaxPct: 64.0, // 60% Foreigner ABSD + ~4% BSD! (20% for PRs)
    foreignBuyerTaxLabel: '60% Foreigner ABSD + 4%–6% Buyer Stamp Duty (PRs pay 5%–30% ABSD)',
    annualServiceAndTaxPct: 1.2, // MCST fees + progressive property tax
    grossRentalYieldPct: 3.4,
    rentalIncomeTaxPct: 24.0, // Non-resident flat 24% on net rental income
    ownershipType: '99-Year Leasehold (most condos) or Freehold Strata',
    tenantProtectionLevel: 'Balanced pro-contract Tenancy Agreement; diplomatic clause standard for expats',
    keyPublicRegistries: ['URA Private Property Transactions API', 'URA Rental Contract Database', 'SLA Title Search'],
    hiddenLiabilities: [
      '60% Additional Buyer Stamp Duty (ABSD) for non-exempt foreign buyers (US/Swiss/FTA citizens exempt to citizen rates)',
      '99-Year Lease Decay curve accelerates sharply after building crosses 40 years of age',
      'Strata area includes non-livable air-conditioner ledges and planter boxes',
    ],
  },
  'New York': {
    city: 'New York',
    country: 'United States',
    currency: 'USD',
    lat: 40.758,
    lng: -73.9855,
    areaConvention: 'Gross Exterior Wall-to-Wall Area (includes structural columns & shafts ~14%)',
    livableIndoorFactor: 0.86,
    avgQuotedPriceUsdPerSqFt: 1550,
    foreignBuyerTaxPct: 4.8, // Mansion Tax (1%–3.9%) + Mortgage Recording Tax (1.925%) + Title Insurance
    foreignBuyerTaxLabel: 'NY Mansion Tax (1%–3.9% over $1M) + Title Insurance + Closing Legal',
    annualServiceAndTaxPct: 2.6, // NYC Property Tax + High Condo Common Charges
    grossRentalYieldPct: 4.1,
    rentalIncomeTaxPct: 24.0, // Federal + NY State net rental tax + FIRPTA withholding on exit
    ownershipType: 'Condominium (Real Property) or Co-op (Corporate Shares)',
    tenantProtectionLevel: 'Strict NY Housing Stability & Good Cause Eviction protections',
    keyPublicRegistries: ['NYC ACRIS Deeds & Mortgages', 'NYC DOB Building Violations', 'FEMA Flood Hazard API'],
    hiddenLiabilities: [
      'Local Law 97 Carbon Emissions Fines hitting older pre-war & glass towers starting 2025–2030',
      'Co-op Board Rejection Risk (can reject buyers without reason + require 24 months post-closing liquid reserves)',
      'FIRPTA 15% gross withholding tax when a foreign investor sells a US property',
    ],
  },
};

export async function compareGlobalCitiesEdge(
  cityA: GlobalCityKey,
  cityB: GlobalCityKey,
  budgetUsdMillions: number
) {
  const budgetUsd = Math.max(0.25, Number(budgetUsdMillions) || 1.5) * 1_000_000;
  const pA = GLOBAL_CITY_PROFILES[cityA] || GLOBAL_CITY_PROFILES.Mumbai;
  const pB = GLOBAL_CITY_PROFILES[cityB] || GLOBAL_CITY_PROFILES.Dubai;

  // Fetch LIVE Open-Meteo AQI & Weather for BOTH global cities in parallel!
  const fetchLiveEnv = async (lat: number, lng: number) => {
    try {
      const [aq, wx] = await Promise.all([
        fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      const aqC = (aq as { current?: Record<string, number> } | null)?.current;
      const wxC = (wx as { current?: Record<string, number>; elevation?: number } | null)?.current;
      const elev = (wx as { elevation?: number } | null)?.elevation ?? 12;
      return {
        usAqi: Math.round(Number(aqC?.us_aqi ?? 55)),
        pm25: Number(Number(aqC?.pm2_5 ?? 16).toFixed(1)),
        temperatureC: Number(Number(wxC?.temperature_2m ?? 22).toFixed(1)),
        elevationMeters: Math.round(Number(elev)),
      };
    } catch {
      return { usAqi: 55, pm25: 16, temperatureC: 22, elevationMeters: 12 };
    }
  };

  const [envA, envB] = await Promise.all([fetchLiveEnv(pA.lat, pA.lng), fetchLiveEnv(pB.lat, pB.lng)]);

  const buildCityMetrics = (p: GlobalCityProfile, env: Awaited<ReturnType<typeof fetchLiveEnv>>) => {
    const quotedSqFt = Math.round(budgetUsd / p.avgQuotedPriceUsdPerSqFt);
    const trueLivableIndoorSqFt = Math.round(quotedSqFt * p.livableIndoorFactor);
    const allInFrictionCostUsd = Math.round(budgetUsd * (p.foreignBuyerTaxPct / 100));
    const totalAllInCostUsd = budgetUsd + allInFrictionCostUsd;
    const trueLivableUsdPerSqFt = Math.round(totalAllInCostUsd / trueLivableIndoorSqFt);
    const netPreTaxYieldPct = Number(Math.max(0.5, p.grossRentalYieldPct - p.annualServiceAndTaxPct).toFixed(2));
    const netPostTaxYieldPct = Number(
      (netPreTaxYieldPct * (1 - p.rentalIncomeTaxPct / 100)).toFixed(2)
    );
    const annualNetCashflowUsd = Math.round((totalAllInCostUsd * netPostTaxYieldPct) / 100);

    return {
      ...p,
      quotedSqFt,
      trueLivableIndoorSqFt,
      allInFrictionCostUsd,
      totalAllInCostUsd,
      trueLivableUsdPerSqFt,
      netPreTaxYieldPct,
      netPostTaxYieldPct,
      annualNetCashflowUsd,
      liveEnvironment: env,
    };
  };

  const sideA = buildCityMetrics(pA, envA);
  const sideB = buildCityMetrics(pB, envB);

  const yieldWinner = sideA.netPostTaxYieldPct >= sideB.netPostTaxYieldPct ? sideA.city : sideB.city;
  const spaceWinner = sideA.trueLivableIndoorSqFt >= sideB.trueLivableIndoorSqFt ? sideA.city : sideB.city;
  const frictionWinner = sideA.allInFrictionCostUsd <= sideB.allInFrictionCostUsd ? sideA.city : sideB.city;
  const airWinner = sideA.liveEnvironment.usAqi <= sideB.liveEnvironment.usAqi ? sideA.city : sideB.city;

  return {
    budgetUsdMillions: Number((budgetUsd / 1_000_000).toFixed(2)),
    sideA,
    sideB,
    verdictSummary: {
      yieldWinner,
      spaceWinner,
      frictionWinner,
      airWinner,
      executiveTakeaway: `At $${(budgetUsd / 1_000_000).toFixed(2)}M, ${yieldWinner} wins on Net Post-Tax Yield (${Math.max(
        sideA.netPostTaxYieldPct,
        sideB.netPostTaxYieldPct
      )}%/yr), ${spaceWinner} delivers more true indoor livable space (${Math.max(
        sideA.trueLivableIndoorSqFt,
        sideB.trueLivableIndoorSqFt
      ).toLocaleString()} sq.ft.), and ${frictionWinner} has lower upfront buyer taxes.`,
    },
  };
}

// =========================================================================
// ENGINE 3: LIVE WORLDWIDE PLACE & BUILDING AUTOCOMPLETE (PHOTON + NOMINATIM)
// Covers ANY neighborhood, street, landmark, or unindexed building globally!
// =========================================================================

export interface PlaceSuggestion {
  id: string;
  label: string;
  subtitle: string;
  fullQuery: string;
  kind: 'property' | 'scheme' | 'global_pair' | 'live_place';
  placeType?: string;
  lat?: number;
  lng?: number;
  indexed: boolean;
  targetId?: string;
}

export async function fetchLivePlaceSuggestions(query: string, limit = 6): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const dedupe = new Set<string>();
  const results: PlaceSuggestion[] = [];

  // 1. Primary: Komoot Photon API (fast OpenStreetMap search-as-you-type engine)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${Math.min(10, limit + 4)}&lang=en`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'LensRoof/2.0 (https://lensroof.com)' },
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as {
        features?: Array<{
          properties?: {
            osm_id?: number;
            name?: string;
            street?: string;
            district?: string;
            locality?: string;
            city?: string;
            county?: string;
            state?: string;
            country?: string;
            osm_value?: string;
            type?: string;
          };
          geometry?: { coordinates?: [number, number] };
        }>;
      };

      for (const f of data.features || []) {
        const p = f.properties || {};
        const label = (p.name || p.street || p.locality || p.city || '').trim();
        if (!label) continue;

        const subParts: string[] = [];
        for (const part of [p.district, p.city || p.county, p.state, p.country]) {
          if (part && part.toLowerCase() !== label.toLowerCase() && !subParts.includes(part)) {
            subParts.push(part);
          }
        }
        const subtitle = subParts.join(', ');
        const key = `${label.toLowerCase()}|${subtitle.toLowerCase()}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);

        const coords = f.geometry?.coordinates;
        const lng = coords ? Number(coords[0].toFixed(5)) : undefined;
        const lat = coords ? Number(coords[1].toFixed(5)) : undefined;
        const fullQuery = subtitle ? `${label}, ${subtitle}` : label;

        results.push({
          id: `osm_${p.osm_id || results.length}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          label,
          subtitle: subtitle || 'Worldwide Location',
          fullQuery,
          kind: 'live_place',
          placeType: p.osm_value || p.type || 'place',
          lat,
          lng,
          indexed: false,
        });

        if (results.length >= limit) break;
      }
    }
  } catch {
    // fall through to Nominatim fallback
  }

  if (results.length > 0) return results;

  // 2. Fallback: OpenStreetMap Nominatim Search
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'LensRoof/2.0 (https://lensroof.com)' },
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const items = (await res.json()) as Array<{
        place_id?: number;
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
        type?: string;
      }>;
      for (const item of items || []) {
        const parts = (item.display_name || '').split(',').map((s) => s.trim()).filter(Boolean);
        const label = (item.name || parts[0] || '').trim();
        if (!label) continue;
        const subtitle = parts.slice(1, 4).join(', ');
        const key = `${label.toLowerCase()}|${subtitle.toLowerCase()}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);

        results.push({
          id: `nom_${item.place_id || results.length}`,
          label,
          subtitle: subtitle || 'Worldwide Location',
          fullQuery: subtitle ? `${label}, ${subtitle}` : label,
          kind: 'live_place',
          placeType: item.type || 'place',
          lat: item.lat ? Number(Number(item.lat).toFixed(5)) : undefined,
          lng: item.lon ? Number(Number(item.lon).toFixed(5)) : undefined,
          indexed: false,
        });
      }
    }
  } catch {
    // ignore
  }

  return results;
}
