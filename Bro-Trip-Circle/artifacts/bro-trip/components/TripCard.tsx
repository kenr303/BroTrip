import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Trip } from "@/context/AppContext";

interface TripCardProps {
  trip: Trip;
}

function getDaysUntil(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Past";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days away`;
}

function getTripDuration(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return `${diff} day${diff !== 1 ? "s" : ""}`;
}

const COVER_IMAGES: Record<string, number> = {
  road: require("@/assets/images/road-trip.png"),
  hero: require("@/assets/images/trip-hero.png"),
};

export function TripCard({ trip }: TripCardProps) {
  const colors = useColors();
  const router = useRouter();

  const statusColor =
    trip.status === "active"
      ? colors.success
      : trip.status === "upcoming"
        ? colors.primary
        : colors.mutedForeground;

  const statusLabel =
    trip.status === "active"
      ? "In Progress"
      : trip.status === "upcoming"
        ? getDaysUntil(trip.startDate)
        : "Completed";

  const totalSpent = trip.budget.reduce((s, b) => s + b.amount, 0);
  const budgetPct = trip.totalBudget > 0 ? Math.min(totalSpent / trip.totalBudget, 1) : 0;

  const coverSrc = trip.coverImage
    ? { uri: trip.coverImage }
    : COVER_IMAGES[Math.random() > 0.5 ? "road" : "hero"];

  return (
    <Pressable
      onPress={() => router.push(`/trip/${trip.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          opacity: pressed ? 0.92 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
    >
      <ImageBackground
        source={coverSrc}
        style={styles.cover}
        imageStyle={{
          borderTopLeftRadius: colors.radius,
          borderTopRightRadius: colors.radius,
        }}
      >
        <View style={styles.coverOverlay}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.content}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.destination, { color: colors.mutedForeground }]}>{trip.destination}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{trip.title}</Text>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {getTripDuration(trip.startDate, trip.endDate)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="users" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {trip.members.length}
            </Text>
          </View>
        </View>

        {trip.totalBudget > 0 && (
          <View style={styles.budgetSection}>
            <View style={styles.budgetRow}>
              <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>Budget</Text>
              <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>
                ${totalSpent.toFixed(0)} / ${trip.totalBudget}
              </Text>
            </View>
            <View style={[styles.budgetTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.budgetFill,
                  {
                    width: `${budgetPct * 100}%`,
                    backgroundColor: budgetPct > 0.9 ? colors.destructive : colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden" },
  cover: { height: 160, justifyContent: "flex-end" },
  coverOverlay: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "flex-start",
    backgroundColor: "transparent",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  content: { padding: 16, gap: 8 },
  destination: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, lineHeight: 26 },
  meta: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  budgetSection: { gap: 6, marginTop: 4 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  budgetTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 2 },
});
