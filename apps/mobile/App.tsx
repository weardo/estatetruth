import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { ESTATETRUTH_TOKENS as T } from '../../packages/design-tokens';

const API_BASE_LAN = 'http://192.168.1.53:4000/api';
const API_FALLBACK_EDGE = 'https://demos.soupup.ai/api/estatetruth/query';
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

interface TracePayload {
  traceId: string;
  totalLatencyMs: number;
  totalCostUsd: number;
  selfHealIterations: number;
  spans: Array<{ name: string; modelUsed?: string; latencyMs: number; metadata?: Record<string, unknown> }>;
  comparisons: Array<{
    mode: string;
    label?: string;
    negationTrapCaught: boolean;
    ndcgAt3?: number;
    estimatedNdcgAt5?: number;
    mrr?: number;
  }>;
}

interface BookingItem {
  id: string;
  property_id: string;
  canonical_name: string;
  buyer_name: string;
  preferred_date: string;
  status: string;
}

const QUICK_INQUIRIES = [
  'Sea-facing 4BHK in Worli under ₹40 Cr, zero MahaRERA litigation, private lift',
  'Quiet beachfront home in Dubai with zero DJ party clubs or Airbnb traffic',
  'Audit Imperial Crown Heights Lower Parel — verify litigation & night noise',
  'Quietest residence in Pali Hill Bandra with step-free wheelchair entry',
];

/**
 * CRED-inspired Neo-Editorial Mechanical Button:
 * Razor-sharp 0px geometry with hard solid ink offset shadow that physically depresses on tap.
 */
const TactileButton: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'ink' | 'alabaster' | 'brass';
  disabled?: boolean;
  fullWidth?: boolean;
}> = ({ label, onPress, variant = 'ink', disabled, fullWidth }) => {
  const bg =
    variant === 'ink'
      ? T.colors.ink
      : variant === 'brass'
        ? T.colors.brass
        : T.colors.surface;
  const fg = variant === 'alabaster' ? T.colors.ink : T.colors.canvas;
  const shadowColor = variant === 'ink' ? T.colors.brass : T.colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tactileWrap,
        fullWidth && { width: '100%' },
        { opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {({ pressed }) => (
        <View style={{ position: 'relative' }}>
          <View
            style={[
              styles.tactileBackplate,
              { backgroundColor: shadowColor },
            ]}
          />
          <View
            style={[
              styles.tactileFace,
              {
                backgroundColor: bg,
                transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [{ translateX: 0 }, { translateY: 0 }],
              },
            ]}
          >
            <Text style={[styles.tactileLabel, { color: fg }]}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const [activeTab, setActiveTab] = useState<'index' | 'counsel' | 'vault'>('index');
  const [cityFilter, setCityFilter] = useState<'All' | 'Mumbai' | 'Dubai'>('All');
  const [safeOnly, setSafeOnly] = useState(false);

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [connectedMode, setConnectedMode] = useState<'live' | 'edge'>('live');

  // Atelier Private Inquiry Modal
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);

  // Private Counsel (Live Gemini 4)
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Private Counsel ready. Specify your preferred micro-market, budget, and non-negotiables — such as zero MahaRERA disputes, low nighttime decibels, or step-free access. Every answer is audited against first-party registry and acoustic records.',
    },
  ]);

  // Discreet Technical Audit Drawer (for CTOs / Engineers)
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [simulateHallucination, setSimulateHallucination] = useState(false);
  const [lastTrace, setLastTrace] = useState<TracePayload | null>(null);

  const fetchFeed = async (city = cityFilter, onlySafe = safeOnly) => {
    setLoadingFeed(true);
    try {
      const res = await fetch(
        `${API_BASE_LAN}/properties?city=${encodeURIComponent(city)}&safeOnly=${onlySafe}&userId=${USER_ID}`
      );
      if (res.ok) {
        const json = await res.json();
        setProperties(json.properties || []);
        setSavedIds((json.properties || []).filter((p: PropertyItem) => p.isSaved).map((p: PropertyItem) => p.id));
        setConnectedMode('live');
      }
    } catch {
      setConnectedMode('edge');
    }
    setLoadingFeed(false);
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_BASE_LAN}/bookings?userId=${USER_ID}`);
      if (res.ok) {
        const json = await res.json();
        setBookings(json.bookings || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchFeed(cityFilter, safeOnly);
    fetchBookings();
  }, [cityFilter, safeOnly]);

  const handleToggleSave = async (prop: PropertyItem) => {
    const currentlySaved = savedIds.includes(prop.id);
    setSavedIds((prev) => (currentlySaved ? prev.filter((id) => id !== prop.id) : [...prev, prop.id]));
    try {
      await fetch(`${API_BASE_LAN}/saved/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, propertyId: prop.id }),
      });
    } catch {
      // ignore
    }
  };

  const handleUnlockDossier = async (prop: PropertyItem) => {
    setSelectedProperty((prev) => (prev ? { ...prev, isDossierUnlocked: true } : prev));
    setProperties((prev) => prev.map((p) => (p.id === prop.id ? { ...p, isDossierUnlocked: true } : p)));
    try {
      await fetch(`${API_BASE_LAN}/dossiers/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, propertyId: prop.id }),
      });
    } catch {
      // ignore
    }
  };

  const handleConfirmInquiry = async () => {
    if (!selectedProperty || !buyerName.trim() || !buyerContact.trim()) return;
    setBookingBusy(true);
    try {
      const res = await fetch(`${API_BASE_LAN}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          propertyId: selectedProperty.id,
          buyerName: buyerName.trim(),
          buyerContact: buyerContact.trim(),
          preferredDate: 'Private Chauffeur Appointment',
        }),
      });
      if (res.ok) {
        await fetchBookings();
        setInquiryOpen(false);
        setBuyerName('');
        setBuyerContact('');
      }
    } catch {
      // ignore
    }
    setBookingBusy(false);
  };

  const handleSendCounsel = async (overrideText?: string) => {
    const q = (overrideText ?? chatInput).trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setActiveTab('counsel');
    setChatLoading(true);
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: q }]);

    let data: any = null;
    try {
      const res = await fetch(`${API_BASE_LAN}/concierge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          sessionId: 'android_counsel_session',
          userId: USER_ID,
          simulateInitialHallucination: simulateHallucination,
        }),
      });
      if (res.ok) data = await res.json();
    } catch {
      try {
        const res = await fetch(API_FALLBACK_EDGE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, sessionId: 'android_counsel_session' }),
        });
        if (res.ok) data = await res.json();
      } catch {
        // ignore
      }
    }

    if (data) {
      setLastTrace({
        traceId: data.traceId,
        totalLatencyMs: data.langfuseTrace?.totalLatencyMs || 0,
        totalCostUsd: data.langfuseTrace?.totalCostUsd || 0,
        selfHealIterations: data.selfHealIterations || 0,
        spans: data.langfuseTrace?.spans || [],
        comparisons: data.searchComparisons || [],
      });
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

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={T.colors.ink} />
      </SafeAreaView>
    );
  }

  // =========================================================================
  // MONOGRAPH DETAIL VIEW (Architectural Ledger + Blueprint Carpet Scale)
  // =========================================================================
  if (selectedProperty) {
    const isDisputed = selectedProperty.activeReraLitigations > 0 || selectedProperty.truthScore < 60;
    const isSaved = savedIds.includes(selectedProperty.id);
    const hasBooked = bookings.some((b) => b.property_id === selectedProperty.id);
    const trueRatioPct = Math.round(
      (selectedProperty.trueCarpetSqFt / selectedProperty.brokerAdvertisedSqFt) * 100
    );
    const overpayCrore = (
      selectedProperty.priceCroreInr *
      (Math.max(0, selectedProperty.brokerAdvertisedSqFt - selectedProperty.trueCarpetSqFt) /
        selectedProperty.brokerAdvertisedSqFt)
    ).toFixed(1);

    const handleShareBrief = () => {
      Share.share({
        message: `EstateTruth Forensic Brief — ${selectedProperty.canonicalName} (${selectedProperty.microMarket})\n• Safety Score: ${selectedProperty.truthScore}/100 (${selectedProperty.activeReraLitigations} RERA disputes)\n• True Carpet: ${selectedProperty.trueCarpetSqFt.toLocaleString()} sq.ft vs ${selectedProperty.brokerAdvertisedSqFt.toLocaleString()} advertised (~₹${overpayCrore} Cr non-usable gap)\n• Night Noise: ${selectedProperty.ambientNoiseDbNight} dB\nAudit live: https://demos.soupup.ai/estatetruth`,
      }).catch(() => {});
    };

    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        {/* Hairline Masthead */}
        <View style={styles.detailMasthead}>
          <Pressable onPress={() => setSelectedProperty(null)} style={styles.mastheadAction}>
            <Text style={styles.metaUpper}>← RETURN TO INDEX</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={handleShareBrief} style={styles.mastheadAction}>
              <Text style={styles.metaUpper}>SHARE</Text>
            </Pressable>
            <Pressable onPress={() => handleToggleSave(selectedProperty)} style={styles.mastheadAction}>
              <Text style={[styles.metaUpper, isSaved && { color: T.colors.brass }]}>
                {isSaved ? 'IN VAULT' : 'ARCHIVE'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* Full-Bleed Architectural Plate (Zero Clutter) */}
          <View style={styles.detailPlateWrap}>
            <Image source={{ uri: selectedProperty.heroImage }} style={styles.detailPlateImg} />
            {/* Rotated Mechanical Ink Stamp */}
            <View
              style={[
                styles.inkStamp,
                { borderColor: isDisputed ? T.colors.oxblood : T.colors.forest },
              ]}
            >
              <Text
                style={[
                  styles.inkStampSub,
                  { color: isDisputed ? T.colors.oxblood : T.colors.forest },
                ]}
              >
                {isDisputed ? 'DISPUTED' : 'VERIFIED'}
              </Text>
              <Text
                style={[
                  styles.inkStampNum,
                  { color: isDisputed ? T.colors.oxblood : T.colors.forest },
                ]}
              >
                {selectedProperty.truthScore}
              </Text>
            </View>
          </View>

          <View style={styles.monographBody}>
            <Text style={styles.kickerBrass}>
              {selectedProperty.microMarket.toUpperCase()} · {selectedProperty.city.toUpperCase()}
            </Text>
            <Text style={styles.serifH1}>{selectedProperty.canonicalName}</Text>
            <Text style={styles.priceRowEditorial}>
              ₹{selectedProperty.priceCroreInr} Cr{' '}
              <Text style={styles.priceRowUsd}>/ ${selectedProperty.priceUsdMillions}M Guide</Text>
            </Text>

            {/* 3-Column Hairline Architectural Ledger */}
            <View style={styles.ledgerGrid}>
              <View style={[styles.ledgerCell, styles.ledgerCellBorderRight]}>
                <Text style={styles.ledgerLabel}>RERA / DLD</Text>
                <Text
                  style={[
                    styles.ledgerVal,
                    isDisputed && { color: T.colors.oxblood },
                  ]}
                >
                  {selectedProperty.activeReraLitigations === 0
                    ? 'Clear (0)'
                    : `${selectedProperty.activeReraLitigations} Cases`}
                </Text>
                <Text style={styles.ledgerSub}>{selectedProperty.reraId}</Text>
              </View>
              <View style={[styles.ledgerCell, styles.ledgerCellBorderRight]}>
                <Text style={styles.ledgerLabel}>NIGHT ACOUSTICS</Text>
                <Text
                  style={[
                    styles.ledgerVal,
                    selectedProperty.ambientNoiseDbNight > 55 && { color: T.colors.oxblood },
                  ]}
                >
                  {selectedProperty.ambientNoiseDbNight} dB
                </Text>
                <Text style={styles.ledgerSub}>
                  {selectedProperty.ambientNoiseDbNight <= 45 ? 'Sanctuary' : 'Traffic Exposed'}
                </Text>
              </View>
              <View style={styles.ledgerCell}>
                <Text style={styles.ledgerLabel}>PRIVATE LIFT</Text>
                <Text style={styles.ledgerVal}>
                  {selectedProperty.floorplanVisionAudit.hasPrivateElevatorLobby ? 'Direct' : 'Shared'}
                </Text>
                <Text style={styles.ledgerSub}>
                  {selectedProperty.floorplanVisionAudit.stepFreeWheelchairEntry
                    ? 'Step-Free'
                    : 'Steps at Entry'}
                </Text>
              </View>
            </View>

            {/* SIGNATURE COMPONENT: Calibrated Carpet-Area Truth Ruler */}
            <View style={styles.rulerSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.metaUpper}>SANCTIONED CARPET VS. BROCHURE CLAIM</Text>
                <Text style={[styles.metaUpper, { color: T.colors.oxblood }]}>
                  +{selectedProperty.carpetInflationPct}% (~₹{overpayCrore} CR GAP)
                </Text>
              </View>
              <View style={styles.rulerTrack}>
                <View style={[styles.rulerFill, { width: `${trueRatioPct}%` }]} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.rulerCaption}>
                  Verified RERA Carpet: {selectedProperty.trueCarpetSqFt.toLocaleString()} sq.ft.
                </Text>
                <Text style={styles.rulerCaptionMuted}>
                  Advertised: {selectedProperty.brokerAdvertisedSqFt.toLocaleString()} sq.ft.
                </Text>
              </View>
            </View>

            {/* Brochure Claim vs Independent Audit */}
            <View style={styles.comparisonBlock}>
              <Text style={styles.metaUpper}>BROCHURE STATEMENT</Text>
              <Text style={styles.serifQuote}>"{selectedProperty.brokerClaim}"</Text>
            </View>

            {/* Verified First-Party Ledger Entries */}
            <View style={{ gap: 14, marginTop: 8 }}>
              <Text style={styles.metaUpper}>PRIMARY REGISTRY &amp; RESIDENT EVIDENCE</Text>
              {selectedProperty.evidence.map((ev, i) => (
                <View key={i} style={styles.evidenceRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.evTag}>{ev.author || ev.source}</Text>
                    <Text style={styles.evDate}>{ev.date}</Text>
                  </View>
                  <Text style={styles.evText}>{ev.quote}</Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 12 }}>
              <TactileButton
                label={
                  selectedProperty.isDossierUnlocked
                    ? '30-YEAR TITLE & ESCROW DOSSIER UNLOCKED'
                    : 'REQUEST FULL 30-YEAR LEGAL DOSSIER · ₹9,999'
                }
                onPress={() => handleUnlockDossier(selectedProperty)}
                variant="alabaster"
                fullWidth
              />
            </View>
          </View>
        </ScrollView>

        {/* Tactile Obsidian Atelier Footer */}
        <View style={styles.vaultFooter}>
          <View>
            <Text style={styles.vaultFooterMeta}>BUYER-SIDE REPRESENTATION</Text>
            <Text style={styles.vaultFooterPrice}>₹{selectedProperty.priceCroreInr} Crore</Text>
          </View>
          <TactileButton
            label={hasBooked ? 'APPOINTMENT CONFIRMED' : 'INQUIRE WITH ADVISOR'}
            onPress={() => setInquiryOpen(true)}
            variant="brass"
          />
        </View>

        {/* Atelier Private Inquiry Sheet (Minimalist Hairline Underlines) */}
        <Modal visible={inquiryOpen} transparent animationType="fade">
          <View style={styles.modalShade}>
            <View style={styles.atelierSheet}>
              <Text style={styles.kickerBrass}>PRIVATE CLIENT DESK</Text>
              <Text style={styles.serifH2}>{selectedProperty.canonicalName}</Text>
              <Text style={styles.bodyEditorial}>
                Chauffeur-arranged private viewing with independent buyer representation. Your details are stored privately in our vault.
              </Text>
              <TextInput
                value={buyerName}
                onChangeText={setBuyerName}
                placeholder="Full Name"
                placeholderTextColor={T.colors.inkMuted}
                style={styles.underlineInput}
              />
              <TextInput
                value={buyerContact}
                onChangeText={setBuyerContact}
                placeholder="Direct Telephone or Email"
                placeholderTextColor={T.colors.inkMuted}
                style={styles.underlineInput}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <TactileButton label="CLOSE" onPress={() => setInquiryOpen(false)} variant="alabaster" fullWidth />
                </View>
                <View style={{ flex: 1.5 }}>
                  <TactileButton
                    label={bookingBusy ? 'RECORDING…' : 'CONFIRM APPOINTMENT'}
                    onPress={handleConfirmInquiry}
                    disabled={bookingBusy}
                    variant="ink"
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // MAIN EDITORIAL APP (INDEX | COUNSEL | VAULT)
  // =========================================================================
  const heroEstate = properties[0];
  const restEstates = properties.slice(1);
  const savedProperties = properties.filter((p) => savedIds.includes(p.id));

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      {/* Architectural Masthead (Zero Clutter) */}
      <View style={styles.masthead}>
        <View>
          <Text style={styles.brandWordmark}>ESTATETRUTH</Text>
          <Text style={styles.brandSub}>MUMBAI · DUBAI · PRIVATE REGISTRY</Text>
        </View>
        <Pressable onPress={() => setAuditDrawerOpen(true)} style={styles.systemLink}>
          <Text style={styles.systemLinkTxt}>SYSTEM AUDIT</Text>
        </Pressable>
      </View>

      {/* TAB 1: INDEX — Aman Editorial Hero + Auction Lot Monographs */}
      {activeTab === 'index' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Quiet Filter Rule Strip */}
          <View style={styles.filterStrip}>
            {(['All', 'Mumbai', 'Dubai'] as const).map((c) => {
              const active = cityFilter === c;
              return (
                <Pressable key={c} onPress={() => setCityFilter(c)} style={styles.filterTab}>
                  <Text style={[styles.filterTabTxt, active && styles.filterTabTxtActive]}>
                    {c === 'All' ? 'ALL LOTS' : c.toUpperCase()}
                  </Text>
                  {active && <View style={styles.filterUnderline} />}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setSafeOnly(!safeOnly)} style={styles.filterTab}>
              <Text style={[styles.filterTabTxt, safeOnly && { color: T.colors.forest }]}>
                {safeOnly ? 'CLEAN ONLY · ON' : 'CLEAN ONLY'}
              </Text>
              {safeOnly && <View style={[styles.filterUnderline, { backgroundColor: T.colors.forest }]} />}
            </Pressable>
          </View>

          {loadingFeed ? (
            <ActivityIndicator color={T.colors.ink} style={{ marginTop: 60 }} />
          ) : (
            <>
              {/* FULL-BLEED EDITORIAL COVER HERO (Inspiration Before Interrogation!) */}
              {heroEstate && (
                <Pressable onPress={() => setSelectedProperty(heroEstate)} style={styles.coverHero}>
                  <Image source={{ uri: heroEstate.heroImage }} style={styles.coverHeroImg} />
                  <View style={styles.coverHeroScrim} />
                  <View style={styles.coverHeroContent}>
                    <Text style={styles.coverLotTag}>
                      LOT 01 · {heroEstate.microMarket.toUpperCase()} · VERIFIED {heroEstate.truthScore}/100
                    </Text>
                    <Text style={styles.coverHeroTitle}>{heroEstate.canonicalName}</Text>
                    <View style={styles.coverHeroFoot}>
                      <Text style={styles.coverHeroMeta}>
                        ₹{heroEstate.priceCroreInr} Cr · {heroEstate.trueCarpetSqFt.toLocaleString()} sq.ft True Carpet · {heroEstate.ambientNoiseDbNight} dB
                      </Text>
                      <Text style={styles.coverHeroLink}>INSPECT DOSSIER →</Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {/* Quiet Editorial Counsel Prompt Strip */}
              <View style={styles.counselBanner}>
                <Text style={styles.kickerBrass}>PRIVATE COUNSEL</Text>
                <Text style={styles.serifH2}>
                  Eliminate broker hype, hidden RERA disputes &amp; highway noise before you tour.
                </Text>
                <View style={{ marginTop: 14 }}>
                  <TactileButton
                    label="CONSULT PRIVATE AI ADVISOR"
                    onPress={() => setActiveTab('counsel')}
                    variant="ink"
                  />
                </View>
              </View>

              {/* Curated Architectural Monographs */}
              <View style={{ paddingHorizontal: 20, gap: 28 }}>
                {restEstates.map((prop, idx) => {
                  const isDisputed = prop.activeReraLitigations > 0 || prop.truthScore < 60;
                  const isSaved = savedIds.includes(prop.id);
                  const lotNum = String(idx + 2).padStart(2, '0');
                  return (
                    <Pressable
                      key={prop.id}
                      onPress={() => setSelectedProperty(prop)}
                      style={styles.lotCard}
                    >
                      <View style={styles.lotHeader}>
                        <Text style={styles.kickerBrass}>
                          LOT {lotNum} · {prop.microMarket.toUpperCase()}
                        </Text>
                        <Text
                          style={[
                            styles.lotVerdict,
                            { color: isDisputed ? T.colors.oxblood : T.colors.forest },
                          ]}
                        >
                          {isDisputed ? `DISPUTED · ${prop.truthScore}` : `VERIFIED · ${prop.truthScore}`}
                        </Text>
                      </View>

                      <Image source={{ uri: prop.heroImage }} style={styles.lotImg} />

                      <View style={styles.lotBody}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.lotTitle}>{prop.canonicalName}</Text>
                          <Pressable onPress={() => handleToggleSave(prop)}>
                            <Text style={[styles.metaUpper, isSaved && { color: T.colors.brass }]}>
                              {isSaved ? 'ARCHIVED' : 'ARCHIVE'}
                            </Text>
                          </Pressable>
                        </View>

                        <View style={styles.lotSpecStrip}>
                          <Text style={styles.lotSpec}>₹{prop.priceCroreInr} Cr</Text>
                          <Text style={styles.lotDot}>·</Text>
                          <Text style={styles.lotSpec}>{prop.trueCarpetSqFt.toLocaleString()} sq.ft</Text>
                          <Text style={styles.lotDot}>·</Text>
                          <Text
                            style={[
                              styles.lotSpec,
                              prop.ambientNoiseDbNight > 55 && { color: T.colors.oxblood },
                            ]}
                          >
                            {prop.ambientNoiseDbNight} dB
                          </Text>
                          <Text style={styles.lotDot}>·</Text>
                          <Text
                            style={[
                              styles.lotSpec,
                              prop.activeReraLitigations > 0 && { color: T.colors.oxblood },
                            ]}
                          >
                            {prop.activeReraLitigations === 0
                              ? '0 Disputes'
                              : `${prop.activeReraLitigations} RERA Cases`}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* TAB 2: COUNSEL — Refined Private Wealth Dialogue (Live Gemini 4) */}
      {activeTab === 'counsel' && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.counselScroll}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.counselTurn,
                  m.role === 'user' ? styles.counselUser : styles.counselAi,
                ]}
              >
                <Text style={styles.turnSpeaker}>
                  {m.role === 'user' ? 'CLIENT INQUIRY' : 'ESTATETRUTH COUNSEL'}
                </Text>
                <Text style={m.role === 'user' ? styles.turnUserText : styles.turnAiText}>
                  {m.text}
                </Text>

                {m.properties && m.properties.length > 0 && (
                  <View style={{ gap: 10, marginTop: 14 }}>
                    {m.properties.map((p) => (
                      <Pressable
                        key={p.propertyId}
                        onPress={() => {
                          const found = properties.find((x) => x.id === p.propertyId);
                          if (found) setSelectedProperty(found);
                        }}
                        style={styles.inlineLot}
                      >
                        {p.heroImage && <Image source={{ uri: p.heroImage }} style={styles.inlineLotImg} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inlineLotTitle}>{p.canonicalName}</Text>
                          <Text style={styles.inlineLotSub}>
                            ₹{p.priceCroreInr} Cr · {p.ambientNoiseDbNight} dB · {p.activeReraLitigations} cases
                          </Text>
                          <Text style={styles.inlineLotLink}>VERIFIED {p.truthScore}/100 · OPEN MONOGRAPH →</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {m.trapsCount && m.trapsCount > 0 ? (
                  <Text style={styles.excludedNote}>
                    Excluded {m.trapsCount} non-compliant listings failing legal or acoustic thresholds.
                  </Text>
                ) : null}
              </View>
            ))}

            {chatLoading && (
              <View style={[styles.counselTurn, styles.counselAi]}>
                <Text style={styles.turnSpeaker}>AUDITING REGISTRIES &amp; GEMINI 4…</Text>
                <ActivityIndicator color={T.colors.ink} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
              </View>
            )}

            {messages.length <= 2 && (
              <View style={{ gap: 8, marginTop: 6 }}>
                <Text style={styles.metaUpper}>SUGGESTED INQUIRIES</Text>
                {QUICK_INQUIRIES.map((qi) => (
                  <Pressable key={qi} onPress={() => handleSendCounsel(qi)} style={styles.suggestionRow}>
                    <Text style={styles.suggestionTxt}>{qi}</Text>
                    <Text style={styles.metaUpper}>→</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Sharp Architectural Input Bar */}
          <View style={styles.composerBar}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="State neighborhood, budget, and dealbreakers…"
              placeholderTextColor={T.colors.inkMuted}
              style={styles.composerInput}
              onSubmitEditing={() => handleSendCounsel()}
            />
            <Pressable onPress={() => handleSendCounsel()} style={styles.composerBtn}>
              <Text style={styles.composerBtnTxt}>SEND</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* TAB 3: VAULT — Archived Shortlist & Private Appointments (SQLite) */}
      {activeTab === 'vault' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 22 }}>
          <View>
            <Text style={styles.kickerBrass}>PRIVATE ARCHIVE</Text>
            <Text style={styles.serifH1}>Your Vault</Text>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={styles.metaUpper}>SHORTLISTED RESIDENCES ({savedProperties.length})</Text>
            {savedProperties.length === 0 ? (
              <View style={styles.emptyLedger}>
                <Text style={styles.bodyEditorial}>
                  Archive residences from the Index to compare their verified ledgers side by side.
                </Text>
              </View>
            ) : (
              savedProperties.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProperty(p)}
                  style={styles.inlineLot}
                >
                  <Image source={{ uri: p.heroImage }} style={styles.inlineLotImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inlineLotTitle}>{p.canonicalName}</Text>
                    <Text style={styles.inlineLotSub}>
                      {p.microMarket} · ₹{p.priceCroreInr} Cr · Score {p.truthScore}/100
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Text style={styles.metaUpper}>CONFIRMED APPOINTMENTS ({bookings.length})</Text>
            {bookings.length === 0 ? (
              <View style={styles.emptyLedger}>
                <Text style={styles.bodyEditorial}>No private chauffeur viewings scheduled yet.</Text>
              </View>
            ) : (
              bookings.map((b) => (
                <View key={b.id} style={styles.appointmentCard}>
                  <Text style={styles.kickerBrass}>CONFIRMED · {b.id}</Text>
                  <Text style={styles.inlineLotTitle}>{b.canonical_name}</Text>
                  <Text style={styles.inlineLotSub}>
                    {b.buyer_name} · {b.preferred_date}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Architectural Hairline Bottom Navigation (Zero Emojis) */}
      <View style={styles.bottomNav}>
        {[
          { id: 'index', num: '01', label: 'INDEX' },
          { id: 'counsel', num: '02', label: 'COUNSEL' },
          { id: 'vault', num: '03', label: `VAULT (${savedIds.length})` },
        ].map((item) => {
          const active = activeTab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setActiveTab(item.id as typeof activeTab)}
              style={[styles.navCell, active && styles.navCellActive]}
            >
              <Text style={[styles.navNum, active && { color: T.colors.brass }]}>{item.num}</Text>
              <Text style={[styles.navLbl, active && { color: T.colors.ink }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* DISCREET ENGINEERING / SYSTEM AUDIT MODAL (LangGraph + Langfuse + NDCG) */}
      <Modal visible={auditDrawerOpen} transparent animationType="slide">
        <View style={styles.modalShade}>
          <View style={[styles.atelierSheet, { maxHeight: '85%' }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.kickerBrass}>SYSTEM ARCHITECTURE · MLOPS TELEMETRY</Text>
              <Pressable onPress={() => setAuditDrawerOpen(false)}>
                <Text style={styles.metaUpper}>CLOSE</Text>
              </Pressable>
            </View>
            <ScrollView style={{ marginTop: 10 }}>
              <Text style={styles.bodyEditorial}>
                Engine: {connectedMode === 'live' ? 'NestJS + 5-Node LangGraph + Live Gemini 4 + SQLite WAL' : 'Cloudflare Edge Multi-Agent'}
              </Text>

              <View style={styles.auditSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evTag}>Hallucination Self-Heal Stress Test</Text>
                  <Text style={styles.evDate}>Injects a RERA trap on Iter 1 so Node 5 Judge cycles &amp; heals</Text>
                </View>
                <Switch
                  value={simulateHallucination}
                  onValueChange={setSimulateHallucination}
                  trackColor={{ false: T.colors.hairline, true: T.colors.ink }}
                  thumbColor={T.colors.canvas}
                />
              </View>

              {lastTrace ? (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <Text style={styles.metaUpper}>
                    LANGFUSE TRACE {lastTrace.traceId} · {lastTrace.totalLatencyMs}MS · ${lastTrace.totalCostUsd.toFixed(5)}
                  </Text>
                  {lastTrace.spans.map((sp, i) => (
                    <View key={i} style={styles.evidenceRow}>
                      <Text style={styles.evTag}>{sp.name}</Text>
                      <Text style={styles.evDate}>
                        {sp.modelUsed || 'Deterministic Tool'} · {sp.latencyMs}ms
                        {sp.metadata?.liveLlmCalled ? ' · LIVE GEMINI 4' : ''}
                      </Text>
                    </View>
                  ))}
                  <Text style={[styles.metaUpper, { marginTop: 8 }]}>GOLDEN RELEVANCE BENCHMARK</Text>
                  {lastTrace.comparisons.map((c, i) => (
                    <View key={i} style={styles.evidenceRow}>
                      <Text style={styles.evTag}>{c.label || c.mode}</Text>
                      <Text style={styles.evDate}>
                        NDCG@3 {(c.ndcgAt3 ?? c.estimatedNdcgAt5 ?? 0.8).toFixed(3)} ·{' '}
                        {c.negationTrapCaught ? 'NEGATION CLEAN' : 'TRAP LEAKED'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.bodyEditorial, { marginTop: 12 }]}>
                  Run an inquiry in Private Counsel to inspect the live LangGraph span waterfall and Hybrid RRF relevance comparison.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.colors.canvas },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
    backgroundColor: T.colors.canvas,
  },
  brandWordmark: {
    fontFamily: T.typography.serifSemiBold,
    fontSize: 22,
    letterSpacing: 3.5,
    color: T.colors.ink,
  },
  brandSub: {
    fontFamily: T.typography.sansMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: T.colors.inkMuted,
    marginTop: 2,
  },
  systemLink: {
    borderWidth: 1,
    borderColor: T.colors.hairline,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  systemLinkTxt: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: T.colors.inkSecondary,
  },
  filterStrip: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
    gap: 20,
  },
  filterTab: { paddingVertical: 14, position: 'relative' },
  filterTabTxt: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: T.colors.inkMuted,
  },
  filterTabTxtActive: { color: T.colors.ink },
  filterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: T.colors.ink,
  },

  // Full-Bleed Architectural Hero
  coverHero: { height: 420, width: '100%', position: 'relative', backgroundColor: T.colors.ink },
  coverHeroImg: { width: '100%', height: '100%', opacity: 0.82 },
  coverHeroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 19, 17, 0.36)',
  },
  coverHeroContent: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    gap: 8,
  },
  coverLotTag: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: '#E7D8BE',
  },
  coverHeroTitle: {
    fontFamily: T.typography.serifRegular,
    fontSize: 38,
    lineHeight: 42,
    color: '#FAF8F3',
  },
  coverHeroFoot: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(250,248,243,0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverHeroMeta: { fontFamily: T.typography.sansRegular, fontSize: 11, color: '#EAE4D8' },
  coverHeroLink: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#FAF8F3',
  },

  counselBanner: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
    marginBottom: 24,
    backgroundColor: T.colors.surface,
  },

  // Lot Monograph Cards
  lotCard: {
    borderTopWidth: 1,
    borderTopColor: T.colors.ink,
    paddingTop: 12,
    gap: 12,
  },
  lotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lotVerdict: { fontFamily: T.typography.sansSemiBold, fontSize: 10, letterSpacing: 1.6 },
  lotImg: { width: '100%', height: 230, backgroundColor: T.colors.surfaceMuted },
  lotBody: { gap: 8 },
  lotTitle: { fontFamily: T.typography.serifMedium, fontSize: 26, color: T.colors.ink, flex: 1 },
  lotSpecStrip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lotSpec: { fontFamily: T.typography.sansMedium, fontSize: 12, color: T.colors.inkSecondary },
  lotDot: { color: T.colors.hairline },

  // Shared Editorial Typography
  kickerBrass: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: T.colors.brass,
  },
  metaUpper: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: T.colors.inkSecondary,
  },
  serifH1: {
    fontFamily: T.typography.serifRegular,
    fontSize: 36,
    lineHeight: 40,
    color: T.colors.ink,
    marginTop: 4,
  },
  serifH2: {
    fontFamily: T.typography.serifRegular,
    fontSize: 26,
    lineHeight: 32,
    color: T.colors.ink,
    marginTop: 4,
  },
  serifQuote: {
    fontFamily: T.typography.serifItalic,
    fontSize: 20,
    lineHeight: 28,
    color: T.colors.inkSecondary,
    marginTop: 6,
  },
  bodyEditorial: {
    fontFamily: T.typography.sansRegular,
    fontSize: 13,
    lineHeight: 21,
    color: T.colors.inkSecondary,
  },

  // Tactile CRED-style Mechanical Button
  tactileWrap: { alignSelf: 'flex-start' },
  tactileBackplate: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
  },
  tactileFace: {
    borderWidth: 1.5,
    borderColor: T.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tactileLabel: {
    fontFamily: T.typography.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.8,
  },

  // Detail Monograph Screen
  detailMasthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.hairline,
  },
  mastheadAction: { paddingVertical: 4 },
  detailPlateWrap: { height: 290, width: '100%', position: 'relative' },
  detailPlateImg: { width: '100%', height: '100%' },
  inkStamp: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    backgroundColor: 'rgba(250, 248, 243, 0.94)',
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  inkStampSub: { fontFamily: T.typography.sansSemiBold, fontSize: 9, letterSpacing: 2 },
  inkStampNum: { fontFamily: T.typography.serifSemiBold, fontSize: 28, lineHeight: 30 },
  monographBody: { padding: 20, gap: 18 },
  priceRowEditorial: { fontFamily: T.typography.serifMedium, fontSize: 24, color: T.colors.ink },
  priceRowUsd: { fontFamily: T.typography.sansRegular, fontSize: 13, color: T.colors.inkMuted },
  ledgerGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.colors.ink,
    paddingVertical: 14,
  },
  ledgerCell: { flex: 1, paddingHorizontal: 8 },
  ledgerCellBorderRight: { borderRightWidth: 1, borderRightColor: T.colors.hairline },
  ledgerLabel: { fontFamily: T.typography.sansSemiBold, fontSize: 9, letterSpacing: 1.4, color: T.colors.inkMuted },
  ledgerVal: { fontFamily: T.typography.serifSemiBold, fontSize: 20, color: T.colors.ink, marginTop: 4 },
  ledgerSub: { fontFamily: T.typography.sansRegular, fontSize: 10, color: T.colors.inkSecondary, marginTop: 2 },

  // Signature Carpet-Area Ruler
  rulerSection: {
    backgroundColor: T.colors.surface,
    borderWidth: 1,
    borderColor: T.colors.hairline,
    padding: 16,
    gap: 10,
  },
  rulerTrack: {
    height: 10,
    backgroundColor: T.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: T.colors.ink,
    overflow: 'hidden',
  },
  rulerFill: { height: '100%', backgroundColor: T.colors.ink },
  rulerCaption: { fontFamily: T.typography.sansSemiBold, fontSize: 11, color: T.colors.ink },
  rulerCaptionMuted: { fontFamily: T.typography.sansRegular, fontSize: 11, color: T.colors.inkMuted },

  comparisonBlock: {
    borderLeftWidth: 2,
    borderLeftColor: T.colors.brass,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  evidenceRow: {
    borderTopWidth: 1,
    borderTopColor: T.colors.hairline,
    paddingTop: 12,
    gap: 5,
  },
  evTag: { fontFamily: T.typography.sansSemiBold, fontSize: 11, color: T.colors.ink },
  evDate: { fontFamily: T.typography.sansRegular, fontSize: 10, color: T.colors.inkMuted },
  evText: { fontFamily: T.typography.sansRegular, fontSize: 13, lineHeight: 20, color: T.colors.inkSecondary },

  vaultFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.colors.vaultBg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaultFooterMeta: { fontFamily: T.typography.sansSemiBold, fontSize: 9, letterSpacing: 1.6, color: T.colors.brass },
  vaultFooterPrice: { fontFamily: T.typography.serifMedium, fontSize: 22, color: T.colors.vaultText },

  // Private Counsel Chat
  counselScroll: { padding: 20, gap: 18, paddingBottom: 30 },
  counselTurn: { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: T.colors.hairline, gap: 6 },
  counselUser: { borderLeftWidth: 2, borderLeftColor: T.colors.ink, paddingLeft: 14 },
  counselAi: {},
  turnSpeaker: { fontFamily: T.typography.sansSemiBold, fontSize: 9, letterSpacing: 1.8, color: T.colors.brass },
  turnUserText: { fontFamily: T.typography.serifMedium, fontSize: 22, lineHeight: 28, color: T.colors.ink },
  turnAiText: { fontFamily: T.typography.sansRegular, fontSize: 14, lineHeight: 22, color: T.colors.ink },
  inlineLot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.colors.surface,
    borderWidth: 1,
    borderColor: T.colors.hairline,
    padding: 10,
  },
  inlineLotImg: { width: 68, height: 68 },
  inlineLotTitle: { fontFamily: T.typography.serifSemiBold, fontSize: 18, color: T.colors.ink },
  inlineLotSub: { fontFamily: T.typography.sansRegular, fontSize: 11, color: T.colors.inkSecondary, marginTop: 2 },
  inlineLotLink: { fontFamily: T.typography.sansSemiBold, fontSize: 9, letterSpacing: 1.4, color: T.colors.forest, marginTop: 4 },
  excludedNote: { fontFamily: T.typography.sansMedium, fontSize: 11, color: T.colors.oxblood, marginTop: 8 },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: T.colors.hairline,
    paddingVertical: 12,
    gap: 12,
  },
  suggestionTxt: { fontFamily: T.typography.sansRegular, fontSize: 13, color: T.colors.ink, flex: 1 },
  composerBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: T.colors.ink,
    backgroundColor: T.colors.surface,
  },
  composerInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: T.typography.sansRegular,
    fontSize: 14,
    color: T.colors.ink,
  },
  composerBtn: {
    backgroundColor: T.colors.ink,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  composerBtnTxt: { fontFamily: T.typography.sansSemiBold, fontSize: 11, letterSpacing: 1.8, color: T.colors.canvas },

  // Vault
  emptyLedger: {
    borderWidth: 1,
    borderColor: T.colors.hairline,
    backgroundColor: T.colors.surface,
    padding: 18,
  },
  appointmentCard: {
    borderWidth: 1,
    borderColor: T.colors.forest,
    backgroundColor: T.colors.forestTint,
    padding: 16,
    gap: 4,
  },

  // Bottom Navigation (Editorial Numbered Hairline Bar)
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: T.colors.ink,
    backgroundColor: T.colors.canvas,
  },
  navCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  navCellActive: { borderTopColor: T.colors.ink, backgroundColor: T.colors.surface },
  navNum: { fontFamily: T.typography.serifMedium, fontSize: 12, color: T.colors.inkMuted },
  navLbl: { fontFamily: T.typography.sansSemiBold, fontSize: 10, letterSpacing: 1.8, color: T.colors.inkMuted },

  // Modals
  modalShade: { flex: 1, backgroundColor: 'rgba(20,19,17,0.72)', justifyContent: 'flex-end' },
  atelierSheet: {
    backgroundColor: T.colors.canvas,
    borderTopWidth: 2,
    borderTopColor: T.colors.ink,
    padding: 24,
    gap: 12,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: T.colors.ink,
    paddingVertical: 12,
    fontFamily: T.typography.sansRegular,
    fontSize: 15,
    color: T.colors.ink,
  },
  auditSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.colors.hairline,
    backgroundColor: T.colors.surface,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
});
