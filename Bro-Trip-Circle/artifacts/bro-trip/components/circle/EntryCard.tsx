import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const SCREEN = Dimensions.get("window");
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { useApp, type TimelineEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { timeAgo } from "@/lib/dateUtils";

const REACTIONS = ["🔥", "😂", "❤️", "🤙", "💀", "🙌"];

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

interface Props {
  entry: TimelineEntry;
  circleId: string;
  memberNickname: (userId: string) => string;
}

export function EntryCard({ entry, circleId, memberNickname }: Props) {
  const colors = useColors();
  const { currentUser, addReaction, addComment, removeTimelineEntry, updateTimelineEntry } = useApp();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(entry.caption);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxRef = useRef<FlatList>(null);

  const myReaction = entry.reactions.find((r) => r.userId === currentUser?.id);
  const reactionCounts: Record<string, number> = {};
  entry.reactions.forEach((r) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  const handleReact = (emoji: string) => {
    if (!currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addReaction(circleId, entry.id, { userId: currentUser.id, emoji });
    setShowReactions(false);
  };

  const handleComment = () => {
    if (!commentText.trim() || !currentUser) return;
    addComment(circleId, entry.id, {
      id: uid(),
      userId: currentUser.id,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    });
    setCommentText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveImage = async (url: string) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to save images.");
      return;
    }
    try {
      // cacheDirectory is preferred; documentDirectory is the fallback
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const localUri = `${dir}bro-trip-${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(url, localUri);
      if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Image saved to your photos.");
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? String(e));
    }
  };

  const handleSaveEdit = () => {
    updateTimelineEntry(circleId, entry.id, { caption: editCaption.trim() });
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const isOwn = entry.userId === currentUser?.id;

  return (
    <View
      style={[
        styles.entryCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius - 4,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
      ]}
    >
      {entry.type === "event" && entry.eventLabel && (
        <View style={[styles.eventBadge, { backgroundColor: colors.primary + "15" }]}>
          <Feather name="clock" size={12} color={colors.primary} />
          <Text style={[styles.eventBadgeText, { color: colors.primary }]}>
            {entry.eventLabel}
          </Text>
        </View>
      )}

      <View style={styles.entryHeader}>
        <View style={[styles.entryAvatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.entryAvatarText, { color: colors.primary }]}>
            {memberNickname(entry.userId).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.entryAuthor, { color: colors.foreground }]}>
            {memberNickname(entry.userId)}
          </Text>
          <Text style={[styles.entryTime, { color: colors.mutedForeground }]}>
            {timeAgo(entry.createdAt)}
          </Text>
        </View>
        {isOwn && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { setEditCaption(entry.caption); setIsEditing(true); }}>
              <Feather name="edit-2" size={15} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Delete post?", "This cannot be undone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => removeTimelineEntry(circleId, entry.id) },
                ])
              }
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </Pressable>
          </View>
        )}
      </View>

      {isEditing ? (
        <View style={[styles.editArea, { borderTopColor: colors.border }]}>
          <TextInput
            value={editCaption}
            onChangeText={setEditCaption}
            multiline
            autoFocus
            style={[styles.editField, { color: colors.foreground, fontFamily: "Inter_400Regular", borderColor: colors.primary }]}
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => setIsEditing(false)} style={[styles.editBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}>
              <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSaveEdit} style={[styles.editBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}>
              <Text style={[styles.editBtnText, { color: "#fff" }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : entry.caption ? (
        <Text style={[styles.entryCaption, { color: colors.foreground }]}>{entry.caption}</Text>
      ) : null}

      {entry.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
          {entry.images.map((uri, i) => (
            <Pressable key={i} onPress={() => setLightboxIndex(i)}>
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri }}
                  style={[styles.entryImage, { borderRadius: colors.radius - 8 }]}
                />
                <View style={[styles.downloadBtn, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <Feather name="maximize-2" size={13} color="#fff" />
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Full-screen lightbox */}
      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLightboxIndex(null)}
      >
        <View style={styles.lightboxBg}>
          <Pressable style={styles.lightboxClose} onPress={() => setLightboxIndex(null)}>
            <Feather name="x" size={26} color="#fff" />
          </Pressable>

          <FlatList
            ref={lightboxRef}
            data={entry.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={lightboxIndex ?? 0}
            getItemLayout={(_, index) => ({ length: SCREEN.width, offset: SCREEN.width * index, index })}
            onLayout={() => {
              if (lightboxIndex != null && lightboxIndex > 0) {
                lightboxRef.current?.scrollToIndex({ index: lightboxIndex, animated: false });
              }
            }}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item: uri, index }) => (
              <View style={styles.lightboxSlide}>
                <Image
                  source={{ uri }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
                <Pressable
                  style={[styles.lightboxDownload, { backgroundColor: "rgba(0,0,0,0.55)" }]}
                  onPress={() => handleSaveImage(uri)}
                >
                  <Feather name="download" size={18} color="#fff" />
                  <Text style={styles.lightboxDownloadText}>Save</Text>
                </Pressable>
              </View>
            )}
          />

          {entry.images.length > 1 && (
            <View style={styles.lightboxDots}>
              {entry.images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, { backgroundColor: i === (lightboxIndex ?? 0) ? "#fff" : "rgba(255,255,255,0.35)" }]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>

      <View style={styles.entryActions}>
        <Pressable onPress={() => setShowReactions((v) => !v)} style={styles.actionBtn}>
          <Text style={styles.reactionEmoji}>{myReaction?.emoji || "🔥"}</Text>
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
            {entry.reactions.length}
          </Text>
        </Pressable>
        <Pressable onPress={() => setShowComments((v) => !v)} style={styles.actionBtn}>
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
            {entry.comments.length}
          </Text>
        </Pressable>
        {Object.entries(reactionCounts).map(([emoji, count]) => (
          <View key={emoji} style={[styles.reactionChip, { backgroundColor: colors.muted, borderRadius: 10 }]}>
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{count}</Text>
          </View>
        ))}
      </View>

      {showReactions && (
        <View style={[styles.reactionPicker, { borderTopColor: colors.border }]}>
          {REACTIONS.map((e) => (
            <Pressable key={e} onPress={() => handleReact(e)} style={styles.reactionOption}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {showComments && (
        <View style={[styles.commentsArea, { borderTopColor: colors.border }]}>
          {entry.comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <View style={[styles.commentAvatar, { backgroundColor: colors.muted }]}>
                <Text style={[styles.commentAvatarText, { color: colors.mutedForeground }]}>
                  {memberNickname(c.userId).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={[styles.commentBubble, { backgroundColor: colors.muted, borderRadius: 12 }]}>
                <Text style={[styles.commentText, { color: colors.foreground }]}>{c.text}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.commentInputRow, { borderTopColor: colors.border }]}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Say something..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.commentField, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              onSubmitEditing={handleComment}
              returnKeyType="send"
            />
            <Pressable onPress={handleComment}>
              <Feather
                name="send"
                size={17}
                color={commentText.trim() ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entryCard: { borderWidth: 1, overflow: "hidden" },
  editArea: { borderTopWidth: 1, padding: 12, gap: 8 },
  editField: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 60, fontSize: 14 },
  editActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  eventBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  eventBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 8 },
  entryAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  entryAvatarText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  entryAuthor: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  entryTime: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  entryCaption: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, paddingHorizontal: 14, paddingBottom: 10 },
  imageRow: { paddingHorizontal: 14, paddingBottom: 10 },
  imageWrap: { position: "relative", marginRight: 8 },
  entryImage: { width: 200, height: 180 },
  downloadBtn: { position: "absolute", bottom: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  entryActions: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingBottom: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  reactionEmoji: { fontSize: 20 },
  actionCount: { fontFamily: "Inter_500Medium", fontSize: 13 },
  reactionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3 },
  reactionPicker: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, borderTopWidth: 1 },
  reactionOption: { padding: 4 },
  commentsArea: { borderTopWidth: 1, padding: 14, gap: 10 },
  comment: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  commentBubble: { flex: 1, paddingHorizontal: 12, paddingVertical: 8 },
  commentText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, paddingTop: 10 },
  commentField: { flex: 1, fontSize: 14 },
  lightboxBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" },
  lightboxClose: { position: "absolute", top: 52, right: 20, zIndex: 10, padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20 },
  lightboxSlide: { width: SCREEN.width, height: SCREEN.height, justifyContent: "center", alignItems: "center" },
  lightboxImage: { width: SCREEN.width, height: SCREEN.height * 0.75 },
  lightboxDownload: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  lightboxDownloadText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  lightboxDots: { position: "absolute", bottom: 48, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
