import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, Circle } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

function getDaysUntil(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Completed";
  if (diff === 0) return "Today!";
  if (diff === 1) return "Tomorrow";
  return `${diff} days away`;
}

function getTripDuration(start: string, end: string): string {
  if (!start || !end) return "";
  const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return `${diff} day${diff !== 1 ? "s" : ""}`;
}

const COVERS = [
  require("@/assets/images/trip-hero.png"),
  require("@/assets/images/road-trip.png"),
];

function CircleCard({ circle }: { circle: Circle }) {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, updateCircle } = useApp();
  const [uploading, setUploading] = useState(false);

  const totalSpent = circle.budget.reduce((s, b) => s + b.amount, 0);
  const budgetPct = circle.totalBudget > 0 ? Math.min(totalSpent / circle.totalBudget, 1) : 0;
  const isCreator = circle.createdBy === currentUser?.id;

  const statusColor =
    circle.status === "active"
      ? colors.success
      : circle.status === "upcoming"
        ? colors.primary
        : colors.mutedForeground;

  const fallbackCover = COVERS[circle.id.charCodeAt(0) % COVERS.length];
  const coverSource = circle.coverImage ? { uri: circle.coverImage } : fallbackCover;

  const handleChangeCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const bytes = Uint8Array.from(atob(asset.base64!), (c) => c.charCodeAt(0));
      const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
      const path = `covers/${circle.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("trip-images").upload(path, bytes, { contentType: `image/${ext}`, upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("trip-images").getPublicUrl(path);
      await updateCircle(circle.id, { coverImage: publicUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn("[cover upload]", e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/circle/${circle.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          opacity: pressed ? 0.92 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 4,
        },
      ]}
    >
      <ImageBackground
        source={coverSource}
        style={styles.cover}
        imageStyle={{ borderTopLeftRadius: colors.radius, borderTopRightRadius: colors.radius }}
      >
        <View style={[styles.coverGradient, { backgroundColor: "rgba(0,0,0,0.25)" }]}>
          <View style={[styles.statusBadge, { backgroundColor: "rgba(0,0,0,0.5)", borderColor: statusColor + "60", borderWidth: 1 }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {circle.status === "active" ? "In Progress" : circle.status === "upcoming" ? getDaysUntil(circle.startDate) : "Completed"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isCreator && (
              <Pressable
                onPress={handleChangeCover}
                style={[styles.memberBadge, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size={12} color="#fff" />
                  : <Feather name="camera" size={12} color="rgba(255,255,255,0.9)" />
                }
              </Pressable>
            )}
            <View style={[styles.memberBadge, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
              <Feather name="users" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.memberBadgeText}>{circle.members.length}</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            {circle.destination ? (
              <View style={styles.destRow}>
                <Feather name="map-pin" size={11} color={colors.primary} />
                <Text style={[styles.destination, { color: colors.primary }]}>{circle.destination}</Text>
              </View>
            ) : null}
            <Text style={[styles.circleName, { color: colors.foreground }]}>{circle.name}</Text>
          </View>
          <View style={[styles.timelineBadge, { backgroundColor: colors.muted, borderRadius: 10 }]}>
            <Feather name="activity" size={12} color={colors.mutedForeground} />
            <Text style={[styles.timelineBadgeText, { color: colors.mutedForeground }]}>
              {circle.timeline.length}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {circle.startDate ? (
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(circle.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </Text>
            </View>
          ) : null}
          {circle.startDate && circle.endDate ? (
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {getTripDuration(circle.startDate, circle.endDate)}
              </Text>
            </View>
          ) : null}
        </View>

        {circle.totalBudget > 0 && (
          <View style={styles.budgetRow}>
            <View style={[styles.budgetTrack, { backgroundColor: colors.muted, flex: 1 }]}>
              <View
                style={[
                  styles.budgetFill,
                  {
                    width: `${budgetPct * 100}%` as any,
                    backgroundColor: budgetPct > 0.9 ? colors.destructive : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>
              ${totalSpent.toFixed(0)} / ${circle.totalBudget}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function TripsHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, circles } = useApp();

  const topPad = Platform.OS === "web" ? 70 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={circles}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: topPad + 10 }]}>
            <View>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
                Hey {currentUser?.name?.split(" ")[0]}
              </Text>
              <Text style={[styles.title, { color: colors.foreground }]}>My Trips</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push("/join-circle")}
                style={[styles.headerBtn, { backgroundColor: colors.muted, borderRadius: 22 }]}
              >
                <Feather name="link" size={18} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/create-circle")}
                style={[styles.headerBtn, { backgroundColor: colors.primary, borderRadius: 22 }]}
              >
                <Feather name="plus" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <CircleCard circle={item} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 90 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15", borderRadius: 50 }]}>
              <Feather name="map" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No trips yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Start a new circle for a trip or join an existing one with an invite code.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                onPress={() => router.push("/create-circle")}
                style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>New Trip</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/join-circle")}
                style={[styles.emptyBtnOutline, { borderColor: colors.primary, borderRadius: colors.radius - 4 }]}
              >
                <Feather name="link" size={16} color={colors.primary} />
                <Text style={[styles.emptyBtnOutlineText, { color: colors.primary }]}>Join a Trip</Text>
              </Pressable>
            </View>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: { fontFamily: "Inter_500Medium", fontSize: 14 },
  title: { fontFamily: "Inter_700Bold", fontSize: 30, letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 10 },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  card: { overflow: "hidden" },
  cover: { height: 150, justifyContent: "flex-end" },
  coverGradient: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  memberBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "rgba(255,255,255,0.9)" },
  cardBody: { padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  destRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  destination: { fontFamily: "Inter_500Medium", fontSize: 12 },
  circleName: { fontFamily: "Inter_700Bold", fontSize: 20, lineHeight: 26 },
  timelineBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  timelineBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  budgetTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 2 },
  budgetLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  empty: { alignItems: "center", gap: 16, paddingTop: 80, paddingHorizontal: 36 },
  emptyIcon: { width: 90, height: 90, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 22 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  emptyBtnOutline: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderWidth: 1.5 },
  emptyBtnOutlineText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
