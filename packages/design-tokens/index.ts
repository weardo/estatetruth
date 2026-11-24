/**
 * EstateTruth — Single Source of Truth Cross-Platform Design Tokens
 * Aesthetic: Aman Resorts Editorial Alabaster × CRED Tactile Mechanical Precision
 * Shared identically across Web (React) and Mobile (Expo React Native).
 */
export const ESTATETRUTH_TOKENS = {
  colors: {
    canvas: '#F4F0E8',         // Warm Museum Alabaster (replaces dark AI-slop SaaS)
    surface: '#FAF8F3',        // Ivory Vellum card / ledger surface
    surfaceMuted: '#EAE4D8',   // Recessed Parchment for spec wells
    ink: '#141311',            // Primary Deep Espresso Ink
    inkSecondary: '#5C574F',   // Muted Architectural Stone
    inkMuted: '#8B8479',       // Hairline captions & lot metadata
    hairline: '#D6CFC2',       // 1px editorial rule
    inkBorder: '#141311',      // Sharp Neo-Editorial mechanical border
    brass: '#9A7B4F',          // Brushed Antique Brass (lot numbers & active accents)
    forest: '#1B4D3E',         // Verified Clean Ink
    forestTint: '#E6EFEA',     // Quiet Verified wash
    oxblood: '#8C2323',        // Red Flag / Litigation Ink
    oxbloodTint: '#F5E6E6',    // Quiet Red Flag wash
    vaultBg: '#141311',        // High-contrast tactile Obsidian footer / advisor accent
    vaultText: '#F4F0E8',      // Crisp Alabaster on Obsidian
  },
  radii: {
    none: 0,                   // Architectural 0px frames for photos & ledger sheets
    hair: 2,                   // Subtle mechanical press button bevel
  },
  spacing: {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 28,
    xl: 40,
  },
  typography: {
    serifRegular: 'CormorantGaramond_400Regular',
    serifMedium: 'CormorantGaramond_500Medium',
    serifSemiBold: 'CormorantGaramond_600SemiBold',
    serifItalic: 'CormorantGaramond_500Medium_Italic',
    sansRegular: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
  },
} as const;
