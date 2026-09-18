import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiPost } from "@/src/api/client";
import { useFollowups, useInvalidate } from "@/src/api/hooks";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import {
  AppButton, AppHeader, Card, DateField, EmptyState, Field, LoadingView, SelectField, Segmented, Sheet,
} from "@/src/components/ui";
import { FOLLOWUP_METHODS } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const BUCKETS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

export default function Followups() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const invalidate = useInvalidate();

  const [bucket, setBucket] = useState("today");
  const { data, isLoading, refetch, isRefetching } = useFollowups(bucket);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [method, setMethod] = useState("Call");
  const [saving, setSaving] = useState(false);

  const [active, setActive] = useState<any>(null);
  const [outcome, setOutcome] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [reason, setReason] = useState("");

  const create = async () => {
    if (!title || !dueAt) { toast("Title and due date required", "error"); return; }
    setSaving(true);
    try {
      await apiPost("/followups", { title, due_at: new Date(dueAt).toISOString(), method });
      toast("Follow-up scheduled", "success");
      setCreateOpen(false); setTitle(""); setDueAt(""); setMethod("Call");
      invalidate("followups", "dashboard");
      refetch();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const complete = async () => {
    if (!outcome) { toast("An outcome is required", "error"); return; }
    try {
      await apiPost(`/followups/${active.id}/complete`, { outcome });
      toast("Follow-up completed", "success");
      setActive(null); setOutcome("");
      invalidate("followups", "dashboard"); refetch();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const reschedule = async () => {
    if (!rescheduleAt || !reason) { toast("New date and reason required", "error"); return; }
    try {
      await apiPost(`/followups/${active.id}/reschedule`, { due_at: new Date(rescheduleAt).toISOString(), reason });
      toast("Rescheduled", "success");
      setActive(null); setRescheduleAt(""); setReason("");
      invalidate("followups", "dashboard"); refetch();
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Follow-ups"
        right={
          <Pressable onPress={() => setCreateOpen(true)} style={styles.addBtn} testID="add-followup">
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        }
      />
      <View style={styles.chips}>
        <Segmented options={BUCKETS} value={bucket} onChange={setBucket} testID="followup-buckets" />
      </View>

      {isLoading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState title="Nothing here" subtitle="No follow-ups in this view." icon="calendar-blank-outline" />}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: spacing.md, gap: 6 }} testID={`followup-${item.id}`}>
              <View style={styles.row}>
                <View style={styles.methodPill}><Icon name={methodIcon(item.method)} size={14} color={colors.onBrandTertiary} /><Text style={styles.methodText}>{item.method}</Text></View>
                {item.status === "Completed" && <Icon name="check-circle" size={20} color={colors.success} />}
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.due}>{item.status === "Completed" ? `Outcome: ${item.outcome}` : `Due ${new Date(item.due_at).toLocaleString()}`}</Text>
              {item.status !== "Completed" && (
                <View style={styles.actions}>
                  <AppButton title="Complete" icon="check" variant="primary" style={{ flex: 1, minHeight: 42 }} onPress={() => { setActive(item); setOutcome(""); }} testID={`complete-${item.id}`} />
                  <AppButton title="Reschedule" icon="calendar-clock" variant="outline" style={{ flex: 1, minHeight: 42 }} onPress={() => { setActive({ ...item, _mode: "reschedule" }); setRescheduleAt(""); setReason(""); }} />
                </View>
              )}
            </Card>
          )}
        />
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="New follow-up">
        <Field label="Next action / title" required value={title} onChangeText={setTitle} placeholder="e.g. Confirm delivery date" testID="fu-title" />
        <DateField label="Due date" required mode="datetime" value={dueAt} onChange={setDueAt} testID="fu-due" />
        <SelectField label="Method" value={method} options={FOLLOWUP_METHODS} onChange={setMethod} />
        <AppButton title="Schedule" onPress={create} loading={saving} testID="fu-save" />
      </Sheet>

      <Sheet open={!!active && active?._mode !== "reschedule"} onClose={() => setActive(null)} title="Complete follow-up">
        <Field label="Outcome" required value={outcome} onChangeText={setOutcome} placeholder="What happened?" multiline testID="fu-outcome" />
        <AppButton title="Mark complete" onPress={complete} testID="fu-complete-save" />
      </Sheet>

      <Sheet open={!!active && active?._mode === "reschedule"} onClose={() => setActive(null)} title="Reschedule">
        <DateField label="New due date" required mode="datetime" value={rescheduleAt} onChange={setRescheduleAt} />
        <Field label="Reason" required value={reason} onChangeText={setReason} placeholder="Why reschedule?" />
        <AppButton title="Reschedule" onPress={reschedule} />
      </Sheet>
    </View>
  );
}

function methodIcon(m: string) {
  return { Call: "phone", Email: "email-outline", WhatsApp: "whatsapp", Meeting: "account-group-outline", Internal: "note-text-outline" }[m] || "bell";
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  chips: { paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  methodPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  methodText: { fontSize: 11, fontWeight: "700", color: colors.onBrandTertiary },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  due: { fontSize: 13, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
}));
