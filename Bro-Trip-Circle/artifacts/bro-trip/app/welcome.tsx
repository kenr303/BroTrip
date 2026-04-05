import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const AVATARS = ["🏄", "🧗", "🏕️", "🚵", "🏔️", "🤿", "🪂", "🎿"];

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { setCurrentUser } = useApp();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      setNameError("Enter your name to continue");
      return;
    }
    setNameError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await setCurrentUser({
      id,
      name: name.trim(),
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      joinedAt: new Date().toISOString(),
    });
    setLoading(false);
    router.replace("/(tabs)/");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoSection}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Bro Trip</Text>
            <Text style={styles.tagline}>
              Your private circle.{"\n"}Your wildest trips.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              What do your bros call you?
            </Text>
            <Input
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              error={nameError}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            <Button
              label="Let's Go"
              onPress={handleContinue}
              loading={loading}
              disabled={!name.trim()}
            />
          </View>

          <View style={styles.featureList}>
            {[
              { icon: "lock", text: "Private circles, verified by your friends" },
              { icon: "map", text: "Plan trips, itineraries, and budgets together" },
              { icon: "camera", text: "Share photos and memories privately" },
            ].map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Feather name={f.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.card }]}>{f.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 32,
    paddingTop: Platform.OS === "web" ? 80 : 24,
    paddingBottom: Platform.OS === "web" ? 50 : 24,
  },
  logoSection: { alignItems: "center", gap: 12 },
  icon: { width: 90, height: 90, borderRadius: 20 },
  appName: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 26,
  },
  card: { padding: 24, gap: 20 },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  featureList: { gap: 16 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
});
