import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  useApp,
  TimelineEntry,
  ItineraryItem,
  BudgetItem,
  VerificationQuestion,
} from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
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

/** Validate "HH:MM AM/PM" time format */
function isValidTime(t: string): boolean {
  return /^(0?[1-9]|1[0-2]):\d{2}\s?(AM|PM)$/i.test(t.trim());
}

/** Validate "MM/DD/YYYY" date format */
function isValidDate(d: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(d.trim())) return false;
  const [m, day, y] = d.split("/").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
}

/**
 * Compute actual Date for an activity given the circle's trip start date,
 * the day number (1-based), and the time string ("HH:MM AM/PM").
 * Falls back to now if parsing fails.
 */
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

const REACTIONS = ["🔥", "😂", "❤️", "🤙", "💀", "🙌"];
const BUDGET_ICONS: Record<string, string> = {
  transport: "truck",
  food: "coffee",
  accommodation: "home",
  activities: "activity",
  other: "more-horizontal",
};
const BUDGET_CATEGORIES = [
  "transport",
  "food",
  "accommodation",
  "activities",
  "other",
] as const;

type Tab = "timeline" | "itinerary" | "budget" | "members";

// ── Timeline Entry Card ─────────────────────────────────────────────────────
function EntryCard({
  entry,
  circleId,
  memberNickname,
}: {
  entry: TimelineEntry;
  circleId: string;
  memberNickname: (userId: string) => string;
}) {
  const colors = useColors();
  const { currentUser, addReaction, addComment, removeTimelineEntry, updateTimelineEntry } = useApp();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(entry.caption);

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
            <Image
              key={i}
              source={{ uri }}
              style={[styles.entryImage, { borderRadius: colors.radius - 8 }]}
            />
          ))}
        </ScrollView>
      )}

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
          <View
            key={emoji}
            style={[styles.reactionChip, { backgroundColor: colors.muted, borderRadius: 10 }]}
          >
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
              style={[
                styles.commentField,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
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

// ── Activity Form (shared for add + edit) ────────────────────────────────────
interface ActivityFormState {
  day: string;
  time: string;
  title: string;
  notes: string;
  expenseAmount: string;
  expenseCategory: typeof BUDGET_CATEGORIES[number];
  postToTimeline: boolean;
}

function blankForm(): ActivityFormState {
  return {
    day: "1",
    time: "",
    title: "",
    notes: "",
    expenseAmount: "",
    expenseCategory: "activities",
    postToTimeline: true,
  };
}

function formFromItem(item: ItineraryItem): ActivityFormState {
  return {
    day: String(item.day),
    time: item.time,
    title: item.title,
    notes: item.notes,
    expenseAmount: item.expenseAmount ? String(item.expenseAmount) : "",
    expenseCategory: item.expenseCategory ?? "activities",
    postToTimeline: false, // don't re-post on edit by default
  };
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    circles,
    currentUser,
    leaveCircle,
    addItineraryItem,
    updateItineraryItem,
    removeItineraryItem,
    addBudgetItem,
    removeBudgetItem,
    addTimelineEntry,
    addQuestion,
    removeQuestion,
    updateNickname,
    approveJoin,
    rejectJoin,
  } = useApp();

  const circle = circles.find((c) => c.id === id);
  const [activeTab, setActiveTab] = useState<Tab>("timeline");

  // ─── Entry verification gate ────────────────────────────────────────────────
  const [verified, setVerified] = useState(false);
  const [gateQ, setGateQ] = useState<VerificationQuestion | null>(null);
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateError, setGateError] = useState("");

  // Keep a fresh ref to circles so the focus callback never has stale data
  const circlesRef = useRef(circles);
  useEffect(() => { circlesRef.current = circles; }, [circles]);

  useFocusEffect(
    useCallback(() => {
      const c = circlesRef.current.find((c) => c.id === id);
      if (!c || c.questions.length === 0) {
        // No questions defined — skip gate
        setVerified(true);
        return;
      }
      // Pick a fresh random question on every entry
      const q = c.questions[Math.floor(Math.random() * c.questions.length)];
      setGateQ(q);
      setVerified(false);
      setGateAnswer("");
      setGateError("");
    }, [id])
  );

  const handleGateSubmit = () => {
    if (!gateQ) return;
    const norm = gateAnswer.trim().toLowerCase();
    if (!norm) { setGateError("Please type your answer."); return; }
    const ok = gateQ.answers.some((a) => a.toLowerCase() === norm);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerified(true);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setGateError("That's not right. Try another answer, or ask a bro for a hint.");
      setGateAnswer("");
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // Timeline composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<"post" | "event">("post");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLabel, setEventLabel] = useState("");

  // Itinerary: add form
  const [showAddItem, setShowAddItem] = useState(false);
  const [addForm, setAddForm] = useState<ActivityFormState>(blankForm());

  // Itinerary: edit
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ActivityFormState>(blankForm());

  // Budget
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [budgetTitle, setBudgetTitle] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCategory, setBudgetCategory] =
    useState<typeof BUDGET_CATEGORIES[number]>("food");

  // Members / questions
  const [showAddQ, setShowAddQ] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newAnswers, setNewAnswers] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");

  if (!circle) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          Circle not found
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Verification gate screen ────────────────────────────────────────────────
  if (!verified) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy }}>
        <View style={[styles.gateSafeTop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
          {/* back */}
          <Pressable onPress={() => router.back()} style={styles.gateBack}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>

          {/* lock icon + circle name */}
          <View style={styles.gateLockWrap}>
            <View style={styles.gateLockCircle}>
              <Feather name="lock" size={28} color="#fff" />
            </View>
            <Text style={styles.gateCircleName}>{circle.name}</Text>
            <Text style={styles.gateSubtitle}>Answer to enter</Text>
          </View>

          {/* question card */}
          {gateQ ? (
            <View style={[styles.gateCard, { backgroundColor: "#fff" + "0F", borderColor: "#fff" + "20" }]}>
              <Text style={styles.gateQuestionLabel}>Secret question</Text>
              <Text style={styles.gateQuestion}>{gateQ.question}</Text>
            </View>
          ) : null}

          {/* answer input */}
          <View style={styles.gateInputWrap}>
            <TextInput
              style={[styles.gateInput, { color: "#fff", borderColor: gateError ? "#FF5C5C" : "#ffffff50" }]}
              placeholder="Your answer…"
              placeholderTextColor="#ffffff60"
              value={gateAnswer}
              onChangeText={(v) => { setGateAnswer(v); setGateError(""); }}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleGateSubmit}
            />
            {gateError ? (
              <Text style={styles.gateError}>{gateError}</Text>
            ) : null}
          </View>

          <Button
            label="Enter Circle"
            onPress={handleGateSubmit}
            size="lg"
            style={{ marginHorizontal: 24 }}
          />
        </View>
      </View>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const myMember = circle.members.find((m) => m.userId === currentUser?.id);
  const myNickname = myMember?.nickname || currentUser?.name || "";
  const memberNickname = (userId: string) =>
    circle.members.find((m) => m.userId === userId)?.nickname || userId;

  const totalSpent = circle.budget.reduce((s, b) => s + b.amount, 0);
  const budgetPct =
    circle.totalBudget > 0 ? Math.min(totalSpent / circle.totalBudget, 1) : 0;

  const sortedItinerary = [...circle.itinerary].sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.time.localeCompare(b.time)
  );
  const days = [...new Set(sortedItinerary.map((i) => i.day))].sort(
    (a, b) => a - b
  );

  const pendingRequests = (circle.joinRequests || []).filter(
    (r) => r.status === "pending"
  );

  // ── Helpers ─────────────────────────────────────────────────────────────

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

    const entry: TimelineEntry = {
      id: uid(),
      userId: currentUser.id,
      type: composerType,
      day: day ? parseInt(day) : undefined,
      eventTime: eventTime.trim() || undefined,
      eventLabel: label || undefined,
      caption: caption.trim(),
      images,
      reactions: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };
    await addTimelineEntry(circle.id, entry);
    setCaption("");
    setImages([]);
    setDay("");
    setEventTime("");
    setEventLabel("");
    setComposerOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Activity helpers ─────────────────────────────────────────────────────

  /** Creates a budget item for an activity expense, returns its id */
  const createActivityExpense = async (
    f: ActivityFormState,
    activityTitle: string
  ): Promise<string | undefined> => {
    const amount = parseFloat(f.expenseAmount);
    if (!amount || !currentUser) return undefined;
    const budgetItem: BudgetItem = {
      id: uid(),
      title: activityTitle,
      amount,
      paidBy: currentUser.id,
      category: f.expenseCategory,
      date: new Date().toISOString(),
    };
    await addBudgetItem(circle.id, budgetItem);
    return budgetItem.id;
  };

  /** Creates a timeline event entry for an activity, returns its id */
  const createActivityTimelineEntry = async (
    f: ActivityFormState,
    activityTitle: string
  ): Promise<string | undefined> => {
    if (!currentUser) return undefined;
    const dayNum = parseInt(f.day) || 1;
    const label = `Day ${dayNum}, ${f.time || "TBD"} – ${activityTitle}`;
    // Compute the actual datetime for the event so it appears in the right
    // chronological position on the timeline
    const eventAt = activityDate(circle.startDate, dayNum, f.time);
    const entry: TimelineEntry = {
      id: uid(),
      userId: currentUser.id,
      type: "event",
      day: dayNum,
      eventTime: f.time || undefined,
      eventLabel: label,
      caption: f.notes.trim() || activityTitle,
      images: [],
      reactions: [],
      comments: [],
      createdAt: eventAt.toISOString(),
    };
    await addTimelineEntry(circle.id, entry);
    return entry.id;
  };

  const handleAddItem = async () => {
    if (!addForm.title.trim()) return;
    if (addForm.time && !isValidTime(addForm.time)) {
      Alert.alert("Invalid time format", "Please use HH:MM AM/PM (e.g. 07:30 PM)");
      return;
    }

    const title = addForm.title.trim();
    const expenseAmount = parseFloat(addForm.expenseAmount) || undefined;

    const budgetItemId = expenseAmount ? uid() : undefined;
    const budgetItem: BudgetItem | undefined = expenseAmount && currentUser
      ? { id: budgetItemId!, title, amount: expenseAmount, paidBy: currentUser.id, category: addForm.expenseCategory, date: new Date().toISOString() }
      : undefined;

    const timelineEntryId = addForm.postToTimeline ? uid() : undefined;
    const timelineEntry: TimelineEntry | undefined = addForm.postToTimeline && currentUser
      ? (() => {
          const dayNum = parseInt(addForm.day) || 1;
          const eventAt = activityDate(circle.startDate, dayNum, addForm.time);
          return {
            id: timelineEntryId!,
            userId: currentUser.id,
            type: "event" as const,
            day: dayNum,
            eventTime: addForm.time || undefined,
            eventLabel: `Day ${dayNum}, ${addForm.time || "TBD"} – ${title}`,
            caption: addForm.notes.trim() || title,
            images: [],
            reactions: [],
            comments: [],
            createdAt: eventAt.toISOString(),
          };
        })()
      : undefined;

    const item: ItineraryItem = {
      id: uid(),
      day: parseInt(addForm.day) || 1,
      time: addForm.time.trim(),
      title,
      notes: addForm.notes.trim(),
      expenseAmount,
      expenseCategory: expenseAmount ? addForm.expenseCategory : undefined,
      expenseBudgetItemId: budgetItemId,
      postedToTimeline: !!timelineEntryId,
      timelineEntryId,
    };
    await addItineraryItem(circle.id, item, budgetItem, timelineEntry);
    setAddForm(blankForm());
    setShowAddItem(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startEdit = (item: ItineraryItem) => {
    setEditingItemId(item.id);
    setEditForm(formFromItem(item));
  };

  const handleSaveEdit = async (item: ItineraryItem) => {
    const f = editForm;
    if (f.time && !isValidTime(f.time)) {
      Alert.alert("Invalid time format", "Please use HH:MM AM/PM (e.g. 07:30 PM)");
      return;
    }

    const title = f.title.trim() || item.title;
    const newAmount = parseFloat(f.expenseAmount) || 0;
    const oldAmount = item.expenseAmount || 0;
    const expenseChanged = newAmount !== oldAmount;

    let expenseBudgetItemId = item.expenseBudgetItemId;
    let removeBudgetItemId: string | undefined;
    let newBudgetItem: BudgetItem | undefined;

    if (expenseChanged) {
      removeBudgetItemId = item.expenseBudgetItemId;
      if (newAmount > 0 && currentUser) {
        expenseBudgetItemId = uid();
        newBudgetItem = { id: expenseBudgetItemId, title, amount: newAmount, paidBy: currentUser.id, category: f.expenseCategory, date: new Date().toISOString() };
      } else {
        expenseBudgetItemId = undefined;
      }
    }

    let timelineEntryId = item.timelineEntryId;
    let newTimelineEntry: TimelineEntry | undefined;
    if (f.postToTimeline && currentUser) {
      timelineEntryId = uid();
      const dayNum = parseInt(f.day) || item.day;
      const eventAt = activityDate(circle.startDate, dayNum, f.time);
      newTimelineEntry = {
        id: timelineEntryId,
        userId: currentUser.id,
        type: "event" as const,
        day: dayNum,
        eventTime: f.time || undefined,
        eventLabel: `Day ${dayNum}, ${f.time || "TBD"} – ${title}`,
        caption: f.notes.trim() || title,
        images: [],
        reactions: [],
        comments: [],
        createdAt: eventAt.toISOString(),
      };
    }

    await updateItineraryItem(
      circle.id,
      item.id,
      {
        day: parseInt(f.day) || item.day,
        time: f.time,
        title,
        notes: f.notes.trim(),
        expenseAmount: newAmount || undefined,
        expenseCategory: newAmount ? f.expenseCategory : undefined,
        expenseBudgetItemId,
        postedToTimeline: !!timelineEntryId,
        timelineEntryId,
      },
      { removeBudgetItemId, addBudgetItem: newBudgetItem, addTimelineEntry: newTimelineEntry }
    );
    setEditingItemId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveItem = async (item: ItineraryItem) => {
    await removeItineraryItem(circle.id, item.id);
  };

  const handleAddBudget = async () => {
    if (!budgetTitle.trim() || !budgetAmount) return;
    const item: BudgetItem = {
      id: uid(),
      title: budgetTitle.trim(),
      amount: parseFloat(budgetAmount) || 0,
      paidBy: currentUser?.id || "",
      category: budgetCategory,
      date: new Date().toISOString(),
    };
    await addBudgetItem(circle.id, item);
    setBudgetTitle("");
    setBudgetAmount("");
    setBudgetCategory("food");
    setShowAddBudget(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddQuestion = async () => {
    if (!newQ.trim() || !newAnswers.trim()) return;
    const q: VerificationQuestion = {
      id: uid(),
      question: newQ.trim(),
      answers: newAnswers
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean),
      addedBy: currentUser?.id || "",
    };
    await addQuestion(circle.id, q);
    setNewQ("");
    setNewAnswers("");
    setShowAddQ(false);
  };

  const handleSaveNickname = async () => {
    if (!newNickname.trim()) return;
    await updateNickname(circle.id, newNickname.trim());
    setEditingNickname(false);
  };

  const handleLeave = () => {
    Alert.alert("Leave circle?", "You'll need to re-join with an invite code.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          await leaveCircle(circle.id);
          router.back();
        },
      },
    ]);
  };

  const handleShareInvite = async () => {
    const appUrl = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/bro-trip?code=${circle.inviteCode}`
      : null;

    const message = [
      `Join my trip on Bro Trip! 🗺️`,
      ``,
      `Trip: ${circle.name}${circle.destination ? ` → ${circle.destination}` : ""}`,
      `Invite code: ${circle.inviteCode}`,
      appUrl ? `\nLink: ${appUrl}` : ``,
      ``,
      `Download Bro Trip, enter the code, and prove you know the secret answer to join!`,
    ]
      .join("\n")
      .trim();

    try {
      await Share.share({ message, title: `Join ${circle.name} on Bro Trip` });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
  };

  const topPad = Platform.OS === "web" ? 70 : insets.top;

  // ── Activity form renderer (shared for add + edit) ────────────────────────
  const renderActivityForm = (
    f: ActivityFormState,
    setF: (f: ActivityFormState) => void,
    onSave: () => void,
    onCancel: () => void,
    isEdit = false
  ) => (
    <View
      style={[
        styles.addForm,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius - 4,
          borderColor: colors.primary,
        },
      ]}
    >
      <View style={styles.addFormRow}>
        <View style={{ flex: 1 }}>
          <Input
            label="Day"
            placeholder="1"
            value={f.day}
            onChangeText={(v) => setF({ ...f, day: v })}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 2 }}>
          <Input
            label="Time"
            placeholder="10:30 AM"
            value={f.time}
            onChangeText={(v) => setF({ ...f, time: v })}
            error={f.time && !isValidTime(f.time) ? "Use HH:MM AM/PM" : undefined}
          />
        </View>
      </View>

      <Input
        label="Activity"
        placeholder="What are you doing?"
        value={f.title}
        onChangeText={(v) => setF({ ...f, title: v })}
        autoFocus={!isEdit}
      />

      <Input
        label="Notes (optional)"
        placeholder="Address, link, extra details..."
        value={f.notes}
        onChangeText={(v) => setF({ ...f, notes: v })}
      />

      {/* Expense section */}
      <View style={[styles.expenseSection, { backgroundColor: colors.muted, borderRadius: 10 }]}>
        <View style={styles.expenseSectionHeader}>
          <Feather name="dollar-sign" size={14} color={colors.primary} />
          <Text style={[styles.expenseSectionTitle, { color: colors.foreground }]}>
            Activity Expense
          </Text>
          <Text style={[styles.expenseSectionHint, { color: colors.mutedForeground }]}>
            (auto-added to budget)
          </Text>
        </View>
        <Input
          label="Amount ($)"
          placeholder="Leave blank if free"
          value={f.expenseAmount}
          onChangeText={(v) => setF({ ...f, expenseAmount: v })}
          keyboardType="decimal-pad"
        />
        {!!f.expenseAmount && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BUDGET_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setF({ ...f, expenseCategory: cat })}
                style={[
                  styles.catChip,
                  {
                    backgroundColor:
                      f.expenseCategory === cat ? colors.primary : colors.card,
                    borderRadius: 12,
                  },
                ]}
              >
                <Feather
                  name={BUDGET_ICONS[cat] as any}
                  size={13}
                  color={f.expenseCategory === cat ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color:
                        f.expenseCategory === cat ? "#fff" : colors.mutedForeground,
                    },
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Auto-post to timeline */}
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
            {isEdit ? "Re-post to timeline" : "Post to timeline"}
          </Text>
          <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
            Adds a timed event entry in the feed
          </Text>
        </View>
        <Switch
          value={f.postToTimeline}
          onValueChange={(v) => setF({ ...f, postToTimeline: v })}
          trackColor={{ false: colors.border, true: colors.primary + "80" }}
          thumbColor={f.postToTimeline ? colors.primary : colors.mutedForeground}
        />
      </View>

      <View style={styles.addFormActions}>
        <Button label="Cancel" onPress={onCancel} variant="ghost" size="sm" style={{ flex: 1 }} />
        <Button label={isEdit ? "Save" : "Add Activity"} onPress={onSave} size="sm" style={{ flex: 1 }} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.navBack}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.navTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {circle.name}
          </Text>
          {circle.destination ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 }}>
              <Feather name="map-pin" size={11} color={colors.primary} />
              <Text style={[styles.navSub, { color: colors.primary }]}>
                {circle.destination}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={handleShareInvite}
          style={[styles.navBtn, { backgroundColor: colors.muted, borderRadius: 22 }]}
        >
          <Feather name="share" size={17} color={colors.foreground} />
        </Pressable>
        {activeTab === "timeline" && (
          <Pressable
            onPress={() => setComposerOpen((v) => !v)}
            style={[styles.navBtn, { backgroundColor: colors.primary, borderRadius: 22 }]}
          >
            <Feather name={composerOpen ? "x" : "edit-3"} size={18} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Invite code banner */}
      <Pressable
        onPress={handleShareInvite}
        style={[styles.inviteBanner, { backgroundColor: colors.navy }]}
      >
        <Feather name="link" size={13} color={colors.primary} />
        <Text style={styles.inviteLabel}>Invite code:</Text>
        <Text style={styles.inviteCode}>{circle.inviteCode}</Text>
        <Text style={styles.inviteMembers}>
          {circle.members.length} member{circle.members.length !== 1 ? "s" : ""}
        </Text>
        <View style={[styles.shareChip, { backgroundColor: colors.primary + "25", borderRadius: 10 }]}>
          <Text style={[styles.shareChipText, { color: colors.primary }]}>Tap to share</Text>
        </View>
      </Pressable>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["timeline", "itinerary", "budget", "members"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveTab(t)}
            style={[
              styles.tab,
              {
                borderBottomColor:
                  activeTab === t ? colors.primary : "transparent",
                borderBottomWidth: 2.5,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === t ? colors.primary : colors.mutedForeground,
                },
              ]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "members" && pendingRequests.length > 0
                ? ` (${pendingRequests.length})`
                : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            Platform.OS === "web" ? 80 : insets.bottom + 30,
        }}
      >
        {/* ── TIMELINE ──────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <View style={styles.section}>
            {composerOpen && (
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
                <View
                  style={[
                    styles.composerToggle,
                    { backgroundColor: colors.muted, borderRadius: 10 },
                  ]}
                >
                  {(["post", "event"] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setComposerType(type)}
                      style={[
                        styles.composerToggleBtn,
                        {
                          backgroundColor:
                            composerType === type ? colors.card : "transparent",
                          borderRadius: 8,
                        },
                      ]}
                    >
                      <Feather
                        name={type === "post" ? "camera" : "clock"}
                        size={14}
                        color={
                          composerType === type
                            ? colors.primary
                            : colors.mutedForeground
                        }
                      />
                      <Text
                        style={[
                          styles.composerToggleText,
                          {
                            color:
                              composerType === type
                                ? colors.primary
                                : colors.mutedForeground,
                          },
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
                  placeholder={
                    composerType === "post"
                      ? "Share something with the crew..."
                      : "What happened?"
                  }
                  placeholderTextColor={colors.mutedForeground}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  style={[
                    styles.composerInput,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                      borderTopColor: colors.border,
                    },
                  ]}
                />

                {images.length > 0 && (
                  <View style={styles.imagePreviewRow}>
                    {images.map((uri, i) => (
                      <View key={i} style={styles.imagePreviewWrap}>
                        <Image
                          source={{ uri }}
                          style={[styles.imagePreview, { borderRadius: 8 }]}
                        />
                        <Pressable
                          onPress={() =>
                            setImages((prev) =>
                              prev.filter((_, idx) => idx !== i)
                            )
                          }
                          style={[
                            styles.removeImg,
                            { backgroundColor: colors.destructive },
                          ]}
                        >
                          <Feather name="x" size={11} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <View
                  style={[styles.composerBar, { borderTopColor: colors.border }]}
                >
                  <Pressable onPress={pickImage} style={styles.composerBarBtn}>
                    <Feather name="image" size={20} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    onPress={submitEntry}
                    disabled={!caption.trim() && images.length === 0}
                    style={[
                      styles.postBtn,
                      {
                        backgroundColor:
                          !caption.trim() && images.length === 0
                            ? colors.muted
                            : colors.primary,
                        borderRadius: 18,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.postBtnText,
                        {
                          color:
                            !caption.trim() && images.length === 0
                              ? colors.mutedForeground
                              : "#fff",
                        },
                      ]}
                    >
                      Post
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {circle.timeline.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="activity" size={34} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No entries yet
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Log events and share posts with your crew
                </Text>
              </View>
            ) : (
              circle.timeline.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  circleId={circle.id}
                  memberNickname={memberNickname}
                />
              ))
            )}
          </View>
        )}

        {/* ── ITINERARY ─────────────────────────────────────────── */}
        {activeTab === "itinerary" && (
          <View style={styles.section}>
            {days.length === 0 && !showAddItem && (
              <View style={styles.empty}>
                <Feather name="list" size={34} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No activities yet
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Plan your adventure day by day
                </Text>
              </View>
            )}

            {days.map((d) => (
              <View key={d}>
                <Text style={[styles.dayLabel, { color: colors.foreground }]}>
                  Day {d}
                </Text>
                {sortedItinerary
                  .filter((item) => item.day === d)
                  .map((item) =>
                    editingItemId === item.id ? (
                      // ── Inline edit form ──────────────────────
                      <View key={item.id}>
                        {renderActivityForm(
                          editForm,
                          setEditForm,
                          () => handleSaveEdit(item),
                          () => setEditingItemId(null),
                          true
                        )}
                      </View>
                    ) : (
                      // ── Activity row ──────────────────────────
                      <View
                        key={item.id}
                        style={[
                          styles.itineraryRow,
                          {
                            backgroundColor: colors.card,
                            borderRadius: colors.radius - 6,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={[styles.timeChip, { backgroundColor: colors.primary + "15" }]}>
                          <Text style={[styles.timeChipText, { color: colors.primary }]}>
                            {item.time || "--"}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itineraryTitle, { color: colors.foreground }]}>
                            {item.title}
                          </Text>
                          {item.notes ? (
                            <Text style={[styles.itineraryNotes, { color: colors.mutedForeground }]}>
                              {item.notes}
                            </Text>
                          ) : null}
                          <View style={styles.activityMeta}>
                            {item.expenseAmount ? (
                              <View style={[styles.expenseBadge, { backgroundColor: colors.success + "15", borderRadius: 8 }]}>
                                <Feather name="dollar-sign" size={11} color={colors.success} />
                                <Text style={[styles.expenseBadgeText, { color: colors.success }]}>
                                  ${item.expenseAmount.toFixed(2)}
                                </Text>
                              </View>
                            ) : null}
                            {item.postedToTimeline ? (
                              <View style={[styles.timelineBadge, { backgroundColor: colors.primary + "15", borderRadius: 8 }]}>
                                <Feather name="activity" size={11} color={colors.primary} />
                                <Text style={[styles.timelineBadgeText, { color: colors.primary }]}>
                                  In timeline
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.itineraryActions}>
                          <Pressable
                            onPress={() => startEdit(item)}
                            style={[styles.itineraryActionBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}
                          >
                            <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              Alert.alert("Remove activity?", item.title, [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: () => handleRemoveItem(item),
                                },
                              ])
                            }
                            style={[styles.itineraryActionBtn, { backgroundColor: colors.destructive + "15", borderRadius: 8 }]}
                          >
                            <Feather name="trash-2" size={14} color={colors.destructive} />
                          </Pressable>
                        </View>
                      </View>
                    )
                  )}
              </View>
            ))}

            {showAddItem
              ? renderActivityForm(
                  addForm,
                  setAddForm,
                  handleAddItem,
                  () => setShowAddItem(false)
                )
              : editingItemId === null && (
                  <Pressable
                    onPress={() => setShowAddItem(true)}
                    style={[
                      styles.dashedBtn,
                      {
                        borderColor: colors.primary,
                        borderRadius: colors.radius - 4,
                      },
                    ]}
                  >
                    <Feather name="plus" size={18} color={colors.primary} />
                    <Text style={[styles.dashedBtnText, { color: colors.primary }]}>
                      Add Activity
                    </Text>
                  </Pressable>
                )}
          </View>
        )}

        {/* ── BUDGET ──────────────────────────────────────────────── */}
        {activeTab === "budget" && (
          <View style={styles.section}>
            {circle.totalBudget > 0 && (
              <View
                style={[styles.budgetSummary, { backgroundColor: colors.navy, borderRadius: colors.radius }]}
              >
                <View style={styles.budgetSummaryRow}>
                  <Text style={styles.budgetSummaryLabel}>Spent</Text>
                  <Text style={styles.budgetSummaryValue}>
                    ${totalSpent.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.budgetTrack, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <View
                    style={[
                      styles.budgetFill,
                      {
                        width: `${budgetPct * 100}%` as any,
                        backgroundColor:
                          budgetPct > 0.9 ? colors.destructive : colors.primary,
                      },
                    ]}
                  />
                </View>
                <View style={styles.budgetSummaryRow}>
                  <Text style={styles.budgetSummaryRemaining}>
                    Remaining: ${Math.max(0, circle.totalBudget - totalSpent).toFixed(2)}
                  </Text>
                  <Text style={styles.budgetSummaryTotal}>
                    Budget: ${circle.totalBudget}
                  </Text>
                </View>
              </View>
            )}

            {circle.budget.length === 0 && !showAddBudget ? (
              <View style={styles.empty}>
                <Feather name="dollar-sign" size={34} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No expenses yet
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Add expenses manually, or attach them to itinerary activities
                </Text>
              </View>
            ) : (
              circle.budget.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.budgetRow,
                    {
                      backgroundColor: colors.card,
                      borderRadius: colors.radius - 6,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.budgetCatIcon,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <Feather
                      name={BUDGET_ICONS[item.category] as any}
                      size={15}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.budgetItemTitle, { color: colors.foreground }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.budgetItemSub, { color: colors.mutedForeground }]}>
                      {item.category} · {memberNickname(item.paidBy)}
                    </Text>
                  </View>
                  <Text style={[styles.budgetAmount, { color: colors.foreground }]}>
                    ${item.amount.toFixed(2)}
                  </Text>
                  <Pressable onPress={() => removeBudgetItem(circle.id, item.id)}>
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))
            )}

            {circle.budget.length > 0 && (
              <View style={[styles.budgetTotal, { borderTopColor: colors.border }]}>
                <Text style={[styles.budgetTotalLabel, { color: colors.mutedForeground }]}>
                  Total
                </Text>
                <Text style={[styles.budgetTotalValue, { color: colors.foreground }]}>
                  ${totalSpent.toFixed(2)}
                </Text>
              </View>
            )}

            {showAddBudget ? (
              <View
                style={[
                  styles.addForm,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius - 4,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Input
                  label="What was it for?"
                  placeholder="Dinner, Uber, tickets..."
                  value={budgetTitle}
                  onChangeText={setBudgetTitle}
                />
                <Input
                  label="Amount ($)"
                  placeholder="0.00"
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  keyboardType="decimal-pad"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {BUDGET_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setBudgetCategory(cat)}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor:
                            budgetCategory === cat ? colors.primary : colors.muted,
                          borderRadius: 12,
                        },
                      ]}
                    >
                      <Feather
                        name={BUDGET_ICONS[cat] as any}
                        size={13}
                        color={budgetCategory === cat ? "#fff" : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          {
                            color:
                              budgetCategory === cat ? "#fff" : colors.mutedForeground,
                          },
                        ]}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.addFormActions}>
                  <Button
                    label="Cancel"
                    onPress={() => setShowAddBudget(false)}
                    variant="ghost"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Add"
                    onPress={handleAddBudget}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowAddBudget(true)}
                style={[
                  styles.dashedBtn,
                  {
                    borderColor: colors.primary,
                    borderRadius: colors.radius - 4,
                  },
                ]}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={[styles.dashedBtnText, { color: colors.primary }]}>
                  Add Expense
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── MEMBERS ─────────────────────────────────────────────── */}
        {activeTab === "members" && (
          <View style={styles.section}>
            {/* Share invite */}
            <Pressable
              onPress={handleShareInvite}
              style={[styles.shareInviteCard, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.shareInviteTitle}>Invite more friends</Text>
                <Text style={styles.shareInviteCode}>Code: {circle.inviteCode}</Text>
              </View>
              <View style={[styles.shareInviteBtn, { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20 }]}>
                <Feather name="share-2" size={18} color="#fff" />
              </View>
            </Pressable>

            {/* Nickname editor */}
            <View
              style={[
                styles.myNicknameCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius - 4,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                Your Nickname
              </Text>
              {editingNickname ? (
                <View style={{ gap: 10 }}>
                  <Input
                    value={newNickname}
                    onChangeText={setNewNickname}
                    placeholder="Your nickname in this circle"
                    autoFocus
                  />
                  <View style={styles.addFormActions}>
                    <Button
                      label="Cancel"
                      onPress={() => setEditingNickname(false)}
                      variant="ghost"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Save"
                      onPress={handleSaveNickname}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setNewNickname(myNickname);
                    setEditingNickname(true);
                  }}
                  style={styles.nicknameRow}
                >
                  <Text style={[styles.nicknameValue, { color: colors.foreground }]}>
                    {myNickname}
                  </Text>
                  <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* Pending join requests */}
            {pendingRequests.length > 0 && (
              <View style={styles.requestsSection}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Join Requests
                </Text>
                {pendingRequests.map((req) => (
                  <View
                    key={req.id}
                    style={[
                      styles.requestCard,
                      {
                        backgroundColor: colors.card,
                        borderRadius: colors.radius - 4,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.reqAvatar, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.reqAvatarText, { color: colors.mutedForeground }]}>
                        {req.userName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqName, { color: colors.foreground }]}>
                        {req.userName}
                      </Text>
                      <Text style={[styles.reqTime, { color: colors.mutedForeground }]}>
                        Requested {timeAgo(req.requestedAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => approveJoin(circle.id, req.id)}
                      style={[
                        styles.reqApprove,
                        {
                          backgroundColor: colors.success + "15",
                          borderRadius: 8,
                        },
                      ]}
                    >
                      <Feather name="check" size={16} color={colors.success} />
                    </Pressable>
                    <Pressable
                      onPress={() => rejectJoin(circle.id, req.id)}
                      style={[
                        styles.reqReject,
                        {
                          backgroundColor: colors.destructive + "15",
                          borderRadius: 8,
                        },
                      ]}
                    >
                      <Feather name="x" size={16} color={colors.destructive} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Members list */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Members · {circle.members.length}
            </Text>
            {circle.members.map((m) => (
              <View
                key={m.userId}
                style={[
                  styles.memberCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius - 4,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.memberAvatar, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                    {m.nickname.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>
                    {m.nickname}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.mutedForeground }]}>
                    {m.role === "creator" ? "Creator" : "Member"} · joined{" "}
                    {timeAgo(m.joinedAt)}
                  </Text>
                </View>
                {m.userId === currentUser?.id && (
                  <View style={[styles.youBadge, { backgroundColor: colors.primary + "15", borderRadius: 8 }]}>
                    <Text style={[styles.youBadgeText, { color: colors.primary }]}>You</Text>
                  </View>
                )}
              </View>
            ))}

            {/* Verification questions */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
              Verification Questions
            </Text>
            {circle.questions.map((q) => (
              <View
                key={q.id}
                style={[
                  styles.questionCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius - 4,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.questionCardHeader}>
                  <Feather name="lock" size={14} color={colors.primary} />
                  <Text style={[styles.questionText, { color: colors.foreground }]}>
                    {q.question}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (circle.questions.length <= 1) {
                        Alert.alert(
                          "Keep at least 1 question",
                          "You need at least one verification question."
                        );
                        return;
                      }
                      removeQuestion(circle.id, q.id);
                    }}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.answersRow,
                    { backgroundColor: colors.muted, borderRadius: 8 },
                  ]}
                >
                  <Feather name="check-circle" size={12} color={colors.success} />
                  <Text style={[styles.answersText, { color: colors.mutedForeground }]}>
                    {q.answers.join(", ")}
                  </Text>
                </View>
              </View>
            ))}

            {showAddQ ? (
              <View
                style={[
                  styles.addForm,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius - 4,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Input
                  label="Question"
                  placeholder="Something only real friends know..."
                  value={newQ}
                  onChangeText={setNewQ}
                  multiline
                />
                <Input
                  label="Accepted Answers (comma-separated)"
                  placeholder='e.g. rex, "the dog", Rex'
                  value={newAnswers}
                  onChangeText={setNewAnswers}
                />
                <View style={styles.addFormActions}>
                  <Button
                    label="Cancel"
                    onPress={() => setShowAddQ(false)}
                    variant="ghost"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Add"
                    onPress={handleAddQuestion}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowAddQ(true)}
                style={[
                  styles.dashedBtn,
                  {
                    borderColor: colors.primary,
                    borderRadius: colors.radius - 4,
                  },
                ]}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={[styles.dashedBtnText, { color: colors.primary }]}>
                  Add Question
                </Text>
              </Pressable>
            )}

            <Button
              label="Leave Circle"
              onPress={handleLeave}
              variant="destructive"
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  navBack: { padding: 4 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  navSub: { fontFamily: "Inter_500Medium", fontSize: 12 },
  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  inviteLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  inviteCode: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 3,
    flex: 1,
  },
  inviteMembers: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  shareChip: { paddingHorizontal: 8, paddingVertical: 4 },
  shareChipText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  section: { padding: 16, gap: 12 },
  // composer
  composer: { borderWidth: 1, overflow: "hidden", gap: 0 },
  composerToggle: { flexDirection: "row", margin: 12, padding: 4, gap: 4 },
  composerToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  composerToggleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  eventFields: { paddingHorizontal: 14, gap: 8 },
  eventFieldRow: { flexDirection: "row", gap: 12 },
  composerInput: {
    fontSize: 15,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingTop: 12,
    lineHeight: 22,
    borderTopWidth: 1,
  },
  imagePreviewRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    flexWrap: "wrap",
  },
  imagePreviewWrap: { position: "relative" },
  imagePreview: { width: 72, height: 72 },
  removeImg: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  composerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  composerBarBtn: { padding: 4 },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  postBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  // gate
  gateSafeTop: { flex: 1, flexDirection: "column" },
  gateBack: { paddingHorizontal: 20, paddingVertical: 4 },
  gateLockWrap: { alignItems: "center", paddingTop: 32, paddingBottom: 24, gap: 10 },
  gateLockCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#ffffff20",
    alignItems: "center", justifyContent: "center",
  },
  gateCircleName: {
    fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", textAlign: "center", paddingHorizontal: 24,
  },
  gateSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: "#ffffff80" },
  gateCard: {
    marginHorizontal: 24, borderRadius: 14, borderWidth: 1,
    padding: 20, gap: 8, marginBottom: 20,
  },
  gateQuestionLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FFD166",
    textTransform: "uppercase", letterSpacing: 1,
  },
  gateQuestion: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: "#fff", lineHeight: 26 },
  gateInputWrap: { marginHorizontal: 24, marginBottom: 16, gap: 8 },
  gateInput: {
    fontFamily: "Inter_400Regular", fontSize: 16,
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: "#fff",
  },
  gateError: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#FF5C5C" },
  // entry card
  entryCard: { borderWidth: 1, overflow: "hidden" },
  editArea: { borderTopWidth: 1, padding: 12, gap: 8 },
  editField: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 60, fontSize: 14 },
  editActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  eventBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingBottom: 8,
  },
  entryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  entryAvatarText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  entryAuthor: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  entryTime: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  entryCaption: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  imageRow: { paddingHorizontal: 14, paddingBottom: 10 },
  entryImage: { width: 200, height: 180, marginRight: 8 },
  entryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  reactionEmoji: { fontSize: 20 },
  actionCount: { fontFamily: "Inter_500Medium", fontSize: 13 },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reactionPicker: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  reactionOption: { padding: 4 },
  commentsArea: { borderTopWidth: 1, padding: 14, gap: 10 },
  comment: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  commentBubble: { flex: 1, paddingHorizontal: 12, paddingVertical: 8 },
  commentText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  commentField: { flex: 1, fontSize: 14 },
  // itinerary
  dayLabel: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 },
  itineraryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  timeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 2 },
  timeChipText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  itineraryTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  itineraryNotes: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  itineraryActions: { flexDirection: "row", gap: 6, marginTop: 2 },
  itineraryActionBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  activityMeta: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  expenseBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3 },
  expenseBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  timelineBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3 },
  timelineBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  // expense section
  expenseSection: { padding: 14, gap: 10 },
  expenseSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  expenseSectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  expenseSectionHint: { fontFamily: "Inter_400Regular", fontSize: 12 },
  // toggle
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  toggleSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  // budget
  budgetSummary: { padding: 18, gap: 10 },
  budgetSummaryRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetSummaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  budgetSummaryValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  budgetTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 3 },
  budgetSummaryRemaining: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  budgetSummaryTotal: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  budgetCatIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetItemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  budgetItemSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  budgetAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  budgetTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  budgetTotalLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
  budgetTotalValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  // members
  shareInviteCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  shareInviteTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  shareInviteCode: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 3,
  },
  shareInviteBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  myNicknameCard: { padding: 14, borderWidth: 1, gap: 10 },
  nicknameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nicknameValue: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  requestsSection: { gap: 10 },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  reqAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reqAvatarText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  reqName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  reqTime: { fontFamily: "Inter_400Regular", fontSize: 12 },
  reqApprove: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  reqReject: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  memberName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  memberRole: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  youBadge: { paddingHorizontal: 8, paddingVertical: 4 },
  youBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  questionCard: { padding: 14, borderWidth: 1, gap: 10 },
  questionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  questionText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  answersRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  answersText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  // shared
  empty: {
    alignItems: "center",
    gap: 10,
    paddingTop: 50,
    paddingBottom: 20,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  dashedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 14,
  },
  dashedBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  addForm: { borderWidth: 1.5, padding: 16, gap: 14 },
  addFormRow: { flexDirection: "row", gap: 12 },
  addFormActions: { flexDirection: "row", gap: 10 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
