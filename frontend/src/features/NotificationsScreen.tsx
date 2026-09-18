import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiPost } from "@/src/api/client";
import { useInvalidate, useNotifications } from "@/src/api/hooks";
import { Icon } from "@/src/components/Icon";
import { AppHeader, EmptyState, LoadingView } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function NotificationsScreen({ back }: { back?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { data, isLoading, refetch, isRefetching } = useNotifications();

  const onTap = async (n: any) => {
    if (!n.read) { await apiPost(`/notifications/${n.id}/read`, {}); invalidate("notifications", "unread"); }
    if (n.data?.order_id) router.push(`/order/${n.data.order_id}`);
    else if (n.data?.request_id) router.push(`/request/${n.data.request_id}`);
  };

  const markAll = async () => { await apiPost("/notifications/read-all", {}); invalidate("notifications", "unread"); refetch(); };

  return (
    <View style={styles.screen}>
      <AppHeader title="Notifications" back={back}
        right={<Pressable onPress={markAll} testID="mark-all-read"><Text style={styles.markAll}>Mark all</Text></Pressable>} />
      {isLoading ? <LoadingView /> : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState title="All caught up" subtitle="No notifications yet." icon="bell-check-outline" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => onTap(item)} style={[styles.row, !item.read && styles.unread]} testID={`notif-${item.id}`}>
              <View style={[styles.dot, { backgroundColor: item.read ? colors.border : colors.brandPrimary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  markAll: { color: colors.brandPrimary, fontWeight: "700", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  unread: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  body: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4 },
}));
