import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Input } from "@/components/ui/Input";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

function isValidTime(t: string): boolean {
  return /^(0?[1-9]|1[0-2]):\d{2}\s?(AM|PM)$/i.test(t.trim());
}

function isValidDate(d: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(d.trim())) return false;
  const [m, day, y] = d.split("/").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
}

function activityDate(startDateStr: string, dayNum: number, timeStr: string): Date {
  const fallback = new Date();
  if (!startDateStr || !isValidDate(startDateStr)) return fallback;
  const [m, d, y] = startDateStr.split("/").map(Number);
  const base = new Date(y, m - 1, d + (dayNum - 1));
  if (timeStr && isValidTime(timeStr)) {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
    if (match) {
      let hours = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      base.setHours(hours, mins, 0, 0);
    }
  }
  return base;
}

interface Props {
  circleId: string;
  circleStartDate: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TimelineComposer({ circleId, circleStartDate, isOpen, onClose }: Props) {
  const colors = useColors();
  const { currentUser, addTimelineEntry } = useApp();

  const [composerType, setComposerType] = useState<"post" | "event">("post");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLabel, setEventLabel] = useState("");

  if (!isOpen) return null;

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!res.canceled)
      setImages((prev) => [...prev, ...res.assets.map((a) => a.uri)]);
  };

  const submitEntry = async () => {
    if (!caption.trim() && images.length === 0 && composerType === "post") return;
    if (composerType === "event" && !caption.trim() && !eventLabel.trim()) return;
    if (!currentUser) return;

    const label =
      eventLabel.trim() ||
      (day && eventTime
        ? `Day ${day}, ${eventTime} – ${caption.substring(0, 40)}`
        : "");

    const dayNum = day ? parseInt(day) : undefined;
    const eventAt =
      composerType === "event" && dayNum
        ? activityDate(circleStartDate, dayNum, eventTime.trim())
        : new Date();

    await addTimelineEntry(circleId, {
      id: uid(),
      userId: currentUser.id,
      type: composerType,
      day: dayNum,
      eventTime: eventTime.trim() || undefined,
      eventLabel: label || undefined,
      caption: caption.trim(),
      images,
      reactions: [],
      comments: [],
      createdAt: eventAt.toISOString(),
    });

    setCaption("");
    setImages([]);
    setDay("");
    setEventTime("");
    setEventLabel("");
    setComposerType("post");
    onClose();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View
      style={[
        styles.composer,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.composerToggle, { backgroundColor: colors.muted, borderRadius: 10 }]}>
        {(["post", "event"] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setComposerType(type)}
            style={[
              styles.composerToggleBtn,
              {
                backgroundColor: composerType === type ? colors.card : "transparent",
                borderRadius: 8,
              },
            ]}
          >
            <Feather
              name={type === "post" ? "camera" : "clock"}
              size={14}
              color={composerType === type ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.composerToggleText,
                { color: composerType === type ? colors.primary : colors.mutedForeground },
              ]}
            >
              {type === "post" ? "Post" : "Log Event"}
            </Text>
          </Pressable>
        ))}
      </View>

      {composerType === "event" && (
        <View style={styles.eventFields}>
          <View style={styles.eventFieldRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Day #"
                placeholder="e.g. 2"
                value={day}
                onChangeText={setDay}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Input
                label="Time"
                placeholder="e.g. 7:00 PM"
                value={eventTime}
                onChangeText={setEventTime}
              />
            </View>
          </View>
          <Input
            label="Event Label (optional)"
            placeholder={`Day ${day || "?"}, ${eventTime || "?"} – e.g. buffet dinner`}
            value={eventLabel}
            onChangeText={setEventLabel}
          />
        </View>
      )}

      <TextInput
        placeholder={composerType === "post" ? "Share something with the crew..." : "What happened?"}
        placeholderTextColor={colors.mutedForeground}
        value={caption}
        onChangeText={setCaption}
        multiline
        style={[
          styles.composerInput,
          { color: colors.foreground, fontFamily: "Inter_400Regular", borderTopColor: colors.border },
        ]}
      />

      {images.length > 0 && (
        <View style={styles.imagePreviewRow}>
          {images.map((uri, i) => (
            <View key={i} style={styles.imagePreviewWrap}>
              <Image source={{ uri }} style={[styles.imagePreview, { borderRadius: 8 }]} />
              <Pressable
                onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={[styles.removeImg, { backgroundColor: colors.destructive }]}
              >
                <Feather name="x" size={11} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.composerBar, { borderTopColor: colors.border }]}>
        <Pressable onPress={pickImage} style={styles.composerBarBtn}>
          <Feather name="image" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={submitEntry}
          disabled={!caption.trim() && images.length === 0}
          style={[
            styles.postBtn,
            {
              backgroundColor: !caption.trim() && images.length === 0 ? colors.muted : colors.primary,
              borderRadius: 18,
            },
          ]}
        >
          <Text
            style={[
              styles.postBtnText,
              { color: !caption.trim() && images.length === 0 ? colors.mutedForeground : "#fff" },
            ]}
          >
            Post
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { borderWidth: 1, overflow: "hidden", gap: 0 },
  composerToggle: { flexDirection: "row", margin: 12, padding: 4, gap: 4 },
  composerToggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  composerToggleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  eventFields: { paddingHorizontal: 14, gap: 8 },
  eventFieldRow: { flexDirection: "row", gap: 12 },
  composerInput: { fontSize: 15, minHeight: 60, paddingHorizontal: 14, paddingTop: 12, lineHeight: 22, borderTopWidth: 1 },
  imagePreviewRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, flexWrap: "wrap" },
  imagePreviewWrap: { position: "relative" },
  imagePreview: { width: 72, height: 72 },
  removeImg: { position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  composerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  composerBarBtn: { padding: 4 },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  postBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
