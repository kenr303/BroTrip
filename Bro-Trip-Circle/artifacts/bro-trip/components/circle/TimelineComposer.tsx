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
import { isValidTime, activityDate } from "@/lib/dateUtils";
import { supabase } from "@/lib/supabase";

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
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
  const [images, setImages] = useState<{ uri: string; base64?: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [day, setDay] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLabel, setEventLabel] = useState("");

  if (!isOpen) return null;

  const pickImage = async () => {
    let res;
    try {
      res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });
    } catch {
      return;
    }
    if (!res.canceled)
      setImages((prev) => [
        ...prev,
        ...res.assets.map((a) => ({ uri: a.uri, base64: a.base64 })),
      ]);
  };

  const uploadImages = async (imgs: { uri: string; base64?: string | null }[]): Promise<string[]> => {
    const publicUrls: string[] = [];
    for (const img of imgs) {
      try {
        const ext = (img.uri.split(".").pop()?.split("?")[0] ?? "jpg").toLowerCase();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        // Decode base64 → Uint8Array (works reliably in React Native)
        const binary = atob(img.base64 ?? "");
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const { error } = await supabase.storage
          .from("trip-images")
          .upload(path, bytes, { contentType: `image/${ext}` });
        if (!error) {
          const { data } = supabase.storage.from("trip-images").getPublicUrl(path);
          publicUrls.push(data.publicUrl);
        }
      } catch (_) {
        // skip failed uploads silently
      }
    }
    return publicUrls;
  };

  const submitEntry = async () => {
    if (!caption.trim() && images.length === 0 && composerType === "post") return;
    if (composerType === "event" && !caption.trim() && !eventLabel.trim()) return;
    if (!currentUser) return;

    setUploading(true);
    const uploadedUrls = images.length > 0 ? await uploadImages(images) : [];

    setUploading(false);

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
      images: uploadedUrls,
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
          {images.map((img, i) => (
            <View key={i} style={styles.imagePreviewWrap}>
              <Image source={{ uri: img.uri }} style={[styles.imagePreview, { borderRadius: 8 }]} />
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
          disabled={uploading || (!caption.trim() && images.length === 0)}
          style={[styles.postBtn, {
            backgroundColor: uploading || (!caption.trim() && images.length === 0)
              ? colors.muted : colors.primary,
            borderRadius: 18,
          }]}
        >
          <Text style={[styles.postBtnText, {
            color: uploading || (!caption.trim() && images.length === 0)
              ? colors.mutedForeground : "#fff",
          }]}
          >
            {uploading ? "Uploading..." : "Post"}
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
