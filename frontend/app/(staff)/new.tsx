import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useOrders } from "@/src/api/hooks";
import { useAuth } from "@/src/auth/auth";
import { OrderCard } from "@/src/components/OrderCard";
import { AppButton, AppHeader, EmptyState, SectionTitle } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export default function NewOrderTab() {
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const drafts = useOrders({ status: "DRAFT" });
  const corrections = useOrders({ status: "CORRECTION_REQUIRED" });

  return (
    <View style={styles.screen}>
      <AppHeader title="New Order" subtitle="Create & manage drafts" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Start a new order</Text>
          <Text style={styles.heroText}>Capture full specifications through the 8-step guided form.</Text>
          <AppButton title="Create Order" icon="plus-box" onPress={() => router.push("/wizard")} testID="start-new-order" />
        </View>

        {(user?.role !== "Manager" || user) && (
          <>
            <SectionTitle>Returned for correction</SectionTitle>
            {corrections.data?.items?.length ? (
              corrections.data.items.map((o: any) => <OrderCard key={o.id} order={o} />)
            ) : (
              <EmptyState title="Nothing to correct" icon="check-circle-outline" />
            )}

            <SectionTitle>My drafts</SectionTitle>
            {drafts.data?.items?.length ? (
              drafts.data.items.map((o: any) => <OrderCard key={o.id} order={o} />)
            ) : (
              <EmptyState title="No drafts saved" subtitle="Your saved drafts will appear here." icon="file-outline" />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  hero: { backgroundColor: colors.brand, borderRadius: 20, padding: spacing.xl, gap: spacing.sm, marginBottom: spacing.lg },
  heroTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  heroText: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: spacing.md },
}));
