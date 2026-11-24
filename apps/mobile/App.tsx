import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { ESTATETRUTH_TOKENS as T } from './tokens';

const API_BASE_LAN = 'http://192.168.1.53:4000/api';
const API_EDGE_BASE = 'https://lensroof.com/api/estatetruth';
const USER_ID = 'android_hni_client';

interface EvidenceItem {
  source: string;
  author?: string;
  quote: string;
  verifiedTag: string;
  date?: string;
}

interface PropertyItem {
  id: string;
  canonicalName: string;
  developer: string;
  city: 'Mumbai' | 'Dubai';
  microMarket: string;
  heroImage: string;
  priceCroreInr: number;
  priceUsdMillions: number;
  trueCarpetSqFt: number;
  brokerAdvertisedSqFt: number;
  carpetInflationPct: number;
  reraId: string;
  reraStatus: string;
  activeReraLitigations: number;
  ambientNoiseDbNight: number;
  truthScore: number;
  brokerClaim: string;
  floorplanVisionAudit: {
    hasPrivateElevatorLobby: boolean;
    stepFreeWheelchairEntry: boolean;
    balconyDepthFeet: number;
    sunlightOrientation: string;
    obstructionRisk: string;
  };
  evidence: EvidenceItem[];
  isSaved?: boolean;
  isDossierUnlocked?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  properties?: Array<{
    propertyId: string;
    canonicalName: string;
    microMarket: string;
    heroImage?: string;
    priceCroreInr: number;
    truthScore: number;
    activeReraLitigations: number;
    ambientNoiseDbNight: number;
  }>;
  trapsCount?: number;
}

interface BookingItem {
  id: string;
  property_id: string;
  canonical_name: string;
  buyer_name: string;
  preferred_date: string;
  status: string;
}

interface LiveFxRates {
  usdToInr: number;
  aedToInr: number;
  liveFetched: boolean;
  provider: string;
}

interface LiveNeighborhoodAudit {
  query: string;
  resolvedAddress: string;
  lat: number;
  lng: number;
  elevationMeters: number;
  coastalFloodWatch: string;
  weather: { temperatureC: number; humidityPct: number; windSpeedKmh: number };
  airQuality: { usAqi: number; pm25: number; pm10: number; no2: number; category: string };
  nearbyInfrastructure: Array<{ category: string; name: string; distanceMeters: number }>;
  estimatedNightNoiseDb: number;
  osmMapUrl: string;
  liveSourcesUsed: string[];
  latencyMs: number;
}

interface RegistryVerificationResult {
  inputId: string;
  jurisdiction: string;
  formatValid: boolean;
  decodedAuthority: string;
  matchedLocalDocket?: {
    canonicalName: string;
    developer: string;
    reraStatus: string;
    activeReraLitigations: number;
    escrowCompliant: boolean;
  };
  officialVerificationUrl: string;
  officialPortalName: string;
  mandatoryChecklist: string[];
  verdict: string;
}

interface TrueCostBreakdown {
  city: 'Mumbai' | 'Dubai';
  basePriceCrore: number;
  totalAllInCrore: number;
  hiddenCostDeltaCrore: number;
  hiddenCostPct: number;
  carpetLoadingPct: number;
  nonUsableSqFt: number;
  moneyPaidForWallsAndLobbiesCrore: number;
  advertisedPricePerSqFtInr: number;
  trueCarpetPricePerSqFtInr: number;
  nriComplianceNote: string;
  lineItems: Array<{ label: string; amountCrore: number; note: string }>;
}

interface AgreementScanResult {
  verdict: 'DO_NOT_SIGN_AS_IS' | 'NEGOTIATE_BEFORE_SIGNING' | 'GENERALLY_FAIR';
  riskScore: number;
  executiveSummary: string;
  redFlags: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'INFO';
    clauseTitle: string;
    riskSummary: string;
    legalBasis: string;
    recommendedCounterClause: string;
  }>;
  modelUsed: string;
  liveLlmCalled: boolean;
  latencyMs: number;
}

const QUICK_INQUIRIES = [
  'Sea-facing 4BHK in Worli under ₹40 Cr, zero MahaRERA litigation, private lift',
  'Quiet beachfront home in Dubai with zero DJ party clubs or Airbnb traffic',
  'Audit Imperial Crown Heights Lower Parel — verify litigation & night noise',
  'Quietest residence in Pali Hill Bandra with step-free wheelchair entry',
];

const SAMPLE_AGREEMENTS = [
  {
    label: 'Mumbai Predatory Allotment',
    city: 'Mumbai' as const,
    text: 'Allotment Letter Clause 4: The flat is billed on 4,850 sq.ft. Super Built-up Area. In case of buyer cancellation, 18% of total consideration shall be forfeited by the Promoter. Delay in possession due to market conditions shall grant the Promoter an automatic 24-month grace period without interest. Token amount of Rs 2.5 Cr must be wired to Director Personal Account before RERA registration.',
  },
  {
    label: 'Dubai Escrow Bypass Pitch',
    city: 'Dubai' as const,
    text: 'Exclusive Palm Penthouse Offer: 12% guaranteed rental assured return for 5 years! Wire 20% booking deposit directly to broker personal account today to lock tentative handover date with sole discretion extension clause.',
  },
];

function EstateTruthMain() {
  const insets = useSafeAreaInsets();
  const topInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, RNStatusBar.currentHeight || 28)
      : insets.top;
  const bottomInset = Math.max(insets.bottom, 10);

  const [activeTab, setActiveTab] = useState<'explore' | 'advisor' | 'tools' | 'wishlists'>('explore');
  const [cityFilter, setCityFilter] = useState<'All' | 'Mumbai' | 'Dubai'>('All');
  const [safeOnly, setSafeOnly] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'AED'>('INR');
  const [fxRates, setFxRates] = useState<LiveFxRates>({
    usdToInr: 84.5,
    aedToInr: 23.01,
    liveFetched: false,
    provider: 'Reference',
  });

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [selectedLiveEnv, setSelectedLiveEnv] = useState<LiveNeighborhoodAudit | null>(null);
  const [selectedCompsStack, setSelectedCompsStack] = useState<any | null>(null);
  const [tractionData, setTractionData] = useState<any | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [searchBarText, setSearchBarText] = useState('');

  // Booking Modal
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);

  // Advisor Chat
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Welcome to LensRoof Advisor. Tell me your preferred neighborhood, budget, and dealbreakers — zero RERA disputes, quiet nighttime decibels, or step-free entry.',
    },
  ]);

  // 6 Buyer Verification, Govt Schemes & Global Compare Tools State
  const [toolTab, setToolTab] = useState<'schemes' | 'global' | 'neighborhood' | 'registry' | 'cost' | 'scanner'>('schemes');
  const [schemesList, setSchemesList] = useState<any[]>([]);
  const [simCity, setSimCity] = useState<'Mumbai' | 'Navi Mumbai / Thane' | 'Pune' | 'Delhi NCR' | 'Bengaluru'>('Navi Mumbai / Thane');
  const [simIncomeL, setSimIncomeL] = useState('7.5');
  const [simBudgetL, setSimBudgetL] = useState('34');
  const [simFirstTime, setSimFirstTime] = useState(true);
  const [simFemale, setSimFemale] = useState(true);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const [globalCityA, setGlobalCityA] = useState<'Mumbai' | 'Dubai' | 'London' | 'Singapore' | 'New York'>('Mumbai');
  const [globalCityB, setGlobalCityB] = useState<'Mumbai' | 'Dubai' | 'London' | 'Singapore' | 'New York'>('Dubai');
  const [globalBudgetM, setGlobalBudgetM] = useState('1.5');
  const [globalResult, setGlobalResult] = useState<any | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const [envQuery, setEnvQuery] = useState('Pali Hill Bandra West Mumbai');
  const [envResult, setEnvResult] = useState<LiveNeighborhoodAudit | null>(null);
  const [envLoading, setEnvLoading] = useState(false);

  const [regInput, setRegInput] = useState('P51900028411');
  const [regResult, setRegResult] = useState<RegistryVerificationResult | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const [costCity, setCostCity] = useState<'Mumbai' | 'Dubai'>('Mumbai');
  const [costPriceCr, setCostPriceCr] = useState('34');
  const [costAdvSqFt, setCostAdvSqFt] = useState('4850');
  const [costCarpetSqFt, setCostCarpetSqFt] = useState('3420');
  const [costUnderConst, setCostUnderConst] = useState(true);
  const [costNri, setCostNri] = useState(true);
  const [costResult, setCostResult] = useState<TrueCostBreakdown | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  const [scanCity, setScanCity] = useState<'Mumbai' | 'Dubai'>('Mumbai');
  const [scanText, setScanText] = useState(SAMPLE_AGREEMENTS[0].text);
  const [scanResult, setScanResult] = useState<AgreementScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState('');

  // Live Autocomplete Recommendations (Indexed + Unindexed Worldwide Places)
  const [topSuggestions, setTopSuggestions] = useState<any[]>([]);
  const [envSuggestions, setEnvSuggestions] = useState<any[]>([]);

  // Android Hardware Back Button Handling (Prevents accidental app exit!)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inquiryOpen) {
        setInquiryOpen(false);
        return true;
      }
      if (selectedProperty) {
        setSelectedProperty(null);
        return true;
      }
      if (activeTab !== 'explore') {
        setActiveTab('explore');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [inquiryOpen, selectedProperty, activeTab]);

  const apiCall = async (lanPath: string, edgePath: string, init?: RequestInit) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE_LAN}${lanPath}`, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch {
      // fast fallback to Cloudflare Edge if LAN times out
    }
    try {
      const res = await fetch(`${API_EDGE_BASE}${edgePath}`, init);
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
    return null;
  };

  const triggerLiveDiscovery = async (locality: string) => {
    if (discoverBusy) return;
    setDiscoverBusy(true);
    setDiscoverMsg(`Ingesting live OpenStreetMap buildings in ${locality}…`);
    const res = await apiCall('/properties/discover-live', '/properties/discover-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locality }),
    });
    if (res?.discovered?.length) {
      setDiscoverMsg(`Added ${res.discovered.length} real OSM buildings in ${locality}`);
      await fetchFeed(cityFilter, safeOnly);
    } else {
      setDiscoverMsg(`Checked ${locality}`);
    }
    setDiscoverBusy(false);
  };

  const formatPrice = (croreInr: number): string => {
    if (currency === 'INR') return `₹${croreInr.toFixed(croreInr % 1 === 0 ? 0 : 1)} Cr`;
    const inrTotal = croreInr * 10_000_000;
    if (currency === 'USD') return `$${(inrTotal / fxRates.usdToInr / 1_000_000).toFixed(2)}M`;
    return `AED ${(inrTotal / fxRates.aedToInr / 1_000_000).toFixed(1)}M`;
  };

  useEffect(() => {
    apiCall('/tools/fx-rates', '/tools/fx-rates').then((d) => {
      if (d?.rates) setFxRates(d.rates);
    });
  }, []);

  const fetchFeed = async (city = cityFilter, onlySafe = safeOnly) => {
    setLoadingFeed(true);
    const data = await apiCall(
      `/properties?city=${encodeURIComponent(city)}&safeOnly=${onlySafe}&userId=${USER_ID}`,
      `/properties?city=${encodeURIComponent(city)}&safeOnly=${onlySafe}`
    );
    if (data?.properties) {
      setProperties(data.properties);
      if (data.properties.some((p: PropertyItem) => p.isSaved !== undefined)) {
        setSavedIds(data.properties.filter((p: PropertyItem) => p.isSaved).map((p: PropertyItem) => p.id));
      }
    }
    const [savedRes, bookRes] = await Promise.all([
      apiCall(`/saved?userId=${USER_ID}`, `/saved?userId=${USER_ID}`),
      apiCall(`/bookings?userId=${USER_ID}`, `/bookings?userId=${USER_ID}`),
    ]);
    if (savedRes?.savedIds) setSavedIds(savedRes.savedIds);
    if (bookRes?.bookings) setBookings(bookRes.bookings);
    setLoadingFeed(false);
  };

  useEffect(() => {
    fetchFeed(cityFilter, safeOnly);
  }, [cityFilter, safeOnly]);

  // Auto-fetch Live Open-Meteo AQI, OpenStreetMap Elevation & Registered Sale Deed Comps + Stack View when opening any property
  useEffect(() => {
    if (!selectedProperty) {
      setSelectedLiveEnv(null);
      setSelectedCompsStack(null);
      return;
    }
    apiCall('/tools/live-neighborhood', '/tools/live-neighborhood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: `${selectedProperty.microMarket}, ${selectedProperty.city}` }),
    }).then((d) => {
      if (d?.audit) setSelectedLiveEnv(d.audit);
    });
    apiCall(`/tools/comps-stack/${selectedProperty.id}`, `/tools/comps-stack/${selectedProperty.id}`).then((d) => {
      if (d?.compsStack) setSelectedCompsStack(d.compsStack);
    });
  }, [selectedProperty?.id]);

  const handleToggleSave = async (prop: PropertyItem) => {
    const exists = savedIds.includes(prop.id);
    setSavedIds((prev) => (exists ? prev.filter((id) => id !== prop.id) : [...prev, prop.id]));
    apiCall('/saved/toggle', '/saved/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, propertyId: prop.id }),
    });
  };

  const handleConfirmBooking = async () => {
    if (!selectedProperty || !buyerName.trim() || !buyerContact.trim()) return;
    setBookingBusy(true);
    const res = await apiCall('/bookings', '/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: USER_ID,
        propertyId: selectedProperty.id,
        canonicalName: selectedProperty.canonicalName,
        buyerName: buyerName.trim(),
        buyerContact: buyerContact.trim(),
        preferredDate: 'Private Chauffeur Appointment',
      }),
    });
    if (res?.booking) {
      setBookings((prev) => [res.booking, ...prev]);
    } else {
      await fetchFeed();
    }
    setBookingBusy(false);
    setInquiryOpen(false);
    setBuyerName('');
    setBuyerContact('');
  };

  const handleSendAdvisor = async (overrideText?: string) => {
    const q = (overrideText ?? chatInput).trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setSearchBarText('');
    setSelectedProperty(null);
    setActiveTab('advisor');
    setChatLoading(true);
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: q }]);

    const data = await apiCall('/concierge/query', '/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, sessionId: 'android_advisor', userId: USER_ID }),
    });
    if (data) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.conciergeNarrative,
          properties: data.verifiedDossiers || [],
          trapsCount: data.rejectedTraps?.length || 0,
        },
      ]);
    }
    setChatLoading(false);
  };

  const runLiveNeighborhood = async (overrideAddr?: string) => {
    const addr = (overrideAddr ?? envQuery).trim();
    if (!addr || envLoading) return;
    setEnvLoading(true);
    const data = await apiCall('/tools/live-neighborhood', '/tools/live-neighborhood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addr }),
    });
    if (data?.audit) setEnvResult(data.audit);
    setEnvLoading(false);
  };

  const runRegistryVerify = async (overrideId?: string) => {
    const id = (overrideId ?? regInput).trim();
    if (!id || regLoading) return;
    setRegLoading(true);
    const data = await apiCall('/tools/verify-registry', '/tools/verify-registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: id }),
    });
    if (data?.verification) setRegResult(data.verification);
    setRegLoading(false);
  };

  const runTrueCostAudit = async () => {
    setCostLoading(true);
    const data = await apiCall('/tools/true-cost', '/tools/true-cost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: costCity,
        agreementPriceCroreInr: Number(costPriceCr) || 34,
        advertisedSqFt: Number(costAdvSqFt) || 4850,
        reraCarpetSqFt: Number(costCarpetSqFt) || 3420,
        isUnderConstruction: costUnderConst,
        isNriTransaction: costNri,
      }),
    });
    if (data?.breakdown) setCostResult(data.breakdown);
    setCostLoading(false);
  };

  const runAgreementAudit = async (overrideText?: string, overrideCity?: 'Mumbai' | 'Dubai') => {
    const textToScan = (overrideText ?? scanText).trim();
    const cityToUse = overrideCity ?? scanCity;
    if (!textToScan || scanLoading) return;
    setScanLoading(true);
    const data = await apiCall('/tools/scan-agreement', '/tools/scan-agreement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textToScan, city: cityToUse }),
    });
    if (data?.scan) setScanResult(data.scan);
    setScanLoading(false);
  };

  const loadSchemes = async () => {
    const data = await apiCall('/schemes', '/schemes');
    if (data?.schemes) setSchemesList(data.schemes);
  };

  const runSchemeSimulation = async () => {
    setSimLoading(true);
    const data = await apiCall('/schemes/simulate', '/schemes/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: simCity,
        annualHouseholdIncomeLakh: Number(simIncomeL) || 7.5,
        propertyBudgetLakh: Number(simBudgetL) || 34,
        isFirstTimeBuyer: simFirstTime,
        hasFemaleCoOwner: simFemale,
        isUnderConstruction: true,
        category: 'MIG',
      }),
    });
    if (data?.simulation) setSimResult(data.simulation);
    setSimLoading(false);
  };

  const runGlobalCompare = async (
    overrideA?: 'Mumbai' | 'Dubai' | 'London' | 'Singapore' | 'New York',
    overrideB?: 'Mumbai' | 'Dubai' | 'London' | 'Singapore' | 'New York'
  ) => {
    setGlobalLoading(true);
    const data = await apiCall('/global/compare', '/global/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cityA: overrideA ?? globalCityA,
        cityB: overrideB ?? globalCityB,
        budgetUsdMillions: Number(globalBudgetM) || 1.5,
      }),
    });
    if (data?.comparison) setGlobalResult(data.comparison);
    setGlobalLoading(false);
  };

  useEffect(() => {
    const q = searchBarText.trim();
    if (q.length < 2) {
      setTopSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await apiCall(
        `/places/suggest?q=${encodeURIComponent(q)}&mode=all`,
        `/places/suggest?q=${encodeURIComponent(q)}&mode=all`
      );
      if (Array.isArray(res?.suggestions)) setTopSuggestions(res.suggestions.slice(0, 5));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchBarText]);

  useEffect(() => {
    const q = envQuery.trim();
    if (activeTab !== 'tools' || toolTab !== 'neighborhood' || q.length < 2) {
      setEnvSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await apiCall(
        `/places/suggest?q=${encodeURIComponent(q)}&mode=places`,
        `/places/suggest?q=${encodeURIComponent(q)}&mode=places`
      );
      if (Array.isArray(res?.suggestions)) setEnvSuggestions(res.suggestions.slice(0, 5));
    }, 250);
    return () => clearTimeout(timer);
  }, [envQuery, activeTab, toolTab]);

  useEffect(() => {
    if (activeTab === 'tools') {
      if (toolTab === 'schemes') {
        if (schemesList.length === 0) loadSchemes();
        if (!simResult) runSchemeSimulation();
      }
      if (toolTab === 'global' && !globalResult) runGlobalCompare();
      if (toolTab === 'neighborhood' && !envResult) runLiveNeighborhood();
      if (toolTab === 'registry' && !regResult) runRegistryVerify();
      if (toolTab === 'cost' && !costResult) runTrueCostAudit();
    }
  }, [activeTab, toolTab]);

  // =========================================================================
  // PROPERTY DETAIL SCREEN (AIRBNB LISTING PAGE + SAFE TOP/BOTTOM INSETS)
  // =========================================================================
  if (selectedProperty) {
    const isDisputed = selectedProperty.activeReraLitigations > 0 || selectedProperty.truthScore < 60;
    const isSaved = savedIds.includes(selectedProperty.id);
    const hasBooked = bookings.some((b) => b.property_id === selectedProperty.id);
    const trueRatioPct = Math.round(
      (selectedProperty.trueCarpetSqFt / selectedProperty.brokerAdvertisedSqFt) * 100
    );

    return (
      <View style={[styles.root, { paddingTop: topInset }]}>
        <StatusBar style="dark" />

        {/* Clean Top Action Bar (Strictly Below Android Status Bar!) */}
        <View style={styles.detailHeader}>
          <Pressable onPress={() => setSelectedProperty(null)} style={styles.circleBtn}>
            <Ionicons name="chevron-back" size={20} color={T.colors.ink} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() =>
                Share.share({
                  message: `LensRoof Report — ${selectedProperty.canonicalName} (${selectedProperty.microMarket})\nScore: ${selectedProperty.truthScore}/100 | True Carpet: ${selectedProperty.trueCarpetSqFt} sq.ft | Night Noise: ${selectedProperty.ambientNoiseDbNight} dB\nhttps://lensroof.com/property/${selectedProperty.id}`,
                }).catch(() => {})
              }
              style={styles.circleBtn}
            >
              <Ionicons name="share-outline" size={18} color={T.colors.ink} />
            </Pressable>
            <Pressable onPress={() => handleToggleSave(selectedProperty)} style={styles.circleBtn}>
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={19}
                color={isSaved ? T.colors.rausch : T.colors.ink}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: selectedProperty.heroImage }} style={styles.detailHeroImg} />

          <View style={styles.detailBody}>
            <Text style={styles.h1}>{selectedProperty.canonicalName}</Text>
            <Text style={styles.subText}>
              {selectedProperty.microMarket}, {selectedProperty.city} · {selectedProperty.developer}
            </Text>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={T.colors.ink} />
              <Text style={styles.ratingBold}>{selectedProperty.truthScore}/100 Truth Score</Text>
              <Text style={styles.subText}>· {selectedProperty.reraId}</Text>
            </View>

            <View style={styles.divider} />

            {/* Verified Highlights */}
            <View style={{ gap: 14 }}>
              <View style={styles.highlightRow}>
                <Ionicons
                  name={isDisputed ? 'alert-circle-outline' : 'shield-checkmark-outline'}
                  size={22}
                  color={isDisputed ? T.colors.danger : T.colors.verified}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.h3}>
                    {selectedProperty.activeReraLitigations === 0
                      ? `Clean Registry (${selectedProperty.reraStatus.replace(/_/g, ' ')})`
                      : `${selectedProperty.activeReraLitigations} Active RERA Litigations`}
                  </Text>
                  <Text style={styles.caption}>Verified against public filings &amp; escrow compliance</Text>
                </View>
              </View>

              <View style={styles.highlightRow}>
                <Ionicons name="volume-low-outline" size={22} color={T.colors.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.h3}>{selectedProperty.ambientNoiseDbNight} dB Night Acoustics</Text>
                  <Text style={styles.caption}>
                    {selectedProperty.ambientNoiseDbNight <= 45
                      ? 'Whisper-quiet residential pocket'
                      : 'Elevated arterial traffic exposure'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Carpet Area Truth Card */}
            <View style={styles.grayCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.h3}>RERA Carpet vs Brochure</Text>
                <Text style={styles.dangerBadge}>+{selectedProperty.carpetInflationPct}% Loading</Text>
              </View>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${trueRatioPct}%` }]} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.captionBold}>
                  True: {selectedProperty.trueCarpetSqFt.toLocaleString()} sq.ft.
                </Text>
                <Text style={styles.caption}>
                  Advertised: {selectedProperty.brokerAdvertisedSqFt.toLocaleString()} sq.ft.
                </Text>
              </View>
            </View>

            {/* COMPETITOR-KILLER: REGISTERED SALE DEED COMPS & TOWER STACK VIEW */}
            {selectedCompsStack && (
              <View style={styles.grayCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.h3}>Registered Sale Deeds &amp; Stack View</Text>
                  <Text style={styles.verifiedTag}>
                    Save ₹{selectedCompsStack.recommendedNegotiationSavingsCrore} Cr
                  </Text>
                </View>
                <Text style={styles.caption}>{selectedCompsStack.negotiationScript}</Text>
                {selectedCompsStack.registeredDeeds.map((d: any) => (
                  <View key={d.deedId} style={styles.rowBetween}>
                    <Text style={styles.captionBold}>
                      {d.deedId} · Fl {d.floor}
                    </Text>
                    <Text style={styles.verifiedTag}>
                      ₹{d.registeredValueCrore} Cr (₹{d.registeredRatePerCarpetSqFt.toLocaleString()}/sq.ft)
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* GOOGLE MAPS & LIVE LOCATION TELEMETRY */}
            <View style={styles.grayCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.h3}>Google Maps &amp; Air Quality</Text>
                {selectedLiveEnv && (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${selectedProperty.canonicalName} ${selectedProperty.microMarket} ${selectedProperty.city}`
                        )}`
                      )
                    }
                  >
                    <Text style={styles.linkCoral}>Open in Google Maps →</Text>
                  </Pressable>
                )}
              </View>
              {selectedLiveEnv ? (
                <View style={styles.metricsRow}>
                  <View style={styles.metricPill}>
                    <Text style={styles.caption}>Live AQI</Text>
                    <Text
                      style={[
                        styles.metricNum,
                        { color: selectedLiveEnv.airQuality.usAqi > 120 ? T.colors.danger : T.colors.verified },
                      ]}
                    >
                      {selectedLiveEnv.airQuality.usAqi}
                    </Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.caption}>PM2.5</Text>
                    <Text style={styles.metricNum}>{selectedLiveEnv.airQuality.pm25}</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.caption}>Elevation</Text>
                    <Text style={styles.metricNum}>{selectedLiveEnv.elevationMeters}m</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.caption}>Temp</Text>
                    <Text style={styles.metricNum}>{selectedLiveEnv.weather.temperatureC}°C</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.caption}>Loading Google Maps coordinates &amp; live AQI…</Text>
              )}
            </View>

            {/* Verified Reviews */}
            <Text style={styles.h2}>Verified Registry &amp; Resident Notes</Text>
            {selectedProperty.evidence.map((ev, idx) => (
              <View key={idx} style={styles.reviewCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.h3}>{ev.author || ev.source}</Text>
                  <Text style={styles.caption}>{ev.date}</Text>
                </View>
                <Text style={styles.body}>{ev.quote}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Airbnb Sticky Bottom Reserve Bar (Safe Bottom Inset!) */}
        <View style={[styles.detailFooter, { paddingBottom: bottomInset }]}>
          <View>
            <Text style={styles.footerPrice}>{formatPrice(selectedProperty.priceCroreInr)}</Text>
            <Text style={styles.caption}>Buyer-only · 0% commission</Text>
          </View>
          <Pressable onPress={() => setInquiryOpen(true)} style={styles.rauschBtn}>
            <Text style={styles.rauschBtnTxt}>{hasBooked ? 'Reserved' : 'Reserve Viewing'}</Text>
          </Pressable>
        </View>

        {/* Booking Modal */}
        <Modal visible={inquiryOpen} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: bottomInset + 16 }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.h2}>Reserve Private Viewing</Text>
                <Pressable onPress={() => setInquiryOpen(false)}>
                  <Ionicons name="close" size={24} color={T.colors.ink} />
                </Pressable>
              </View>
              <Text style={styles.subText}>{selectedProperty.canonicalName}</Text>
              <TextInput
                value={buyerName}
                onChangeText={setBuyerName}
                placeholder="Full Name"
                placeholderTextColor={T.colors.inkMuted}
                style={styles.inputBox}
              />
              <TextInput
                value={buyerContact}
                onChangeText={setBuyerContact}
                placeholder="Phone / WhatsApp or Email"
                placeholderTextColor={T.colors.inkMuted}
                style={styles.inputBox}
              />
              <Pressable onPress={handleConfirmBooking} disabled={bookingBusy} style={styles.rauschBtnFull}>
                <Text style={styles.rauschBtnTxt}>
                  {bookingBusy ? 'Confirming…' : 'Confirm Reservation'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // MAIN AIRBNB APP SHELL (STRICT SAFE TOP + BOTTOM INSETS!)
  // =========================================================================
  const savedProperties = properties.filter((p) => savedIds.includes(p.id));

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <StatusBar style="dark" />

      {/* =================================================================== */}
      {/* TAB 1: EXPLORE (AIRBNB PILL SEARCH + CATEGORY STRIP + PHOTO CARDS)  */}
      {/* =================================================================== */}
      {activeTab === 'explore' && (
        <View style={{ flex: 1 }}>
          {/* Airbnb Top Floating Pill Search Bar + Live Currency Button */}
          <View style={styles.topSearchWrap}>
            <View style={styles.pillSearch}>
              <Ionicons name="search" size={18} color={T.colors.ink} />
              <TextInput
                value={searchBarText}
                onChangeText={setSearchBarText}
                placeholder="Where to? Search Mumbai, Dubai, dealbreakers…"
                placeholderTextColor={T.colors.inkMuted}
                style={styles.pillSearchInput}
                onSubmitEditing={() => searchBarText.trim() && handleSendAdvisor(searchBarText)}
              />
              <Pressable
                onPress={() =>
                  setCurrency((prev) => (prev === 'INR' ? 'USD' : prev === 'USD' ? 'AED' : 'INR'))
                }
                style={styles.fxPill}
              >
                <Text style={styles.fxPillTxt}>{currency}</Text>
              </Pressable>
            </View>

            {/* Live Worldwide & Verified Recommendations Dropdown */}
            {topSuggestions.length > 0 && (
              <View style={{ marginHorizontal: 18, marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: T.colors.border, overflow: 'hidden' }}>
                {topSuggestions.map((s: any) => (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setTopSuggestions([]);
                      setSearchBarText('');
                      if (s.kind === 'property' && s.targetId) {
                        const found = properties.find((p) => p.id === s.targetId);
                        if (found) {
                          setSelectedProperty(found);
                          return;
                        }
                      }
                      if (s.kind === 'scheme') {
                        setToolTab('schemes');
                        setActiveTab('tools');
                        return;
                      }
                      setEnvQuery(s.fullQuery);
                      setToolTab('neighborhood');
                      setActiveTab('tools');
                      runLiveNeighborhood(s.fullQuery);
                    }}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.colors.hairline, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.h3} numberOfLines={1}>{s.label}</Text>
                      <Text style={styles.caption} numberOfLines={1}>{s.subtitle}</Text>
                    </View>
                    <Text style={s.indexed ? styles.verifiedTag : styles.captionBold}>
                      {s.indexed ? 'VERIFIED' : 'LIVE MAP'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Horizontal Airbnb Category Filter Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catStrip}
            >
              {[
                { id: 'All', label: 'All Homes', icon: 'compass-outline' as const, active: cityFilter === 'All' && !safeOnly, onPress: () => { setCityFilter('All'); setSafeOnly(false); } },
                { id: 'Schemes', label: 'Govt Schemes', icon: 'business-outline' as const, active: false, onPress: () => { setToolTab('schemes'); setActiveTab('tools'); } },
                { id: 'Global', label: 'Global Compare', icon: 'globe-outline' as const, active: false, onPress: () => { setToolTab('global'); setActiveTab('tools'); } },
                { id: 'Mumbai', label: 'Mumbai', icon: 'location-outline' as const, active: cityFilter === 'Mumbai', onPress: () => setCityFilter('Mumbai') },
                { id: 'Dubai', label: 'Dubai', icon: 'sparkles-outline' as const, active: cityFilter === 'Dubai', onPress: () => setCityFilter('Dubai') },
                { id: 'Clean', label: 'Clean Only', icon: 'shield-checkmark-outline' as const, active: safeOnly, onPress: () => setSafeOnly(!safeOnly) },
                { id: 'AQI', label: 'Live AQI', icon: 'leaf-outline' as const, active: false, onPress: () => { setToolTab('neighborhood'); setActiveTab('tools'); } },
                { id: 'RERA', label: 'RERA Check', icon: 'checkmark-circle-outline' as const, active: false, onPress: () => { setToolTab('registry'); setActiveTab('tools'); } },
                { id: 'Cost', label: 'Cost X-Ray', icon: 'calculator-outline' as const, active: false, onPress: () => { setToolTab('cost'); setActiveTab('tools'); } },
                { id: 'Scan', label: 'Clause Scan', icon: 'document-text-outline' as const, active: false, onPress: () => { setToolTab('scanner'); setActiveTab('tools'); } },
              ].map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={cat.onPress}
                  style={[styles.catItem, cat.active && styles.catItemActive]}
                >
                  <Ionicons
                    name={cat.icon}
                    size={20}
                    color={cat.active ? T.colors.ink : T.colors.inkMuted}
                  />
                  <Text style={[styles.catLabel, cat.active && styles.catLabelActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {loadingFeed ? (
            <ActivityIndicator color={T.colors.rausch} style={{ marginTop: 60 }} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 18, gap: 22, paddingBottom: 30 }}
            >
              {/* Consumer Neighborhood Explorer Bar */}
              <View style={styles.grayCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.h3}>{properties.length} Verified Homes</Text>
                  <Text style={styles.verifiedTag}>LENSROOF VERIFIED</Text>
                </View>
                <Text style={styles.caption}>
                  Tap a neighborhood to add verified residential buildings:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {['Juhu Mumbai', 'Malabar Hill Mumbai', 'Dubai Marina', 'Downtown Dubai'].map((loc) => (
                    <Pressable
                      key={loc}
                      onPress={() => triggerLiveDiscovery(loc)}
                      disabled={discoverBusy}
                      style={styles.toolChip}
                    >
                      <Text style={styles.toolChipTxt}>+ {loc}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {discoverMsg ? <Text style={styles.verifiedTag}>{discoverMsg}</Text> : null}
              </View>

              {properties.map((prop) => {
                const isDisputed = prop.activeReraLitigations > 0 || prop.truthScore < 60;
                const isSaved = savedIds.includes(prop.id);
                return (
                  <Pressable
                    key={prop.id}
                    onPress={() => setSelectedProperty(prop)}
                    style={styles.listingCard}
                  >
                    <View style={styles.photoWrap}>
                      <Image source={{ uri: prop.heroImage }} style={styles.photoImg} />
                      <View
                        style={[
                          styles.guestBadge,
                          isDisputed && { backgroundColor: T.colors.danger },
                        ]}
                      >
                        <Text style={[styles.guestBadgeTxt, isDisputed && { color: '#FFFFFF' }]}>
                          {isDisputed ? `RERA Risk · ${prop.truthScore}` : `Verified · ${prop.truthScore}`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleToggleSave(prop)}
                        style={styles.heartBtn}
                      >
                        <Ionicons
                          name={isSaved ? 'heart' : 'heart-outline'}
                          size={22}
                          color={isSaved ? T.colors.rausch : '#FFFFFF'}
                        />
                      </Pressable>
                    </View>

                    <View style={{ gap: 2, marginTop: 10 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.listingTitle} numberOfLines={1}>
                          {prop.canonicalName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="star" size={13} color={T.colors.ink} />
                          <Text style={styles.listingScore}>{(prop.truthScore / 20).toFixed(2)}</Text>
                        </View>
                      </View>
                      <Text style={styles.subText}>
                        {prop.microMarket}, {prop.city}
                      </Text>
                      <Text style={styles.subText}>
                        {prop.trueCarpetSqFt.toLocaleString()} sq.ft. carpet · {prop.ambientNoiseDbNight} dB ·{' '}
                        {prop.activeReraLitigations === 0 ? '0 disputes' : `${prop.activeReraLitigations} RERA cases`}
                      </Text>
                      <Text style={styles.listingPrice}>
                        {formatPrice(prop.priceCroreInr)}{' '}
                        <Text style={styles.listingPriceSub}>total guide</Text>
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* =================================================================== */}
      {/* TAB 2: AI ADVISOR (LIVE GEMINI 4 + KEYBOARD-SAFE COMPOSER)          */}
      {/* =================================================================== */}
      {activeTab === 'advisor' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.screenHeader}>
            <Text style={styles.h1}>LensRoof Advisor</Text>
            <Text style={styles.caption}>Independent Buyer Concierge</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}
              >
                <Text style={[styles.body, m.role === 'user' && { color: '#FFFFFF' }]}>{m.text}</Text>
                {m.properties && m.properties.length > 0 && (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {m.properties.map((p) => (
                      <Pressable
                        key={p.propertyId}
                        onPress={() => {
                          const found = properties.find((x) => x.id === p.propertyId);
                          if (found) setSelectedProperty(found);
                        }}
                        style={styles.miniPropCard}
                      >
                        {p.heroImage && <Image source={{ uri: p.heroImage }} style={styles.miniPropImg} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.h3} numberOfLines={1}>{p.canonicalName}</Text>
                          <Text style={styles.caption}>
                            {formatPrice(p.priceCroreInr)} · {p.ambientNoiseDbNight} dB · Score {p.truthScore}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {chatLoading && <ActivityIndicator color={T.colors.rausch} style={{ alignSelf: 'flex-start' }} />}

            {messages.length <= 2 && (
              <View style={{ gap: 8, marginTop: 6 }}>
                <Text style={styles.captionBold}>Try asking:</Text>
                {QUICK_INQUIRIES.map((qi) => (
                  <Pressable key={qi} onPress={() => handleSendAdvisor(qi)} style={styles.promptPill}>
                    <Text style={styles.body}>{qi}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.composerRow}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask about Worli, Dubai, RERA, or noise…"
              placeholderTextColor={T.colors.inkMuted}
              style={styles.composerInput}
              onSubmitEditing={() => handleSendAdvisor()}
            />
            <Pressable onPress={() => handleSendAdvisor()} style={styles.sendCircle}>
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* =================================================================== */}
      {/* TAB 3: LIVE TOOLS (4 REAL EXTERNAL INTEGRATIONS)                    */}
      {/* =================================================================== */}
      {activeTab === 'tools' && (
        <View style={{ flex: 1 }}>
          <View style={styles.screenHeader}>
            <Text style={styles.h1}>Buyer Tools</Text>
            <Text style={styles.caption}>Govt Schemes · Global Compare · Maps &amp; AQI · RERA/DLD</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: T.colors.hairline }}
            contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10, gap: 8 }}
          >
            {[
              { id: 'schemes', label: 'Govt Schemes' },
              { id: 'global', label: 'Global Compare' },
              { id: 'neighborhood', label: 'Google Maps & AQI' },
              { id: 'registry', label: 'RERA / DLD' },
              { id: 'cost', label: 'True Cost' },
              { id: 'scanner', label: 'Clause Scanner' },
            ].map((t) => {
              const active = toolTab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setToolTab(t.id as typeof toolTab)}
                  style={[styles.toolChip, active && styles.toolChipActive]}
                >
                  <Text style={[styles.toolChipTxt, active && { color: '#FFFFFF' }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 30 }}>
            {/* TOOL A: INDIAN GOVT SCHEMES & STACKING SIMULATOR */}
            {toolTab === 'schemes' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.h3}>Indian Govt Housing Scheme Stacking Simulator</Text>
                  <Text style={styles.caption}>
                    Combine PMAY-Urban 2.0, MHADA/CIDCO/DDA, Female Stamp Duty &amp; 1% Affordable GST.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {(['Mumbai', 'Navi Mumbai / Thane', 'Pune', 'Delhi NCR', 'Bengaluru'] as const).map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setSimCity(c)}
                        style={[styles.toolChip, simCity === c && styles.toolChipActive]}
                      >
                        <Text style={[styles.toolChipTxt, simCity === c && { color: '#FFFFFF' }]}>{c}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      value={simIncomeL}
                      onChangeText={setSimIncomeL}
                      keyboardType="numeric"
                      placeholder="Income ₹L/yr"
                      style={[styles.inputBox, { flex: 1 }]}
                    />
                    <TextInput
                      value={simBudgetL}
                      onChangeText={setSimBudgetL}
                      keyboardType="numeric"
                      placeholder="Budget ₹L"
                      style={[styles.inputBox, { flex: 1 }]}
                    />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.body}>First-Time Buyer</Text>
                    <Switch value={simFirstTime} onValueChange={setSimFirstTime} trackColor={{ true: T.colors.rausch, false: '#DDDDDD' }} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.body}>Female Sole / Co-Owner</Text>
                    <Switch value={simFemale} onValueChange={setSimFemale} trackColor={{ true: T.colors.rausch, false: '#DDDDDD' }} />
                  </View>
                  <Pressable onPress={runSchemeSimulation} style={styles.rauschBtnFull}>
                    <Text style={styles.rauschBtnTxt}>
                      {simLoading ? 'Calculating…' : 'Calculate Stacked Savings'}
                    </Text>
                  </Pressable>
                </View>

                {simResult && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.verifiedTag}>TOTAL STACKED SAVINGS</Text>
                        <Text style={styles.h1}>₹{simResult.totalStackedSavingsLakh} Lakh</Text>
                      </View>
                      <Text style={styles.verifiedTag}>{simResult.savingsPctOfBudget}% Saved</Text>
                    </View>
                    <Text style={styles.caption}>
                      Effective Cost: ₹{simResult.netEffectiveCostLakh} Lakh
                    </Text>
                    {simResult.stackedBenefits.map((b: any, i: number) => (
                      <View key={i} style={styles.grayCard}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.h3, { flex: 1 }]}>{b.schemeName}</Text>
                          <Text style={b.eligible ? styles.verifiedTag : styles.caption}>
                            {b.savingsLakhInr > 0 ? `₹${b.savingsLakhInr}L` : 'Not Eligible'}
                          </Text>
                        </View>
                        <Text style={styles.caption}>{b.ruleSummary}</Text>
                        <Text style={[styles.caption, { color: T.colors.danger }]}>Catch: {b.catchWarning}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {schemesList.map((s) => (
                  <View key={s.slug} style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.verifiedTag}>{s.status.replace(/_/g, ' ')}</Text>
                      <Text style={styles.caption}>
                        {s.lockInYears > 0 ? `${s.lockInYears}-Yr Lock-In` : 'Zero Lock-In'}
                      </Text>
                    </View>
                    <Text style={styles.h3}>{s.name}</Text>
                    <Text style={styles.caption}>{s.stateOrRegion}</Text>
                    <Text style={[styles.body, { color: T.colors.verified }]}>{s.maxBenefitHeadline}</Text>
                    {s.hiddenCatches?.[0] ? (
                      <Text style={[styles.caption, { color: T.colors.danger }]}>
                        Hidden Catch: {s.hiddenCatches[0]}
                      </Text>
                    ) : null}
                    <Pressable onPress={() => Linking.openURL(s.reraOrPortalUrl)} style={styles.darkBtnFull}>
                      <Text style={styles.rauschBtnTxt}>Official Govt Portal →</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {/* TOOL B: GLOBAL CROSS-BORDER PROPERTY COMPARATOR */}
            {toolTab === 'global' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.h3}>Global Cross-Border Property Comparator</Text>
                  <Text style={styles.caption}>
                    Compare True Indoor Sq.Ft., Foreign Buyer Taxes, Net Post-Tax Yield &amp; Live AQI across 5 hubs.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {[
                      { label: 'Mumbai vs Dubai', a: 'Mumbai' as const, b: 'Dubai' as const },
                      { label: 'Mumbai vs London', a: 'Mumbai' as const, b: 'London' as const },
                      { label: 'Dubai vs London', a: 'Dubai' as const, b: 'London' as const },
                      { label: 'Dubai vs Singapore', a: 'Dubai' as const, b: 'Singapore' as const },
                      { label: 'London vs New York', a: 'London' as const, b: 'New York' as const },
                    ].map((pair) => {
                      const active = globalCityA === pair.a && globalCityB === pair.b;
                      return (
                        <Pressable
                          key={pair.label}
                          onPress={() => {
                            setGlobalCityA(pair.a);
                            setGlobalCityB(pair.b);
                            runGlobalCompare(pair.a, pair.b);
                          }}
                          style={[styles.toolChip, active && styles.toolChipActive]}
                        >
                          <Text style={[styles.toolChipTxt, active && { color: '#FFFFFF' }]}>{pair.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <TextInput
                    value={globalBudgetM}
                    onChangeText={setGlobalBudgetM}
                    keyboardType="numeric"
                    placeholder="Budget ($M USD)"
                    style={styles.inputBox}
                  />
                  <Pressable onPress={() => runGlobalCompare()} style={styles.rauschBtnFull}>
                    <Text style={styles.rauschBtnTxt}>
                      {globalLoading ? 'Comparing Live…' : `Compare ${globalCityA} vs ${globalCityB}`}
                    </Text>
                  </Pressable>
                </View>

                {globalResult && (
                  <>
                    <View style={styles.grayCard}>
                      <Text style={styles.verifiedTag}>NORMALIZED VERDICT (${globalResult.budgetUsdMillions}M)</Text>
                      <Text style={styles.body}>{globalResult.verdictSummary.executiveTakeaway}</Text>
                    </View>
                    {[globalResult.sideA, globalResult.sideB].map((side: any) => (
                      <View key={side.city} style={styles.card}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.h2}>{side.city} ({side.country})</Text>
                          <Text style={styles.verifiedTag}>{side.netPostTaxYieldPct}% Net Yield</Text>
                        </View>
                        <Text style={styles.body}>
                          True Indoor Area: {side.trueLivableIndoorSqFt.toLocaleString()} sq.ft. (${side.trueLivableUsdPerSqFt.toLocaleString()}/sq.ft.)
                        </Text>
                        <Text style={[styles.caption, { color: T.colors.danger }]}>
                          Buyer Tax: ${side.allInFrictionCostUsd.toLocaleString()} ({side.foreignBuyerTaxPct}%)
                        </Text>
                        <Text style={styles.caption}>
                          Live Air: US AQI {side.liveEnvironment.usAqi} · {side.liveEnvironment.temperatureC}°C · Elev {side.liveEnvironment.elevationMeters}m
                        </Text>
                        <View style={styles.grayCard}>
                          <Text style={[styles.captionBold, { color: T.colors.danger }]}>Hidden Liabilities:</Text>
                          {side.hiddenLiabilities.map((trap: string, idx: number) => (
                            <Text key={idx} style={styles.caption}>• {trap}</Text>
                          ))}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {/* TOOL 1: LIVE NEIGHBORHOOD */}
            {toolTab === 'neighborhood' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.h3}>Audit ANY Address Worldwide (Live Sensors)</Text>
                  <TextInput
                    value={envQuery}
                    onChangeText={setEnvQuery}
                    placeholder="Type any street, tower, or unindexed neighborhood…"
                    placeholderTextColor={T.colors.inkMuted}
                    style={styles.inputBox}
                  />
                  {envSuggestions.length > 0 && (
                    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: T.colors.border, overflow: 'hidden' }}>
                      {envSuggestions.map((s: any) => (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            setEnvQuery(s.fullQuery);
                            setEnvSuggestions([]);
                            runLiveNeighborhood(s.fullQuery);
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.colors.hairline, backgroundColor: '#FAFAFA' }}
                        >
                          <Text style={styles.h3} numberOfLines={1}>{s.label}</Text>
                          <Text style={styles.caption} numberOfLines={1}>{s.subtitle}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Pressable
                    onPress={() => runLiveNeighborhood()}
                    disabled={envLoading}
                    style={styles.rauschBtnFull}
                  >
                    <Text style={styles.rauschBtnTxt}>
                      {envLoading ? 'Fetching Live Sensors…' : 'Audit Live Location'}
                    </Text>
                  </Pressable>
                </View>

                {envResult && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.verifiedTag}>VERIFIED · {envResult.lat}, {envResult.lng}</Text>
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `https://www.google.com/maps/search/?api=1&query=${envResult.lat},${envResult.lng}`
                          )
                        }
                      >
                        <Text style={styles.linkCoral}>Open in Google Maps →</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.h3}>{envResult.resolvedAddress}</Text>
                    <View style={styles.metricsRow}>
                      <View style={styles.metricPill}>
                        <Text style={styles.caption}>US AQI</Text>
                        <Text
                          style={[
                            styles.metricNum,
                            { color: envResult.airQuality.usAqi > 120 ? T.colors.danger : T.colors.verified },
                          ]}
                        >
                          {envResult.airQuality.usAqi}
                        </Text>
                      </View>
                      <View style={styles.metricPill}>
                        <Text style={styles.caption}>PM2.5</Text>
                        <Text style={styles.metricNum}>{envResult.airQuality.pm25}</Text>
                      </View>
                      <View style={styles.metricPill}>
                        <Text style={styles.caption}>Elevation</Text>
                        <Text style={styles.metricNum}>{envResult.elevationMeters}m</Text>
                      </View>
                      <View style={styles.metricPill}>
                        <Text style={styles.caption}>Temp</Text>
                        <Text style={styles.metricNum}>{envResult.weather.temperatureC}°C</Text>
                      </View>
                    </View>

                    {envResult.nearbyInfrastructure.length > 0 && (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        <Text style={styles.captionBold}>Nearby Hospitals, Schools &amp; Parks (Live OSM)</Text>
                        {envResult.nearbyInfrastructure.slice(0, 5).map((poi, idx) => (
                          <View key={idx} style={styles.rowBetween}>
                            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
                              {poi.name} ({poi.category})
                            </Text>
                            <Text style={styles.captionBold}>{poi.distanceMeters}m</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {/* TOOL 2: MAHARERA / DUBAI DLD VERIFIER */}
            {toolTab === 'registry' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.h3}>MahaRERA &amp; Dubai DLD ID Verifier</Text>
                  <TextInput
                    value={regInput}
                    onChangeText={setRegInput}
                    placeholder="e.g. P51900028411 or DLD-2841"
                    placeholderTextColor={T.colors.inkMuted}
                    style={styles.inputBox}
                  />
                  <Pressable onPress={() => runRegistryVerify()} style={styles.rauschBtnFull}>
                    <Text style={styles.rauschBtnTxt}>
                      {regLoading ? 'Verifying…' : 'Verify Registration ID'}
                    </Text>
                  </Pressable>
                </View>

                {regResult && (
                  <View style={styles.card}>
                    <Text style={styles.verifiedTag}>{regResult.verdict.replace(/_/g, ' ')}</Text>
                    <Text style={styles.h2}>{regResult.inputId}</Text>
                    <Text style={styles.body}>{regResult.jurisdiction}</Text>
                    <Text style={styles.caption}>{regResult.decodedAuthority}</Text>
                    {regResult.matchedLocalDocket && (
                      <View style={styles.grayCard}>
                        <Text style={styles.h3}>{regResult.matchedLocalDocket.canonicalName}</Text>
                        <Text style={styles.caption}>
                          {regResult.matchedLocalDocket.reraStatus} · {regResult.matchedLocalDocket.activeReraLitigations} Litigations
                        </Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => Linking.openURL(regResult.officialVerificationUrl)}
                      style={styles.darkBtnFull}
                    >
                      <Text style={styles.rauschBtnTxt}>{regResult.officialPortalName} →</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}

            {/* TOOL 3: TRUE LANDING COST X-RAY */}
            {toolTab === 'cost' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.h3}>True Cost &amp; Carpet Loading X-Ray</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['Mumbai', 'Dubai'] as const).map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setCostCity(c)}
                        style={[styles.toolChip, costCity === c && styles.toolChipActive, { flex: 1, alignItems: 'center' }]}
                      >
                        <Text style={[styles.toolChipTxt, costCity === c && { color: '#FFFFFF' }]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput value={costPriceCr} onChangeText={setCostPriceCr} keyboardType="numeric" placeholder="Quoted ₹ Cr" style={styles.inputBox} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput value={costAdvSqFt} onChangeText={setCostAdvSqFt} keyboardType="numeric" placeholder="Advertised sq.ft" style={[styles.inputBox, { flex: 1 }]} />
                    <TextInput value={costCarpetSqFt} onChangeText={setCostCarpetSqFt} keyboardType="numeric" placeholder="Carpet sq.ft" style={[styles.inputBox, { flex: 1 }]} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.body}>Under-Construction (+5% GST)</Text>
                    <Switch value={costUnderConst} onValueChange={setCostUnderConst} trackColor={{ true: T.colors.rausch, false: '#DDDDDD' }} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.body}>NRI Buyer / Seller (FEMA)</Text>
                    <Switch value={costNri} onValueChange={setCostNri} trackColor={{ true: T.colors.rausch, false: '#DDDDDD' }} />
                  </View>
                  <Pressable onPress={runTrueCostAudit} style={styles.rauschBtnFull}>
                    <Text style={styles.rauschBtnTxt}>{costLoading ? 'Calculating…' : 'Calculate True Cost'}</Text>
                  </Pressable>
                </View>

                {costResult && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.caption}>True All-In Landing Cost</Text>
                        <Text style={styles.h1}>{formatPrice(costResult.totalAllInCrore)}</Text>
                      </View>
                      <Text style={styles.dangerBadge}>+₹{costResult.hiddenCostDeltaCrore} Cr Hidden</Text>
                    </View>
                    <Text style={styles.body}>
                      Paid for Walls/Lobbies: ₹{costResult.moneyPaidForWallsAndLobbiesCrore} Cr (+{costResult.carpetLoadingPct}% loading)
                    </Text>
                    <Text style={styles.caption}>{costResult.nriComplianceNote}</Text>
                  </View>
                )}
              </>
            )}

            {/* TOOL 4: AGREEMENT CLAUSE SCANNER */}
            {toolTab === 'scanner' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.h3}>Agreement &amp; Pitch Red-Flag Scanner</Text>
                  {SAMPLE_AGREEMENTS.map((s) => (
                    <Pressable
                      key={s.label}
                      onPress={() => {
                        setScanCity(s.city);
                        setScanText(s.text);
                        runAgreementAudit(s.text, s.city);
                      }}
                      style={styles.promptPill}
                    >
                      <Text style={styles.captionBold}>{s.label} →</Text>
                    </Pressable>
                  ))}
                  <TextInput
                    value={scanText}
                    onChangeText={setScanText}
                    multiline
                    numberOfLines={4}
                    placeholder="Paste builder clause or WhatsApp message…"
                    style={[styles.inputBox, { minHeight: 96, textAlignVertical: 'top' }]}
                  />
                  <Pressable onPress={() => runAgreementAudit()} style={styles.rauschBtnFull}>
                    <Text style={styles.rauschBtnTxt}>
                      {scanLoading ? 'Auditing Clauses…' : 'Scan for Red Flags'}
                    </Text>
                  </Pressable>
                </View>

                {scanResult && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.dangerBadge}>
                        {scanResult.verdict.replace(/_/g, ' ')} · {scanResult.riskScore}/100
                      </Text>
                    </View>
                    <Text style={styles.body}>{scanResult.executiveSummary}</Text>
                    {scanResult.redFlags.map((f, i) => (
                      <View key={i} style={styles.grayCard}>
                        <Text style={styles.h3}>{f.clauseTitle}</Text>
                        <Text style={styles.caption}>{f.legalBasis}</Text>
                        <Text style={styles.body}>{f.recommendedCounterClause}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* =================================================================== */}
      {/* TAB 4: WISHLISTS & VIEWINGS (PERSISTED IN SQLITE / CLOUDFLARE D1)   */}
      {/* =================================================================== */}
      {activeTab === 'wishlists' && (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 20 }}>
          <View>
            <Text style={styles.h1}>Wishlists</Text>
            <Text style={styles.caption}>Saved homes &amp; reserved viewings</Text>
          </View>

          <Text style={styles.h2}>Saved ({savedProperties.length})</Text>
          {savedProperties.length === 0 ? (
            <View style={styles.grayCard}>
              <Text style={styles.body}>Tap the heart icon on any home in Explore to save it here.</Text>
            </View>
          ) : (
            savedProperties.map((p) => (
              <Pressable key={p.id} onPress={() => setSelectedProperty(p)} style={styles.miniPropCard}>
                <Image source={{ uri: p.heroImage }} style={styles.miniPropImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.h3}>{p.canonicalName}</Text>
                  <Text style={styles.caption}>
                    {p.microMarket} · {formatPrice(p.priceCroreInr)} · Score {p.truthScore}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          <Text style={styles.h2}>Reserved Viewings ({bookings.length})</Text>
          {bookings.length === 0 ? (
            <View style={styles.grayCard}>
              <Text style={styles.body}>No private viewings reserved yet.</Text>
            </View>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={[styles.card, { borderColor: T.colors.verified }]}>
                <Text style={styles.verifiedTag}>CONFIRMED · {b.id}</Text>
                <Text style={styles.h3}>{b.canonical_name}</Text>
                <Text style={styles.caption}>
                  {b.buyer_name} · {b.preferred_date}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* =================================================================== */}
      {/* AUTHENTIC AIRBNB 4-TAB BOTTOM BAR (SAFE BOTTOM GESTURE INSET!)      */}
      {/* =================================================================== */}
      <View style={[styles.bottomBar, { paddingBottom: bottomInset }]}>
        {[
          { id: 'explore', label: 'Explore', icon: 'search' as const },
          { id: 'advisor', label: 'Advisor', icon: 'chatbubble-ellipses-outline' as const },
          { id: 'tools', label: 'Tools', icon: 'shield-checkmark-outline' as const },
          { id: 'wishlists', label: 'Wishlists', icon: 'heart-outline' as const },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id as typeof activeTab)}
              style={styles.tabBtn}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={active ? T.colors.rausch : T.colors.inkMuted}
              />
              <Text style={[styles.tabLbl, active && { color: T.colors.rausch }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator color={T.colors.rausch} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <EstateTruthMain />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.colors.canvas },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Typography
  h1: { fontFamily: T.typography.sansSemiBold, fontSize: 24, color: T.colors.ink, letterSpacing: -0.4 },
  h2: { fontFamily: T.typography.sansSemiBold, fontSize: 18, color: T.colors.ink },
  h3: { fontFamily: T.typography.sansSemiBold, fontSize: 14, color: T.colors.ink },
  body: { fontFamily: T.typography.sansRegular, fontSize: 14, lineHeight: 20, color: T.colors.inkSecondary },
  subText: { fontFamily: T.typography.sansRegular, fontSize: 13, color: T.colors.inkMuted },
  caption: { fontFamily: T.typography.sansRegular, fontSize: 12, color: T.colors.inkMuted },
  captionBold: { fontFamily: T.typography.sansSemiBold, fontSize: 12, color: T.colors.ink },

  // Airbnb Top Floating Pill Search + Categories
  topSearchWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
    paddingTop: 10,
  },
  pillSearch: {
    marginHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  pillSearchInput: {
    flex: 1,
    fontFamily: T.typography.sansRegular,
    fontSize: 14,
    color: T.colors.ink,
    paddingVertical: 2,
  },
  fxPill: {
    backgroundColor: T.colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fxPillTxt: { fontFamily: T.typography.sansSemiBold, fontSize: 11, color: T.colors.ink },
  catStrip: { paddingHorizontal: 18, paddingTop: 14, gap: 22 },
  catItem: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  catItemActive: { borderBottomColor: T.colors.ink },
  catLabel: { fontFamily: T.typography.sansMedium, fontSize: 11, color: T.colors.inkMuted },
  catLabelActive: { color: T.colors.ink, fontFamily: T.typography.sansSemiBold },

  // Airbnb Listing Cards
  listingCard: { gap: 4 },
  photoWrap: {
    position: 'relative',
    width: '100%',
    height: 270,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: T.colors.surfaceMuted,
  },
  photoImg: { width: '100%', height: '100%' },
  guestBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  guestBadgeTxt: { fontFamily: T.typography.sansSemiBold, fontSize: 12, color: T.colors.ink },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingTitle: { fontFamily: T.typography.sansSemiBold, fontSize: 16, color: T.colors.ink, flex: 1 },
  listingScore: { fontFamily: T.typography.sansMedium, fontSize: 14, color: T.colors.ink },
  listingPrice: { fontFamily: T.typography.sansSemiBold, fontSize: 15, color: T.colors.ink, marginTop: 3 },
  listingPriceSub: { fontFamily: T.typography.sansRegular, fontSize: 14, color: T.colors.inkMuted },

  // Detail Screen
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
    backgroundColor: '#FFFFFF',
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  detailHeroImg: { width: '100%', height: 260 },
  detailBody: { padding: 18, gap: 14 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingBold: { fontFamily: T.typography.sansSemiBold, fontSize: 13, color: T.colors.ink },
  divider: { height: 1, backgroundColor: T.colors.hairline, marginVertical: 4 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  grayCard: {
    backgroundColor: T.colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  meterTrack: { height: 8, backgroundColor: T.colors.border, borderRadius: 999, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: T.colors.ink, borderRadius: 999 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.colors.hairline,
    padding: 8,
    alignItems: 'center',
  },
  metricNum: { fontFamily: T.typography.sansSemiBold, fontSize: 15, color: T.colors.ink, marginTop: 2 },
  reviewCard: {
    borderWidth: 1,
    borderColor: T.colors.hairline,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  detailFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: T.colors.hairline,
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPrice: { fontFamily: T.typography.sansSemiBold, fontSize: 18, color: T.colors.ink },

  // Shared Cards & Buttons
  screenHeader: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
    backgroundColor: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: T.colors.borderDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: T.typography.sansRegular,
    fontSize: 14,
    color: T.colors.ink,
    backgroundColor: '#FFFFFF',
  },
  rauschBtn: {
    backgroundColor: T.colors.rausch,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  rauschBtnFull: {
    backgroundColor: T.colors.rausch,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  darkBtnFull: {
    backgroundColor: T.colors.ink,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  rauschBtnTxt: { fontFamily: T.typography.sansSemiBold, fontSize: 14, color: '#FFFFFF' },
  linkCoral: { fontFamily: T.typography.sansSemiBold, fontSize: 12, color: T.colors.rausch },
  dangerBadge: { fontFamily: T.typography.sansSemiBold, fontSize: 12, color: T.colors.danger },
  verifiedTag: { fontFamily: T.typography.sansSemiBold, fontSize: 11, color: T.colors.verified },

  // Advisor Chat
  bubble: { borderRadius: 16, padding: 14 },
  bubbleUser: { backgroundColor: T.colors.ink, alignSelf: 'flex-end', maxWidth: '85%' },
  bubbleAi: { backgroundColor: T.colors.surfaceMuted, alignSelf: 'flex-start', maxWidth: '94%' },
  miniPropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.colors.hairline,
    borderRadius: 12,
    padding: 8,
  },
  miniPropImg: { width: 58, height: 58, borderRadius: 8 },
  promptPill: {
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: T.colors.hairline,
    backgroundColor: '#FFFFFF',
  },
  composerInput: {
    flex: 1,
    backgroundColor: T.colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: T.typography.sansRegular,
    fontSize: 14,
    color: T.colors.ink,
  },
  sendCircle: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: T.colors.rausch,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tools Chips
  toolChip: {
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  toolChipActive: { backgroundColor: T.colors.ink, borderColor: T.colors.ink },
  toolChipTxt: { fontFamily: T.typography.sansSemiBold, fontSize: 12, color: T.colors.ink },

  // Airbnb Bottom Tab Bar
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: T.colors.hairline,
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3 },
  tabLbl: { fontFamily: T.typography.sansMedium, fontSize: 11, color: T.colors.inkMuted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
});
