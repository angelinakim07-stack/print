import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { PRIORITY_META, STATUS_META } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------
export function StatusChip({ status, testID }: { status?: string; testID?: string }) {
  const { colors } = useTheme();
  const meta = STATUS_META[status || "DRAFT"] || STATUS_META.DRAFT;
  return (
    <View style={{ backgroundColor: colors[meta.bg], borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }} testID={testID}>
      <Text style={{ color: colors[meta.text], fontSize: 12, fontWeight: "700" }}>{meta.label}</Text>
    </View>
  );
}

export function PriorityChip({ priority }: { priority?: string }) {
  const { colors } = useTheme();
  const meta = PRIORITY_META[priority || "Normal"] || PRIORITY_META.Normal;
  return (
    <View style={{ backgroundColor: colors[meta.bg], borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: colors[meta.text], fontSize: 11, fontWeight: "700" }}>{meta.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export function AppButton({
  title, onPress, variant = "primary", loading, disabled, icon, testID, style,
}: {
  title: string; onPress?: () => void; variant?: BtnVariant; loading?: boolean; disabled?: boolean;
  icon?: any; testID?: string; style?: any;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const map: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary },
    secondary: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
    outline: { bg: "transparent", fg: colors.brandPrimary, border: colors.brandPrimary },
    danger: { bg: colors.error, fg: colors.onError },
    ghost: { bg: "transparent", fg: colors.onSurface },
  };
  const c = map[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.bg, borderColor: c.border || "transparent", borderWidth: c.border ? 1.5 : 0, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Icon name={icon} size={18} color={c.fg} />}
          <Text style={[styles.btnText, { color: c.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card / Section
// ---------------------------------------------------------------------------
export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: any; onPress?: () => void; testID?: string }) {
  const styles = useStyles();
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.9 }]}>
        {children}
      </Pressable>
    );
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function KeyVal({ label, value }: { label: string; value?: any }) {
  const styles = useStyles();
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value === undefined || value === null || value === "" ? "—" : String(value)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export function Field({
  label, required, error, hint, ...props
}: { label?: string; required?: boolean; error?: string; hint?: string } & TextInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={{ color: colors.error }}>*</Text>}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error && { borderColor: colors.error }]}
        {...props}
      />
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function SelectField({
  label, required, value, options, onChange, placeholder, error, testID,
}: {
  label?: string; required?: boolean; value?: string; options: string[];
  onChange: (v: string) => void; placeholder?: string; error?: string; testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={{ color: colors.error }}>*</Text>}
        </Text>
      )}
      <Pressable testID={testID} onPress={() => setOpen(true)} style={[styles.input, styles.selectRow, error && { borderColor: colors.error }]}>
        <Text style={{ color: value ? colors.onSurface : colors.muted, fontSize: 15 }}>{value || placeholder || "Select"}</Text>
        <Icon name="chevron-down" size={20} color={colors.muted} />
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Sheet open={open} onClose={() => setOpen(false)} title={label || "Select"}>
        <ScrollView style={{ maxHeight: 360 }}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onChange(opt); setOpen(false); }}
              style={styles.optionRow}
            >
              <Text style={{ color: colors.onSurface, fontSize: 16 }}>{opt}</Text>
              {value === opt && <Icon name="check" size={20} color={colors.brandPrimary} />}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

export function DateField({
  label, required, value, onChange, mode = "date", error, testID,
}: { label?: string; required?: boolean; value?: string; onChange: (v: string) => void; mode?: "date" | "datetime"; error?: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [show, setShow] = React.useState(false);

  if (Platform.OS === "web") {
    return (
      <Field
        label={label}
        required={required}
        placeholder={mode === "datetime" ? "YYYY-MM-DDTHH:MM" : "YYYY-MM-DD"}
        value={value}
        onChangeText={onChange}
        error={error}
        testID={testID}
      />
    );
  }

  const display = value ? new Date(value).toLocaleString() : "";
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={{ color: colors.error }}>*</Text>}
        </Text>
      )}
      <Pressable testID={testID} onPress={() => setShow(true)} style={[styles.input, styles.selectRow, error && { borderColor: colors.error }]}>
        <Text style={{ color: value ? colors.onSurface : colors.muted, fontSize: 15 }}>{display || "Select date"}</Text>
        <Icon name="calendar" size={20} color={colors.muted} />
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {show && (
        (() => {
          const DateTimePicker = require("@react-native-community/datetimepicker").default;
          return (
            <DateTimePicker
              value={value ? new Date(value) : new Date()}
              mode="date"
              onChange={(_e: any, d?: Date) => {
                setShow(false);
                if (d) onChange(mode === "datetime" ? d.toISOString() : d.toISOString().slice(0, 10));
              }}
            />
          );
        })()
      )}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={[styles.checkbox, value && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
        {value && <Icon name="check" size={16} color={colors.onBrandPrimary} />}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Segmented control (scrollable)
// ---------------------------------------------------------------------------
export function Segmented({
  options, value, onChange, testID,
}: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }} testID={testID}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flexShrink: 0, height: 36, justifyContent: "center", paddingHorizontal: spacing.lg,
              borderRadius: radius.pill, borderWidth: 1,
              backgroundColor: active ? colors.brandPrimary : colors.surface,
              borderColor: active ? colors.brandPrimary : colors.border,
            }}
          >
            <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary, fontWeight: "600", fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Sheet (bottom modal)
// ---------------------------------------------------------------------------
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.sheetHandle} />
        {title && (
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} testID="sheet-close">
              <Icon name="close" size={22} />
            </Pressable>
          </View>
        )}
        {children}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export function LoadingView({ text }: { text?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }} testID="loading-view">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      {text && <Text style={{ marginTop: spacing.md, color: colors.muted }}>{text}</Text>}
    </View>
  );
}

export function EmptyState({ title, subtitle, icon = "inbox-outline" }: { title: string; subtitle?: string; icon?: any }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing["2xl"], gap: spacing.sm }} testID="empty-state">
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={30} color={colors.muted} />
      </View>
      <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700", marginTop: spacing.sm }}>{title}</Text>
      {subtitle && <Text style={{ color: colors.muted, textAlign: "center" }}>{subtitle}</Text>}
    </View>
  );
}

export function ErrorView({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }} testID="error-view">
      <Icon name="alert-circle-outline" size={40} color={colors.error} />
      <Text style={{ color: colors.onSurface, textAlign: "center" }}>{message || "Something went wrong."}</Text>
      {onRetry && <AppButton title="Retry" variant="outline" onPress={onRetry} icon="refresh" />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header (sticky, safe-area aware)
// ---------------------------------------------------------------------------
export function AppHeader({
  title, subtitle, back, right,
}: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        {back && (
          <Pressable onPress={() => router.back()} hitSlop={10} testID="header-back" style={{ marginRight: spacing.sm }}>
            <Icon name="chevron-left" size={26} color={colors.onSurface} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    </View>
  );
}

export function HeroHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height: 150 + insets.top }}>
      <Image
        source={{ uri: "https://images.pexels.com/photos/1555199/pexels-photo-1555199.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(11,43,94,0.55)", "rgba(11,43,94,0.92)"]}
        style={{ flex: 1, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, justifyContent: "flex-end", paddingBottom: spacing.lg }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            {subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
            <Text style={styles.heroTitle}>{title}</Text>
          </View>
          {right}
        </View>
      </LinearGradient>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: { minHeight: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontSize: 15, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm },
  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: spacing.lg },
  kvLabel: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  kvValue: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 13, fontSize: 15, color: colors.onSurface, borderWidth: 1, borderColor: colors.border,
    minHeight: 48,
  },
  selectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  toggleLabel: { flex: 1, color: colors.onSurface, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: "85%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  headerSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  heroSubtitle: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.85)", marginBottom: 2 },
}));
