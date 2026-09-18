import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { apiPatch, apiPost } from "@/src/api/client";
import { useInvalidate, useUsers } from "@/src/api/hooks";
import { useToast } from "@/src/components/Toast";
import { AppButton, AppHeader, Card, KeyVal, SectionTitle, Sheet, Toggle } from "@/src/components/ui";
import { PERMISSION_LABELS } from "@/src/constants";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function UserDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useUsers();
  const target = (data || []).find((u: any) => u.id === id);

  const [perms, setPerms] = useState<any>({});
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tempPw, setTempPw] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setPerms(target.permissions || {}); setActive(target.active); }
  }, [target?.id]);

  if (!target) return <View style={styles.screen}><AppHeader title="User" back /></View>;

  const showPerms = ["Manager", "Employee"].includes(target.role);

  const savePerms = async () => {
    setBusy(true);
    try { await apiPatch(`/users/${id}`, { permissions: perms }); toast("Permissions updated", "success"); invalidate("users"); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const toggleActive = async () => {
    try { await apiPatch(`/users/${id}/active`, { active: !active }); setActive(!active); toast(!active ? "Account enabled" : "Account disabled & sessions revoked", "success"); invalidate("users"); }
    catch (e: any) { toast(e.message, "error"); }
  };

  const resetPw = async () => {
    try { const r = await apiPost(`/users/${id}/reset-password`, {}); setTempPw(r.temporary_password); }
    catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={target.name} subtitle={target.role} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}>
        <Card>
          <KeyVal label="Email" value={target.email} />
          <KeyVal label="Status" value={active ? "Active" : "Disabled"} />
          {target.company && <KeyVal label="Company" value={target.company} />}
        </Card>

        {showPerms && (
          <>
            <SectionTitle>Permissions</SectionTitle>
            <Card>
              {Object.entries(PERMISSION_LABELS).map(([k, label]) => (
                <Toggle key={k} label={label} value={!!perms[k]} onChange={(v) => setPerms({ ...perms, [k]: v })} />
              ))}
            </Card>
            <View style={{ height: spacing.sm }} />
            <AppButton title="Save Permissions" onPress={savePerms} loading={busy} testID="save-permissions" />
          </>
        )}

        <View style={{ height: spacing.lg }} />
        <AppButton title="Reset Password" icon="lock-reset" variant="outline" onPress={resetPw} />
        <View style={{ height: spacing.md }} />
        <AppButton title={active ? "Disable Account" : "Enable Account"} icon={active ? "account-off" : "account-check"} variant={active ? "danger" : "secondary"} onPress={toggleActive} testID="toggle-active" />
      </ScrollView>

      <Sheet open={!!tempPw} onClose={() => setTempPw(null)} title="Temporary password">
        <Text style={styles.dim}>Share this one-time password with the user. They can change it after signing in.</Text>
        <View style={styles.pwBox}><Text style={styles.pw}>{tempPw}</Text></View>
        <AppButton title="Done" variant="outline" onPress={() => setTempPw(null)} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  dim: { color: colors.muted, fontSize: 13, marginBottom: spacing.md },
  pwBox: { backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md },
  pw: { fontSize: 20, fontWeight: "800", color: colors.brand, letterSpacing: 1 },
}));
