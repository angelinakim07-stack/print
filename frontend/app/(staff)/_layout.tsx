import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth/auth";
import { Icon } from "@/src/components/Icon";
import { isInternal } from "@/src/constants";
import { useTheme } from "@/src/theme";

export default function StaffLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (!isInternal(user.role)) return <Redirect href="/(portal)/home" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: ({ color }) => <Icon name="view-dashboard" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Orders", tabBarIcon: ({ color }) => <Icon name="clipboard-list-outline" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="new"
        options={{ title: "New", tabBarIcon: ({ color }) => <Icon name="plus-box" color={color} size={26} /> }}
      />
      <Tabs.Screen
        name="followups"
        options={{ title: "Follow-ups", tabBarIcon: ({ color }) => <Icon name="calendar-check" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarIcon: ({ color }) => <Icon name="dots-horizontal-circle-outline" color={color} size={24} /> }}
      />
    </Tabs>
  );
}
