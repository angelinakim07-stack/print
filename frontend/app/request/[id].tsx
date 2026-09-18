import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiPost } from "@/src/api/client";
import { useInvalidate, useRequest, useUsers } from "@/src/api/hooks";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import { AppButton, AppHeader, Card, Field, KeyVal, LoadingView, SectionTitle, SelectField, Sheet } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function RequestDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { user, can } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: req, isLoading, refetch } = useRequest(id);
  const employees = useUsers("Employee");

  const [sheet, setSheet] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  if (isLoading || !req) return <View style={styles.screen}><AppHeader title="Request" back /><LoadingView /></View>;

  const canTriage = user?.role === "Admin" || user?.role === "Manager" || can("assign_responsibility");

  const run = async (path: string, body: any, msg: string, thenOrder?: boolean) => {
    setBusy(true);
    try {
      const res = await apiPost(path, body);
      toast(msg, "success"); setSheet(null); setF({});
      invalidate("requests", "request", "orders", "dashboard"); refetch();
      if (thenOrder && res?.order_id) router.replace(`/wizard?id=${res.order_id}`);
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={req.reference} subtitle={req.status} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}>
        <Card>
          <KeyVal label="Business" value={req.business_name} />
          <KeyVal label="Contact" value={req.contact_person} />
          <KeyVal label="Mobile" value={req.mobile} />
          <KeyVal label="Email" value={req.email} />
          <KeyVal label="Quantity" value={req.quantity} />
          <KeyVal label="Delivery date" value={req.delivery_date} />
          <KeyVal label="Delivery location" value={req.delivery_location} />
          <KeyVal label="PO number" value={req.po_number} />
        </Card>
        <SectionTitle>Requirement</SectionTitle>
        <Card><Text style={styles.body}>{req.requirement}</Text>
          {req.special_instructions ? <Text style={styles.dim}>Notes: {req.special_instructions}</Text> : null}
        </Card>
        {req.linked_order_id && (
          <Pressable style={styles.link} onPress={() => router.push(`/order/${req.linked_order_id}`)}>
            <Icon name="link-variant" size={18} color={colors.brandPrimary} />
            <Text style={styles.linkText}>View linked order</Text>
          </Pressable>
        )}
      </ScrollView>

      {canTriage && !["CONVERTED", "REJECTED"].includes(req.status) && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton title="Triage" icon="tune" onPress={() => setSheet("triage")} testID="request-triage" />
        </View>
      )}

      <Sheet open={sheet === "triage"} onClose={() => setSheet(null)} title="Triage request">
        <AppButton title="Assign employee" icon="account-plus" variant="outline" style={{ marginBottom: spacing.sm }} onPress={() => setSheet("assign")} />
        <AppButton title="Request clarification" icon="comment-question-outline" variant="outline" style={{ marginBottom: spacing.sm }} onPress={() => setSheet("clarify")} />
        <AppButton title="Convert to order" icon="file-move-outline" style={{ marginBottom: spacing.sm }} onPress={() => setSheet("convert")} />
        <AppButton title="Reject" icon="close-circle-outline" variant="danger" onPress={() => setSheet("reject")} />
      </Sheet>

      <Sheet open={sheet === "assign"} onClose={() => setSheet(null)} title="Assign employee">
        <SelectField label="Employee" required value={employees.data?.find((e: any) => e.id === f.emp)?.name || ""} options={(employees.data || []).map((e: any) => e.name)}
          onChange={(name) => setF({ ...f, emp: employees.data.find((e: any) => e.name === name)?.id })} />
        <AppButton title="Assign" loading={busy} onPress={() => run(`/requests/${id}/assign`, { employee_id: f.emp }, "Assigned")} />
      </Sheet>

      <Sheet open={sheet === "clarify"} onClose={() => setSheet(null)} title="Request clarification">
        <Field label="Message to requester" required multiline value={f.note} onChangeText={(v) => setF({ ...f, note: v })} />
        <AppButton title="Send" loading={busy} onPress={() => run(`/requests/${id}/clarify`, { note: f.note }, "Clarification sent")} />
      </Sheet>

      <Sheet open={sheet === "convert"} onClose={() => setSheet(null)} title="Convert to order">
        <SelectField label="Assign to (optional)" value={employees.data?.find((e: any) => e.id === f.emp)?.name || ""} options={(employees.data || []).map((e: any) => e.name)}
          onChange={(name) => setF({ ...f, emp: employees.data.find((e: any) => e.name === name)?.id })} />
        <Text style={styles.dim}>An order draft will be created with pre-filled details for editing.</Text>
        <AppButton title="Convert & edit" loading={busy} onPress={() => run(`/requests/${id}/convert`, { employee_id: f.emp }, "Converted", true)} />
      </Sheet>

      <Sheet open={sheet === "reject"} onClose={() => setSheet(null)} title="Reject request">
        <Field label="Reason" required multiline value={f.reason} onChangeText={(v) => setF({ ...f, reason: v })} />
        <AppButton title="Reject" variant="danger" loading={busy} onPress={() => run(`/requests/${id}/reject`, { reason: f.reason }, "Rejected")} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  body: { color: colors.onSurface, fontSize: 15, lineHeight: 22 },
  dim: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, justifyContent: "center" },
  linkText: { color: colors.brandPrimary, fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
}));
