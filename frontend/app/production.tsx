import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOrders } from "@/src/api/hooks";
import { OrderCard } from "@/src/components/OrderCard";
import { AppHeader, EmptyState, LoadingView, Segmented } from "@/src/components/ui";
import { spacing, useTheme, makeStyles } from "@/src/theme";

const STAGES = [
  { key: "APPROVED", label: "Approved" },
  { key: "PRODUCTION_PLANNING", label: "Planning" },
  { key: "IN_PRODUCTION", label: "In Production" },
  { key: "QC", label: "QC" },
  { key: "READY_FOR_DISPATCH", label: "Ready" },
  { key: "DISPATCHED", label: "Dispatched" },
];

export default function Production() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState("APPROVED");
  const { data, isLoading, refetch, isRefetching } = useOrders({ status: stage });

  return (
    <View style={styles.screen}>
      <AppHeader title="Production Board" back />
      <View style={styles.chips}>
        <Segmented options={STAGES} value={stage} onChange={setStage} testID="production-stages" />
      </View>
      {isLoading ? <LoadingView /> : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListEmptyComponent={<EmptyState title="No jobs in this stage" icon="factory" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  chips: { paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
}));
