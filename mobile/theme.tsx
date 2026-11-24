import React, { createContext, useContext, type ReactNode } from "react";

export const theme = {
  colors: {
    primary: "#1D4ED8", primarySoft: "#EFF6FF", primaryTint: "#DBEAFE",
    background: "#F8FAFC", surface: "#FFFFFF", text: "#1E293B", textSecondary: "#64748B",
    textMuted: "#94A3B8", border: "#E2E8F0", borderStrong: "#CBD5E1",
    success: "#15803D", successSoft: "#DCFCE7", warning: "#B45309", warningSoft: "#FEF3C7",
    danger: "#B91C1C", dangerSoft: "#FEF2F2", dangerBorder: "#FECACA", slateSoft: "#E2E8F0", white: "#FFFFFF",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, page: 20, section: 16, card: 18 },
  radii: { sm: 8, md: 12, lg: 16, xl: 18, xxl: 24, pill: 999 },
  typography: {
    eyebrow: { fontSize: 10, fontWeight: "900" as const, letterSpacing: 1.6 },
    pageTitle: { fontSize: 29, lineHeight: 36, fontWeight: "800" as const, letterSpacing: -0.65 },
    sectionTitle: { fontSize: 17, fontWeight: "800" as const }, body: { fontSize: 13, lineHeight: 20 },
    small: { fontSize: 11 }, button: { fontSize: 14, fontWeight: "800" as const },
  },
  shadows: {
    card: { shadowColor: "#0F172A", shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    button: { shadowColor: "#1D4ED8", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  },
} as const;
type Theme = typeof theme;
const ThemeContext = createContext<Theme>(theme);
export function ThemeProvider({ children }: { children: ReactNode }) { return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>; }
export function useTheme() { return useContext(ThemeContext); }
