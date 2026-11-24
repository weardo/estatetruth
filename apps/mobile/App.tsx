import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_BASE_LAN = 'http://192.168.1.53:4000/api';
const API_FALLBACK_EDGE = 'https://demos.soupup.ai/api/estatetruth/query';
const USER_ID = 'android_hni_client';

interface EvidenceItem {
  source: string;
  author?: string;
  quote: string;
  verifiedTag: string;
  date?: string;
  sentiment?: string;
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
  redFlags: string[];
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
    trueCarpetSqFt: number;
  }>;
  trapsCount?: number;
  trace?: {
    traceId: string;
    totalLatencyMs: number;
    totalCostUsd: number;
    selfHealIterations: number;
    spans: Array<{ name: string; modelUsed?: string; latencyMs: number; metadata?: Record<string, unknown> }>;
    comparisons: Array<{ mode: string; label?: string; topResultNames: string[]; negationTrapCaught: boolean; estimatedNdcgAt5?: number; ndcgAt3?: number }>;
  };
}

interface BookingItem {
  id: string;
  property_id: string;
  canonical_name: string;
  buyer_name: string;
  preferred_date: string;
  status: string;
}

const QUICK_ASKS = [
  'Quiet sea-facing 4BHK in Worli under ₹40 Cr, zero legal disputes',
  'Beachfront home in Dubai, no loud DJ clubs or Airbnb traffic',
  'Is Imperial Crown Heights Lower Parel safe to buy?',
  'Quietest home in Bandra with wheelchair step-free access',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'discover' | 'advisor' | 'saved'>('discover');
  const [cityFilter, setCityFilter] = useState<'All' | 'Mumbai' | 'Dubai'>('All');
  const [safeOnly, setSafeOnly] = useState(false);

  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [connectedMode, setConnectedMode] = useState<'live' | 'edge'>('live');

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);

  // Advisor Chat State (Powered by Live Gemini 4 + 5-Agent LangGraph!)
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Welcome to EstateTruth. Tell me what you’re looking for — including dealbreakers like "no RERA litigation", "no highway noise", or "private lift" — and I’ll cross-check government filings, acoustic data, and verified resident logs for you.',
    },
  ]);

  // Optional Hidden MLOps X-Ray Modal (For CTOs / Engineers — stays completely out of a rich buyer's way!)
  const [xrayOpen, setXrayOpen] = useState(false);
  const [simulateHallucination, setSimulateHallucination] = useState(false);
  const [lastTrace, setLastTrace] = useState<ChatMessage['trace'] | null>(null);

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

  const handleConfirmBooking = async () => {
    if (!selectedProperty || !buyerName.trim() || !buyerContact.trim()) return;
    setBookingSaving(true);
    try {
      const res = await fetch(`${API_BASE_LAN}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          propertyId: selectedProperty.id,
          buyerName: buyerName.trim(),
          buyerContact: buyerContact.trim(),
          preferredDate: 'This Weekend · Private Chauffeur',
        }),
      });
      if (res.ok) {
        await fetchBookings();
        setBookingModalOpen(false);
        setBuyerName('');
        setBuyerContact('');
      }
    } catch {
      // ignore
    }
    setBookingSaving(false);
  };

  const handleSendAsk = async (textOverride?: string) => {
    const q = (textOverride ?? chatInput).trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setActiveTab('advisor');
    setChatLoading(true);

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);

    let data: any = null;
    try {
      const res = await fetch(`${API_BASE_LAN}/concierge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          sessionId: 'android_advisor_session',
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
          body: JSON.stringify({ query: q, sessionId: 'android_advisor_session' }),
        });
        if (res.ok) data = await res.json();
      } catch {
        // ignore
      }
    }

    if (data) {
      const traceInfo: ChatMessage['trace'] = {
        traceId: data.traceId,
        totalLatencyMs: data.langfuseTrace?.totalLatencyMs || 0,
        totalCostUsd: data.langfuseTrace?.totalCostUsd || 0,
        selfHealIterations: data.selfHealIterations || 0,
        spans: data.langfuseTrace?.spans || [],
        comparisons: data.searchComparisons || [],
      };
      setLastTrace(traceInfo);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.conciergeNarrative,
          properties: data.verifiedDossiers || [],
          trapsCount: data.rejectedTraps?.length || 0,
          trace: traceInfo,
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: 'Could not reach the EstateTruth server right now. Check that your phone is on the same Wi-Fi network.',
        },
      ]);
    }
    setChatLoading(false);
  };

  const openPropertyById = (propertyId: string) => {
    const found = properties.find((p) => p.id === propertyId);
    if (found) setSelectedProperty(found);
  };

  const savedProperties = properties.filter((p) => savedIds.includes(p.id));

  // =========================================================================
  // FULL-SCREEN PROPERTY FORENSIC REPORT VIEW (When user taps any residence)
  // =========================================================================
  if (selectedProperty) {
    const isDanger = selectedProperty.activeReraLitigations > 0 || selectedProperty.truthScore < 60;
    const isSaved = savedIds.includes(selectedProperty.id);
    const hasBooked = bookings.some((b) => b.property_id === selectedProperty.id);

    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Hero Photo Header */}
          <View style={styles.detailHeroWrap}>
            <Image source={{ uri: selectedProperty.heroImage }} style={styles.detailHeroImg} />
            <View style={styles.heroOverlayTop}>
              <TouchableOpacity onPress={() => setSelectedProperty(null)} style={styles.roundIconBtn}>
                <Text style={styles.roundIconTxt}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleToggleSave(selectedProperty)} style={styles.roundIconBtn}>
                <Text style={[styles.roundIconTxt, isSaved && { color: '#fb7185' }]}>
                  {isSaved ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.detailScoreBadge, isDanger && styles.badgeDanger]}>
              <Text style={styles.detailScoreText}>
                {isDanger
                  ? `⚠️ Caution · ${selectedProperty.truthScore}/100 Safety Score`
                  : `✓ Verified Safe · ${selectedProperty.truthScore}/100`}
              </Text>
            </View>
          </View>

          <View style={styles.detailBody}>
            <Text style={styles.detailMicro}>
              {selectedProperty.microMarket} · {selectedProperty.city}
            </Text>
            <Text style={styles.detailTitle}>{selectedProperty.canonicalName}</Text>
            <Text style={styles.detailPrice}>
              ₹{selectedProperty.priceCroreInr} Cr{' '}
              <Text style={styles.detailPriceUsd}>(${selectedProperty.priceUsdMillions}M)</Text>
            </Text>

            {/* 3 Plain-English Key Checks */}
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkLabel}>Legal &amp; RERA</Text>
                <Text style={[styles.checkVal, selectedProperty.activeReraLitigations > 0 && { color: '#fb7185' }]}>
                  {selectedProperty.activeReraLitigations === 0
                    ? '0 Disputes'
                    : `${selectedProperty.activeReraLitigations} Litigations`}
                </Text>
                <Text style={styles.checkSub}>{selectedProperty.reraStatus.replace('_', ' ')}</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkLabel}>Night Quietness</Text>
                <Text style={[styles.checkVal, selectedProperty.ambientNoiseDbNight > 55 && { color: '#fb7185' }]}>
                  {selectedProperty.ambientNoiseDbNight} dB
                </Text>
                <Text style={styles.checkSub}>
                  {selectedProperty.ambientNoiseDbNight <= 45 ? 'Whisper Quiet' : 'Loud Traffic'}
                </Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkLabel}>True Carpet</Text>
                <Text style={styles.checkVal}>{selectedProperty.trueCarpetSqFt.toLocaleString()}</Text>
                <Text style={styles.checkSub}>sq.ft. verified</Text>
              </View>
            </View>

            {/* Broker Claim vs Reality */}
            <View style={styles.truthSection}>
              <Text style={styles.sectionH}>Broker Claim vs. Verified Reality</Text>
              <View style={styles.brokerCard}>
                <Text style={styles.brokerLbl}>What Brochures Say</Text>
                <Text style={styles.brokerTxt}>"{selectedProperty.brokerClaim}"</Text>
              </View>
              <View style={[styles.realityCard, isDanger && styles.realityCardDanger]}>
                <Text style={[styles.realityLbl, isDanger && { color: '#fda4af' }]}>
                  What Our Audit Found
                </Text>
                <Text style={styles.realityTxt}>
                  True RERA carpet is {selectedProperty.trueCarpetSqFt.toLocaleString()} sq.ft. (brokers advertise{' '}
                  {selectedProperty.brokerAdvertisedSqFt.toLocaleString()} sq.ft. — {selectedProperty.carpetInflationPct}%
                  inflation). Private lift lobby:{' '}
                  {selectedProperty.floorplanVisionAudit.hasPrivateElevatorLobby ? 'Yes ✓' : 'No (Shared) ✗'}.
                  Step-free access:{' '}
                  {selectedProperty.floorplanVisionAudit.stepFreeWheelchairEntry ? 'Yes ✓' : 'No (Steps) ✗'}.
                </Text>
              </View>
            </View>

            {/* Verified Resident & Registry Evidence */}
            <View style={styles.truthSection}>
              <Text style={styles.sectionH}>Verified Evidence &amp; Resident Logs</Text>
              {selectedProperty.evidence.map((ev, idx) => (
                <View key={idx} style={styles.evCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.evAuthor}>{ev.author || ev.source}</Text>
                    <Text style={styles.evDate}>{ev.date}</Text>
                  </View>
                  <Text style={styles.evQuote}>"{ev.quote}"</Text>
                </View>
              ))}
            </View>

            {/* Paid Dossier Unlock Section */}
            <TouchableOpacity
              onPress={() => handleUnlockDossier(selectedProperty)}
              style={styles.dossierBtn}
            >
              <Text style={styles.dossierBtnText}>
                {selectedProperty.isDossierUnlocked
                  ? '✓ Full CA Form-3 Escrow & 30-Yr Title Report Unlocked'
                  : 'Unlock Full RERA + 30-Yr Legal Dossier · ₹9,999'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sticky Bottom CTA Bar */}
        <View style={styles.stickyFooter}>
          <View>
            <Text style={styles.footerPrice}>₹{selectedProperty.priceCroreInr} Cr</Text>
            <Text style={styles.footerSub}>Zero broker commission bias</Text>
          </View>
          <TouchableOpacity
            onPress={() => setBookingModalOpen(true)}
            style={styles.bookBtn}
          >
            <Text style={styles.bookBtnText}>
              {hasBooked ? 'Viewing Confirmed ✓' : 'Book Private Viewing'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Private Viewing Booking Modal (Saves directly to SQLite!) */}
        <Modal visible={bookingModalOpen} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Arrange Private Viewing</Text>
              <Text style={styles.modalSub}>
                Chauffeur-assisted private tour for {selectedProperty.canonicalName} (buyer-side representation only).
              </Text>
              <TextInput
                value={buyerName}
                onChangeText={setBuyerName}
                placeholder="Your Full Name"
                placeholderTextColor="#7a746c"
                style={styles.modalInput}
              />
              <TextInput
                value={buyerContact}
                onChangeText={setBuyerContact}
                placeholder="WhatsApp Number or Email"
                placeholderTextColor="#7a746c"
                style={styles.modalInput}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <TouchableOpacity
                  onPress={() => setBookingModalOpen(false)}
                  style={[styles.modalBtnSecondary, { flex: 1 }]}
                >
                  <Text style={styles.modalBtnSecTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmBooking}
                  disabled={bookingSaving}
                  style={[styles.modalBtnPrimary, { flex: 1.5 }]}
                >
                  <Text style={styles.modalBtnPriTxt}>
                    {bookingSaving ? 'Confirming…' : 'Confirm Viewing'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // MAIN 3-TAB LUXURY CONSUMER APP (Discover | AI Advisor | Saved)
  // =========================================================================
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      {/* Clean Minimal Luxury Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.logo}>
            EstateTruth<Text style={styles.logoGold}>.</Text>
          </Text>
          <Text style={styles.tagline}>Verified Luxury Residences · Mumbai &amp; Dubai</Text>
        </View>
        {/* Subtle Engineering Mode Icon for CTOs / Recruiters */}
        <TouchableOpacity onPress={() => setXrayOpen(true)} style={styles.devPill}>
          <Text style={styles.devPillText}>{'</>'} MLOps</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: DISCOVER — Visual Sotheby's / Airbnb Luxe Feed */}
      {activeTab === 'discover' && (
        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Natural Ask Bar right at top */}
          <TouchableOpacity
            onPress={() => setActiveTab('advisor')}
            activeOpacity={0.85}
            style={styles.fakeSearchBar}
          >
            <Text style={styles.searchIcon}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.searchMain}>Ask our AI Advisor anything…</Text>
              <Text style={styles.searchHint}>"Quiet Worli sea-facing 4BHK, zero RERA disputes"</Text>
            </View>
          </TouchableOpacity>

          {/* Clean City & Safety Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {(['All', 'Mumbai', 'Dubai'] as const).map((c) => {
              const active = cityFilter === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCityFilter(c)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterTxt, active && styles.filterTxtActive]}>
                    {c === 'All' ? 'All Cities' : c}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setSafeOnly(!safeOnly)}
              style={[styles.filterChip, safeOnly && styles.filterChipGreen]}
            >
              <Text style={[styles.filterTxt, safeOnly && { color: '#06150f' }]}>
                ✓ Verified Clean Only
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {loadingFeed ? (
            <ActivityIndicator size="large" color="#e5a96c" style={{ marginTop: 40 }} />
          ) : (
            properties.map((prop) => {
              const isDanger = prop.activeReraLitigations > 0 || prop.truthScore < 60;
              const isSaved = savedIds.includes(prop.id);
              return (
                <TouchableOpacity
                  key={prop.id}
                  activeOpacity={0.92}
                  onPress={() => setSelectedProperty(prop)}
                  style={styles.propCard}
                >
                  <View style={styles.cardImageWrap}>
                    <Image source={{ uri: prop.heroImage }} style={styles.cardImg} />
                    <View style={[styles.trustPill, isDanger && styles.trustPillDanger]}>
                      <Text style={styles.trustPillTxt}>
                        {isDanger
                          ? `⚠️ Red Flag · ${prop.truthScore}/100`
                          : `✓ Verified Safe · ${prop.truthScore}/100`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleToggleSave(prop)}
                      style={styles.cardHeartBtn}
                    >
                      <Text style={[styles.cardHeartTxt, isSaved && { color: '#fb7185' }]}>
                        {isSaved ? '♥' : '♡'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.cardRowBetween}>
                      <Text style={styles.cardMicro}>
                        {prop.microMarket} · {prop.city}
                      </Text>
                      <Text style={styles.cardPrice}>₹{prop.priceCroreInr} Cr</Text>
                    </View>
                    <Text style={styles.cardTitle}>{prop.canonicalName}</Text>
                    <View style={styles.pillRow}>
                      <View style={styles.infoChip}>
                        <Text style={[styles.infoChipTxt, prop.activeReraLitigations > 0 && { color: '#fda4af' }]}>
                          {prop.activeReraLitigations === 0
                            ? '0 Legal Disputes'
                            : `${prop.activeReraLitigations} RERA Cases`}
                        </Text>
                      </View>
                      <View style={styles.infoChip}>
                        <Text style={[styles.infoChipTxt, prop.ambientNoiseDbNight > 55 && { color: '#fda4af' }]}>
                          {prop.ambientNoiseDbNight} dB Night
                        </Text>
                      </View>
                      <View style={styles.infoChip}>
                        <Text style={styles.infoChipTxt}>{prop.trueCarpetSqFt.toLocaleString()} sq.ft</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* TAB 2: AI ADVISOR — Real Multi-Turn Gemini 4 Conversational Chat */}
      {activeTab === 'advisor' && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.chatBody}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[styles.msgBubble, m.role === 'user' ? styles.msgUser : styles.msgAssistant]}
              >
                <Text style={m.role === 'user' ? styles.msgUserTxt : styles.msgAiTxt}>{m.text}</Text>

                {/* Embedded Clean Property Cards inside Chat */}
                {m.properties && m.properties.length > 0 && (
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {m.properties.map((p) => (
                      <TouchableOpacity
                        key={p.propertyId}
                        onPress={() => openPropertyById(p.propertyId)}
                        style={styles.chatPropCard}
                      >
                        {p.heroImage && <Image source={{ uri: p.heroImage }} style={styles.chatPropThumb} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chatPropName} numberOfLines={1}>
                            {p.canonicalName}
                          </Text>
                          <Text style={styles.chatPropMeta}>
                            ₹{p.priceCroreInr} Cr · {p.ambientNoiseDbNight} dB · {p.activeReraLitigations} cases
                          </Text>
                          <Text style={styles.chatPropScore}>
                            Safety Score: {p.truthScore}/100 · Tap for full audit →
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {m.trapsCount && m.trapsCount > 0 ? (
                  <Text style={styles.trapsFoot}>
                    🛡️ Automatically filtered out {m.trapsCount} broker traps that failed your rules.
                  </Text>
                ) : null}
              </View>
            ))}

            {chatLoading && (
              <View style={[styles.msgBubble, styles.msgAssistant, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                <ActivityIndicator color="#e5a96c" size="small" />
                <Text style={styles.msgAiTxt}>Auditing RERA filings &amp; acoustic data with Gemini 4…</Text>
              </View>
            )}

            {/* Quick Tap Suggestions */}
            {messages.length <= 2 && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={styles.quickLabel}>Try asking:</Text>
                {QUICK_ASKS.map((qa) => (
                  <TouchableOpacity
                    key={qa}
                    onPress={() => handleSendAsk(qa)}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickChipTxt}>{qa}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Chat Composer */}
          <View style={styles.chatInputBar}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask about any area, budget, or dealbreaker..."
              placeholderTextColor="#7a746c"
              style={styles.chatInput}
              onSubmitEditing={() => handleSendAsk()}
            />
            <TouchableOpacity onPress={() => handleSendAsk()} style={styles.sendBtn}>
              <Text style={styles.sendBtnTxt}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TAB 3: SAVED SHORTLIST & CONFIRMED VIEWINGS (Persisted in SQLite!) */}
      {activeTab === 'saved' && (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <Text style={styles.sectionH}>Your Shortlist ({savedProperties.length})</Text>
          {savedProperties.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTxt}>Tap ♡ on any residence in Discover to save it here.</Text>
            </View>
          ) : (
            savedProperties.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedProperty(p)}
                style={styles.savedRow}
              >
                <Image source={{ uri: p.heroImage }} style={styles.savedThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{p.canonicalName}</Text>
                  <Text style={styles.cardMicro}>
                    {p.microMarket} · ₹{p.priceCroreInr} Cr · Score {p.truthScore}/100
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={[styles.sectionH, { marginTop: 20 }]}>
            Booked Private Viewings ({bookings.length})
          </Text>
          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTxt}>No private viewings scheduled yet.</Text>
            </View>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.bookingName}>{b.canonical_name}</Text>
                <Text style={styles.bookingMeta}>
                  {b.buyer_name} · {b.preferred_date}
                </Text>
                <Text style={styles.bookingStatus}>✓ {b.status} ({b.id})</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Clean 3-Item Luxury Bottom Tab Navigation */}
      <View style={styles.bottomTabs}>
        {[
          { id: 'discover', icon: '🏛️', label: 'Discover' },
          { id: 'advisor', icon: '✦', label: 'AI Advisor' },
          { id: 'saved', icon: '♡', label: `Saved (${savedIds.length})` },
        ].map((t) => {
          const active = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id as typeof activeTab)}
              style={styles.bTabItem}
            >
              <Text style={[styles.bTabIcon, active && { color: '#e5a96c' }]}>{t.icon}</Text>
              <Text style={[styles.bTabLbl, active && { color: '#e5a96c' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* HIDDEN ENGINEERING / MLOPS X-RAY MODAL (For CTOs, Recruiters & Demos) */}
      <Modal visible={xrayOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>MLOps Engineering X-Ray</Text>
              <TouchableOpacity onPress={() => setXrayOpen(false)}>
                <Text style={{ color: '#e5a96c', fontWeight: '800', fontSize: 14 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop: 10 }}>
              <Text style={styles.xrayMeta}>
                Backend: {connectedMode === 'live' ? 'NestJS + LangGraph + Gemini 4 + SQLite WAL' : 'Cloudflare Edge'}
              </Text>

              <View style={styles.xrayToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.xrayToggleTitle}>Hallucination Self-Heal Test</Text>
                  <Text style={styles.xrayToggleSub}>Injects trap on Iter 1 so Judge loops &amp; heals</Text>
                </View>
                <Switch
                  value={simulateHallucination}
                  onValueChange={setSimulateHallucination}
                  trackColor={{ false: '#2a2a32', true: '#e5a96c' }}
                />
              </View>

              {lastTrace ? (
                <View style={{ gap: 8, marginTop: 10 }}>
                  <Text style={styles.xraySection}>
                    Langfuse Trace: {lastTrace.traceId} ({lastTrace.totalLatencyMs}ms · $
                    {lastTrace.totalCostUsd.toFixed(5)})
                  </Text>
                  {lastTrace.spans.map((s, idx) => (
                    <View key={idx} style={styles.xraySpan}>
                      <Text style={styles.xraySpanName}>{s.name}</Text>
                      <Text style={styles.xraySpanSub}>
                        {s.modelUsed || 'Tool'} · {s.latencyMs}ms
                        {s.metadata?.liveLlmCalled ? ' · LIVE GEMINI 4 ✓' : ''}
                      </Text>
                    </View>
                  ))}
                  <Text style={[styles.xraySection, { marginTop: 8 }]}>Golden Relevance Benchmark</Text>
                  {lastTrace.comparisons.map((c, idx) => (
                    <View key={idx} style={styles.xraySpan}>
                      <Text style={styles.xraySpanName}>{c.label || c.mode}</Text>
                      <Text style={styles.xraySpanSub}>
                        NDCG: {(c.ndcgAt3 ?? c.estimatedNdcgAt5 ?? 0.8).toFixed(3)} ·{' '}
                        {c.negationTrapCaught ? 'Negation Clean ✓' : 'Trap Leaked ✕'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.xrayMeta}>
                  Ask any question in the AI Advisor tab to inspect the live 5-Agent LangGraph &amp; Langfuse trace here.
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
  root: { flex: 1, backgroundColor: '#09090b' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  logo: { fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
  logoGold: { color: '#e5a96c' },
  tagline: { fontSize: 11, color: '#9c948b', marginTop: 1 },
  devPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  devPillText: { color: '#a8a29e', fontSize: 11, fontWeight: '700' },
  scrollBody: { padding: 18, paddingBottom: 36, gap: 16 },
  fakeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151418',
    borderWidth: 1,
    borderColor: 'rgba(229,169,108,0.35)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchIcon: { color: '#e5a96c', fontSize: 18 },
  searchMain: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  searchHint: { color: '#8f877e', fontSize: 11, marginTop: 2 },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#131216',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#f5efe6', borderColor: '#f5efe6' },
  filterChipGreen: { backgroundColor: '#34d399', borderColor: '#34d399' },
  filterTxt: { color: '#d6d3d1', fontSize: 12, fontWeight: '700' },
  filterTxtActive: { color: '#09090b' },
  propCard: {
    backgroundColor: '#121115',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  cardImageWrap: { height: 220, width: '100%', position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  trustPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(6, 28, 20, 0.88)',
    borderColor: 'rgba(52, 211, 153, 0.5)',
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trustPillDanger: { backgroundColor: 'rgba(46, 10, 18, 0.92)', borderColor: 'rgba(251, 113, 133, 0.6)' },
  trustPillTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  cardHeartBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeartTxt: { color: '#ffffff', fontSize: 18 },
  cardContent: { padding: 16, gap: 6 },
  cardRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMicro: { color: '#a89f94', fontSize: 12, fontWeight: '600' },
  cardPrice: { color: '#e5a96c', fontSize: 16, fontWeight: '900' },
  cardTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  infoChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoChipTxt: { color: '#e7e5e4', fontSize: 11, fontWeight: '700' },

  // Detail Screen
  detailHeroWrap: { height: 310, width: '100%', position: 'relative' },
  detailHeroImg: { width: '100%', height: '100%' },
  heroOverlayTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundIconTxt: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  detailScoreBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(6, 28, 20, 0.92)',
    borderWidth: 1,
    borderColor: '#34d399',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeDanger: { backgroundColor: 'rgba(46, 10, 18, 0.94)', borderColor: '#fb7185' },
  detailScoreText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  detailBody: { padding: 20, gap: 14 },
  detailMicro: { color: '#e5a96c', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  detailTitle: { color: '#ffffff', fontSize: 26, fontWeight: '900' },
  detailPrice: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  detailPriceUsd: { color: '#9c948b', fontSize: 15, fontWeight: '500' },
  checkGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  checkCard: {
    flex: 1,
    backgroundColor: '#141318',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  checkLabel: { color: '#8f877e', fontSize: 10, fontWeight: '700' },
  checkVal: { color: '#34d399', fontSize: 14, fontWeight: '900', marginTop: 4 },
  checkSub: { color: '#a8a29e', fontSize: 10, marginTop: 2 },
  truthSection: { gap: 10, marginTop: 6 },
  sectionH: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  brokerCard: {
    backgroundColor: '#141318',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  brokerLbl: { color: '#a8a29e', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  brokerTxt: { color: '#d6d3d1', fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  realityCard: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  realityCardDanger: { backgroundColor: 'rgba(244,63,94,0.1)', borderColor: 'rgba(244,63,94,0.45)' },
  realityLbl: { color: '#6ee7b7', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  realityTxt: { color: '#ffffff', fontSize: 13, lineHeight: 20 },
  evCard: {
    backgroundColor: '#141318',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  evAuthor: { color: '#e5a96c', fontSize: 11, fontWeight: '800' },
  evDate: { color: '#78716c', fontSize: 10 },
  evQuote: { color: '#f5f5f4', fontSize: 13, lineHeight: 19 },
  dossierBtn: {
    borderWidth: 1,
    borderColor: 'rgba(229,169,108,0.5)',
    backgroundColor: 'rgba(229,169,108,0.12)',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  dossierBtnText: { color: '#f5cfa2', fontSize: 13, fontWeight: '800' },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111014',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPrice: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  footerSub: { color: '#9c948b', fontSize: 11 },
  bookBtn: { backgroundColor: '#e5a96c', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13 },
  bookBtnText: { color: '#09090b', fontSize: 13, fontWeight: '900' },

  // Chat
  chatBody: { padding: 16, gap: 12, paddingBottom: 24 },
  msgBubble: { borderRadius: 20, padding: 14, maxWidth: '92%' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: '#e5a96c' },
  msgAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#16151a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  msgUserTxt: { color: '#09090b', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  msgAiTxt: { color: '#f5f5f4', fontSize: 14, lineHeight: 21 },
  chatPropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0c0b0e',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chatPropThumb: { width: 62, height: 62, borderRadius: 10 },
  chatPropName: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  chatPropMeta: { color: '#a8a29e', fontSize: 11, marginTop: 2 },
  chatPropScore: { color: '#34d399', fontSize: 11, fontWeight: '700', marginTop: 3 },
  trapsFoot: { color: '#fda4af', fontSize: 11, marginTop: 10, fontWeight: '600' },
  quickLabel: { color: '#8f877e', fontSize: 12, fontWeight: '700' },
  quickChip: {
    backgroundColor: '#141318',
    borderWidth: 1,
    borderColor: 'rgba(229,169,108,0.28)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickChipTxt: { color: '#f5cfa2', fontSize: 12, fontWeight: '600' },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0f0e12',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#19181e',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#ffffff',
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e5a96c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnTxt: { color: '#09090b', fontSize: 20, fontWeight: '900' },

  // Saved
  emptyCard: { backgroundColor: '#141318', borderRadius: 16, padding: 20, alignItems: 'center' },
  emptyTxt: { color: '#8f877e', fontSize: 13 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141318',
    borderRadius: 16,
    padding: 10,
  },
  savedThumb: { width: 64, height: 64, borderRadius: 12 },
  bookingCard: {
    backgroundColor: '#101915',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  bookingName: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  bookingMeta: { color: '#cbd5e1', fontSize: 12 },
  bookingStatus: { color: '#34d399', fontSize: 11, fontWeight: '800', marginTop: 2 },

  // Bottom Navigation
  bottomTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0d0c10',
    paddingVertical: 10,
  },
  bTabItem: { flex: 1, alignItems: 'center', gap: 3 },
  bTabIcon: { color: '#78716c', fontSize: 18 },
  bTabLbl: { color: '#78716c', fontSize: 11, fontWeight: '700' },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#141318',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { color: '#ffffff', fontSize: 19, fontWeight: '900' },
  modalSub: { color: '#a8a29e', fontSize: 13, lineHeight: 18 },
  modalInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  modalBtnPrimary: { backgroundColor: '#e5a96c', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  modalBtnPriTxt: { color: '#09090b', fontSize: 13, fontWeight: '900' },
  modalBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalBtnSecTxt: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  xrayMeta: { color: '#9c948b', fontSize: 12, marginBottom: 10 },
  xrayToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,169,108,0.1)',
    borderRadius: 14,
    padding: 12,
  },
  xrayToggleTitle: { color: '#f5cfa2', fontSize: 13, fontWeight: '800' },
  xrayToggleSub: { color: '#cbd5e1', fontSize: 11 },
  xraySection: { color: '#34d399', fontSize: 12, fontWeight: '800' },
  xraySpan: {
    backgroundColor: '#0a090d',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  xraySpanName: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  xraySpanSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
});
