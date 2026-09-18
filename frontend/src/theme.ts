// Design tokens for PRINT PACK INC. Navy-led industrial palette, light theme.
//
// Keys match the "color" block of /app/design_guidelines.json. Build sheets
// with makeStyles((colors) => ...) and read useTheme().colors for color props.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0F172A",
  surfaceSecondary: "#F8FAFC",
  onSurfaceSecondary: "#1E293B",
  surfaceTertiary: "#F1F5F9",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B",

  brand: "#0B2B5E",
  onBrand: "#FFFFFF",
  brandPrimary: "#1D4ED8",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3B82F6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#EFF6FF",
  onBrandTertiary: "#1D4ED8",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#0284C7",
  onInfo: "#FFFFFF",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",

  // Workflow status chips (bg + text)
  status_draft_bg: "#F1F5F9", status_draft_text: "#475569",
  status_new_bg: "#E0F2FE", status_new_text: "#0284C7",
  status_under_checking_bg: "#FEF3C7", status_under_checking_text: "#D97706",
  status_correction_bg: "#FEE2E2", status_correction_text: "#DC2626",
  status_approved_bg: "#DCFCE7", status_approved_text: "#16A34A",
  status_in_production_bg: "#FFEDD5", status_in_production_text: "#EA580C",
  status_qc_bg: "#CCFBF1", status_qc_text: "#0D9488",
  status_ready_dispatch_bg: "#D1FAE5", status_ready_dispatch_text: "#059669",
  status_dispatched_bg: "#CFFAFE", status_dispatched_text: "#0891B2",
  status_billed_bg: "#ECFCCB", status_billed_text: "#65A30D",
  status_closed_bg: "#F8FAFC", status_closed_text: "#94A3B8",

  priority_normal_bg: "#F1F5F9", priority_normal_text: "#475569",
  priority_urgent_bg: "#FFEDD5", priority_urgent_text: "#EA580C",
  priority_very_urgent_bg: "#FEE2E2", priority_very_urgent_text: "#DC2626",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const font = {
  sizes: { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 },
} as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
