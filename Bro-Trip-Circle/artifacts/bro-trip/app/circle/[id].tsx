import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
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
import { EntryCard } from "@/components/circle/EntryCard";
import { TimelineComposer } from "@/components/circle/TimelineComposer";
import { VerificationGate } from "@/components/circle/VerificationGate";
import { timeAgo, isValidTime, timeToMinutes, activityDate } from "@/lib/dateUtils";

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

// Persists across navigation for the lifetime of the app session
const verifiedThisSession = new Set<string>();

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

// ── Activity Form (shared for add + edit) ────────────────────────────────────
interface ActivityFormState {
  day: string;
  time: string;
  title: string;
  notes: string;
  expenseAmount: string;
  expenseCategory: typeof BUDGET_CATEGORIES[number];
  expensePaidBy: string;
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
    expensePaidBy: "",
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
    expensePaidBy: "",
    postToTimeline: false,
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
    updateCircle,
    approveJoin,
    rejectJoin,
    removeMember,
    initiateDeleteVote,
    castDeleteVote,
    cancelDeleteVote,
    deleteCircle,
  } = useApp();

  const circle = circles.find((c) => c.id === id);
  const [activeTab, setActiveTab] = useState<Tab>("timeline");

  const [verified, setVerified] = useState(() => verifiedThisSession.has(id));

  const [composerOpen, setComposerOpen] = useState(false);

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
  const [budgetPaidBy, setBudgetPaidBy] = useState("");
  const [editingTotalBudget, setEditingTotalBudget] = useState(false);
  const [totalBudgetInput, setTotalBudgetInput] = useState("");

  // Edit circle details
  const [showEditCircle, setShowEditCircle] = useState(false);
  const [editCircleName, setEditCircleName] = useState("");
  const [editCircleDestination, setEditCircleDestination] = useState("");
  const [editCircleDescription, setEditCircleDescription] = useState("");
  const [editCircleStartDate, setEditCircleStartDate] = useState("");
  const [editCircleEndDate, setEditCircleEndDate] = useState("");
  const [savingCircleEdit, setSavingCircleEdit] = useState(false);

  // Members / questions
  const [showAddQ, setShowAddQ] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newAnswers, setNewAnswers] = useState("");
  const [newQDifficulty, setNewQDifficulty] = useState<"easy" | "medium" | "hard">("medium");
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

  if (!verified) return <VerificationGate circleId={id} onVerified={() => { verifiedThisSession.add(id); setVerified(true); }} onBack={() => router.back()} />;

  const myMember = circle.members.find((m) => m.userId === currentUser?.id);
  const myNickname = myMember?.nickname || currentUser?.name || "";
  const isCreator = circle.createdBy === currentUser?.id;
  const memberNickname = (userId: string) =>
    circle.members.find((m) => m.userId === userId)?.nickname || userId;

  // Delete vote helpers
  const deleteResponses = circle.deleteResponses ?? [];
  const deleteDeadline = circle.deleteInitiatedAt
    ? new Date(new Date(circle.deleteInitiatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const isPastDeadline = deleteDeadline ? new Date() > deleteDeadline : false;
  const yesVotes = deleteResponses.filter((r) => r.vote === "yes").length;
  const noVotes = deleteResponses.filter((r) => r.vote === "no").length;
  const notVoted = circle.members.length - deleteResponses.length;
  const effectiveYes = isPastDeadline ? yesVotes + notVoted : yesVotes;
  const deleteApproved = effectiveYes > circle.members.length * 0.5;
  const myVote = deleteResponses.find((r) => r.userId === currentUser?.id)?.vote ?? null;

  const handleInitiateDelete = () => {
    Alert.alert(
      "Start Deletion Vote?",
      `All ${circle.members.length} members will be notified and asked to vote. If more than 50% vote yes (or don't respond within 7 days), the circle will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start Vote", style: "destructive", onPress: () => initiateDeleteVote(circle.id) },
      ]
    );
  };

  const handleDeleteApproved = () => {
    Alert.alert(
      "Delete Circle",
      "Vote passed. This will permanently delete the circle and all its data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            await deleteCircle(circle.id);
            router.replace("/(tabs)/");
          },
        },
      ]
    );
  };

  const openEditCircle = () => {
    // Pre-fill with current values; convert ISO dates to MM/DD/YYYY for display
    const toMDY = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };
    setEditCircleName(circle.name);
    setEditCircleDestination(circle.destination);
    setEditCircleDescription(circle.description);
    setEditCircleStartDate(toMDY(circle.startDate));
    setEditCircleEndDate(toMDY(circle.endDate));
    setShowEditCircle(true);
  };

  const handleSaveCircleEdit = async () => {
    if (!editCircleName.trim()) return;
    setSavingCircleEdit(true);
    const parseMDY = (s: string) => {
      if (!s.trim()) return "";
      const [m, d, y] = s.split("/");
      if (!m || !d || !y) return s;
      return new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
    };
    await updateCircle(circle.id, {
      name: editCircleName.trim(),
      destination: editCircleDestination.trim(),
      description: editCircleDescription.trim(),
      startDate: parseMDY(editCircleStartDate),
      endDate: parseMDY(editCircleEndDate),
    });
    setSavingCircleEdit(false);
    setShowEditCircle(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const totalSpent = circle.budget.reduce((s, b) => s + b.amount, 0);
  const budgetPct =
    circle.totalBudget > 0 ? Math.min(totalSpent / circle.totalBudget, 1) : 0;

  // ── Budget split calculations ─────────────────────────────────────────────
  const splitSettlements = (() => {
    if (circle.members.length < 2 || circle.budget.length === 0) return [];
    const fairShare = totalSpent / circle.members.length;
    const balances = circle.members.map((m) => {
      const paid = circle.budget
        .filter((b) => b.paidBy === m.userId)
        .reduce((s, b) => s + b.amount, 0);
      return { userId: m.userId, balance: paid - fairShare };
    });
    // Greedy settlement — minimise number of transactions
    const debtors = balances.filter((b) => b.balance < -0.005).map((b) => ({ ...b }));
    const creditors = balances.filter((b) => b.balance > 0.005).map((b) => ({ ...b }));
    const result: { from: string; to: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(-debtors[i].balance, creditors[j].balance);
      if (amount > 0.005) result.push({ from: debtors[i].userId, to: creditors[j].userId, amount });
      debtors[i].balance += amount;
      creditors[j].balance -= amount;
      if (Math.abs(debtors[i].balance) < 0.005) i++;
      if (Math.abs(creditors[j].balance) < 0.005) j++;
    }
    return result;
  })();

  const sortedItinerary = [...circle.itinerary].sort((a, b) =>
    a.day !== b.day ? a.day - b.day : timeToMinutes(a.time) - timeToMinutes(b.time)
  );
  const days = [...new Set(sortedItinerary.map((i) => i.day))].sort(
    (a, b) => a - b
  );

  const pendingRequests = (circle.joinRequests || []).filter(
    (r) => r.status === "pending"
  );

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
      ? { id: budgetItemId!, title, amount: expenseAmount, paidBy: addForm.expensePaidBy || currentUser.id, category: addForm.expenseCategory, date: new Date().toISOString() }
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
        newBudgetItem = { id: expenseBudgetItemId, title, amount: newAmount, paidBy: f.expensePaidBy || currentUser.id, category: f.expenseCategory, date: new Date().toISOString() };
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
      paidBy: budgetPaidBy || currentUser?.id || "",
      category: budgetCategory,
      date: new Date().toISOString(),
    };
    await addBudgetItem(circle.id, item);
    setBudgetTitle("");
    setBudgetAmount("");
    setBudgetCategory("food");
    setBudgetPaidBy("");
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
      difficulty: newQDifficulty,
    };
    await addQuestion(circle.id, q);
    setNewQ("");
    setNewAnswers("");
    setNewQDifficulty("medium");
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
    } catch (_) { }
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
          <>
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
                      { color: f.expenseCategory === cat ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.catLabel, { color: colors.mutedForeground, marginTop: 6 }]}>PAID BY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {circle.members.map((m) => {
                const selected = (f.expensePaidBy || currentUser?.id) === m.userId;
                return (
                  <Pressable
                    key={m.userId}
                    onPress={() => setF({ ...f, expensePaidBy: m.userId })}
                    style={[styles.catChip, { backgroundColor: selected ? colors.primary : colors.card, borderRadius: 12 }]}
                  >
                    <Text style={[styles.catChipText, { color: selected ? "#fff" : colors.mutedForeground }]}>
                      {m.nickname}{m.userId === currentUser?.id ? " (you)" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
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
        {isCreator && (
          <Pressable
            onPress={openEditCircle}
            style={[styles.navBtn, { backgroundColor: colors.muted, borderRadius: 22 }]}
          >
            <Feather name="settings" size={17} color={colors.foreground} />
          </Pressable>
        )}
        {activeTab === "timeline" && (
          <Pressable
            onPress={() => setComposerOpen((v) => !v)}
            style={[styles.navBtn, { backgroundColor: colors.primary, borderRadius: 22 }]}
          >
            <Feather name={composerOpen ? "x" : "edit-3"} size={18} color="#fff" />
          </Pressable>
        )}
      </View>

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

      {/* ── Delete vote banner ───────────────────────────────────── */}
      {circle.deleteInitiatedAt && (
        <View style={[styles.voteBanner, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}>
          <View style={styles.voteBannerTop}>
            <Feather name="alert-triangle" size={15} color={colors.destructive} />
            <Text style={[styles.voteBannerTitle, { color: colors.destructive }]}>
              Deletion Vote In Progress
            </Text>
          </View>
          <Text style={[styles.voteBannerSub, { color: colors.mutedForeground }]}>
            {deleteApproved
              ? "Vote passed — circle can now be deleted."
              : `${effectiveYes} of ${circle.members.length} yes · Deadline: ${deleteDeadline?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          </Text>
          {deleteApproved && isCreator ? (
            <Pressable
              onPress={handleDeleteApproved}
              style={[styles.voteBannerBtn, { backgroundColor: colors.destructive }]}
            >
              <Text style={styles.voteBannerBtnText}>Delete Circle Forever</Text>
            </Pressable>
          ) : !myVote && !isCreator ? (
            <View style={styles.voteButtons}>
              <Pressable
                onPress={() => castDeleteVote(circle.id, "yes")}
                style={[styles.voteBtn, { backgroundColor: colors.destructive + "20", borderColor: colors.destructive + "60" }]}
              >
                <Text style={[styles.voteBtnText, { color: colors.destructive }]}>Yes, Delete</Text>
              </Pressable>
              <Pressable
                onPress={() => castDeleteVote(circle.id, "no")}
                style={[styles.voteBtn, { backgroundColor: colors.success + "20", borderColor: colors.success + "60" }]}
              >
                <Text style={[styles.voteBtnText, { color: colors.success }]}>No, Keep It</Text>
              </Pressable>
            </View>
          ) : myVote ? (
            <Text style={[styles.votedLabel, { color: colors.mutedForeground }]}>
              You voted: <Text style={{ color: myVote === "yes" ? colors.destructive : colors.success, fontFamily: "Inter_600SemiBold" }}>{myVote === "yes" ? "Yes, delete" : "No, keep it"}</Text>
            </Text>
          ) : null}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            Platform.OS === "web" ? 80 : insets.bottom + 30,
        }}
      >
        {/* ── TIMELINE ──────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <View style={styles.section}>
            <TimelineComposer
              circleId={circle.id}
              circleStartDate={circle.startDate}
              isOpen={composerOpen}
              onClose={() => setComposerOpen(false)}
            />

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
                  {isCreator && editingTotalBudget ? (
                    <View style={styles.budgetEditRow}>
                      <Input
                        value={totalBudgetInput}
                        onChangeText={setTotalBudgetInput}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        style={styles.budgetEditInput}
                      />
                      <Pressable
                        onPress={async () => {
                          const val = parseFloat(totalBudgetInput);
                          if (!isNaN(val) && val >= 0) {
                            await updateCircle(circle.id, { totalBudget: val });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }
                          setEditingTotalBudget(false);
                        }}
                        style={[styles.budgetEditSave, { backgroundColor: colors.primary }]}
                      >
                        <Feather name="check" size={14} color="#fff" />
                      </Pressable>
                      <Pressable onPress={() => setEditingTotalBudget(false)}>
                        <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={isCreator ? () => { setTotalBudgetInput(String(circle.totalBudget)); setEditingTotalBudget(true); } : undefined}
                      style={styles.budgetTotalPressable}
                    >
                      <Text style={styles.budgetSummaryTotal}>
                        Budget: ${circle.totalBudget}
                      </Text>
                      {isCreator && <Feather name="edit-2" size={11} color="rgba(255,255,255,0.45)" style={{ marginLeft: 5 }} />}
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* No budget set yet — creator can set one */}
            {circle.totalBudget === 0 && isCreator && !editingTotalBudget && (
              <Pressable
                onPress={() => { setTotalBudgetInput(""); setEditingTotalBudget(true); }}
                style={[styles.setBudgetBtn, { borderColor: colors.primary + "50", borderRadius: colors.radius - 4 }]}
              >
                <Feather name="dollar-sign" size={15} color={colors.primary} />
                <Text style={[styles.setBudgetText, { color: colors.primary }]}>Set Trip Budget</Text>
              </Pressable>
            )}
            {circle.totalBudget === 0 && isCreator && editingTotalBudget && (
              <View style={[styles.setBudgetCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Text style={[styles.setBudgetCardLabel, { color: colors.foreground }]}>Total Trip Budget ($)</Text>
                <View style={styles.budgetEditRow}>
                  <Input
                    value={totalBudgetInput}
                    onChangeText={setTotalBudgetInput}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 2000"
                    style={{ flex: 1 }}
                  />
                  <Pressable
                    onPress={async () => {
                      const val = parseFloat(totalBudgetInput);
                      if (!isNaN(val) && val > 0) {
                        await updateCircle(circle.id, { totalBudget: val });
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                      setEditingTotalBudget(false);
                    }}
                    style={[styles.budgetEditSave, { backgroundColor: colors.primary }]}
                  >
                    <Feather name="check" size={14} color="#fff" />
                  </Pressable>
                  <Pressable onPress={() => setEditingTotalBudget(false)}>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </Pressable>
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

            {/* ── Split summary ───────────────────────────────────────── */}
            {circle.budget.length > 0 && circle.members.length > 1 && (
              <View style={[styles.splitCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <View style={styles.splitHeader}>
                  <Feather name="users" size={14} color={colors.primary} />
                  <Text style={[styles.splitTitle, { color: colors.foreground }]}>Split</Text>
                  <Text style={[styles.splitShare, { color: colors.mutedForeground }]}>
                    ${(totalSpent / circle.members.length).toFixed(2)} / person
                  </Text>
                </View>

                {/* Per-member paid vs share */}
                {circle.members.map((m) => {
                  const paid = circle.budget
                    .filter((b) => b.paidBy === m.userId)
                    .reduce((s, b) => s + b.amount, 0);
                  const fairShare = totalSpent / circle.members.length;
                  const diff = paid - fairShare;
                  const isEven = Math.abs(diff) < 0.005;
                  return (
                    <View key={m.userId} style={styles.splitMemberRow}>
                      <Text style={[styles.splitMemberName, { color: colors.foreground }]} numberOfLines={1}>
                        {m.nickname}
                      </Text>
                      <Text style={[styles.splitMemberPaid, { color: colors.mutedForeground }]}>
                        paid ${paid.toFixed(2)}
                      </Text>
                      <Text style={[
                        styles.splitMemberDiff,
                        { color: isEven ? colors.mutedForeground : diff > 0 ? "#22c55e" : colors.destructive }
                      ]}>
                        {isEven ? "even" : diff > 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`}
                      </Text>
                    </View>
                  );
                })}

                {/* Settlement suggestions */}
                {splitSettlements.length > 0 && (
                  <View style={[styles.splitSettleSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.splitSettleLabel, { color: colors.mutedForeground }]}>
                      To settle up
                    </Text>
                    {splitSettlements.map((s, idx) => (
                      <View key={idx} style={styles.splitSettleRow}>
                        <Text style={[styles.splitSettleName, { color: colors.foreground }]}>
                          {memberNickname(s.from)}
                        </Text>
                        <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.splitSettleName, { color: colors.foreground }]}>
                          {memberNickname(s.to)}
                        </Text>
                        <Text style={[styles.splitSettleAmount, { color: colors.foreground }]}>
                          ${s.amount.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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

                {/* Paid by */}
                <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>PAID BY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {circle.members.map((m) => {
                    const selected = (budgetPaidBy || currentUser?.id) === m.userId;
                    return (
                      <Pressable
                        key={m.userId}
                        onPress={() => setBudgetPaidBy(m.userId)}
                        style={[styles.catChip, { backgroundColor: selected ? colors.primary : colors.muted, borderRadius: 12 }]}
                      >
                        <Text style={[styles.catChipText, { color: selected ? "#fff" : colors.mutedForeground }]}>
                          {m.nickname}{m.userId === currentUser?.id ? " (you)" : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
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
                {m.userId === currentUser?.id ? (
                  <View style={[styles.youBadge, { backgroundColor: colors.primary + "15", borderRadius: 8 }]}>
                    <Text style={[styles.youBadgeText, { color: colors.primary }]}>You</Text>
                  </View>
                ) : isCreator ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        `Remove ${m.nickname}?`,
                        "They will be removed from the circle and will need to rejoin with the invite code.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () => removeMember(circle.id, m.userId),
                          },
                        ]
                      )
                    }
                    style={[styles.removeMemberBtn, { backgroundColor: colors.destructive + "15", borderRadius: 8 }]}
                  >
                    <Feather name="user-minus" size={14} color={colors.destructive} />
                  </Pressable>
                ) : null}
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
                <View>
                  <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>DIFFICULTY</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => setNewQDifficulty(d)}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: newQDifficulty === d ? colors.primary : colors.muted,
                            borderRadius: 12,
                            flex: 1,
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <Text style={[styles.catChipText, { color: newQDifficulty === d ? "#fff" : colors.mutedForeground }]}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
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

            {/* Delete circle — creator only */}
            {isCreator && (
              <View style={[styles.deleteSection, { borderTopColor: colors.border }]}>
                {!circle.deleteInitiatedAt ? (
                  <Pressable
                    onPress={handleInitiateDelete}
                    style={[styles.deleteBtn, { borderColor: colors.destructive + "50", borderRadius: colors.radius - 4 }]}
                  >
                    <Feather name="trash-2" size={15} color={colors.destructive} />
                    <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Circle…</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => cancelDeleteVote(circle.id)}
                    style={[styles.deleteBtn, { borderColor: colors.mutedForeground + "40", borderRadius: colors.radius - 4 }]}
                  >
                    <Feather name="x-circle" size={15} color={colors.mutedForeground} />
                    <Text style={[styles.deleteBtnText, { color: colors.mutedForeground }]}>Cancel Deletion Vote</Text>
                  </Pressable>
                )}
              </View>
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

      {/* ── Edit Circle Modal ────────────────────────────────────────── */}
      <Modal
        visible={showEditCircle}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditCircle(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.editModalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => setShowEditCircle(false)}>
              <Text style={[styles.editModalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.editModalTitle, { color: colors.foreground }]}>Edit Circle</Text>
            <Pressable onPress={handleSaveCircleEdit} disabled={!editCircleName.trim() || savingCircleEdit}>
              <Text style={[styles.editModalSave, { color: !editCircleName.trim() || savingCircleEdit ? colors.mutedForeground : colors.primary }]}>
                {savingCircleEdit ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Input
              label="Circle Name"
              value={editCircleName}
              onChangeText={setEditCircleName}
              placeholder="Weekend trip name..."
            />
            <Input
              label="Destination"
              value={editCircleDestination}
              onChangeText={setEditCircleDestination}
              placeholder="Where are you going?"
            />
            <Input
              label="Description"
              value={editCircleDescription}
              onChangeText={setEditCircleDescription}
              placeholder="What's this trip about?"
            />
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Date"
                  value={editCircleStartDate}
                  onChangeText={setEditCircleStartDate}
                  placeholder="MM/DD/YYYY"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Date"
                  value={editCircleEndDate}
                  onChangeText={setEditCircleEndDate}
                  placeholder="MM/DD/YYYY"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  navBack: {
    padding: 4,
  },
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
  catLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 1,
  },
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
  budgetTotalPressable: { flexDirection: "row", alignItems: "center" },
  budgetEditRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" },
  budgetEditInput: { width: 90, height: 34, fontSize: 13 },
  budgetEditSave: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  setBudgetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderWidth: 1.5, borderStyle: "dashed" as any, marginBottom: 12 },
  setBudgetText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  setBudgetCard: { padding: 14, borderWidth: 1, gap: 10, marginBottom: 12 },
  setBudgetCardLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
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
  // split
  splitCard: { borderWidth: 1, padding: 14, gap: 10, marginTop: 4 },
  splitHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  splitTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  splitShare: { fontFamily: "Inter_400Regular", fontSize: 13 },
  splitMemberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  splitMemberName: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
  splitMemberPaid: { fontFamily: "Inter_400Regular", fontSize: 12 },
  splitMemberDiff: { fontFamily: "Inter_600SemiBold", fontSize: 13, minWidth: 56, textAlign: "right" },
  splitSettleSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  splitSettleLabel: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  splitSettleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  splitSettleName: { fontFamily: "Inter_500Medium", fontSize: 13 },
  splitSettleAmount: { fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: "auto" as any },
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
  removeMemberBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  deleteSection: { borderTopWidth: 1, paddingTop: 16, marginTop: 8 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderWidth: 1 },
  deleteBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  voteBanner: { margin: 12, marginBottom: 0, padding: 14, borderWidth: 1, borderRadius: 12, gap: 10 },
  voteBannerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  voteBannerTitle: { fontFamily: "Inter_700Bold", fontSize: 14 },
  voteBannerSub: { fontFamily: "Inter_400Regular", fontSize: 13 },
  voteBannerBtn: { padding: 12, borderRadius: 10, alignItems: "center" },
  voteBannerBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  voteButtons: { flexDirection: "row", gap: 10 },
  voteBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  voteBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  votedLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  dateRow: { flexDirection: "row", gap: 12 },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  editModalCancel: { fontFamily: "Inter_400Regular", fontSize: 16 },
  editModalTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  editModalSave: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
