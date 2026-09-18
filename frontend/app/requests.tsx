import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRequests } from "@/src/api/hooks";
import { AppHeader, Card, EmptyState, LoadingView } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const STATUS_COLOR: Record<string, [keyof any, keyof any]> = {};

export default function Requests() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useRequests();

  return (
    <View style={styles.screen}>
      <AppHeader title="Incoming Requests" back />
      {isLoading ? <LoadingView /> : (
        <FlatList
          data={data || []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<EmptyState title="No requests" subtitle="Customer & vendor requests appear here." icon="inbox-outline" />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/request/${item.id}`)} style={{ marginBottom: spacing.md, gap: 4 }} testID={`request-${item.id}`}>
              <View style={styles.row}>
                <Text style={styles.ref}>{item.reference}</Text>
                <View style={styles.statusPill}><Text style={styles.statusText}>{item.status}</Text></View>
              </View>
              <Text style={styles.biz}>{item.business_name}</Text>
              <Text style={styles.req} numberOfLines={2}>{item.requirement}</Text>
              <Text style={styles.meta}>{item.source} · Qty {item.quantity || "—"}</Text>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ref: { fontSize: 13, fontWeight: "800", color: colors.brand },
  statusPill: { backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700", color: colors.onBrandTertiary },
  biz: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  req: { fontSize: 13, color: colors.onSurfaceTertiary },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
}));
