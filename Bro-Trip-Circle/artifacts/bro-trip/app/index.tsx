import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const LOADING_NOTES = [
  "珍惜生命 远离毒品",
  "喝酒不开车，开车不喝酒",
  "道路千万条，安全第一条",
  "天上掉馅饼，地下有陷阱",
  "劝君莫打鸟，子在巢中望母归",
  "今天偷税漏税，明天牢里排队",
  "所有的礼物，都在暗中标好了价格",
  "你可以低头，但不能跪下",
  "当你在凝视深渊时，深渊也在凝视着你",
  "别太把自己当回事，这世界离了谁都转得动",
];

export default function RootIndex() {
  const { currentUser, isLoading } = useApp();
  const router = useRouter();
  const colors = useColors();
  const [canNavigate, setCanNavigate] = useState(false);
  const noteRef = useRef(LOADING_NOTES[Math.floor(Math.random() * LOADING_NOTES.length)]);

  // Minimum 1 second on screen so the note is readable
  useEffect(() => {
    const t = setTimeout(() => setCanNavigate(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isLoading || !canNavigate) return;
    if (!currentUser) {
      router.replace("/welcome");
    } else {
      router.replace("/(tabs)/");
    }
  }, [isLoading, canNavigate, currentUser]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        gap: 20,
        paddingHorizontal: 40,
      }}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          textAlign: "center",
          lineHeight: 22,
        }}
      >
        {noteRef.current}
      </Text>
    </View>
  );
}
