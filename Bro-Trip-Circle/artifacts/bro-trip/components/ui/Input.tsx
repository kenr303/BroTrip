import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: focused
              ? colors.primary
              : error
                ? colors.destructive
                : colors.border,
            color: colors.foreground,
            borderRadius: colors.radius - 4,
          },
          style,
        ]}
        placeholderTextColor={colors.mutedForeground}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
