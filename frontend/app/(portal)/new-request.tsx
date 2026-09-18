import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { apiPost } from "@/src/api/client";
import { useInvalidate } from "@/src/api/hooks";
import { useAuth } from "@/src/auth/auth";
import { DocumentUploader } from "@/src/components/DocumentUploader";
import { useToast } from "@/src/components/Toast";
import { AppButton, AppHeader, Field, SectionTitle } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export default function NewRequest() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { user } = useAuth();
  const [f, setF] = useState<any>({ business_name: user?.company || "", documents: [] });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!f.business_name || !f.requirement) { toast("Business name and requirement are required", "error"); return; }
    setBusy(true);
    try {
      const res = await apiPost("/requests", {
        business_name: f.business_name, contact_person: f.contact_person, mobile: f.mobile, email: f.email,
        requirement: f.requirement, quantity: f.quantity, delivery_date: f.delivery_date,
        delivery_location: f.delivery_location, po_number: f.po_number, special_instructions: f.special_instructions,
        documents: f.documents,
      });
      toast(`Request ${res.reference} submitted`, "success");
      invalidate("requests", "dashboard");
      router.replace(`/request/${res.id}`);
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="New Request" subtitle="Submit a packaging requirement" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }} keyboardShouldPersistTaps="handled">
          <Field label="Business / customer name" required value={f.business_name} onChangeText={(v) => setF({ ...f, business_name: v })} testID="req-business" />
          <Field label="Contact person" value={f.contact_person} onChangeText={(v) => setF({ ...f, contact_person: v })} />
          <Field label="Mobile" keyboardType="phone-pad" value={f.mobile} onChangeText={(v) => setF({ ...f, mobile: v })} />
          <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
          <Field label="Product / packaging requirement" required multiline value={f.requirement} onChangeText={(v) => setF({ ...f, requirement: v })} testID="req-requirement" />
          <Field label="Quantity" keyboardType="numeric" value={f.quantity} onChangeText={(v) => setF({ ...f, quantity: v })} />
          <Field label="Requested delivery date" placeholder="YYYY-MM-DD" value={f.delivery_date} onChangeText={(v) => setF({ ...f, delivery_date: v })} />
          <Field label="Delivery location" value={f.delivery_location} onChangeText={(v) => setF({ ...f, delivery_location: v })} />
          <Field label="PO number (optional)" value={f.po_number} onChangeText={(v) => setF({ ...f, po_number: v })} />
          <Field label="Special instructions" multiline value={f.special_instructions} onChangeText={(v) => setF({ ...f, special_instructions: v })} />

          <SectionTitle>Attachments (PO, artwork, drawing)</SectionTitle>
          <DocumentUploader category="Other" docs={f.documents} onChange={(d) => setF({ ...f, documents: d })} ensureOrderId={async () => undefined} />

          <View style={{ height: spacing.md }} />
          <AppButton title="Submit Request" icon="send" onPress={submit} loading={busy} testID="submit-request" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
}));
