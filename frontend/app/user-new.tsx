import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { apiPost } from "@/src/api/client";
import { useInvalidate } from "@/src/api/hooks";
import { useToast } from "@/src/components/Toast";
import { AppButton, AppHeader, Field, SectionTitle, SelectField, Toggle } from "@/src/components/ui";
import { PERMISSION_LABELS } from "@/src/constants";
import { makeStyles, spacing } from "@/src/theme";

const ROLES = ["Employee", "Manager", "Customer", "Vendor", "Admin"];

export default function UserNew() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [f, setF] = useState<any>({ role: "Employee", permissions: {} });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.name || !f.email || !f.password) { toast("Name, email and password required", "error"); return; }
    setBusy(true);
    try {
      await apiPost("/users", { name: f.name, email: f.email, password: f.password, role: f.role, permissions: f.permissions, phone: f.phone, company: f.company });
      toast("Account created", "success");
      invalidate("users");
      router.back();
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const showPerms = ["Manager", "Employee"].includes(f.role);

  return (
    <View style={styles.screen}>
      <AppHeader title="New Account" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}>
        <Field label="Full name" required value={f.name} onChangeText={(v) => setF({ ...f, name: v })} testID="new-user-name" />
        <Field label="Email" required autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} testID="new-user-email" />
        <Field label="Temporary password" required value={f.password} onChangeText={(v) => setF({ ...f, password: v })} testID="new-user-password" />
        <SelectField label="Role" required value={f.role} options={ROLES} onChange={(v) => setF({ ...f, role: v, permissions: {} })} testID="new-user-role" />
        <Field label="Phone (optional)" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
        {["Customer", "Vendor"].includes(f.role) && <Field label="Company (optional)" value={f.company} onChangeText={(v) => setF({ ...f, company: v })} />}

        {showPerms && (
          <>
            <SectionTitle>Permissions</SectionTitle>
            {Object.entries(PERMISSION_LABELS).map(([k, label]) => (
              <Toggle key={k} label={label} value={!!f.permissions[k]} onChange={(v) => setF({ ...f, permissions: { ...f.permissions, [k]: v } })} />
            ))}
          </>
        )}
        <View style={{ height: spacing.lg }} />
        <AppButton title="Create Account" onPress={save} loading={busy} testID="save-user" />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
}));
