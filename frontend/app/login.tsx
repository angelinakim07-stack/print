import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/Toast";
import { AppButton, Field, Sheet } from "@/src/components/ui";
import { isInternal } from "@/src/constants";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);

  const onSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("Enter your email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      const msg = e instanceof ApiError ? (typeof e.detail === "string" ? e.detail : e.message) : "Login failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand }}>
      <Image
        source={{ uri: "https://images.pexels.com/photos/1555199/pexels-photo-1555199.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <LinearGradient colors={["rgba(11,43,94,0.85)", "rgba(11,43,94,0.97)"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl, paddingTop: insets.top + spacing.xl }}>
            <View style={styles.brandBadge}>
              <Icon name="package-variant-closed" size={34} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.brandName}>PRINT PACK INC</Text>
            <Text style={styles.brandTag}>Order & Production Management</Text>

            <View style={styles.card}>
              <Field
                label="Email"
                placeholder="you@printpackinc.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                testID="login-email"
              />
              <View>
                <Field
                  label="Password"
                  placeholder="Your password"
                  secureTextEntry={!show}
                  value={password}
                  onChangeText={setPassword}
                  testID="login-password"
                />
                <Pressable onPress={() => setShow((s) => !s)} style={styles.eye} testID="toggle-password" hitSlop={8}>
                  <Icon name={show ? "eye-off" : "eye"} size={22} color={colors.muted} />
                </Pressable>
              </View>
              {!!error && <Text style={styles.error} testID="login-error">{error}</Text>}
              <AppButton title="Sign In" onPress={onSubmit} loading={loading} testID="login-submit" style={{ marginTop: spacing.sm }} />
              <Pressable onPress={() => setForgotOpen(true)} style={{ alignSelf: "center", marginTop: spacing.md }} testID="forgot-password">
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Sheet open={forgotOpen} onClose={() => setForgotOpen(false)} title="Password recovery">
        <Text style={{ color: colors.onSurfaceSecondary, lineHeight: 22, marginBottom: spacing.lg }}>
          Email-based reset is not configured yet. Please contact your administrator — they can reset your password
          from Users & Permissions and share a temporary one.
        </Text>
        <AppButton title="Got it" variant="outline" onPress={() => setForgotOpen(false)} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  brandBadge: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.lg },
  brandName: { fontSize: 28, fontWeight: "900", color: "#FFFFFF", textAlign: "center", letterSpacing: 0.5 },
  brandTag: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xl },
  eye: { position: "absolute", right: spacing.md, top: 34 },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  forgot: { color: colors.brandPrimary, fontWeight: "600", fontSize: 14 },
}));
