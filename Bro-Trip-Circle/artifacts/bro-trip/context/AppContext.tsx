import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  answers: string[]; // multiple accepted answers
  addedBy: string;
  difficulty?: "easy" | "medium" | "hard"; // defaults to "medium" if unset
}

export interface AuthRiskState {
  suspicionScore: number;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lockedUntil: string | null;
  reentryCode: string | null;
  reentryCodeExpiresAt: string | null;
  successHistory: string[]; // ISO timestamps, last 10
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
  // optional expense attached to this activity
  expenseAmount?: number;
  expenseCategory?: "transport" | "food" | "accommodation" | "activities" | "other";
  expenseBudgetItemId?: string; // tracks the linked BudgetItem so we can remove it
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
  type: "event" | "post"; // event = timestamped log, post = social share
  // event fields
  day?: number;
  eventTime?: string; // e.g. "7:00 PM"
  eventLabel?: string; // e.g. "Day 2, 7pm – buffet dinner"
  // shared
  caption: string;
  images: string[];
  reactions: Reaction[];
  comments: Comment[];
  createdAt: string;
}

export interface Circle {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  createdBy: string; // userId
  members: CircleMember[];
  questions: VerificationQuestion[];
  joinRequests: JoinRequest[];
  // Trip details
  destination: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  status: "upcoming" | "active" | "past";
  // Trip data
  itinerary: ItineraryItem[];
  budget: BudgetItem[];
  timeline: TimelineEntry[];
  createdAt: string;
}

interface AppContextType {
  currentUser: User | null;
  circles: Circle[];
  isLoading: boolean;

  setCurrentUser: (user: User) => Promise<void>;
  updateNickname: (circleId: string, nickname: string) => Promise<void>;

  createCircle: (circle: Circle) => Promise<void>;
  joinCircle: (circle: Circle, nickname: string) => Promise<void>;
  leaveCircle: (circleId: string) => Promise<void>;
  updateCircle: (circleId: string, updates: Partial<Circle>) => Promise<void>;

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
  USER: "bt_user",
  CIRCLES: "bt_circles",
  NOTIFICATIONS: "bt_notifications",
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [u, c, n] = await Promise.all([
          AsyncStorage.getItem(KEYS.USER),
          AsyncStorage.getItem(KEYS.CIRCLES),
          AsyncStorage.getItem(KEYS.NOTIFICATIONS),
        ]);
        if (u) setCurrentUserState(JSON.parse(u));
        if (c) setCircles(JSON.parse(c));
        if (n) setNotifications(JSON.parse(n));
      } catch (_) {}
      finally { setIsLoading(false); }
    })();
  }, []);

  // Reads latest from storage to avoid stale closure — safe to call inside any callback
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

  const saveCircles = async (next: Circle[]) => {
    setCircles(next);
    await AsyncStorage.setItem(KEYS.CIRCLES, JSON.stringify(next));
  };

  const setCurrentUser = useCallback(async (user: User) => {
    setCurrentUserState(user);
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  }, []);

  const updateNickname = useCallback(async (circleId: string, nickname: string) => {
    setCircles((prev) => {
      const next = prev.map((c) =>
        c.id !== circleId
          ? c
          : {
              ...c,
              members: c.members.map((m) =>
                m.userId === currentUser?.id ? { ...m, nickname } : m
              ),
            }
      );
      AsyncStorage.setItem(KEYS.CIRCLES, JSON.stringify(next));
      return next;
    });
  }, [currentUser]);

  const createCircle = useCallback(async (circle: Circle) => {
    const next = [...circles, circle];
    await saveCircles(next);
  }, [circles]);

  const joinCircle = useCallback(async (circle: Circle, nickname: string) => {
    if (!currentUser) return;
    const newMember: CircleMember = {
      userId: currentUser.id,
      nickname: nickname || currentUser.name,
      joinedAt: new Date().toISOString(),
      role: "member",
    };
    const already = circles.find((c) => c.id === circle.id);
    if (already) {
      const next = circles.map((c) =>
        c.id !== circle.id
          ? c
          : {
              ...c,
              members: c.members.some((m) => m.userId === currentUser.id)
                ? c.members
                : [...c.members, newMember],
            }
      );
      await saveCircles(next);
    } else {
      const updated = {
        ...circle,
        members: circle.members.some((m) => m.userId === currentUser.id)
          ? circle.members
          : [...circle.members, newMember],
      };
      await saveCircles([...circles, updated]);
    }
    await pushNotification({
      type: "member_joined",
      circleId: circle.id,
      circleName: circle.name,
      title: "Joined a circle",
      body: `You joined ${circle.name}!`,
    });
  }, [circles, currentUser]);

  const leaveCircle = useCallback(async (circleId: string) => {
    const next = circles.filter((c) => c.id !== circleId);
    await saveCircles(next);
  }, [circles]);

  const updateCircle = useCallback(async (circleId: string, updates: Partial<Circle>) => {
    const next = circles.map((c) => c.id === circleId ? { ...c, ...updates } : c);
    await saveCircles(next);
  }, [circles]);

  const addQuestion = useCallback(async (circleId: string, q: VerificationQuestion) => {
    const next = circles.map((c) =>
      c.id === circleId ? { ...c, questions: [...c.questions, q] } : c
    );
    await saveCircles(next);
  }, [circles]);

  const removeQuestion = useCallback(async (circleId: string, qId: string) => {
    const next = circles.map((c) =>
      c.id === circleId ? { ...c, questions: c.questions.filter((q) => q.id !== qId) } : c
    );
    await saveCircles(next);
  }, [circles]);

  const requestJoin = useCallback(async (circleId: string, req: JoinRequest) => {
    const next = circles.map((c) =>
      c.id === circleId ? { ...c, joinRequests: [...(c.joinRequests || []), req] } : c
    );
    await saveCircles(next);
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
    const req = (circle?.joinRequests || []).find((r) => r.id === reqId);
    const next = circles.map((c) => {
      if (c.id !== circleId) return c;
      if (!req) return c;
      const newMember: CircleMember = {
        userId: req.userId,
        nickname: req.userName,
        joinedAt: new Date().toISOString(),
        role: "member",
      };
      return {
        ...c,
        joinRequests: c.joinRequests.map((r) =>
          r.id === reqId ? { ...r, status: "approved" as const } : r
        ),
        members: [...c.members, newMember],
      };
    });
    await saveCircles(next);
    if (req && circle) {
      await pushNotification({
        type: "join_approved",
        circleId,
        circleName: circle.name,
        title: "Join request approved",
        body: `${req.userName} was approved to join ${circle.name}.`,
      });
    }
  }, [circles]);

  const rejectJoin = useCallback(async (circleId: string, reqId: string) => {
    const next = circles.map((c) =>
      c.id === circleId
        ? {
            ...c,
            joinRequests: c.joinRequests.map((r) =>
              r.id === reqId ? { ...r, status: "rejected" as const } : r
            ),
          }
        : c
    );
    await saveCircles(next);
  }, [circles]);

  const addItineraryItem = useCallback(async (circleId: string, item: ItineraryItem, budgetItem?: BudgetItem, timelineEntry?: TimelineEntry) => {
    const circle = circles.find((c) => c.id === circleId);
    const next = circles.map((c) => {
      if (c.id !== circleId) return c;
      const updated = { ...c, itinerary: [...c.itinerary, item] };
      if (budgetItem) updated.budget = [...c.budget, budgetItem];
      if (timelineEntry) updated.timeline = [timelineEntry, ...c.timeline];
      return updated;
    });
    await saveCircles(next);
    await pushNotification({
      type: "itinerary_added",
      circleId,
      circleName: circle?.name ?? "",
      title: "Activity added",
      body: `Day ${item.day} · ${item.title}${budgetItem ? ` · $${budgetItem.amount.toFixed(2)}` : ""}`,
    });
  }, [circles]);

  const updateItineraryItem = useCallback(async (circleId: string, itemId: string, updates: Partial<ItineraryItem>, options?: { removeBudgetItemId?: string; addBudgetItem?: BudgetItem; addTimelineEntry?: TimelineEntry }) => {
    const next = circles.map((c) => {
      if (c.id !== circleId) return c;
      const updated = { ...c, itinerary: c.itinerary.map((i) => i.id === itemId ? { ...i, ...updates } : i) };
      if (options?.removeBudgetItemId) updated.budget = c.budget.filter((b) => b.id !== options.removeBudgetItemId);
      if (options?.addBudgetItem) updated.budget = [...updated.budget, options.addBudgetItem];
      if (options?.addTimelineEntry) updated.timeline = [options.addTimelineEntry, ...c.timeline];
      return updated;
    });
    await saveCircles(next);
  }, [circles]);

  const removeItineraryItem = useCallback(async (circleId: string, itemId: string) => {
    const next = circles.map((c) => {
      if (c.id !== circleId) return c;
      const item = c.itinerary.find((i) => i.id === itemId);
      const updated = { ...c, itinerary: c.itinerary.filter((i) => i.id !== itemId) };
      if (item?.expenseBudgetItemId) {
        updated.budget = c.budget.filter((b) => b.id !== item.expenseBudgetItemId);
      }
      return updated;
    });
    await saveCircles(next);
  }, [circles]);

  const addBudgetItem = useCallback(async (circleId: string, item: BudgetItem) => {
    const circle = circles.find((c) => c.id === circleId);
    const next = circles.map((c) =>
      c.id === circleId ? { ...c, budget: [...c.budget, item] } : c
    );
    await saveCircles(next);
    await pushNotification({
      type: "budget_update",
      circleId,
      circleName: circle?.name ?? "",
      title: "Expense added",
      body: `${item.title} · $${item.amount.toFixed(2)} (${item.category})`,
    });
  }, [circles]);

  const removeBudgetItem = useCallback(async (circleId: string, itemId: string) => {
    const next = circles.map((c) =>
      c.id === circleId
        ? { ...c, budget: c.budget.filter((b) => b.id !== itemId) }
        : c
    );
    await saveCircles(next);
  }, [circles]);

  const addTimelineEntry = useCallback(async (circleId: string, entry: TimelineEntry) => {
    const circle = circles.find((c) => c.id === circleId);
    const next = circles.map((c) =>
      c.id === circleId ? { ...c, timeline: [entry, ...c.timeline] } : c
    );
    await saveCircles(next);
    await pushNotification({
      type: "timeline_post",
      circleId,
      circleName: circle?.name ?? "",
      title: "New post",
      body: entry.caption ? `"${entry.caption.slice(0, 80)}"` : `A new post was added to ${circle?.name ?? "the circle"}.`,
    });
  }, [circles]);

  const removeTimelineEntry = useCallback(async (circleId: string, entryId: string) => {
    const next = circles.map((c) =>
      c.id === circleId
        ? { ...c, timeline: c.timeline.filter((e) => e.id !== entryId) }
        : c
    );
    await saveCircles(next);
  }, [circles]);

  const updateTimelineEntry = useCallback(async (circleId: string, entryId: string, updates: Partial<TimelineEntry>) => {
    const next = circles.map((c) =>
      c.id === circleId
        ? { ...c, timeline: c.timeline.map((e) => e.id === entryId ? { ...e, ...updates } : e) }
        : c
    );
    await saveCircles(next);
  }, [circles]);

  const addReaction = useCallback(async (circleId: string, entryId: string, reaction: Reaction) => {
    const next = circles.map((c) => {
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
    });
    await saveCircles(next);
  }, [circles]);

  const addComment = useCallback(async (circleId: string, entryId: string, comment: Comment) => {
    const circle = circles.find((c) => c.id === circleId);
    const next = circles.map((c) => {
      if (c.id !== circleId) return c;
      return {
        ...c,
        timeline: c.timeline.map((e) =>
          e.id === entryId ? { ...e, comments: [...e.comments, comment] } : e
        ),
      };
    });
    await saveCircles(next);
    await pushNotification({
      type: "comment",
      circleId,
      circleName: circle?.name ?? "",
      title: "New comment",
      body: comment.text.length > 80 ? comment.text.slice(0, 80) + "…" : comment.text,
    });
  }, [circles]);

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        circles,
        isLoading,
        setCurrentUser,
        updateNickname,
        createCircle,
        joinCircle,
        leaveCircle,
        updateCircle,
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
