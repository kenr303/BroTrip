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
import { type AppNotification, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ── Icon + color per notification type ──────────────────────────────────────
const TYPE_META: Record<
  AppNotification["type"],
  { icon: React.ComponentProps<typeof Feather>["name"]; color: string }
> = {
  member_joined:  { icon: "user-plus",      color: "#6366f1" },
  timeline_post:  { icon: "image",           color: "#3b82f6" },
  comment:        { icon: "message-circle",  color: "#10b981" },
  reaction:       { icon: "heart",           color: "#ec4899" },
  itinerary_added:{ icon: "calendar",        color: "#f59e0b" },
  budget_update:  { icon: "dollar-sign",     color: "#22c55e" },
  join_approved:  { icon: "check-circle",    color: "#10b981" },
  join_request:   { icon: "user-check",      color: "#8b5cf6" },
  security_alert: { icon: "shield",          color: "#ef4444" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useApp();

  const topPad = Platform.OS === "web" ? 70 : insets.top;

  const today = notifications.filter((n) => isToday(n.createdAt));
  const earlier = notifications.filter((n) => !isToday(n.createdAt));

  const handleTap = (n: AppNotification) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.circleId) router.push(`/circle/${n.circleId}`);
  };

  const handleClear = () => {
    Alert.alert("Clear notifications", "Remove all notifications?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: clearNotifications },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllNotificationsRead} style={styles.headerBtn} hitSlop={8}>
              <Text style={[styles.headerBtnText, { color: colors.primary }]}>Mark all read</Text>
            </Pressable>
          )}
          {notifications.length > 0 && (
            <Pressable onPress={handleClear} style={styles.headerBtn} hitSlop={8}>
              <Feather name="trash-2" size={17} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {notifications.length === 0 ? (
        // Empty state
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bell" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications yet</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Activity in your circles will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 90,
            paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
        >
          {today.length > 0 && (
            <Section
              label="Today"
              items={today}
              colors={colors}
              onTap={handleTap}
            />
          )}
          {earlier.length > 0 && (
            <Section
              label="Earlier"
              items={earlier}
              colors={colors}
              onTap={handleTap}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Section({
  label,
  items,
  colors,
  onTap,
}: {
  label: string;
  items: AppNotification[];
  colors: ReturnType<typeof useColors>;
  onTap: (n: AppNotification) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {items.map((n) => {
        const meta = TYPE_META[n.type];
        return (
          <Pressable
            key={n.id}
            onPress={() => onTap(n)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: n.read ? colors.background : colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {/* Unread dot */}
            {!n.read && (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            )}

            {/* Icon */}
            <View style={[styles.iconWrap, { backgroundColor: meta.color + "18" }]}>
              <Feather name={meta.icon} size={18} color={meta.color} />
            </View>

            {/* Text */}
            <View style={styles.textWrap}>
              <View style={styles.rowTop}>
                <Text style={[styles.notifTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  {timeAgo(n.createdAt)}
                </Text>
              </View>
              <Text style={[styles.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>
                {n.body}
              </Text>
              {n.circleName ? (
                <View style={[styles.circlePill, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name="map-pin" size={10} color={colors.primary} />
                  <Text style={[styles.circlePillText, { color: colors.primary }]} numberOfLines={1}>
                    {n.circleName}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 30, letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  headerBtn: { paddingVertical: 4 },
  headerBtnText: { fontFamily: "Inter_500Medium", fontSize: 13 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, textAlign: "center" },
  emptyBody: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },

  section: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: {
    position: "absolute",
    left: 6,
    top: "50%",
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notifTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, marginRight: 8 },
  time: { fontFamily: "Inter_400Regular", fontSize: 11, flexShrink: 0 },
  notifBody: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  circlePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  circlePillText: { fontFamily: "Inter_500Medium", fontSize: 11 },
});
