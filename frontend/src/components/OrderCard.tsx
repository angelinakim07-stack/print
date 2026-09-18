import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Card, PriorityChip, StatusChip } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export function OrderCard({ order, testID }: { order: any; testID?: string }) {
  const styles = useStyles();
  const router = useRouter();
  const sales = order.sales || {};
  const box = order.box || {};
  return (
    <Card onPress={() => router.push(`/order/${order.id}`)} testID={testID} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.job}>{order.job_number || "Draft"}</Text>
        <StatusChip status={order.status} />
      </View>
      <Text style={styles.product} numberOfLines={1}>{box.product_name || order.product_name || "Untitled product"}</Text>
      <Text style={styles.customer} numberOfLines={1}>{sales.customer_name || order.customer_name || "—"}</Text>
      <View style={styles.bottom}>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Qty {box.quantity || order.qty_ordered || "—"}</Text>
          {sales.delivery_date ? <Text style={styles.meta}>• Due {sales.delivery_date}</Text> : null}
        </View>
        <PriorityChip priority={order.priority} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: 6, marginBottom: spacing.md },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  job: { fontSize: 13, fontWeight: "800", color: colors.brand, letterSpacing: 0.3 },
  product: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  customer: { fontSize: 13, color: colors.muted },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 6, flexShrink: 1 },
  meta: { fontSize: 12, color: colors.onSurfaceTertiary },
}));
