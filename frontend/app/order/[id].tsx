import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, apiPost, fileDownloadUrl } from "@/src/api/client";
import { useInvalidate, useOrder, useOrderActivity, useUsers } from "@/src/api/hooks";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import {
  AppButton, AppHeader, Card, Field, KeyVal, LoadingView, PriorityChip, SectionTitle,
  SelectField, Sheet, StatusChip, Toggle,
} from "@/src/components/ui";
import { SEND_BACK_REASONS } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "specs", label: "Specs" },
  { key: "documents", label: "Documents" },
  { key: "production", label: "Production" },
  { key: "qc", label: "QC" },
  { key: "dispatch", label: "Dispatch" },
  { key: "billing", label: "Billing" },
  { key: "activity", label: "History" },
];

export default function OrderDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { user, can } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, refetch } = useOrder(id);
  const activity = useOrderActivity(id);
  const employees = useUsers("Employee");

  const [tab, setTab] = useState("overview");
  const [sheet, setSheet] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  if (isLoading || !order) return <View style={styles.screen}><AppHeader title="Order" back /><LoadingView /></View>;

  const box = order.box || {};
  const sales = order.sales || {};
  const isInternal = user && ["Admin", "Manager", "Employee"].includes(user.role);
  const isOwner = order.creator_id === user?.id || order.assigned_to === user?.id;

  const run = async (path: string, body: any, successMsg: string) => {
    setBusy(true);
    try {
      await apiPost(path, body);
      toast(successMsg, "success");
      setSheet(null); setF({});
      invalidate("order", "orders", "dashboard", "order-activity");
      refetch(); activity.refetch();
    } catch (e: any) {
      const msg = e instanceof ApiError ? (typeof e.detail === "string" ? e.detail : e.detail?.message || e.message) : e.message;
      toast(msg, "error");
    } finally { setBusy(false); }
  };

  const openDoc = (docId: string) => {
    if (docId === "demo") { toast("Demo document (no file)", "info"); return; }
    Linking.openURL(fileDownloadUrl(docId));
  };

  // Build available actions
  const actions: { label: string; icon: string; onPress: () => void }[] = [];
  const s = order.status;
  if (["DRAFT", "CORRECTION_REQUIRED"].includes(s)) {
    if (can("create_edit_orders") || isOwner) actions.push({ label: "Edit order", icon: "pencil", onPress: () => router.push(`/wizard?id=${id}`) });
    if (can("create_edit_orders") || isOwner) actions.push({ label: "Submit for checking", icon: "send", onPress: () => run(`/orders/${id}/submit`, {}, "Submitted") });
  }
  if (s === "UNDER_CHECKING" && can("check_approve_return")) {
    actions.push({ label: "Approve", icon: "check-decagram", onPress: () => setSheet("approve") });
    actions.push({ label: "Send back", icon: "undo-variant", onPress: () => setSheet("sendback") });
  }
  if (can("assign_responsibility") && !["CLOSED"].includes(s)) actions.push({ label: "Assign / reassign", icon: "account-switch", onPress: () => setSheet("assign") });
  if (s === "APPROVED" && can("update_production")) actions.push({ label: "Plan production", icon: "calendar-start", onPress: () => setSheet("plan") });
  if (["PRODUCTION_PLANNING", "IN_PRODUCTION"].includes(s) && can("update_production")) actions.push({ label: "Production update", icon: "progress-wrench", onPress: () => setSheet("production") });
  if (["IN_PRODUCTION", "QC", "READY_FOR_DISPATCH"].includes(s) && can("qc_updates")) actions.push({ label: "QC inspection", icon: "magnify-scan", onPress: () => setSheet("qc") });
  if (["READY_FOR_DISPATCH", "DISPATCHED"].includes(s) && can("record_dispatch")) actions.push({ label: "Record dispatch", icon: "truck-fast", onPress: () => setSheet("dispatch") });
  if (["DISPATCHED", "BILLED"].includes(s) && can("record_billing")) actions.push({ label: "Record billing", icon: "receipt-text", onPress: () => setSheet("billing") });
  if (s === "BILLED" && ["Admin", "Manager"].includes(user?.role || "")) actions.push({ label: "Close job", icon: "lock-check", onPress: () => setSheet("close") });
  if (["APPROVED", "PRODUCTION_PLANNING", "IN_PRODUCTION", "QC", "READY_FOR_DISPATCH"].includes(s) && can("create_edit_orders")) actions.push({ label: "Open revision", icon: "file-restore-outline", onPress: () => run(`/orders/${id}/revision`, {}, "Revision opened") });

  const available = order.qc_released_qty - order.dispatched_qty;

  return (
    <View style={styles.screen}>
      <AppHeader title={order.job_number || "Draft order"} subtitle={box.product_name} back
        right={<PriorityChip priority={order.priority} />} />
      <View style={styles.statusBar}>
        <StatusChip status={order.status} testID="order-status" />
        {order.revision > 1 && <Text style={styles.rev}>Rev {order.revision}</Text>}
      </View>
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]} testID={`tab-${t.key}`}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}>
        {tab === "overview" && (
          <Card>
            <KeyVal label="Customer" value={sales.customer_name} />
            <KeyVal label="PO number" value={sales.po_number} />
            <KeyVal label="Delivery date" value={sales.delivery_date} />
            <KeyVal label="Delivery location" value={sales.delivery_location} />
            <KeyVal label="Salesperson" value={employees.data?.find((e: any) => e.id === order.assigned_to)?.name} />
            <KeyVal label="Created by" value={order.creator_name} />
            <KeyVal label="Quantity" value={order.qty_ordered} />
            {isInternal && <KeyVal label="Grand total" value={order.commercial?.grand_total ? `₹ ${order.commercial.grand_total}` : "—"} />}
            {order.correction_reason && <View style={styles.warnBox}><Text style={styles.warnText}>Returned: {order.correction_reason} — {order.correction_note}</Text></View>}
          </Card>
        )}

        {tab === "specs" && (
          <Card>
            <SectionTitle>Box</SectionTitle>
            <KeyVal label="Type" value={box.box_type} />
            <KeyVal label="Size (mm)" value={`${box.length || "?"} × ${box.width || "?"} × ${box.height || "?"}`} />
            <KeyVal label="Ply" value={box.ply} />
            <KeyVal label="Board" value={box.board_spec} />
            <KeyVal label="Paper GSM/BF" value={box.paper_gsm_bf} />
            <KeyVal label="Flute" value={box.flute} />
            <SectionTitle>Printing</SectionTitle>
            <KeyVal label="Required" value={order.printing?.required} />
            <KeyVal label="Process" value={order.printing?.process} />
            <KeyVal label="Colours" value={order.printing?.colours} />
            <KeyVal label="Artwork approval" value={order.printing?.artwork_approval} />
            <SectionTitle>Conversion</SectionTitle>
            <KeyVal label="Processes" value={(order.conversion?.processes || []).join(", ")} />
            <KeyVal label="Die" value={order.conversion?.die_requirement} />
            <SectionTitle>Quality</SectionTitle>
            <KeyVal label="Sample" value={order.quality?.sample_required} />
            <KeyVal label="COC" value={order.quality?.coc_required} />
          </Card>
        )}

        {tab === "documents" && (
          <Card>
            {(order.documents || []).length ? (order.documents || []).map((d: any, i: number) => (
              <Pressable key={i} style={styles.docRow} onPress={() => openDoc(d.id)} testID={`doc-${i}`}>
                <Icon name="file-document-outline" size={20} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName} numberOfLines={1}>{d.original_name || d.name || "Document"}</Text>
                  <Text style={styles.docCat}>{d.category}</Text>
                </View>
                <Icon name="download" size={20} color={colors.muted} />
              </Pressable>
            )) : <Text style={styles.dim}>No documents attached.</Text>}
          </Card>
        )}

        {tab === "production" && (
          <Card>
            <KeyVal label="Planned start" value={order.production?.planned_start} />
            <KeyVal label="Planned completion" value={order.production?.planned_completion} />
            <KeyVal label="Machine/line" value={order.production?.machine} />
            <SectionTitle>Updates</SectionTitle>
            {(order.production_updates || []).length ? order.production_updates.map((u: any, i: number) => (
              <View key={i} style={styles.timeItem}>
                <Text style={styles.timeTitle}>{u.current_process || "Update"} · {u.produced_qty ?? 0} pcs</Text>
                <Text style={styles.dim}>{u.note} — {u.by} · {new Date(u.at).toLocaleString()}</Text>
              </View>
            )) : <Text style={styles.dim}>No production updates yet.</Text>}
          </Card>
        )}

        {tab === "qc" && (
          <Card>
            <KeyVal label="QC released qty" value={order.qc_released_qty} />
            <SectionTitle>Inspections</SectionTitle>
            {(order.qc_inspections || []).length ? order.qc_inspections.map((q: any, i: number) => (
              <View key={i} style={styles.timeItem}>
                <View style={styles.row}>
                  <Text style={styles.timeTitle}>Attempt {q.attempt} · {q.result}</Text>
                  <Icon name={q.result === "Pass" ? "check-circle" : "close-circle"} size={18} color={q.result === "Pass" ? colors.success : colors.error} />
                </View>
                <Text style={styles.dim}>Inspected {q.inspected_qty}, passed {q.passed_qty}, rejected {q.rejected_qty} — {q.inspector}</Text>
              </View>
            )) : <Text style={styles.dim}>No inspections recorded.</Text>}
          </Card>
        )}

        {tab === "dispatch" && (
          <Card>
            <KeyVal label="Ordered" value={order.qty_ordered} />
            <KeyVal label="QC released" value={order.qc_released_qty} />
            <KeyVal label="Dispatched" value={order.dispatched_qty} />
            <KeyVal label="Remaining" value={order.qty_ordered - order.dispatched_qty} />
            <SectionTitle>Dispatch records</SectionTitle>
            {(order.dispatches || []).length ? order.dispatches.map((d: any, i: number) => (
              <View key={i} style={styles.timeItem}>
                <Text style={styles.timeTitle}>{d.reference} · {d.quantity} pcs</Text>
                <Text style={styles.dim}>{d.transporter} {d.vehicle} · {new Date(d.at).toLocaleString()}</Text>
              </View>
            )) : <Text style={styles.dim}>No dispatch records.</Text>}
          </Card>
        )}

        {tab === "billing" && (
          <Card>
            {isInternal ? ((order.billing || []).length ? order.billing.map((b: any, i: number) => (
              <View key={i} style={styles.timeItem}>
                <Text style={styles.timeTitle}>{b.invoice_number} · ₹ {b.grand_total}</Text>
                <Text style={styles.dim}>Taxable ₹{b.taxable_value} + GST {b.gst_rate}% · {b.payment_status}</Text>
              </View>
            )) : <Text style={styles.dim}>No invoices recorded.</Text>) : <Text style={styles.dim}>Billing is restricted.</Text>}
          </Card>
        )}

        {tab === "activity" && (
          <Card>
            {(activity.data || []).length ? activity.data.map((a: any, i: number) => (
              <View key={i} style={styles.timeItem}>
                <Text style={styles.timeTitle}>{a.action}</Text>
                <Text style={styles.dim}>{a.actor_name} · {new Date(a.created_at).toLocaleString()}{a.reason ? ` · ${a.reason}` : ""}</Text>
              </View>
            )) : <Text style={styles.dim}>No history yet.</Text>}
          </Card>
        )}
      </ScrollView>

      {actions.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton title="Actions" icon="cog-outline" onPress={() => setSheet("actions")} testID="order-actions" />
        </View>
      )}

      {/* Actions menu */}
      <Sheet open={sheet === "actions"} onClose={() => setSheet(null)} title="Actions">
        {actions.map((a) => (
          <Pressable key={a.label} style={styles.actionRow} onPress={a.onPress} testID={`action-${a.label}`}>
            <Icon name={a.icon as any} size={22} color={colors.brandPrimary} />
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </Sheet>

      {/* Approve */}
      <Sheet open={sheet === "approve"} onClose={() => setSheet(null)} title="Approve order">
        <Text style={styles.dim}>Confirm specifications, documents and declarations are complete.</Text>
        <Field label="Note (optional)" value={f.note} onChangeText={(v) => setF({ ...f, note: v })} multiline />
        <AppButton title="Approve" icon="check" loading={busy} onPress={() => run(`/orders/${id}/approve`, { note: f.note }, "Approved")} testID="confirm-approve" />
      </Sheet>

      {/* Send back */}
      <Sheet open={sheet === "sendback"} onClose={() => setSheet(null)} title="Send back for correction">
        <SelectField label="Reason" required value={f.reason} options={SEND_BACK_REASONS} onChange={(v) => setF({ ...f, reason: v })} />
        <Field label="Explanatory note" required value={f.snote} onChangeText={(v) => setF({ ...f, snote: v })} multiline />
        <AppButton title="Send back" variant="danger" loading={busy} onPress={() => run(`/orders/${id}/send-back`, { reason: f.reason, note: f.snote }, "Returned")} />
      </Sheet>

      {/* Assign */}
      <Sheet open={sheet === "assign"} onClose={() => setSheet(null)} title="Assign responsibility">
        <SelectField label="Employee" required value={employees.data?.find((e: any) => e.id === f.emp)?.name || ""} options={(employees.data || []).map((e: any) => e.name)}
          onChange={(name) => setF({ ...f, emp: employees.data.find((e: any) => e.name === name)?.id })} />
        <Field label="Reason (needed for reassignment)" value={f.areason} onChangeText={(v) => setF({ ...f, areason: v })} />
        <AppButton title="Assign" loading={busy} onPress={() => run(`/orders/${id}/assign`, { employee_id: f.emp, reason: f.areason }, "Assigned")} />
      </Sheet>

      {/* Plan */}
      <Sheet open={sheet === "plan"} onClose={() => setSheet(null)} title="Production planning">
        <Field label="Planned start" placeholder="YYYY-MM-DD" value={f.ps} onChangeText={(v) => setF({ ...f, ps: v })} />
        <Field label="Planned completion" placeholder="YYYY-MM-DD" value={f.pc} onChangeText={(v) => setF({ ...f, pc: v })} />
        <Field label="Machine / line" value={f.machine} onChangeText={(v) => setF({ ...f, machine: v })} />
        <AppButton title="Save plan" loading={busy} onPress={() => run(`/orders/${id}/production/plan`, { planned_start: f.ps, planned_completion: f.pc, machine: f.machine }, "Planned")} />
      </Sheet>

      {/* Production update */}
      <Sheet open={sheet === "production"} onClose={() => setSheet(null)} title="Production update">
        <Field label="Current process" value={f.proc} onChangeText={(v) => setF({ ...f, proc: v })} />
        <Field label="Produced qty" keyboardType="numeric" value={f.pq} onChangeText={(v) => setF({ ...f, pq: v })} />
        <Field label="Rejected/rework qty" keyboardType="numeric" value={f.rq} onChangeText={(v) => setF({ ...f, rq: v })} />
        <Field label="Progress note" multiline value={f.pnote} onChangeText={(v) => setF({ ...f, pnote: v })} />
        <Toggle label="Move to In Production" value={f.moveIn} onChange={(v) => setF({ ...f, moveIn: v, moveQc: false })} />
        <Toggle label="Move to QC" value={f.moveQc} onChange={(v) => setF({ ...f, moveQc: v, moveIn: false })} />
        <AppButton title="Save update" loading={busy} onPress={() => run(`/orders/${id}/production/update`, { current_process: f.proc, produced_qty: Number(f.pq) || 0, rejected_qty: Number(f.rq) || 0, note: f.pnote, move_to: f.moveIn ? "IN_PRODUCTION" : f.moveQc ? "QC" : null }, "Updated")} />
      </Sheet>

      {/* QC */}
      <Sheet open={sheet === "qc"} onClose={() => setSheet(null)} title="QC inspection">
        <Field label="Inspected qty" required keyboardType="numeric" value={f.iq} onChangeText={(v) => setF({ ...f, iq: v })} />
        <Field label="Passed qty" required keyboardType="numeric" value={f.paq} onChangeText={(v) => setF({ ...f, paq: v })} />
        <Field label="Rejected/rework qty" keyboardType="numeric" value={f.rjq} onChangeText={(v) => setF({ ...f, rjq: v })} />
        <SelectField label="Result" required value={f.result} options={["Pass", "Fail"]} onChange={(v) => setF({ ...f, result: v })} />
        <Field label="Notes" multiline value={f.qnote} onChangeText={(v) => setF({ ...f, qnote: v })} />
        <AppButton title="Record inspection" loading={busy} onPress={() => run(`/orders/${id}/qc`, { inspected_qty: Number(f.iq) || 0, passed_qty: Number(f.paq) || 0, rejected_qty: Number(f.rjq) || 0, result: f.result, notes: f.qnote }, "QC recorded")} />
      </Sheet>

      {/* Dispatch */}
      <Sheet open={sheet === "dispatch"} onClose={() => setSheet(null)} title="Record dispatch">
        <Text style={styles.dim}>Available to dispatch: {available} of {order.qty_ordered}</Text>
        <Field label="Quantity" required keyboardType="numeric" value={f.dq} onChangeText={(v) => setF({ ...f, dq: v })} />
        <Field label="Transporter" value={f.trans} onChangeText={(v) => setF({ ...f, trans: v })} />
        <Field label="Vehicle" value={f.veh} onChangeText={(v) => setF({ ...f, veh: v })} />
        <Field label="Challan / tracking" value={f.challan} onChangeText={(v) => setF({ ...f, challan: v })} />
        <AppButton title="Record dispatch" loading={busy} onPress={() => run(`/orders/${id}/dispatch`, { quantity: Number(f.dq) || 0, transporter: f.trans, vehicle: f.veh, challan_no: f.challan }, "Dispatched")} />
      </Sheet>

      {/* Billing */}
      <Sheet open={sheet === "billing"} onClose={() => setSheet(null)} title="Record invoice">
        <Field label="Invoice number" required value={f.inv} onChangeText={(v) => setF({ ...f, inv: v })} />
        <Field label="Invoice date" placeholder="YYYY-MM-DD" value={f.invd} onChangeText={(v) => setF({ ...f, invd: v })} />
        <Field label="Taxable value" required keyboardType="numeric" value={f.tv} onChangeText={(v) => setF({ ...f, tv: v })} />
        <Field label="GST rate %" keyboardType="numeric" value={f.gst} onChangeText={(v) => setF({ ...f, gst: v })} />
        <Field label="Payment terms" value={f.pt} onChangeText={(v) => setF({ ...f, pt: v })} />
        <AppButton title="Record invoice" loading={busy} onPress={() => run(`/orders/${id}/billing`, { invoice_number: f.inv, invoice_date: f.invd, taxable_value: Number(f.tv) || 0, gst_rate: Number(f.gst) || 0, payment_terms: f.pt }, "Invoice recorded")} />
      </Sheet>

      {/* Close */}
      <Sheet open={sheet === "close"} onClose={() => setSheet(null)} title="Close job">
        <Text style={styles.dim}>Confirm this job is fully billed and complete. This cannot be undone.</Text>
        <AppButton title="Confirm close" icon="lock-check" loading={busy} onPress={() => run(`/orders/${id}/close`, {}, "Job closed")} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  statusBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  rev: { fontSize: 12, fontWeight: "700", color: colors.muted },
  tabsWrap: { backgroundColor: colors.surface, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tab: { flexShrink: 0, height: 34, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceTertiary },
  tabTextActive: { color: colors.onBrandPrimary },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  warnBox: { backgroundColor: colors.status_correction_bg, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm },
  warnText: { color: colors.status_correction_text, fontSize: 13 },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  docName: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  docCat: { fontSize: 12, color: colors.muted },
  dim: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  timeItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 2 },
  timeTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  actionLabel: { fontSize: 16, color: colors.onSurface, fontWeight: "600" },
}));
