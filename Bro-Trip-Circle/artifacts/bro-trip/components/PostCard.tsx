import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp, Post } from "@/context/AppContext";

const REACTION_EMOJIS = ["🔥", "😂", "❤️", "🤙", "💀", "🙌"];

interface PostCardProps {
  post: Post;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function PostCard({ post, compact = false }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, addReaction, addComment } = useApp();
  const [showReactions, setShowReactions] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  const myReaction = post.reactions.find((r) => r.userId === currentUser?.id);

  const reactionCounts: Record<string, number> = {};
  post.reactions.forEach((r) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  const handleReact = (emoji: string) => {
    if (!currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addReaction(post.id, { userId: currentUser.id, emoji });
    setShowReactions(false);
  };

  const handleComment = () => {
    if (!commentText.trim() || !currentUser) return;
    addComment(post.id, {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      userId: currentUser.id,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    });
    setCommentText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {post.userId.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {post.userId === currentUser?.id ? currentUser.name : post.userId}
          </Text>
          {post.tripTitle && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Feather name="map-pin" size={11} color={colors.primary} />
              <Text style={[styles.tripTag, { color: colors.primary }]}>{post.tripTitle}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {timeAgo(post.createdAt)}
        </Text>
      </View>

      {post.images.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.imageScroll}
        >
          {post.images.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.image} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

      {post.caption ? (
        <Text style={[styles.caption, { color: colors.foreground }]}>
          {post.caption}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setShowReactions((v) => !v)}
          style={styles.actionBtn}
        >
          <Text style={styles.reactionEmoji}>{myReaction?.emoji || "🔥"}</Text>
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
            {post.reactions.length}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowComments((v) => !v)}
          style={styles.actionBtn}
        >
          <Feather name="message-circle" size={20} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
            {post.comments.length}
          </Text>
        </Pressable>
      </View>

      {Object.keys(reactionCounts).length > 0 && (
        <View style={styles.reactionSummary}>
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <View key={emoji} style={[styles.reactionChip, { backgroundColor: colors.muted }]}>
              <Text style={styles.reactionChipEmoji}>{emoji}</Text>
              <Text style={[styles.reactionChipCount, { color: colors.mutedForeground }]}>
                {count}
              </Text>
            </View>
          ))}
        </View>
      )}

      {showReactions && (
        <View style={[styles.reactionPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {REACTION_EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => handleReact(e)} style={styles.reactionOption}>
              <Text style={styles.reactionOptionText}>{e}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {showComments && (
        <View style={styles.commentsSection}>
          {post.comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <View style={[styles.commentAvatar, { backgroundColor: colors.muted }]}>
                <Text style={[styles.commentAvatarText, { color: colors.mutedForeground }]}>
                  {c.userId.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={[styles.commentBubble, { backgroundColor: colors.muted }]}>
                <Text style={[styles.commentText, { color: colors.foreground }]}>{c.text}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.commentInput, { borderColor: colors.border }]}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.commentField, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              onSubmitEditing={handleComment}
              returnKeyType="send"
            />
            <Pressable onPress={handleComment}>
              <Feather name="send" size={18} color={commentText.trim() ? colors.primary : colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", marginBottom: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  headerInfo: { flex: 1, gap: 2 },
  userName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  tripTag: { fontFamily: "Inter_400Regular", fontSize: 12 },
  time: { fontFamily: "Inter_400Regular", fontSize: 12 },
  imageScroll: { height: 280 },
  image: { width: 340, height: 280 },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  reactionEmoji: { fontSize: 20 },
  actionCount: { fontFamily: "Inter_500Medium", fontSize: 14 },
  reactionSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  reactionChipEmoji: { fontSize: 14 },
  reactionChipCount: { fontFamily: "Inter_500Medium", fontSize: 12 },
  reactionPicker: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  reactionOption: { padding: 4 },
  reactionOptionText: { fontSize: 26 },
  commentsSection: { borderTopWidth: 1, borderTopColor: "#E5E0D8", padding: 14, gap: 10 },
  comment: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  commentBubble: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  commentText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  commentInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  commentField: { flex: 1, fontSize: 14 },
});
