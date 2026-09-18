import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";

import { uploadFile } from "@/src/api/client";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import { AppButton, Sheet } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type DocItem = { id: string; original_name: string; category: string };

export function DocumentUploader({
  category, docs, onChange, ensureOrderId,
}: {
  category: string;
  docs: DocItem[];
  onChange: (docs: DocItem[]) => void;
  ensureOrderId: () => Promise<string | undefined>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = docs.filter((d) => d.category === category);

  const doUpload = async (uri: string, name: string, type: string) => {
    setBusy(true);
    try {
      const orderId = await ensureOrderId();
      const res = await uploadFile(uri, name, type, category, orderId);
      onChange([...docs, { id: res.id, original_name: res.original_name || name, category }]);
      toast("Uploaded", "success");
    } catch (e: any) {
      toast(e.message || "Upload failed", "error");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        toast("Camera blocked. Enable it in Settings.", "error");
        Linking.openSettings();
      } else toast("Camera permission needed", "error");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) {
      const a = res.assets[0];
      await doUpload(a.uri, a.fileName || `photo-${Date.now()}.jpg`, a.mimeType || "image/jpeg");
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) { toast("Photos blocked. Enable in Settings.", "error"); Linking.openSettings(); }
      else toast("Photo permission needed", "error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled) {
      const a = res.assets[0];
      await doUpload(a.uri, a.fileName || `image-${Date.now()}.jpg`, a.mimeType || "image/jpeg");
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled) {
      const a = res.assets[0];
      await doUpload(a.uri, a.name, a.mimeType || "application/octet-stream");
    }
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      {items.map((d) => (
        <View key={d.id} style={styles.docRow}>
          <Icon name="file-check-outline" size={18} color={colors.success} />
          <Text style={styles.docName} numberOfLines={1}>{d.original_name}</Text>
          <Pressable onPress={() => onChange(docs.filter((x) => x.id !== d.id))} hitSlop={8}>
            <Icon name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => setOpen(true)} style={styles.addRow} testID={`upload-${category}`}>
        <Icon name="paperclip" size={18} color={colors.brandPrimary} />
        <Text style={styles.addText}>Attach {category}</Text>
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={`Attach ${category}`}>
        {Platform.OS !== "web" && <AppButton title="Take Photo" icon="camera" variant="outline" onPress={takePhoto} loading={busy} style={{ marginBottom: spacing.sm }} />}
        {Platform.OS !== "web" && <AppButton title="Choose from Photos" icon="image-outline" variant="outline" onPress={pickPhoto} loading={busy} style={{ marginBottom: spacing.sm }} />}
        <AppButton title="Choose File" icon="file-outline" onPress={pickFile} loading={busy} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: 6 },
  docName: { flex: 1, color: colors.onSurface, fontSize: 13 },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 12, borderWidth: 1, borderColor: colors.brandPrimary, borderStyle: "dashed", borderRadius: radius.md, justifyContent: "center" },
  addText: { color: colors.brandPrimary, fontWeight: "600", fontSize: 14 },
}));
