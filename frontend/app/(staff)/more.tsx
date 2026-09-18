import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { AppHeader, Card } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Item = { label: string; icon: string; route: string; roles?: string[] };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Operations",
    items: [
      { label: "Incoming Requests", icon: "inbox-arrow-down", route: "/requests" },
      { label: "Production Board", icon: "factory", route: "/production" },
      { label: "QC Queue", icon: "magnify-scan", route: "/(staff)/orders?status=QC" },
      { label: "Dispatch", icon: "truck-outline", route: "/(staff)/orders?status=READY_FOR_DISPATCH" },
      { label: "Billing", icon: "receipt-text-outline", route: "/(staff)/orders?status=DISPATCHED" },
      { label: "Reports & Export", icon: "chart-box-outline", route: "/reports" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users & Permissions", icon: "account-group-outline", route: "/users", roles: ["Admin", "Manager"] },
      { label: "Notifications", icon: "bell-outline", route: "/notifications" },
      { label: "Profile", icon: "account-circle-outline", route: "/profile" },
    ],
  },
];

export default function More() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <View style={styles.screen}>
      <AppHeader title="More" subtitle={user?.email} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {section.items
                .filter((it) => !it.roles || it.roles.includes(user?.role || ""))
                .map((it, idx, arr) => (
                  <Pressable
                    key={it.label}
                    onPress={() => router.push(it.route as any)}
                    style={[styles.row, idx < arr.length - 1 && styles.rowBorder]}
                    testID={`more-${it.label}`}
                  >
                    <View style={styles.rowIcon}><Icon name={it.icon as any} size={22} color={colors.brandPrimary} /></View>
                    <Text style={styles.rowLabel}>{it.label}</Text>
                    <Icon name="chevron-right" size={22} color={colors.muted} />
                  </Pressable>
                ))}
            </Card>
          </View>
        ))}

        <Pressable onPress={logout} style={styles.logout} testID="logout-button">
          <Icon name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
        <Text style={styles.version}>PRINT PACK INC · v1.0</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.onSurface },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, marginTop: spacing.sm },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: "700" },
  version: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.sm },
}));
