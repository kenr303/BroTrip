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

type Mode = "signin" | "signup";

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, signUp } = useApp();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const err =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, name.trim());

    setLoading(false);

    if (err) {
      setError(err);
    } else {
      router.replace("/(tabs)/");
    }
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
            {/* Tab switcher */}
            <View style={[styles.tabs, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              {(["signin", "signup"] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[
                    styles.tab,
                    mode === m && { backgroundColor: colors.card, borderRadius: 8 },
                  ]}
                >
                  <Text style={[
                    styles.tabText,
                    { color: mode === m ? colors.foreground : colors.mutedForeground },
                  ]}>
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === "signup" && (
              <Input
                label="Name"
                placeholder="What do your bros call you?"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus={mode === "signup"}
                returnKeyType="next"
              />
            )}

            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus={mode === "signin"}
              returnKeyType="next"
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {!!error && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderRadius: 8 }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <Button
              label={mode === "signin" ? "Sign In" : "Create Account"}
              onPress={handleSubmit}
              loading={loading}
              disabled={!email.trim() || password.length < 6 || (mode === "signup" && !name.trim())}
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
  card: { padding: 24, gap: 16 },
  tabs: { flexDirection: "row", padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  featureList: { gap: 16 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
});
