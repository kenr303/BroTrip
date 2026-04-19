import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const AVATARS = ["🏄", "🧗", "🏕️", "🚵", "🏔️", "🤿", "🪂", "🎿", "🏖️", "🌴", "🚀", "⚡"];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, circles, signOut, updateProfile } = useApp();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  const totalTrips = circles.length;
  const totalEntries = circles.reduce((s, c) => s + c.timeline.length, 0);
  const totalSpent = circles.reduce((s, c) => s + c.budget.reduce((bs, b) => bs + b.amount, 0), 0);

  const startEditing = () => {
    setEditName(currentUser?.name ?? "");
    setEditAvatar(currentUser?.avatar ?? "🏄");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    await updateProfile(editName.trim(), editAvatar);
    setSaving(false);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign out?",
      "You can sign back in anytime with your email and password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await signOut();
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
        {editing ? (
          <>
            {/* Avatar picker */}
            <View style={styles.avatarGrid}>
              {AVATARS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => { setEditAvatar(emoji); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[
                    styles.avatarOption,
                    editAvatar === emoji && { backgroundColor: colors.primary + "40", borderColor: colors.primary, borderWidth: 2 },
                  ]}
                >
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* Name input */}
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[styles.nameInput, { borderColor: editName.trim() ? colors.primary : "rgba(255,255,255,0.3)" }]}
              autoFocus
              maxLength={40}
            />

            <View style={styles.editActions}>
              <Pressable
                onPress={() => setEditing(false)}
                style={[styles.editBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              >
                <Text style={[styles.editBtnText, { color: "#fff" }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!editName.trim() || saving}
                style={[styles.editBtn, { backgroundColor: colors.primary, opacity: !editName.trim() || saving ? 0.5 : 1 }]}
              >
                <Text style={[styles.editBtnText, { color: "#fff" }]}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable onPress={startEditing} style={styles.editIconBtn}>
              <Feather name="edit-2" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
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
          </>
        )}
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
  editIconBtn: { position: "absolute", top: 16, right: 16, padding: 6 },
  avatarRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarEmoji: { fontSize: 38 },
  profileName: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  profileSince: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.5)" },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 8 },
  avatarOption: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  nameInput: { width: "100%", fontFamily: "Inter_400Regular", fontSize: 16, color: "#fff", borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, textAlign: "center" },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4, width: "100%" },
  editBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  editBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
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
