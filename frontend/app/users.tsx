import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUsers } from "@/src/api/hooks";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { AppHeader, EmptyState, LoadingView } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Users() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useUsers();

  return (
    <View style={styles.screen}>
      <AppHeader title="Users & Permissions" back
        right={user?.role === "Admin" ? (
          <Pressable onPress={() => router.push("/user-new")} style={styles.add} testID="add-user">
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        ) : undefined} />
      {isLoading ? <LoadingView /> : (
        <FlatList
          data={data || []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<EmptyState title="No users" icon="account-off-outline" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => user?.role === "Admin" && router.push(`/user/${item.id}`)} style={styles.row} testID={`user-${item.id}`}>
              <View style={[styles.avatar, !item.active && { backgroundColor: colors.muted }]}>
                <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>
              <View style={styles.rightCol}>
                <View style={styles.rolePill}><Text style={styles.roleText}>{item.role}</Text></View>
                {!item.active && <Text style={styles.disabled}>Disabled</Text>}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  add: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontWeight: "800", fontSize: 18 },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  email: { fontSize: 12, color: colors.muted },
  rightCol: { alignItems: "flex-end", gap: 2 },
  rolePill: { backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 11 },
  disabled: { color: colors.error, fontSize: 10, fontWeight: "700" },
}));
