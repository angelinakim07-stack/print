import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, apiGet, apiPatch, apiPost } from "@/src/api/client";
import { useInvalidate, useUsers } from "@/src/api/hooks";
import { DocumentUploader } from "@/src/components/DocumentUploader";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import {
  AppButton, AppHeader, Field, SectionTitle, SelectField, Sheet, Toggle,
} from "@/src/components/ui";
import {
  ARTWORK_APPROVAL, BOARD_COLOURS, BOX_TYPES, CONVERSION_PROCESSES, DECLARATIONS, DIE_REQUIREMENTS,
  FLUTE_OPTIONS, PLY_OPTIONS, PRINT_COLOURS, PRINT_PROCESS, PRINT_SIDES, PRIORITIES, SIZE_TYPES,
  TRANSPORT_OPTIONS, UNIT_OPTIONS,
} from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const STEPS = ["Sales", "Box Specs", "Printing", "Conversion", "Quality", "Commercial", "Documents", "Declaration"];

const empty = {
  priority: "Normal", source: "Employee", assigned_to: null as string | null, customer_id: null as string | null,
  sales: {} as any, box: {} as any, printing: { required: "No" } as any, conversion: { processes: [] as string[] } as any,
  quality: {} as any, commercial: {} as any, declaration: {} as any, documents: [] as any[],
};

export default function Wizard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const params = useLocalSearchParams<{ id?: string }>();

  const [orderId, setOrderId] = useState<string | undefined>(params.id);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [missingOpen, setMissingOpen] = useState<string[] | null>(null);

  const employees = useUsers("Employee");
  const customers = useUsers("Customer");

  useEffect(() => {
    if (params.id) {
      apiGet(`/orders/${params.id}`).then((o) => {
        setForm({
          priority: o.priority, source: o.source, assigned_to: o.assigned_to, customer_id: o.customer_id,
          sales: o.sales || {}, box: o.box || {}, printing: o.printing || { required: "No" },
          conversion: o.conversion || { processes: [] }, quality: o.quality || {}, commercial: o.commercial || {},
          declaration: o.declaration || {}, documents: o.documents || [],
        });
      }).catch(() => {});
    }
  }, [params.id]);

  const set = (section: string, key: string, value: any) =>
    setForm((f: any) => ({ ...f, [section]: { ...f[section], [key]: value } }));

  const payload = () => ({
    priority: form.priority, source: form.source, assigned_to: form.assigned_to, customer_id: form.customer_id,
    sales: { ...form.sales, assigned_to: form.assigned_to }, box: form.box, printing: form.printing,
    conversion: form.conversion, quality: form.quality, commercial: form.commercial,
    declaration: form.declaration, documents: form.documents,
  });

  const ensureSaved = async (): Promise<string | undefined> => {
    try {
      if (orderId) { await apiPatch(`/orders/${orderId}`, payload()); return orderId; }
      const created = await apiPost("/orders", payload());
      setOrderId(created.id);
      return created.id;
    } catch (e: any) {
      toast(e.message || "Save failed", "error");
      return undefined;
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    const id = await ensureSaved();
    setSaving(false);
    if (id) { toast("Draft saved on server", "success"); invalidate("orders", "dashboard"); }
  };

  const submit = async () => {
    setSaving(true);
    const id = await ensureSaved();
    if (!id) { setSaving(false); return; }
    try {
      await apiPost(`/orders/${id}/submit`, {});
      toast("Submitted for checking", "success");
      invalidate("orders", "dashboard");
      router.replace(`/order/${id}`);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 422 && e.detail?.missing) setMissingOpen(e.detail.missing);
      else toast(e.message || "Submit failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const empName = (id: string | null) => employees.data?.find((u: any) => u.id === id)?.name;
  const custName = (id: string | null) => customers.data?.find((u: any) => u.id === id)?.name;

  const comm = useMemo(() => {
    const rate = parseFloat(form.commercial?.rate_per_piece) || 0;
    const qty = parseFloat(form.box?.quantity) || 0;
    const gst = parseFloat(form.commercial?.gst_percent) || 0;
    const subtotal = rate * qty;
    const gstAmt = (subtotal * gst) / 100;
    return { subtotal, gstAmt, total: subtotal + gstAmt };
  }, [form.commercial?.rate_per_piece, form.box?.quantity, form.commercial?.gst_percent]);

  const toggleProcess = (p: string) => {
    const cur: string[] = form.conversion?.processes || [];
    set("conversion", "processes", cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={orderId ? "Edit Order" : "New Order"} subtitle={`Step ${step + 1} of 8 · ${STEPS[step]}`} back />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / 8) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <SelectField label="Responsible salesperson" required value={empName(form.assigned_to) || ""} options={(employees.data || []).map((u: any) => u.name)}
                onChange={(name) => setForm((f: any) => ({ ...f, assigned_to: employees.data.find((u: any) => u.name === name)?.id }))} testID="w-assigned" />
              <SelectField label="Customer account (optional)" value={custName(form.customer_id) || ""} options={(customers.data || []).map((u: any) => u.name)}
                onChange={(name) => setForm((f: any) => ({ ...f, customer_id: customers.data.find((u: any) => u.name === name)?.id }))} />
              <Field label="Customer name" required value={form.sales.customer_name} onChangeText={(v) => set("sales", "customer_name", v)} testID="w-customer" />
              <Field label="PO number" required value={form.sales.po_number} onChangeText={(v) => set("sales", "po_number", v)} />
              <Field label="PO date" required placeholder="YYYY-MM-DD" value={form.sales.po_date} onChangeText={(v) => set("sales", "po_date", v)} />
              <Field label="Required delivery date" required placeholder="YYYY-MM-DD" value={form.sales.delivery_date} onChangeText={(v) => set("sales", "delivery_date", v)} />
              <Field label="Delivery location" required value={form.sales.delivery_location} onChangeText={(v) => set("sales", "delivery_location", v)} />
              <Field label="Contact person" value={form.sales.contact_person} onChangeText={(v) => set("sales", "contact_person", v)} />
              <Field label="Customer mobile" keyboardType="phone-pad" value={form.sales.customer_mobile} onChangeText={(v) => set("sales", "customer_mobile", v)} />
              <Field label="Customer email" keyboardType="email-address" autoCapitalize="none" value={form.sales.customer_email} onChangeText={(v) => set("sales", "customer_email", v)} />
              <SelectField label="Priority" value={form.priority} options={PRIORITIES} onChange={(v) => setForm((f: any) => ({ ...f, priority: v }))} />
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Product / box name" required value={form.box.product_name} onChangeText={(v) => set("box", "product_name", v)} testID="w-product" />
              <SelectField label="Box type" required value={form.box.box_type} options={BOX_TYPES} onChange={(v) => set("box", "box_type", v)} />
              {form.box.box_type === "Other" && <Field label="Specify box type" value={form.box.box_type_other} onChangeText={(v) => set("box", "box_type_other", v)} />}
              <View style={styles.dimRow}>
                <View style={{ flex: 1 }}><Field label="Length (mm)" required keyboardType="numeric" value={String(form.box.length ?? "")} onChangeText={(v) => set("box", "length", v)} /></View>
                <View style={{ flex: 1 }}><Field label="Width (mm)" required keyboardType="numeric" value={String(form.box.width ?? "")} onChangeText={(v) => set("box", "width", v)} /></View>
                <View style={{ flex: 1 }}><Field label="Height (mm)" required keyboardType="numeric" value={String(form.box.height ?? "")} onChangeText={(v) => set("box", "height", v)} /></View>
              </View>
              <SelectField label="Size type" value={form.box.size_type} options={SIZE_TYPES} onChange={(v) => set("box", "size_type", v)} />
              <View style={styles.dimRow}>
                <View style={{ flex: 2 }}><Field label="Quantity" required keyboardType="numeric" value={String(form.box.quantity ?? "")} onChangeText={(v) => set("box", "quantity", v)} testID="w-qty" /></View>
                <View style={{ flex: 1 }}><SelectField label="Unit" value={form.box.unit} options={UNIT_OPTIONS} onChange={(v) => set("box", "unit", v)} /></View>
              </View>
              <SelectField label="Ply" required value={form.box.ply} options={PLY_OPTIONS} onChange={(v) => set("box", "ply", v)} />
              <Field label="Board specification" required value={form.box.board_spec} onChangeText={(v) => set("box", "board_spec", v)} />
              <Field label="Paper GSM / BF" required value={form.box.paper_gsm_bf} onChangeText={(v) => set("box", "paper_gsm_bf", v)} />
              <Field label="Paper combination" value={form.box.paper_combination} onChangeText={(v) => set("box", "paper_combination", v)} />
              <SelectField label="Flute" value={form.box.flute} options={FLUTE_OPTIONS} onChange={(v) => set("box", "flute", v)} />
              <SelectField label="Board colour" value={form.box.board_colour} options={BOARD_COLOURS} onChange={(v) => set("box", "board_colour", v)} />
            </>
          )}

          {step === 2 && (
            <>
              <SelectField label="Printing required?" required value={form.printing.required} options={["Yes", "No"]} onChange={(v) => set("printing", "required", v)} testID="w-print-req" />
              {form.printing.required === "Yes" && (
                <>
                  <SelectField label="Process" value={form.printing.process} options={PRINT_PROCESS} onChange={(v) => set("printing", "process", v)} />
                  <SelectField label="Number of colours" value={form.printing.colours} options={PRINT_COLOURS} onChange={(v) => set("printing", "colours", v)} />
                  <SelectField label="Side" value={form.printing.side} options={PRINT_SIDES} onChange={(v) => set("printing", "side", v)} />
                  <SelectField label="Artwork approval" value={form.printing.artwork_approval} options={ARTWORK_APPROVAL} onChange={(v) => set("printing", "artwork_approval", v)} />
                  <SelectField label="Proof required?" value={form.printing.proof_required} options={["Yes", "No"]} onChange={(v) => set("printing", "proof_required", v)} />
                  <SectionTitle>Artwork upload (required)</SectionTitle>
                  <DocumentUploader category="Printing Artwork" docs={form.documents} onChange={(d) => setForm((f: any) => ({ ...f, documents: d }))} ensureOrderId={ensureSaved} />
                  <Field label="Special printing instructions" multiline value={form.printing.instructions} onChangeText={(v) => set("printing", "instructions", v)} />
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <SectionTitle>Processes (choose at least one)</SectionTitle>
              {CONVERSION_PROCESSES.map((p) => (
                <Toggle key={p} label={p} value={(form.conversion.processes || []).includes(p)} onChange={() => toggleProcess(p)} />
              ))}
              <SelectField label="Die requirement" value={form.conversion.die_requirement} options={DIE_REQUIREMENTS} onChange={(v) => set("conversion", "die_requirement", v)} />
              {form.conversion.die_requirement === "Existing Die" && <Field label="Die number" required value={form.conversion.die_number} onChangeText={(v) => set("conversion", "die_number", v)} />}
              <Field label="Stitching wire specification" value={form.conversion.stitching_wire} onChangeText={(v) => set("conversion", "stitching_wire", v)} />
              <SelectField label="Gum/glue required?" value={form.conversion.gum_required} options={["Yes", "No"]} onChange={(v) => set("conversion", "gum_required", v)} />
              <Field label="Special finishing instructions" multiline value={form.conversion.finishing_instructions} onChangeText={(v) => set("conversion", "finishing_instructions", v)} />
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Customer quality requirement" multiline value={form.quality.requirement} onChangeText={(v) => set("quality", "requirement", v)} />
              <SelectField label="Sample required?" value={form.quality.sample_required} options={["Yes", "No"]} onChange={(v) => set("quality", "sample_required", v)} />
              <SelectField label="Material test report required?" value={form.quality.mtr_required} options={["Yes", "No"]} onChange={(v) => set("quality", "mtr_required", v)} />
              <SelectField label="Dimensional report required?" value={form.quality.dimensional_required} options={["Yes", "No"]} onChange={(v) => set("quality", "dimensional_required", v)} />
              <SelectField label="COC required?" value={form.quality.coc_required} options={["Yes", "No"]} onChange={(v) => set("quality", "coc_required", v)} />
              <Field label="Shelf life requirement" value={form.quality.shelf_life} onChangeText={(v) => set("quality", "shelf_life", v)} />
              <Field label="Special QC instructions" multiline value={form.quality.qc_instructions} onChangeText={(v) => set("quality", "qc_instructions", v)} />
              <SectionTitle>Customer drawing / spec</SectionTitle>
              <DocumentUploader category="Customer Drawing" docs={form.documents} onChange={(d) => setForm((f: any) => ({ ...f, documents: d }))} ensureOrderId={ensureSaved} />
            </>
          )}

          {step === 5 && (
            <>
              <Field label="Rate per piece (INR)" required keyboardType="numeric" value={String(form.commercial.rate_per_piece ?? "")} onChangeText={(v) => set("commercial", "rate_per_piece", v)} testID="w-rate" />
              <Field label="GST %" keyboardType="numeric" value={String(form.commercial.gst_percent ?? "")} onChangeText={(v) => set("commercial", "gst_percent", v)} />
              <View style={styles.calcBox}>
                <View style={styles.calcRow}><Text style={styles.calcLabel}>Subtotal</Text><Text style={styles.calcVal}>₹ {comm.subtotal.toFixed(2)}</Text></View>
                <View style={styles.calcRow}><Text style={styles.calcLabel}>GST amount</Text><Text style={styles.calcVal}>₹ {comm.gstAmt.toFixed(2)}</Text></View>
                <View style={[styles.calcRow, styles.calcTotal]}><Text style={styles.calcTotalLabel}>Grand total</Text><Text style={styles.calcTotalVal}>₹ {comm.total.toFixed(2)}</Text></View>
                <Text style={styles.calcNote}>Final totals are recalculated on the server.</Text>
              </View>
              <Field label="Payment terms" value={form.commercial.payment_terms} onChangeText={(v) => set("commercial", "payment_terms", v)} />
              <SelectField label="Transport" value={form.commercial.transport} options={TRANSPORT_OPTIONS} onChange={(v) => set("commercial", "transport", v)} />
              <Field label="Special commercial instructions" multiline value={form.commercial.instructions} onChangeText={(v) => set("commercial", "instructions", v)} />
            </>
          )}

          {step === 6 && (
            <>
              <Text style={styles.helpText}>Attach documents. PO Copy is required to submit.</Text>
              {["PO Copy", "Customer Drawing", "Printing Artwork", "Previous Sample Photo", "Quality/Specification", "Other"].map((cat) => (
                <View key={cat} style={{ marginBottom: spacing.sm }}>
                  <SectionTitle>{cat}{cat === "PO Copy" ? " *" : ""}</SectionTitle>
                  <DocumentUploader category={cat} docs={form.documents} onChange={(d) => setForm((f: any) => ({ ...f, documents: d }))} ensureOrderId={ensureSaved} />
                </View>
              ))}
            </>
          )}

          {step === 7 && (
            <>
              <SectionTitle>Sales declaration — confirm all</SectionTitle>
              {DECLARATIONS.map((d) => (
                <Toggle key={d.key} label={d.label} value={!!form.declaration[d.key]} onChange={(v) => set("declaration", d.key, v)} />
              ))}
              <SectionTitle>Review</SectionTitle>
              <View style={styles.reviewBox}>
                <ReviewRow label="Salesperson" value={empName(form.assigned_to)} />
                <ReviewRow label="Customer" value={form.sales.customer_name} />
                <ReviewRow label="Product" value={form.box.product_name} />
                <ReviewRow label="Size (mm)" value={`${form.box.length || "?"} × ${form.box.width || "?"} × ${form.box.height || "?"}`} />
                <ReviewRow label="Quantity" value={form.box.quantity} />
                <ReviewRow label="Ply / Board" value={`${form.box.ply || "?"} · ${form.box.board_spec || "?"}`} />
                <ReviewRow label="Printing" value={form.printing.required} />
                <ReviewRow label="Grand total" value={`₹ ${comm.total.toFixed(2)}`} />
                <ReviewRow label="Documents" value={`${form.documents.length} attached`} />
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.footerRow}>
            {step > 0 && <AppButton title="Previous" variant="outline" icon="chevron-left" style={{ flex: 1 }} onPress={() => setStep((s) => s - 1)} />}
            {step < 7 ? (
              <AppButton title="Next" icon="chevron-right" style={{ flex: 1 }} onPress={() => setStep((s) => s + 1)} testID="wizard-next" />
            ) : (
              <AppButton title="Submit for Checking" icon="send" style={{ flex: 1.4 }} loading={saving} onPress={submit} testID="wizard-submit" />
            )}
          </View>
          <Pressable onPress={saveDraft} style={styles.saveDraft} testID="save-draft">
            <Icon name="content-save-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.saveDraftText}>{saving ? "Saving…" : "Save Draft"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet open={!!missingOpen} onClose={() => setMissingOpen(null)} title="Please complete these">
        {(missingOpen || []).map((m) => (
          <View key={m} style={styles.missingRow}><Icon name="alert-circle-outline" size={18} color={colors.error} /><Text style={styles.missingText}>{m}</Text></View>
        ))}
        <AppButton title="OK" variant="outline" onPress={() => setMissingOpen(null)} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value?: any }) {
  const styles = useStyles();
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value || "—"}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  progressTrack: { height: 4, backgroundColor: colors.surfaceTertiary },
  progressFill: { height: 4, backgroundColor: colors.brandPrimary },
  dimRow: { flexDirection: "row", gap: spacing.sm },
  calcBox: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  calcRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  calcLabel: { color: colors.onSurfaceSecondary, fontSize: 14 },
  calcVal: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  calcTotal: { borderTopWidth: 1, borderTopColor: colors.borderStrong, marginTop: 6, paddingTop: 8 },
  calcTotalLabel: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  calcTotalVal: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  calcNote: { color: colors.muted, fontSize: 11, marginTop: 6 },
  helpText: { color: colors.muted, fontSize: 13, marginBottom: spacing.md },
  reviewBox: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  reviewLabel: { color: colors.muted, fontSize: 13 },
  reviewValue: { color: colors.onSurface, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  footerRow: { flexDirection: "row", gap: spacing.sm },
  saveDraft: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: spacing.md },
  saveDraftText: { color: colors.brandPrimary, fontWeight: "600", fontSize: 14 },
  missingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  missingText: { color: colors.onSurface, fontSize: 14 },
}));
