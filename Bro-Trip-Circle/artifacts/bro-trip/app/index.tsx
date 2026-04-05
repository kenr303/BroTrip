import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RootIndex() {
  const { currentUser, isLoading } = useApp();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser) {
      router.replace("/welcome");
    } else {
      router.replace("/(tabs)/");
    }
  }, [isLoading, currentUser]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
