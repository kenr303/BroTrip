import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: "sm" | "md" | "lg";
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  size = "md",
}: ButtonProps) {
  const colors = useColors();

  const bgColor =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.secondary
        : variant === "destructive"
          ? colors.destructive
          : "transparent";

  const textColor =
    variant === "primary"
      ? colors.primaryForeground
      : variant === "secondary"
        ? colors.secondaryForeground
        : variant === "ghost"
          ? colors.primary
          : colors.destructiveForeground;

  const borderColor =
    variant === "ghost" ? colors.primary : "transparent";

  const paddingV = size === "sm" ? 10 : size === "lg" ? 18 : 14;
  const fontSize = size === "sm" ? 14 : size === "lg" ? 18 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: variant === "ghost" ? 1.5 : 0,
          paddingVertical: paddingV,
          opacity: pressed ? 0.82 : disabled ? 0.5 : 1,
          borderRadius: colors.radius,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
