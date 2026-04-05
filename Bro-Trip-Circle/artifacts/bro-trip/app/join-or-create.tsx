import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function JoinOrCreateScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser } = useApp();

  const options = [
    {
      icon: "plus-circle",
      title: "Start a New Circle",
      subtitle: "Create your crew, set the secret questions",
      route: "/create-circle",
      bg: colors.primary,
      fg: "#fff",
    },
    {
      icon: "link",
      title: "Join a Circle",
      subtitle: "Enter an invite code from a bro",
      route: "/join-circle",
      bg: colors.card,
      fg: colors.foreground,
      bordered: true,
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 80 : 40 }]}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hey {currentUser?.name?.split(" ")[0]},</Text>
          <Text style={styles.title}>Ready to plan{"\n"}something epic?</Text>
        </View>

        <View style={styles.options}>
          {options.map((opt) => (
            <Pressable
              key={opt.route}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(opt.route as any);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: opt.bg,
                  borderRadius: colors.radius,
                  borderWidth: opt.bordered ? 1.5 : 0,
                  borderColor: colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: opt.fg + "18" }]}>
                <Feather name={opt.icon as any} size={28} color={opt.fg} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: opt.fg }]}>{opt.title}</Text>
                <Text style={[styles.optionSubtitle, { color: opt.fg + "aa" }]}>{opt.subtitle}</Text>
              </View>
              <Feather name="arrow-right" size={20} color={opt.fg + "80"} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.privacyNote, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: colors.radius - 4 }]}>
          <Feather name="shield" size={18} color="rgba(255,255,255,0.6)" />
          <Text style={styles.privacyText}>
            Your circle is completely private. Only friends who know the secret answers can join.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 36 },
  header: { gap: 8 },
  greeting: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  options: { gap: 14 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, gap: 4 },
  optionTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  optionSubtitle: { fontFamily: "Inter_400Regular", fontSize: 14 },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
  },
  privacyText: {
    flex: 1,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});
