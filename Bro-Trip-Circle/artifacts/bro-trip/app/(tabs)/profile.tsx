import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, circles } = useApp();

  const totalTrips = circles.length;
  const totalEntries = circles.reduce((s, c) => s + c.timeline.length, 0);
  const totalSpent = circles.reduce((s, c) => s + c.budget.reduce((bs, b) => bs + b.amount, 0), 0);

  const handleLogout = () => {
    Alert.alert(
      "Sign out?",
      "Your circles and trips are saved on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("bt_user");
            router.replace("/welcome");
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 70 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.navy, borderRadius: colors.radius, marginHorizontal: 16 }]}>
        <View style={[styles.avatarRing, { borderColor: colors.primary + "50" }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarEmoji}>{currentUser?.avatar || "🏄"}</Text>
          </View>
        </View>
        <Text style={styles.profileName}>{currentUser?.name}</Text>
        <Text style={styles.profileSince}>
          Member since {currentUser?.joinedAt
            ? new Date(currentUser.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : ""}
        </Text>
      </View>

      <View style={[styles.statsRow, { marginHorizontal: 16, marginTop: 16 }]}>
        {[
          { icon: "map-pin", label: "Circles", value: totalTrips },
          { icon: "activity", label: "Posts", value: totalEntries },
          { icon: "dollar-sign", label: "Spent", value: `$${totalSpent.toFixed(0)}` },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
            <Feather name={s.icon as any} size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {circles.length > 0 && (
        <View style={[styles.circlesSection, { marginHorizontal: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Circles</Text>
          {circles.map((c) => {
            const myMember = c.members.find((m) => m.userId === currentUser?.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/circle/${c.id}`)}
                style={({ pressed }) => [
                  styles.circleItem,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.circleItemIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name="map-pin" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.circleItemName, { color: colors.foreground }]}>{c.name}</Text>
                  <Text style={[styles.circleItemSub, { color: colors.mutedForeground }]}>
                    as {myMember?.nickname || "member"} · {c.members.length} members
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={[styles.actions, { marginHorizontal: 16 }]}>
        <Pressable
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: colors.destructive + "40", borderRadius: colors.radius - 4 }]}
        >
          <Feather name="log-out" size={17} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 30, letterSpacing: -0.5 },
  profileCard: { padding: 28, alignItems: "center", gap: 10 },
  avatarRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarEmoji: { fontSize: 38 },
  profileName: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  profileSince: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.5)" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, alignItems: "center", padding: 14, gap: 6, borderWidth: 1 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  circlesSection: { marginTop: 24, gap: 10 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 4 },
  circleItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  circleItemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  circleItemName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  circleItemSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  actions: { marginTop: 24 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderWidth: 1 },
  logoutText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
