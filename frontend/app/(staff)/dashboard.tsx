import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { OrderCard } from "@/src/components/OrderCard";
import { Card, EmptyState, ErrorView, LoadingView, SectionTitle } from "@/src/components/ui";
import { useDashboard, useUnreadCount } from "@/src/api/hooks";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TILES: { key: string; label: string; icon: string; status?: string; color: string }[] = [
  { key: "active_jobs", label: "Active Jobs", icon: "briefcase-outline", color: "brandPrimary" },
  { key: "awaiting_approval", label: "Awaiting Approval", icon: "clipboard-check-outline", status: "UNDER_CHECKING", color: "warning" },
  { key: "corrections_pending", label: "Corrections", icon: "alert-circle-outline", status: "CORRECTION_REQUIRED", color: "error" },
  { key: "in_production", label: "In Production", icon: "factory", status: "IN_PRODUCTION", color: "info" },
  { key: "qc_pending", label: "QC Pending", icon: "magnify-scan", status: "QC", color: "info" },
  { key: "ready_for_dispatch", label: "Ready to Dispatch", icon: "truck-check-outline", status: "READY_FOR_DISPATCH", color: "success" },
  { key: "billing_pending", label: "Billing Pending", icon: "receipt-text-outline", status: "DISPATCHED", color: "warning" },
  { key: "delayed_jobs", label: "Delayed Jobs", icon: "clock-alert-outline", color: "error" },
];

const PORTAL_TILES = [
  { key: "my_requests", label: "My Requests", icon: "file-document-outline", color: "brandPrimary" },
  { key: "my_orders", label: "My Orders", icon: "package-variant", color: "info" },
  { key: "in_production", label: "In Production", icon: "factory", color: "warning" },
  { key: "ready_for_dispatch", label: "Ready to Dispatch", icon: "truck-check-outline", color: "success" },
];

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useDashboard();
  const unread = useUnreadCount();

  const tiles = user && ["Customer", "Vendor"].includes(user.role) ? PORTAL_TILES : TILES;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hello, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.role}>{user?.role} · PRINT PACK INC</Text>
        </View>
        <Pressable onPress={() => router.push("/notifications")} style={styles.bell} testID="dashboard-bell">
          <Icon name="bell-outline" size={24} color={colors.onSurface} />
          {!!unread.data?.unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread.data.unread > 9 ? "9+" : unread.data.unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.grid}>
            {tiles.map((t) => (
              <Pressable
                key={t.key}
                style={styles.tile}
                testID={`kpi-${t.key}`}
                onPress={() => t.status && router.push(`/(staff)/orders?status=${t.status}`)}
              >
                <View style={[styles.tileIcon, { backgroundColor: (colors as any)[t.color] + "1A" }]}>
                  <Icon name={t.icon as any} size={22} color={(colors as any)[t.color]} />
                </View>
                <Text style={styles.tileValue}>{data?.tiles?.[t.key] ?? 0}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {!!data?.workload?.length && (
            <>
              <SectionTitle>Employee Workload</SectionTitle>
              <Card style={{ gap: spacing.sm }}>
                {data.workload.map((w: any, i: number) => (
                  <View key={i} style={styles.workRow}>
                    <Text style={styles.workName}>{w.employee}</Text>
                    <View style={styles.workBadge}>
                      <Text style={styles.workCount}>{w.count} jobs</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Recent Activity</SectionTitle>
          {data?.recent?.length ? (
            data.recent.map((o: any) => <OrderCard key={o.id} order={o} testID={`recent-${o.id}`} />)
          ) : (
            <EmptyState title="No activity yet" subtitle="Orders you work on will appear here." icon="clipboard-text-outline" />
          )}

          {!!data?.updated_at && (
            <Text style={styles.updated}>Updated {new Date(data.updated_at).toLocaleTimeString()}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  hello: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  role: { fontSize: 13, color: colors.muted, marginTop: 2 },
  bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 6, right: 4, backgroundColor: colors.error, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.onError, fontSize: 10, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.md },
  tile: { width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 6 },
  tileIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileValue: { fontSize: 26, fontWeight: "900", color: colors.onSurface, marginTop: 4 },
  tileLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  workRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  workName: { fontSize: 14, color: colors.onSurface, fontWeight: "600" },
  workBadge: { backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  workCount: { fontSize: 12, color: colors.onBrandTertiary, fontWeight: "700" },
  updated: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.lg },
}));
