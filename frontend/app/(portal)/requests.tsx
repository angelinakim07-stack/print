import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRequests } from "@/src/api/hooks";
import { AppHeader, Card, EmptyState, LoadingView } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function PortalRequests() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useRequests();

  return (
    <View style={styles.screen}>
      <AppHeader title="My Requests" />
      {isLoading ? <LoadingView /> : (
        <FlatList
          data={data || []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<EmptyState title="No requests yet" subtitle="Tap New to submit your first request." icon="file-plus-outline" />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/request/${item.id}`)} style={{ marginBottom: spacing.md, gap: 4 }} testID={`preq-${item.id}`}>
              <View style={styles.row}>
                <Text style={styles.ref}>{item.reference}</Text>
                <View style={styles.pill}><Text style={styles.pillText}>{item.status}</Text></View>
              </View>
              <Text style={styles.req} numberOfLines={2}>{item.requirement}</Text>
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
  pill: { backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "700", color: colors.onBrandTertiary },
  req: { fontSize: 14, color: colors.onSurface },
}));
