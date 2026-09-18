import { Redirect } from "expo-router";
import { View } from "react-native";

import { useAuth } from "@/src/auth/auth";
import { LoadingView } from "@/src/components/ui";
import { isInternal } from "@/src/constants";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.brand }}>
        <LoadingView text="PRINT PACK INC" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={isInternal(user.role) ? "/(staff)/dashboard" : "/(portal)/home"} />;
}
