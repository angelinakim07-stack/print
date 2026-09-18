import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { apiGet, BASE, getAccessToken } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import { AppButton, AppHeader, Card, LoadingView } from "@/src/components/ui";
import { OrderCard } from "@/src/components/OrderCard";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const REPORTS = [
  { key: "pending", label: "Pending Orders", icon: "clipboard-text-clock-outline" },
  { key: "delayed", label: "Delayed Jobs", icon: "clock-alert-outline" },
  { key: "production", label: "Production", icon: "factory" },
  { key: "qc", label: "QC", icon: "magnify-scan" },
  { key: "dispatch", label: "Dispatch", icon: "truck-outline" },
  { key: "billing", label: "Billing", icon: "receipt-text-outline" },
];

export default function Reports() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { user, can } = useAuth();
  const [type, setType] = useState("pending");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async (t: string) => {
    setType(t); setLoading(true);
    try { setData(await apiGet(`/reports/${t}`)); } catch (e: any) { toast(e.message, "error"); } finally { setLoading(false); }
  };

  const exportCsv = () => {
    const canExport = ["Admin", "Manager"].includes(user?.role || "") || can("export_reports");
    if (!canExport) { toast("You don't have export permission", "error"); return; }
    Linking.openURL(`${BASE}/reports/export/csv?report_type=${type}&token=${encodeURIComponent(getAccessToken() || "")}`);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Reports" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}>
        <View style={styles.grid}>
          {REPORTS.map((r) => (
            <Pressable key={r.key} onPress={() => load(r.key)} style={[styles.chip, type === r.key && styles.chipActive]} testID={`report-${r.key}`}>
              <Icon name={r.icon as any} size={18} color={type === r.key ? colors.onBrandPrimary : colors.brandPrimary} />
              <Text style={[styles.chipText, type === r.key && { color: colors.onBrandPrimary }]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? <LoadingView /> : data ? (
          <>
            <Card style={styles.summary}>
              <Text style={styles.count}>{data.count}</Text>
              <Text style={styles.countLabel}>records in {REPORTS.find((r) => r.key === type)?.label}</Text>
            </Card>
            <AppButton title="Export CSV" icon="download" variant="outline" onPress={exportCsv} testID="export-csv" />
            <View style={{ height: spacing.md }} />
            {data.items.map((o: any) => <OrderCard key={o.id} order={o} />)}
          </>
        ) : (
          <Text style={styles.hint}>Select a report above to view a summary.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  summary: { alignItems: "center", marginBottom: spacing.md },
  count: { fontSize: 40, fontWeight: "900", color: colors.brand },
  countLabel: { color: colors.muted, fontSize: 13 },
  hint: { color: colors.muted, textAlign: "center", marginTop: spacing.xl },
}));
