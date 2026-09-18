import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/Icon";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      setToast({ message, type });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 2600);
    },
    [opacity],
  );

  const bg =
    toast?.type === "success" ? colors.success : toast?.type === "error" ? colors.error : colors.surfaceInverse;
  const icon = toast?.type === "success" ? "check-circle" : toast?.type === "error" ? "alert-circle" : "information";

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + spacing.md, backgroundColor: bg, opacity }]}
          testID="app-toast"
        >
          <Icon name={icon as any} size={20} color="#FFFFFF" />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const useStyles = makeStyles((colors) => ({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    ...StyleSheet.flatten({
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    }),
  },
  toastText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", flex: 1 },
}));
