import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

// Guard against Expo Go which dropped remote push in SDK 53
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Running in Expo Go — push notifications unavailable
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  joinedAt: string;
}

export interface CircleMember {
  userId: string;
  nickname: string;
  joinedAt: string;
  role: "creator" | "member";
}

export interface VerificationQuestion {
  id: string;
  question: string;
  answers: string[];
  addedBy: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface AuthRiskState {
  suspicionScore: number;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lockedUntil: string | null;
  reentryCode: string | null;
  reentryCodeExpiresAt: string | null;
  successHistory: string[];
  lastAttemptAt: string | null;
}

export interface QuestionUsage {
  [questionId: string]: { usageCount: number; lastUsedAt: string | null };
}

export interface AppNotification {
  id: string;
  type:
    | "member_joined"
    | "timeline_post"
    | "comment"
    | "reaction"
    | "itinerary_added"
    | "budget_update"
    | "join_approved"
    | "join_request"
    | "security_alert";
  circleId: string;
  circleName: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  title: string;
  notes: string;
  expenseAmount?: number;
  expenseCategory?: "transport" | "food" | "accommodation" | "activities" | "other";
  expenseBudgetItemId?: string;
  postedToTimeline?: boolean;
  timelineEntryId?: string;
}

export interface BudgetItem {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  category: "transport" | "food" | "accommodation" | "activities" | "other";
  date: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  userId: string;
  type: "event" | "post";
  day?: number;
  eventTime?: string;
  eventLabel?: string;
  caption: string;
  images: string[];
  reactions: Reaction[];
  comments: Comment[];
  createdAt: string;
}

export interface DeleteVoteResponse {
  userId: string;
  vote: "yes" | "no";
  votedAt: string;
}

export interface Circle {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  createdBy: string;
  members: CircleMember[];
  questions: VerificationQuestion[];
  joinRequests: JoinRequest[];
  destination: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  status: "upcoming" | "active" | "past";
  coverImage: string | null;
  deleteInitiatedAt: string | null;
  deleteInitiatedBy: string | null;
  deleteResponses: DeleteVoteResponse[];
  itinerary: ItineraryItem[];
  budget: BudgetItem[];
  timeline: TimelineEntry[];
  createdAt: string;
}

// Kept for PostCard compatibility
export type Post = TimelineEntry;

interface AppContextType {
  currentUser: User | null;
  circles: Circle[];
  isLoading: boolean;

  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateProfile: (name: string, avatar: string) => Promise<void>;
  updateNickname: (circleId: string, nickname: string) => Promise<void>;

  createCircle: (circle: Circle) => Promise<void>;
  joinCircle: (circle: Circle, nickname: string) => Promise<void>;
  leaveCircle: (circleId: string) => Promise<void>;
  removeMember: (circleId: string, userId: string) => Promise<void>;
  updateCircle: (circleId: string, updates: Partial<Circle>) => Promise<void>;
  findCircleByInviteCode: (code: string) => Promise<Circle | null>;
  refreshCircles: () => Promise<void>;
  initiateDeleteVote: (circleId: string) => Promise<void>;
  castDeleteVote: (circleId: string, vote: "yes" | "no") => Promise<void>;
  cancelDeleteVote: (circleId: string) => Promise<void>;
  deleteCircle: (circleId: string) => Promise<void>;

  addQuestion: (circleId: string, q: VerificationQuestion) => Promise<void>;
  removeQuestion: (circleId: string, qId: string) => Promise<void>;

  requestJoin: (circleId: string, req: JoinRequest) => Promise<void>;
  approveJoin: (circleId: string, reqId: string) => Promise<void>;
  rejectJoin: (circleId: string, reqId: string) => Promise<void>;

  addItineraryItem: (circleId: string, item: ItineraryItem, budgetItem?: BudgetItem, timelineEntry?: TimelineEntry) => Promise<void>;
  updateItineraryItem: (circleId: string, itemId: string, updates: Partial<ItineraryItem>, options?: { removeBudgetItemId?: string; addBudgetItem?: BudgetItem; addTimelineEntry?: TimelineEntry }) => Promise<void>;
  removeItineraryItem: (circleId: string, itemId: string) => Promise<void>;

  addBudgetItem: (circleId: string, item: BudgetItem) => Promise<void>;
  removeBudgetItem: (circleId: string, itemId: string) => Promise<void>;

  addTimelineEntry: (circleId: string, entry: TimelineEntry) => Promise<void>;
  removeTimelineEntry: (circleId: string, entryId: string) => Promise<void>;
  updateTimelineEntry: (circleId: string, entryId: string, updates: Partial<TimelineEntry>) => Promise<void>;
  addReaction: (circleId: string, entryId: string, reaction: Reaction) => Promise<void>;
  addComment: (circleId: string, entryId: string, comment: Comment) => Promise<void>;

  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const KEYS = {
  NOTIFICATIONS: "bt_notifications",
};

const AVATARS = ["🏄", "🧗", "🏕️", "🚵", "🏔️", "🤿", "🪂", "🎿"];

// ── Supabase helpers ──────────────────────────────────────────────────────────

const CIRCLE_SELECT = `
  *,
  circle_members(*),
  circle_questions(*),
  join_requests(*),
  itinerary_items(*),
  budget_items(*),
  circle_delete_responses(*),
  timeline_entries(
    *,
    timeline_reactions(*),
    timeline_comments(*)
  )
`;

function rowToCircle(row: any): Circle {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    destination: row.destination ?? "",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    totalBudget: Number(row.total_budget ?? 0),
    status: row.status ?? "upcoming",
    coverImage: row.cover_image ?? null,
    deleteInitiatedAt: row.delete_initiated_at ?? null,
    deleteInitiatedBy: row.delete_initiated_by ?? null,
    deleteResponses: (row.circle_delete_responses ?? []).map((r: any): DeleteVoteResponse => ({
      userId: r.user_id,
      vote: r.vote,
      votedAt: r.voted_at,
    })),
    createdAt: row.created_at,
    members: (row.circle_members ?? []).map((m: any): CircleMember => ({
      userId: m.user_id,
      nickname: m.nickname,
      joinedAt: m.joined_at,
      role: m.role,
    })),
    questions: (row.circle_questions ?? []).map((q: any): VerificationQuestion => ({
      id: q.id,
      question: q.question,
      answers: q.answers ?? [],
      addedBy: q.added_by,
      difficulty: q.difficulty,
    })),
    joinRequests: (row.join_requests ?? []).map((r: any): JoinRequest => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      requestedAt: r.requested_at,
      status: r.status,
    })),
    itinerary: (row.itinerary_items ?? []).map((i: any): ItineraryItem => ({
      id: i.id,
      day: i.day,
      time: i.time ?? "",
      title: i.title,
      notes: i.notes ?? "",
      expenseAmount: i.expense_amount != null ? Number(i.expense_amount) : undefined,
      expenseCategory: i.expense_category ?? undefined,
      expenseBudgetItemId: i.expense_budget_item_id ?? undefined,
      postedToTimeline: i.posted_to_timeline ?? false,
      timelineEntryId: i.timeline_entry_id ?? undefined,
    })),
    budget: (row.budget_items ?? []).map((b: any): BudgetItem => ({
      id: b.id,
      title: b.title,
      amount: Number(b.amount),
      paidBy: b.paid_by,
      category: b.category,
      date: b.date,
    })),
    timeline: (row.timeline_entries ?? [])
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((e: any): TimelineEntry => ({
        id: e.id,
        userId: e.user_id,
        type: e.type,
        day: e.day ?? undefined,
        eventTime: e.event_time ?? undefined,
        eventLabel: e.event_label ?? undefined,
        caption: e.caption ?? "",
        images: e.images ?? [],
        createdAt: e.created_at,
        reactions: (e.timeline_reactions ?? []).map((r: any): Reaction => ({
          userId: r.user_id,
          emoji: r.emoji,
        })),
        comments: (e.timeline_comments ?? [])
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((c: any): Comment => ({
            id: c.id,
            userId: c.user_id,
            text: c.text,
            createdAt: c.created_at,
          })),
      })),
  };
}

function computeStatus(startDate: string, endDate: string): Circle["status"] {
  if (!startDate) return "upcoming";
  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (now < start) return "upcoming";
  if (end && now > end) return "past";
  return "active";
}

async function fetchCirclesForUser(userId: string): Promise<Circle[]> {
  const { data: memberRows } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", userId);

  if (!memberRows?.length) return [];
  const circleIds = memberRows.map((r) => r.circle_id);

  const { data } = await supabase
    .from("circles")
    .select(CIRCLE_SELECT)
    .in("id", circleIds);

  return (data ?? []).map(rowToCircle);
}

async function syncCircleStatuses(circles: Circle[]): Promise<Circle[]> {
  const updates = circles
    .map((c) => ({ circle: c, correct: computeStatus(c.startDate, c.endDate) }))
    .filter(({ circle, correct }) => circle.startDate && circle.status !== correct);

  await Promise.all(
    updates.map(({ circle, correct }) =>
      supabase.from("circles").update({ status: correct }).eq("id", circle.id)
    )
  );

  if (!updates.length) return circles;
  return circles.map((c) => {
    const match = updates.find((u) => u.circle.id === c.id);
    return match ? { ...c, status: match.correct } : c;
  });
}

async function fetchCircleById(circleId: string): Promise<Circle | null> {
  const { data } = await supabase
    .from("circles")
    .select(CIRCLE_SELECT)
    .eq("id", circleId)
    .single();
  return data ? rowToCircle(data) : null;
}

// ── Push notifications ────────────────────────────────────────────────────────

async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === "web" || !Notifications) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from("users").update({ push_token: token }).eq("id", userId);
  } catch (e) {
    if (__DEV__) console.log("[push] token registration skipped:", e);
  }
}

async function sendPushToUsers(userIds: string[], title: string, body: string): Promise<void> {
  if (!userIds.length) return;
  try {
    const { data } = await supabase
      .from("users")
      .select("push_token")
      .in("id", userIds)
      .not("push_token", "is", null);

    const tokens = (data ?? []).map((r) => r.push_token).filter(Boolean);
    if (!tokens.length) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: "default" }))),
    });
  } catch (e) {
    if (__DEV__) console.log("[push] send failed:", e);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Init: load notifications + subscribe to auth state
  useEffect(() => {
    AsyncStorage.getItem(KEYS.NOTIFICATIONS).then((n) => {
      if (n) setNotifications(JSON.parse(n));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (profile) {
            setCurrentUserState({
              id: session.user.id,
              name: profile.name,
              avatar: profile.avatar ?? "🏄",
              joinedAt: profile.joined_at ?? session.user.created_at,
            });
            const fetched = await fetchCirclesForUser(session.user.id);
            const synced = await syncCircleStatuses(fetched);
            setCircles(synced);
            registerPushToken(session.user.id);
          }
        } else {
          setCurrentUserState(null);
          setCircles([]);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Real-time sync — subscribe once per user session
  useEffect(() => {
    if (!currentUser) return;

    const refreshAll = async () => {
      const fetched = await fetchCirclesForUser(currentUser.id);
      const synced = await syncCircleStatuses(fetched);
      setCircles(synced);
    };

    const refreshCircle = async (circleId: string) => {
      const updated = await fetchCircleById(circleId);
      if (updated) {
        setCircles((prev) => prev.map((c) => (c.id === circleId ? updated : c)));
      }
    };

    const getCircleId = (payload: any): string | null =>
      payload.new?.circle_id || payload.old?.circle_id || null;

    // refreshCircle if id found, otherwise refreshAll (fallback for DELETE without REPLICA IDENTITY FULL)
    const handle = (p: any) => {
      const id = getCircleId(p);
      if (id) refreshCircle(id);
      else refreshAll();
    };

    const channel = supabase
      .channel("realtime-circles")
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_entries" }, handle)
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_reactions" }, () => refreshAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_comments" }, () => refreshAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_members" }, handle)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, handle)
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items" }, handle)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items" }, handle)
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_delete_responses" }, handle)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "circles" }, (p) => refreshCircle(p.new.id))
      .subscribe((status) => {
        if (__DEV__) console.log("[realtime] channel status:", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // ── Notifications (local AsyncStorage) ──────────────────────────────────────

  const pushNotification = async (notif: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
    const current: AppNotification[] = raw ? JSON.parse(raw) : [];
    const next: AppNotification[] = [
      {
        ...notif,
        id: `${Date.now()}${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...current,
    ].slice(0, 100);
    setNotifications(next);
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(next));
  };

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(next));
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearNotifications = useCallback(async () => {
    setNotifications([]);
    await AsyncStorage.removeItem(KEYS.NOTIFICATIONS);
  }, []);

  const addNotification = useCallback(async (notif: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    await pushNotification(notif);
  }, []);

  // ── Auth ─────────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (data.user) {
      await supabase.from("users").upsert({
        id: data.user.id,
        name: name.trim(),
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        joined_at: new Date().toISOString(),
      });
    }
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (name: string, avatar: string) => {
    if (!currentUser) return;
    await supabase.from("users").update({ name: name.trim(), avatar }).eq("id", currentUser.id);
    setCurrentUserState((prev) => prev ? { ...prev, name: name.trim(), avatar } : prev);
  }, [currentUser]);

  // ── Circles ──────────────────────────────────────────────────────────────────

  const refreshCircles = useCallback(async () => {
    if (!currentUser) return;
    const fetched = await fetchCirclesForUser(currentUser.id);
    const synced = await syncCircleStatuses(fetched);
    setCircles(synced);
  }, [currentUser]);

  const findCircleByInviteCode = useCallback(async (code: string): Promise<Circle | null> => {
    const { data } = await supabase
      .from("circles")
      .select(CIRCLE_SELECT)
      .eq("invite_code", code.toUpperCase())
      .single();
    return data ? rowToCircle(data) : null;
  }, []);

  const createCircle = useCallback(async (circle: Circle) => {
    // Insert circle
    await supabase.from("circles").insert({
      id: circle.id,
      name: circle.name,
      description: circle.description,
      invite_code: circle.inviteCode,
      created_by: circle.createdBy,
      destination: circle.destination,
      start_date: circle.startDate,
      end_date: circle.endDate,
      total_budget: circle.totalBudget,
      status: circle.status,
      cover_image: circle.coverImage ?? null,
      created_at: circle.createdAt,
    });
    // Insert creator as member
    for (const m of circle.members) {
      await supabase.from("circle_members").insert({
        circle_id: circle.id,
        user_id: m.userId,
        nickname: m.nickname,
        role: m.role,
        joined_at: m.joinedAt,
      });
    }
    // Insert questions
    for (const q of circle.questions) {
      await supabase.from("circle_questions").insert({
        id: q.id,
        circle_id: circle.id,
        question: q.question,
        answers: q.answers,
        added_by: q.addedBy,
        difficulty: q.difficulty ?? "medium",
      });
    }
    setCircles((prev) => [...prev, circle]);
  }, []);

  const joinCircle = useCallback(async (circle: Circle, nickname: string) => {
    if (!currentUser) return;
    const newMember: CircleMember = {
      userId: currentUser.id,
      nickname: nickname || currentUser.name,
      joinedAt: new Date().toISOString(),
      role: "member",
    };
    await supabase.from("circle_members").upsert({
      circle_id: circle.id,
      user_id: currentUser.id,
      nickname: newMember.nickname,
      role: newMember.role,
      joined_at: newMember.joinedAt,
    });
    // Fetch the full circle and add to state
    const updated = await fetchCircleById(circle.id);
    if (updated) {
      setCircles((prev) =>
        prev.some((c) => c.id === circle.id)
          ? prev.map((c) => (c.id === circle.id ? updated : c))
          : [...prev, updated]
      );
    }
    const displayName = nickname || currentUser.name;
    const otherMemberIds = circle.members.map((m) => m.userId).filter((id) => id !== currentUser.id);
    sendPushToUsers(otherMemberIds, `${displayName} joined ${circle.name}!`, "A new member joined your trip circle.");
    await pushNotification({
      type: "member_joined",
      circleId: circle.id,
      circleName: circle.name,
      title: "Joined a circle",
      body: `You joined ${circle.name}!`,
    });
  }, [currentUser]);

  const leaveCircle = useCallback(async (circleId: string) => {
    if (!currentUser) return;
    await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", currentUser.id);
    setCircles((prev) => prev.filter((c) => c.id !== circleId));
  }, [currentUser]);

  const updateCircle = useCallback(async (circleId: string, updates: Partial<Circle>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.totalBudget !== undefined) dbUpdates.total_budget = updates.totalBudget;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.coverImage !== undefined) dbUpdates.cover_image = updates.coverImage;
    if (Object.keys(dbUpdates).length) {
      await supabase.from("circles").update(dbUpdates).eq("id", circleId);
    }
    setCircles((prev) =>
      prev.map((c) => (c.id === circleId ? { ...c, ...updates } : c))
    );
  }, []);

  const initiateDeleteVote = useCallback(async (circleId: string) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    // Always wipe stale responses first so previous votes don't carry over
    await supabase.from("circle_delete_responses").delete().eq("circle_id", circleId);
    await supabase.from("circles").update({
      delete_initiated_at: now,
      delete_initiated_by: currentUser.id,
    }).eq("id", circleId);
    // Creator's vote is implicitly yes — record it immediately
    await supabase.from("circle_delete_responses").insert(
      { circle_id: circleId, user_id: currentUser.id, vote: "yes", voted_at: now }
    );
    const creatorVote: DeleteVoteResponse = { userId: currentUser.id, vote: "yes", votedAt: now };
    setCircles((prev) => prev.map((c) => c.id !== circleId ? c : {
      ...c, deleteInitiatedAt: now, deleteInitiatedBy: currentUser.id, deleteResponses: [creatorVote],
    }));
    const circle = circles.find((c) => c.id === circleId);
    const otherIds = (circle?.members ?? []).map((m) => m.userId).filter((id) => id !== currentUser.id);
    sendPushToUsers(otherIds, `Vote: Delete "${circle?.name}"`, "The creator wants to delete this circle. Open the app to vote.");
  }, [currentUser, circles]);

  const castDeleteVote = useCallback(async (circleId: string, vote: "yes" | "no") => {
    if (!currentUser) return;
    await supabase.from("circle_delete_responses").upsert(
      { circle_id: circleId, user_id: currentUser.id, vote, voted_at: new Date().toISOString() },
      { onConflict: "circle_id,user_id" }
    );
    const response: DeleteVoteResponse = { userId: currentUser.id, vote, votedAt: new Date().toISOString() };
    setCircles((prev) => prev.map((c) => {
      if (c.id !== circleId) return c;
      const existing = c.deleteResponses.find((r) => r.userId === currentUser.id);
      return {
        ...c,
        deleteResponses: existing
          ? c.deleteResponses.map((r) => r.userId === currentUser.id ? response : r)
          : [...c.deleteResponses, response],
      };
    }));
  }, [currentUser]);

  const cancelDeleteVote = useCallback(async (circleId: string) => {
    await supabase.from("circles").update({ delete_initiated_at: null, delete_initiated_by: null }).eq("id", circleId);
    await supabase.from("circle_delete_responses").delete().eq("circle_id", circleId);
    setCircles((prev) => prev.map((c) => c.id !== circleId ? c : {
      ...c, deleteInitiatedAt: null, deleteInitiatedBy: null, deleteResponses: [],
    }));
  }, []);

  const deleteCircle = useCallback(async (circleId: string) => {
    await supabase.from("circles").delete().eq("id", circleId);
    setCircles((prev) => prev.filter((c) => c.id !== circleId));
  }, []);

  const removeMember = useCallback(async (circleId: string, userId: string) => {
    await supabase.from("circle_members").delete().eq("circle_id", circleId).eq("user_id", userId);
    setCircles((prev) => prev.map((c) =>
      c.id !== circleId ? c : { ...c, members: c.members.filter((m) => m.userId !== userId) }
    ));
  }, []);

  const updateNickname = useCallback(async (circleId: string, nickname: string) => {
    if (!currentUser) return;
    await supabase
      .from("circle_members")
      .update({ nickname })
      .eq("circle_id", circleId)
      .eq("user_id", currentUser.id);
    setCircles((prev) =>
      prev.map((c) =>
        c.id !== circleId
          ? c
          : {
              ...c,
              members: c.members.map((m) =>
                m.userId === currentUser.id ? { ...m, nickname } : m
              ),
            }
      )
    );
  }, [currentUser]);

  // ── Questions ────────────────────────────────────────────────────────────────

  const addQuestion = useCallback(async (circleId: string, q: VerificationQuestion) => {
    await supabase.from("circle_questions").insert({
      id: q.id,
      circle_id: circleId,
      question: q.question,
      answers: q.answers,
      added_by: q.addedBy,
      difficulty: q.difficulty ?? "medium",
    });
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId ? { ...c, questions: [...c.questions, q] } : c
      )
    );
  }, []);

  const removeQuestion = useCallback(async (circleId: string, qId: string) => {
    await supabase.from("circle_questions").delete().eq("id", qId);
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId
          ? { ...c, questions: c.questions.filter((q) => q.id !== qId) }
          : c
      )
    );
  }, []);

  // ── Join requests ────────────────────────────────────────────────────────────

  const requestJoin = useCallback(async (circleId: string, req: JoinRequest) => {
    await supabase.from("join_requests").insert({
      id: req.id,
      circle_id: circleId,
      user_id: req.userId,
      user_name: req.userName,
      status: req.status,
      requested_at: req.requestedAt,
    });
    const circle = circles.find((c) => c.id === circleId);
    await pushNotification({
      type: "join_request",
      circleId,
      circleName: circle?.name ?? "",
      title: "Join request sent",
      body: `Your request to join ${circle?.name ?? "the circle"} is pending approval.`,
    });
  }, [circles]);

  const approveJoin = useCallback(async (circleId: string, reqId: string) => {
    const circle = circles.find((c) => c.id === circleId);
    const req = (circle?.joinRequests ?? []).find((r) => r.id === reqId);
    if (!req || !circle) return;

    const newMember: CircleMember = {
      userId: req.userId,
      nickname: req.userName,
      joinedAt: new Date().toISOString(),
      role: "member",
    };
    await supabase.from("join_requests").update({ status: "approved" }).eq("id", reqId);
    await supabase.from("circle_members").insert({
      circle_id: circleId,
      user_id: req.userId,
      nickname: newMember.nickname,
      role: newMember.role,
      joined_at: newMember.joinedAt,
    });
    setCircles((prev) =>
      prev.map((c) => {
        if (c.id !== circleId) return c;
        return {
          ...c,
          joinRequests: c.joinRequests.map((r) =>
            r.id === reqId ? { ...r, status: "approved" as const } : r
          ),
          members: [...c.members, newMember],
        };
      })
    );
    await pushNotification({
      type: "join_approved",
      circleId,
      circleName: circle.name,
      title: "Join request approved",
      body: `${req.userName} was approved to join ${circle.name}.`,
    });
  }, [circles]);

  const rejectJoin = useCallback(async (circleId: string, reqId: string) => {
    await supabase.from("join_requests").update({ status: "rejected" }).eq("id", reqId);
    setCircles((prev) =>
      prev.map((c) =>
        c.id !== circleId
          ? c
          : {
              ...c,
              joinRequests: c.joinRequests.map((r) =>
                r.id === reqId ? { ...r, status: "rejected" as const } : r
              ),
            }
      )
    );
  }, []);

  // ── Itinerary ────────────────────────────────────────────────────────────────

  const addItineraryItem = useCallback(async (circleId: string, item: ItineraryItem, budgetItem?: BudgetItem, timelineEntry?: TimelineEntry) => {
    const circle = circles.find((c) => c.id === circleId);
    await supabase.from("itinerary_items").insert({
      id: item.id,
      circle_id: circleId,
      day: item.day,
      time: item.time,
      title: item.title,
      notes: item.notes,
      expense_amount: item.expenseAmount ?? null,
      expense_category: item.expenseCategory ?? null,
      expense_budget_item_id: item.expenseBudgetItemId ?? null,
      posted_to_timeline: item.postedToTimeline ?? false,
      timeline_entry_id: item.timelineEntryId ?? null,
    });
    if (budgetItem) {
      await supabase.from("budget_items").insert({
        id: budgetItem.id,
        circle_id: circleId,
        title: budgetItem.title,
        amount: budgetItem.amount,
        paid_by: budgetItem.paidBy,
        category: budgetItem.category,
        date: budgetItem.date,
      });
    }
    if (timelineEntry) {
      await supabase.from("timeline_entries").insert({
        id: timelineEntry.id,
        circle_id: circleId,
        user_id: timelineEntry.userId,
        type: timelineEntry.type,
        day: timelineEntry.day ?? null,
        event_time: timelineEntry.eventTime ?? null,
        event_label: timelineEntry.eventLabel ?? null,
        caption: timelineEntry.caption,
        images: timelineEntry.images,
        created_at: timelineEntry.createdAt,
      });
    }
    setCircles((prev) =>
      prev.map((c) => {
        if (c.id !== circleId) return c;
        const updated = { ...c, itinerary: [...c.itinerary, item] };
        if (budgetItem) updated.budget = [...c.budget, budgetItem];
        if (timelineEntry) updated.timeline = [{ ...timelineEntry, reactions: [], comments: [] }, ...c.timeline];
        return updated;
      })
    );
    await pushNotification({
      type: "itinerary_added",
      circleId,
      circleName: circle?.name ?? "",
      title: "Activity added",
      body: `Day ${item.day} · ${item.title}${budgetItem ? ` · $${budgetItem.amount.toFixed(2)}` : ""}`,
    });
  }, [circles]);

  const updateItineraryItem = useCallback(async (circleId: string, itemId: string, updates: Partial<ItineraryItem>, options?: { removeBudgetItemId?: string; addBudgetItem?: BudgetItem; addTimelineEntry?: TimelineEntry }) => {
    const dbUpdates: any = {};
    if (updates.day !== undefined) dbUpdates.day = updates.day;
    if (updates.time !== undefined) dbUpdates.time = updates.time;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.expenseAmount !== undefined) dbUpdates.expense_amount = updates.expenseAmount ?? null;
    if (updates.expenseCategory !== undefined) dbUpdates.expense_category = updates.expenseCategory ?? null;
    if (updates.expenseBudgetItemId !== undefined) dbUpdates.expense_budget_item_id = updates.expenseBudgetItemId ?? null;
    if (updates.postedToTimeline !== undefined) dbUpdates.posted_to_timeline = updates.postedToTimeline;
    if (updates.timelineEntryId !== undefined) dbUpdates.timeline_entry_id = updates.timelineEntryId ?? null;
    if (Object.keys(dbUpdates).length) {
      await supabase.from("itinerary_items").update(dbUpdates).eq("id", itemId);
    }
    if (options?.removeBudgetItemId) {
      await supabase.from("budget_items").delete().eq("id", options.removeBudgetItemId);
    }
    if (options?.addBudgetItem) {
      const b = options.addBudgetItem;
      await supabase.from("budget_items").insert({
        id: b.id, circle_id: circleId, title: b.title,
        amount: b.amount, paid_by: b.paidBy, category: b.category, date: b.date,
      });
    }
    if (options?.addTimelineEntry) {
      const e = options.addTimelineEntry;
      await supabase.from("timeline_entries").insert({
        id: e.id, circle_id: circleId, user_id: e.userId, type: e.type,
        day: e.day ?? null, event_time: e.eventTime ?? null, event_label: e.eventLabel ?? null,
        caption: e.caption, images: e.images, created_at: e.createdAt,
      });
    }
    setCircles((prev) =>
      prev.map((c) => {
        if (c.id !== circleId) return c;
        const updated = { ...c, itinerary: c.itinerary.map((i) => i.id === itemId ? { ...i, ...updates } : i) };
        if (options?.removeBudgetItemId) updated.budget = c.budget.filter((b) => b.id !== options.removeBudgetItemId);
        if (options?.addBudgetItem) updated.budget = [...updated.budget, options.addBudgetItem];
        if (options?.addTimelineEntry) updated.timeline = [{ ...options.addTimelineEntry, reactions: [], comments: [] }, ...c.timeline];
        return updated;
      })
    );
  }, []);

  const removeItineraryItem = useCallback(async (circleId: string, itemId: string) => {
    const circle = circles.find((c) => c.id === circleId);
    const item = circle?.itinerary.find((i) => i.id === itemId);
    await supabase.from("itinerary_items").delete().eq("id", itemId);
    if (item?.expenseBudgetItemId) {
      await supabase.from("budget_items").delete().eq("id", item.expenseBudgetItemId);
    }
    setCircles((prev) =>
      prev.map((c) => {
        if (c.id !== circleId) return c;
        const updated = { ...c, itinerary: c.itinerary.filter((i) => i.id !== itemId) };
        if (item?.expenseBudgetItemId) {
          updated.budget = c.budget.filter((b) => b.id !== item.expenseBudgetItemId);
        }
        return updated;
      })
    );
  }, [circles]);

  // ── Budget ───────────────────────────────────────────────────────────────────

  const addBudgetItem = useCallback(async (circleId: string, item: BudgetItem) => {
    const circle = circles.find((c) => c.id === circleId);
    await supabase.from("budget_items").insert({
      id: item.id,
      circle_id: circleId,
      title: item.title,
      amount: item.amount,
      paid_by: item.paidBy,
      category: item.category,
      date: item.date,
    });
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId ? { ...c, budget: [...c.budget, item] } : c
      )
    );
    await pushNotification({
      type: "budget_update",
      circleId,
      circleName: circle?.name ?? "",
      title: "Expense added",
      body: `${item.title} · $${item.amount.toFixed(2)} (${item.category})`,
    });
  }, [circles]);

  const removeBudgetItem = useCallback(async (circleId: string, itemId: string) => {
    await supabase.from("budget_items").delete().eq("id", itemId);
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId
          ? { ...c, budget: c.budget.filter((b) => b.id !== itemId) }
          : c
      )
    );
  }, []);

  // ── Timeline ─────────────────────────────────────────────────────────────────

  const addTimelineEntry = useCallback(async (circleId: string, entry: TimelineEntry) => {
    const circle = circles.find((c) => c.id === circleId);
    await supabase.from("timeline_entries").insert({
      id: entry.id,
      circle_id: circleId,
      user_id: entry.userId,
      type: entry.type,
      day: entry.day ?? null,
      event_time: entry.eventTime ?? null,
      event_label: entry.eventLabel ?? null,
      caption: entry.caption,
      images: entry.images,
      created_at: entry.createdAt,
    });
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId
          ? { ...c, timeline: [{ ...entry, reactions: [], comments: [] }, ...c.timeline] }
          : c
      )
    );
    const posterNickname = circle?.members.find((m) => m.userId === entry.userId)?.nickname ?? "Someone";
    const notifBody = entry.caption ? `"${entry.caption.slice(0, 80)}"` : "Shared a photo";
    const otherMemberIds = (circle?.members ?? []).map((m) => m.userId).filter((id) => id !== entry.userId);
    sendPushToUsers(otherMemberIds, `${posterNickname} posted in ${circle?.name ?? "your trip"}`, notifBody);
    await pushNotification({
      type: "timeline_post",
      circleId,
      circleName: circle?.name ?? "",
      title: "New post",
      body: entry.caption ? `"${entry.caption.slice(0, 80)}"` : `A new post was added to ${circle?.name ?? "the circle"}.`,
    });
  }, [circles]);

  const removeTimelineEntry = useCallback(async (circleId: string, entryId: string) => {
    await supabase.from("timeline_entries").delete().eq("id", entryId);
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId
          ? { ...c, timeline: c.timeline.filter((e) => e.id !== entryId) }
          : c
      )
    );
  }, []);

  const updateTimelineEntry = useCallback(async (circleId: string, entryId: string, updates: Partial<TimelineEntry>) => {
    const dbUpdates: any = {};
    if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
    if (updates.eventLabel !== undefined) dbUpdates.event_label = updates.eventLabel;
    if (Object.keys(dbUpdates).length) {
      await supabase.from("timeline_entries").update(dbUpdates).eq("id", entryId);
    }
    setCircles((prev) =>
      prev.map((c) =>
        c.id === circleId
          ? { ...c, timeline: c.timeline.map((e) => e.id === entryId ? { ...e, ...updates } : e) }
          : c
      )
    );
  }, []);

  const addReaction = useCallback(async (circleId: string, entryId: string, reaction: Reaction) => {
    // Upsert: one reaction per user per entry
    await supabase.from("timeline_reactions").upsert(
      { entry_id: entryId, user_id: reaction.userId, emoji: reaction.emoji },
      { onConflict: "entry_id,user_id" }
    );
    setCircles((prev) =>
      prev.map((c) => {
        if (c.id !== circleId) return c;
        return {
          ...c,
          timeline: c.timeline.map((e) => {
            if (e.id !== entryId) return e;
            const existing = e.reactions.find((r) => r.userId === reaction.userId);
            return {
              ...e,
              reactions: existing
                ? e.reactions.map((r) => r.userId === reaction.userId ? reaction : r)
                : [...e.reactions, reaction],
            };
          }),
        };
      })
    );
  }, []);

  const addComment = useCallback(async (circleId: string, entryId: string, comment: Comment) => {
    const circle = circles.find((c) => c.id === circleId);
    await supabase.from("timeline_comments").insert({
      id: comment.id,
      entry_id: entryId,
      user_id: comment.userId,
      text: comment.text,
      created_at: comment.createdAt,
    });
    setCircles((prev) =>
      prev.map((c) => {
        if (c.id !== circleId) return c;
        return {
          ...c,
          timeline: c.timeline.map((e) =>
            e.id === entryId ? { ...e, comments: [...e.comments, comment] } : e
          ),
        };
      })
    );
    await pushNotification({
      type: "comment",
      circleId,
      circleName: circle?.name ?? "",
      title: "New comment",
      body: comment.text.length > 80 ? comment.text.slice(0, 80) + "…" : comment.text,
    });
  }, [circles]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        circles,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        updateNickname,
        createCircle,
        joinCircle,
        leaveCircle,
        updateCircle,
        findCircleByInviteCode,
        refreshCircles,
        removeMember,
        initiateDeleteVote,
        castDeleteVote,
        cancelDeleteVote,
        deleteCircle,
        addQuestion,
        removeQuestion,
        requestJoin,
        approveJoin,
        rejectJoin,
        addItineraryItem,
        updateItineraryItem,
        removeItineraryItem,
        addBudgetItem,
        removeBudgetItem,
        addTimelineEntry,
        removeTimelineEntry,
        updateTimelineEntry,
        addReaction,
        addComment,
        notifications,
        unreadCount,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
