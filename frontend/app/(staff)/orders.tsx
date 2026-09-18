import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOrders } from "@/src/api/hooks";
import { Icon } from "@/src/components/Icon";
import { OrderCard } from "@/src/components/OrderCard";
import { AppHeader, EmptyState, ErrorView, LoadingView, Segmented } from "@/src/components/ui";
import { STATUS_META } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FILTERS = [
  { key: "", label: "All" },
  ...Object.entries(STATUS_META).map(([key, m]) => ({ key, label: m.label })),
];

export default function Orders() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState(params.status || "");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch, isRefetching } = useOrders({ status: status || undefined, q: search || undefined });

  return (
    <View style={styles.screen}>
      <AppHeader title="Orders" subtitle={`${data?.total ?? 0} total`} />
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <TextInput
            placeholder="Search job, customer, product"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            testID="orders-search"
          />
        </View>
      </View>
      <View style={styles.chips}>
        <Segmented options={FILTERS} value={status} onChange={setStatus} testID="order-filter-chips" />
      </View>

      {isLoading ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => <OrderCard order={item} testID={`order-${item.id}`} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState title="No orders found" subtitle="Try a different filter or create a new order." icon="clipboard-text-outline" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chips: { paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
}));
