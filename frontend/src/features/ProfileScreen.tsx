import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { apiPatch, apiPost } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import { AppButton, AppHeader, Card, Field, KeyVal, SectionTitle, Sheet } from "@/src/components/ui";
import { PERMISSION_LABELS } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function ProfileScreen({ back }: { back?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { user, setUser, logout } = useAuth();

  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    setBusy(true);
    try { const u = await apiPatch("/users/me", { name }); setUser(u); toast("Profile updated", "success"); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const changePw = async () => {
    if (!cur || nw.length < 6) { toast("Enter current & 6+ char new password", "error"); return; }
    setBusy(true);
    try { await apiPost("/users/me/change-password", { current_password: cur, new_password: nw }); toast("Password changed", "success"); setPwOpen(false); setCur(""); setNw(""); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const perms = Object.entries(user?.permissions || {}).filter(([, v]) => v).map(([k]) => PERMISSION_LABELS[k] || k);

  return (
    <View style={styles.screen}>
      <AppHeader title="Profile" back={back} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
          <Text style={styles.name}>{user?.name}</Text>
          <View style={styles.rolePill}><Text style={styles.roleText}>{user?.role}</Text></View>
        </View>

        <Card>
          <KeyVal label="Email" value={user?.email} />
          {user?.company && <KeyVal label="Company" value={user.company} />}
          {user?.phone && <KeyVal label="Phone" value={user.phone} />}
        </Card>

        {user && ["Manager", "Employee"].includes(user.role) && (
          <>
            <SectionTitle>My permissions</SectionTitle>
            <Card>
              {perms.length ? perms.map((p) => (
                <View key={p} style={styles.permRow}><Icon name="check-circle" size={18} color={colors.success} /><Text style={styles.permText}>{p}</Text></View>
              )) : <Text style={styles.dim}>View-only. Ask your admin to grant permissions.</Text>}
            </Card>
          </>
        )}

        <SectionTitle>Edit name</SectionTitle>
        <Field value={name} onChangeText={setName} />
        <AppButton title="Save" variant="outline" onPress={saveName} loading={busy} />

        <View style={{ height: spacing.md }} />
        <AppButton title="Change Password" icon="lock-reset" variant="secondary" onPress={() => setPwOpen(true)} />
        <View style={{ height: spacing.md }} />
        <AppButton title="Logout" icon="logout" variant="danger" onPress={logout} testID="profile-logout" />
      </ScrollView>

      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
        <Field label="Current password" secureTextEntry value={cur} onChangeText={setCur} />
        <Field label="New password" secureTextEntry value={nw} onChangeText={setNw} />
        <AppButton title="Update password" onPress={changePw} loading={busy} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  avatarWrap: { alignItems: "center", marginBottom: spacing.lg, gap: spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 32, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  rolePill: { backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  roleText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12 },
  permRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  permText: { color: colors.onSurface, fontSize: 14 },
  dim: { color: colors.muted, fontSize: 13 },
}));
