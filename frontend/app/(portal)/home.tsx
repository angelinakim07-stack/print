import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { useDashboard, useOrders } from "@/src/api/hooks";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { OrderCard } from "@/src/components/OrderCard";
import { AppButton, EmptyState, HeroHeader, LoadingView, SectionTitle } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function PortalHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useDashboard();
  const orders = useOrders({});

  const tiles = [
    { key: "my_requests", label: "My Requests", icon: "file-document-outline" },
    { key: "my_orders", label: "My Orders", icon: "package-variant" },
    { key: "in_production", label: "In Production", icon: "factory" },
    { key: "ready_for_dispatch", label: "Ready", icon: "truck-check-outline" },
  ];

  return (
    <View style={styles.screen}>
      <HeroHeader title={user?.company || user?.name || "Welcome"} subtitle="PRINT PACK INC Portal" />
      {isLoading ? <LoadingView /> : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.grid}>
            {tiles.map((t) => (
              <View key={t.key} style={styles.tile}>
                <Icon name={t.icon as any} size={22} color={colors.brandPrimary} />
                <Text style={styles.tileValue}>{data?.tiles?.[t.key] ?? 0}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </View>
            ))}
          </View>

          <AppButton title="New Request" icon="plus" onPress={() => router.push("/(portal)/new-request")} testID="portal-new-request" />

          <SectionTitle>My Orders</SectionTitle>
          {orders.data?.items?.length ? orders.data.items.map((o: any) => <OrderCard key={o.id} order={o} />) : (
            <EmptyState title="No orders yet" subtitle="Your orders will appear here once created." icon="package-variant-closed" />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  tile: { width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  tileValue: { fontSize: 26, fontWeight: "900", color: colors.onSurface, marginTop: 4 },
  tileLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
}));
