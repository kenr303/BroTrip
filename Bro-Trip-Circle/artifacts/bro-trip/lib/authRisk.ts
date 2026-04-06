import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AuthRiskState,
  QuestionUsage,
  VerificationQuestion,
} from "@/context/AppContext";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const TIMER_SECONDS: Record<Exclude<RiskLevel, "critical">, number> & {
  critical: number;
} = {
  low: 30,
  moderate: 25,
  high: 20,
  critical: 0,
};

const STORAGE_KEYS = {
  state: (userId: string, circleId: string) => `bt_risk_state:${userId}:${circleId}`,
  usage: (circleId: string) => `bt_risk_usage:${circleId}`,
};

const PENALTIES = {
  wrongAnswer: 2,
  timeout: 3,
  slowCorrect: 1,
  correct: 1,
  fastCorrectBonus: 1,
  milestoneBonus: 2,
};

const LIMITS = {
  consecutiveFailuresToLock: 5,
  cooldownMinutes: 30,
  reentryCodeMinutes: 10,
  recoverySpacingMinutes: 60,
  recoveryMilestoneSuccesses: 3,
  storedSuccesses: 10,
};

const THRESHOLDS = {
  moderate: 3,
  high: 6,
  critical: 9,
};

const ONE_HOUR_MS = LIMITS.recoverySpacingMinutes * 60 * 1000;
const COOLDOWN_MS = LIMITS.cooldownMinutes * 60 * 1000;
const REENTRY_EXPIRY_MS = LIMITS.reentryCodeMinutes * 60 * 1000;

const DEFAULT_STATE: AuthRiskState = {
  suspicionScore: 0,
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lockedUntil: null,
  reentryCode: null,
  reentryCodeExpiresAt: null,
  successHistory: [],
  lastAttemptAt: null,
};

function nowIso() {
  return new Date().toISOString();
}

function clampMinZero(n: number) {
  return Math.max(0, n);
}

function isDateInFuture(iso: string | null | undefined) {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function normalizeState(state?: Partial<AuthRiskState> | null): AuthRiskState {
  return {
    ...DEFAULT_STATE,
    ...(state || {}),
    successHistory: Array.isArray(state?.successHistory) ? state!.successHistory : [],
  };
}

function generateReentryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function lockState(state: AuthRiskState): AuthRiskState {
  return {
    ...state,
    lockedUntil: new Date(Date.now() + COOLDOWN_MS).toISOString(),
    reentryCode: generateReentryCode(),
    reentryCodeExpiresAt: new Date(Date.now() + REENTRY_EXPIRY_MS).toISOString(),
    lastAttemptAt: nowIso(),
  };
}

export function isLocked(state: AuthRiskState): boolean {
  return isDateInFuture(state.lockedUntil);
}

export function getRiskLevel(state: AuthRiskState): RiskLevel {
  if (isLocked(state) || state.suspicionScore >= THRESHOLDS.critical) return "critical";
  if (state.suspicionScore >= THRESHOLDS.high) return "high";
  if (state.suspicionScore >= THRESHOLDS.moderate) return "moderate";
  return "low";
}

export async function loadRiskState(
  userId: string,
  circleId: string
): Promise<AuthRiskState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.state(userId, circleId));
  if (!raw) return { ...DEFAULT_STATE };
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveRiskState(
  userId: string,
  circleId: string,
  state: AuthRiskState
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.state(userId, circleId),
    JSON.stringify(normalizeState(state))
  );
}

export async function loadQuestionUsage(circleId: string): Promise<QuestionUsage> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.usage(circleId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as QuestionUsage;
  } catch {
    return {};
  }
}

export async function recordQuestionUsage(
  circleId: string,
  questionIds: string[]
): Promise<void> {
  const usage = await loadQuestionUsage(circleId);
  const ts = nowIso();
  for (const qid of questionIds) {
    const prev = usage[qid] || { usageCount: 0, lastUsedAt: null };
    usage[qid] = {
      usageCount: prev.usageCount + 1,
      lastUsedAt: ts,
    };
  }
  await AsyncStorage.setItem(STORAGE_KEYS.usage(circleId), JSON.stringify(usage));
}

export function checkAnswer(input: string, acceptedAnswers: string[]): boolean {
  const norm = normalizeAnswer(input);
  if (!norm) return false;
  return acceptedAnswers.some((a) => normalizeAnswer(a) === norm);
}

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function applyWrongAnswer(inputState: AuthRiskState): AuthRiskState {
  let state = normalizeState(inputState);
  state = {
    ...state,
    suspicionScore: state.suspicionScore + PENALTIES.wrongAnswer,
    consecutiveFailures: state.consecutiveFailures + 1,
    lastAttemptAt: nowIso(),
  };

  if (
    state.consecutiveFailures >= LIMITS.consecutiveFailuresToLock ||
    state.suspicionScore >= THRESHOLDS.critical
  ) {
    state = lockState(state);
  }

  return state;
}

export function applyTimeout(inputState: AuthRiskState): AuthRiskState {
  let state = normalizeState(inputState);
  state = {
    ...state,
    suspicionScore: state.suspicionScore + PENALTIES.timeout,
    consecutiveFailures: state.consecutiveFailures + 1,
    lastAttemptAt: nowIso(),
  };

  if (
    state.consecutiveFailures >= LIMITS.consecutiveFailuresToLock ||
    state.suspicionScore >= THRESHOLDS.critical
  ) {
    state = lockState(state);
  }

  return state;
}

export function applyCorrectAnswer(
  inputState: AuthRiskState,
  timing?: { remainingSecs?: number; totalSecs?: number }
): AuthRiskState {
  let state = normalizeState(inputState);
  let score = state.suspicionScore - PENALTIES.correct;

  const totalSecs = timing?.totalSecs ?? 0;
  const remainingSecs = timing?.remainingSecs ?? 0;

  if (totalSecs > 0) {
    const remainingRatio = remainingSecs / totalSecs;

    if (remainingRatio <= 0.2) {
      score += PENALTIES.slowCorrect;
    }

    if (remainingRatio >= 0.4) {
      score -= PENALTIES.fastCorrectBonus;
    }
  }

  const now = Date.now();
  const lastCounted = state.lastSuccessAt ? new Date(state.lastSuccessAt).getTime() : 0;
  let successHistory = [...state.successHistory];

  const qualifiesForSpacedRecovery =
    !state.lastSuccessAt || now - lastCounted >= ONE_HOUR_MS;

  if (qualifiesForSpacedRecovery) {
    successHistory.push(new Date(now).toISOString());
    if (successHistory.length > LIMITS.storedSuccesses) {
      successHistory = successHistory.slice(-LIMITS.storedSuccesses);
    }
  }

  let spacedRecentCount = 0;
  for (let i = successHistory.length - 1; i >= 0; i -= 1) {
    const t = new Date(successHistory[i]).getTime();
    if (now - t <= 7 * 24 * 60 * 60 * 1000) {
      spacedRecentCount += 1;
    } else {
      break;
    }
  }

  if (qualifiesForSpacedRecovery && spacedRecentCount >= LIMITS.recoveryMilestoneSuccesses) {
    score -= PENALTIES.milestoneBonus;
    successHistory = [];
  }

  state = {
    ...state,
    suspicionScore: clampMinZero(score),
    consecutiveFailures: 0,
    lastSuccessAt: qualifiesForSpacedRecovery ? new Date(now).toISOString() : state.lastSuccessAt,
    successHistory,
    lastAttemptAt: new Date(now).toISOString(),
  };

  if (!isDateInFuture(state.lockedUntil)) {
    state.lockedUntil = null;
  }

  return state;
}

export function applyReentryCode(
  inputState: AuthRiskState,
  input: string
): { success: boolean; state: AuthRiskState } {
  const state = normalizeState(inputState);
  const code = input.trim().toUpperCase();

  const valid =
    !!state.reentryCode &&
    !!state.reentryCodeExpiresAt &&
    isDateInFuture(state.reentryCodeExpiresAt) &&
    code === state.reentryCode;

  if (!valid) {
    return { success: false, state };
  }

  return {
    success: true,
    state: {
      ...state,
      suspicionScore: 4,
      consecutiveFailures: 0,
      lockedUntil: null,
      reentryCode: null,
      reentryCodeExpiresAt: null,
      lastAttemptAt: nowIso(),
    },
  };
}

function usageScore(
  q: VerificationQuestion,
  usage: QuestionUsage
): number {
  const info = usage[q.id];
  const count = info?.usageCount ?? 0;
  const lastUsedAt = info?.lastUsedAt ? new Date(info.lastUsedAt).getTime() : 0;
  const ageBonus = lastUsedAt ? Math.min((Date.now() - lastUsedAt) / (1000 * 60 * 60), 72) : 72;
  return count - ageBonus * 0.01;
}

function difficultyRank(q: VerificationQuestion): number {
  switch (q.difficulty) {
    case "easy":
      return 1;
    case "hard":
      return 3;
    case "medium":
    default:
      return 2;
  }
}

export function selectQuestions(
  questions: VerificationQuestion[],
  usage: QuestionUsage,
  level: RiskLevel
): VerificationQuestion[] {
  if (!questions.length) return [];

  const sorted = [...questions].sort((a, b) => usageScore(a, usage) - usageScore(b, usage));

  const easy = sorted.filter((q) => difficultyRank(q) === 1);
  const medium = sorted.filter((q) => difficultyRank(q) === 2);
  const hard = sorted.filter((q) => difficultyRank(q) === 3);

  if (level === "low") {
    return [easy[0] || medium[0] || hard[0]].filter(Boolean);
  }

  if (level === "moderate") {
    return [medium[0] || hard[0] || easy[0]].filter(Boolean);
  }

  if (level === "high") {
    const hardFirst = hard[0];
    const med1 = medium[0];
    const med2 = medium[1];
    if (hardFirst) return [hardFirst];
    return [med1, med2].filter(Boolean);
  }

  return [];
}