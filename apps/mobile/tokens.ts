/**
 * EstateTruth — Single Source of Truth Cross-Platform Design Tokens
 * Aesthetic: Airbnb Design Language System (DLS) — Pure White, Rausch Coral,
 * Warm Charcoal Ink, Soft Ambient Shadows, Pill Search & High-Trust Photo Cards.
 * Shared identically across Web (React) and Mobile (Expo SDK 58 React Native).
 */
export const ESTATETRUTH_TOKENS = {
  colors: {
    canvas: '#FFFFFF',         // Pure Crisp White Airbnb Canvas
    surface: '#FFFFFF',        // Elevated White Card Surface
    surfaceMuted: '#F7F7F7',   // Soft Neutral Well / Pill Fill
    ink: '#222222',            // Primary Warm Charcoal (Airbnb Hof)
    inkSecondary: '#484848',   // Secondary Body Charcoal
    inkMuted: '#717171',       // Muted Caption Gray (Airbnb Foggy)
    hairline: '#EBEBEB',       // Crisp 1px Section Divider
    border: '#DDDDDD',         // Interactive Card & Input Border
    borderDark: '#B0B0B0',     // Active / Form Input Border
    rausch: '#FF385C',         // Signature Airbnb Rausch Coral
    rauschDark: '#E31C5F',     // Pressed / Gradient End Coral
    rauschTint: '#FFF0F3',     // Subtle Rausch Highlight Wash
    verified: '#008A05',       // Verified Clean / Zero Litigation Green
    verifiedTint: '#EDF7ED',   // Soft Verified Wash
    danger: '#C13515',         // Red Flag / RERA Risk Crimson
    dangerTint: '#FFF5F3',     // Soft Alert Wash
    warning: '#E07912',        // Moderate Caution Amber
    darkBar: '#222222',        // High-Contrast Button / Badge Surface
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 9999,
  },
  spacing: {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 28,
    xl: 40,
  },
  typography: {
    sansRegular: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
  },
} as const;
