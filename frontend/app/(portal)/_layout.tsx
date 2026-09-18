import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth/auth";
import { useUnreadCount } from "@/src/api/hooks";
import { Icon } from "@/src/components/Icon";
import { isInternal } from "@/src/constants";
import { useTheme } from "@/src/theme";

export default function PortalLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const unread = useUnreadCount();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (isInternal(user.role)) return <Redirect href="/(staff)/dashboard" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color }) => <Icon name="home-outline" color={color} size={24} /> }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarIcon: ({ color }) => <Icon name="file-document-outline" color={color} size={24} /> }} />
      <Tabs.Screen name="new-request" options={{ title: "New", tabBarIcon: ({ color }) => <Icon name="plus-box" color={color} size={26} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => <Icon name="bell-outline" color={color} size={24} />,
          tabBarBadge: unread.data?.unread ? unread.data.unread : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Icon name="account-circle-outline" color={color} size={24} /> }} />
    </Tabs>
  );
}
