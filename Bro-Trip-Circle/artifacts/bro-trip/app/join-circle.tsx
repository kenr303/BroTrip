import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/hooks/useColors";
import { useApp, Circle, VerificationQuestion } from "@/context/AppContext";
import {
  RiskLevel,
  TIMER_SECONDS,
  applyCooldownExpiry,
  applyCorrectAnswer,
  applyReentryCode,
  applyTimeout,
  applyWrongAnswer,
  checkAnswer,
  getRiskLevel,
  isLocked,
  loadQuestionUsage,
  loadRiskState,
  recordQuestionUsage,
  saveRiskState,
  selectQuestions,
} from "@/lib/authRisk";

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

const DEMO_CIRCLES: Circle[] = [
  {
    id: "demo-circle-1",
    name: "The Bros",
    description: "Always down for an adventure",
    inviteCode: "BTRIP1",
    createdBy: "alex",
    members: [
      { userId: "alex", nickname: "Alex", joinedAt: new Date(Date.now() - 86400000 * 30).toISOString(), role: "creator" },
      { userId: "mike", nickname: "Big Mike", joinedAt: new Date(Date.now() - 86400000 * 28).toISOString(), role: "member" },
    ],
    questions: [
      { id: "q1", question: "What was the name of the dog at our first camping trip?", answers: ["rex", "the dog rex", "rex the dog"], addedBy: "alex", difficulty: "easy" },
      { id: "q2", question: "How much did we lose at the casino?", answers: ["1800", "$1800", "1800 dollars", "eighteen hundred"], addedBy: "mike", difficulty: "medium" },
      { id: "q3", question: "What year did we do the Vegas road trip?", answers: ["2019"], addedBy: "alex", difficulty: "hard" },
    ],
    joinRequests: [],
    destination: "Las Vegas, NV",
    startDate: "2026-06-15",
    endDate: "2026-06-19",
    totalBudget: 2000,
    status: "upcoming",
    itinerary: [],
    budget: [],
    timeline: [],
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
];

type Step = "code" | "verify" | "locked" | "nickname" | "request_sent";

const RISK_COLOR_KEY: Record<RiskLevel, "success" | "accent" | "destructive"> = {
  low: "success",
  moderate: "accent",
  high: "destructive",
  critical: "destructive",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
  critical: "Critical",
};

export default function JoinCircleScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, joinCircle, circles, requestJoin, addNotification, findCircleByInviteCode } = useApp();

  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [foundCircle, setFoundCircle] = useState<Circle | null>(null);

  const [questions, setQuestions] = useState<VerificationQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerError, setAnswerError] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [lockRemainingSecs, setLockRemainingSecs] = useState(0);
  const [reentryInput, setReentryInput] = useState("");
  const [reentryError, setReentryError] = useState("");
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [nickname, setNickname] = useState(currentUser?.name || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, []);

  const startTimer = useCallback((secs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSecs(secs);
    setTimerExpired(false);
    if (secs <= 0) return;
    timerRef.current = setInterval(() => {
      setTimerSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startLockTimer = useCallback((until: string) => {
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    const update = () => {
      const remain = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
      setLockRemainingSecs(remain);
      if (remain <= 0 && lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
    update();
    lockTimerRef.current = setInterval(update, 1000);
  }, []);

  useEffect(() => {
    if (!timerExpired || !foundCircle || !currentUser) return;
    (async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let state = await loadRiskState(currentUser.id, foundCircle.id);
      state = applyTimeout(state);
      await saveRiskState(currentUser.id, foundCircle.id, state);
      if (isLocked(state)) {
        setStep("locked");
        if (state.lockedUntil) startLockTimer(state.lockedUntil);
        await addNotification({
          type: "security_alert",
          circleId: foundCircle.id,
          circleName: foundCircle.name,
          title: "Account locked",
          body: `Access to ${foundCircle.name} is locked after too many failed attempts.`,
        });
      } else {
        await beginVerification(foundCircle, state, {
          errorMessage: "Time's up! Try again.",
        });
      }
    })();
  }, [timerExpired]);

  const findCircle = async () => {
    const code = inviteCode.trim().toUpperCase();
    const demo = DEMO_CIRCLES.find((c) => c.inviteCode === code);
    const remote = demo ? null : await findCircleByInviteCode(code);
    const found = demo || remote;
    if (!found) { setCodeError("No circle found. Double-check the code."); return; }
    if (found.members.some((m) => m.userId === currentUser?.id)) { setCodeError("You're already in this circle."); return; }
    setCodeError("");
    setFoundCircle(found);
    if (!currentUser) return;
    let state = await loadRiskState(currentUser.id, found.id);
    state = applyCooldownExpiry(state);
    await saveRiskState(currentUser.id, found.id, state);
    if (isLocked(state)) {
      setStep("locked");
      if (state.lockedUntil) startLockTimer(state.lockedUntil);
      return;
    }
    await beginVerification(found, state);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const beginVerification = async (
    circle: Circle,
    state: Awaited<ReturnType<typeof loadRiskState>>,
    options?: { errorMessage?: string }
  ) => {
    const level = getRiskLevel(state);
    setRiskLevel(level);

    const usage = await loadQuestionUsage(circle.id);
    const selected = selectQuestions(circle.questions, usage, level);

    if (!selected.length) {
      setStep("nickname");
      return;
    }

    setQuestions(selected);
    setCurrentQIndex(0);
    setAnswers(new Array(selected.length).fill(""));

    // keep an error message if caller passes one in
    setAnswerError(options?.errorMessage || "");

    setStep("verify");
    startTimer(TIMER_SECONDS[level]);
  };

  const verifyAnswer = async () => {
    if (!foundCircle || !currentUser || !questions.length) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[currentQIndex];
    const input = answers[currentQIndex] ?? "";
    const correct = checkAnswer(input, q.answers);

    let state = await loadRiskState(currentUser.id, foundCircle.id);
    const currentLevel = getRiskLevel(state);
    const totalSecs = TIMER_SECONDS[currentLevel];
    const remainingSecs = timerSecs;

    if (!correct) {
      state = applyWrongAnswer(state);
      await saveRiskState(currentUser.id, foundCircle.id, state);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isLocked(state)) {
        setStep("locked");
        if (state.lockedUntil) startLockTimer(state.lockedUntil);
        await addNotification({
          type: "security_alert",
          circleId: foundCircle.id,
          circleName: foundCircle.name,
          title: "Account locked",
          body: `Access to ${foundCircle.name} locked after too many wrong answers.`,
        });
        return;
      }

      const nextLevel = getRiskLevel(state);
      setRiskLevel(nextLevel);
      setAnswerError(
        state.consecutiveFailures >= 3
          ? `Wrong. ${Math.max(0, 5 - state.consecutiveFailures)} attempt${5 - state.consecutiveFailures === 1 ? "" : "s"
          } left.`
          : "Wrong answer. Try again."
      );

      // Re-select questions after wrong answers once risk rises.
      await beginVerification(foundCircle, state);
      return;
    }

    state = applyCorrectAnswer(state, { remainingSecs, totalSecs });
    await saveRiskState(currentUser.id, foundCircle.id, state);
    await recordQuestionUsage(foundCircle.id, [q.id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const nextLevel = getRiskLevel(state);
    setRiskLevel(nextLevel);

    const nextIndex = currentQIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQIndex(nextIndex);
      setAnswerError("");
      startTimer(TIMER_SECONDS[nextLevel]);
    } else {
      setStep("nickname");
    }
  };

  const submitReentryCode = async () => {
    if (!foundCircle || !currentUser) return;
    let state = await loadRiskState(currentUser.id, foundCircle.id);
    const { success, state: next } = applyReentryCode(state, reentryInput);
    if (!success) {
      setReentryError("Invalid or expired code.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await saveRiskState(currentUser.id, foundCircle.id, next);
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setReentryError("");
    await beginVerification(foundCircle, next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleJoin = async () => {
    if (!foundCircle) return;
    setLoading(true);
    await joinCircle(foundCircle, nickname.trim() || currentUser?.name || "");
    setLoading(false);
    router.back();
  };

  const handleRequestJoin = async () => {
    if (!foundCircle || !currentUser) return;
    setLoading(true);
    await requestJoin(foundCircle.id, {
      id: uid(),
      userId: currentUser.id,
      userName: currentUser.name,
      requestedAt: new Date().toISOString(),
      status: "pending",
    });
    setLoading(false);
    setStep("request_sent");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const goBack = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (step === "verify" || step === "locked" || step === "nickname") {
      setStep("code");
      setFoundCircle(null);
      setAnswers([]);
      setAnswerError("");
    } else {
      router.back();
    }
  };

  const currentQuestion = questions[currentQIndex] ?? null;
  const currentAnswer = answers[currentQIndex] ?? "";
  const setCurrentAnswer = (v: string) =>
    setAnswers((prev) => { const n = [...prev]; n[currentQIndex] = v; return n; });

  const timerPct = TIMER_SECONDS[riskLevel] > 0 ? timerSecs / TIMER_SECONDS[riskLevel] : 0;
  const timerColor = timerSecs <= 5 ? colors.destructive : timerSecs <= 10 ? colors.accent : colors.primary;
  const riskColor = colors[RISK_COLOR_KEY[riskLevel]] as string;
  const lockMins = Math.floor(lockRemainingSecs / 60);
  const lockSecs = lockRemainingSecs % 60;

  // ── Verify step: split layout (question scrolls, input+button fixed above keyboard)
  if (step === "verify" && currentQuestion) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.timerBarTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.timerBarFill,
              { width: `${timerPct * 100}%`, backgroundColor: timerColor },
            ]}
          />
        </View>

        <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={goBack} style={styles.navBack} hitSlop={12}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>

          <View style={styles.navMeta}>
            <Text
              style={[styles.navCircle, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {foundCircle?.name}
            </Text>
            {foundCircle?.destination ? (
              <Text
                style={[styles.navDest, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {foundCircle.destination}
              </Text>
            ) : null}
          </View>

          <View style={[styles.timerPill, { backgroundColor: timerColor + "18" }]}>
            <Feather name="clock" size={12} color={timerColor} />
            <Text style={[styles.timerPillText, { color: timerColor }]}>
              {timerSecs}s
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.verifyScrollContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.verifyContent}>
                <View>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.riskChip,
                        {
                          backgroundColor: riskColor + "18",
                          borderColor: riskColor + "40",
                        },
                      ]}
                    >
                      <View
                        style={[styles.riskDot, { backgroundColor: riskColor }]}
                      />
                      <Text
                        style={[styles.riskChipText, { color: riskColor }]}
                      >
                        {RISK_LABEL[riskLevel]}
                      </Text>
                    </View>

                    {questions.length > 1 && (
                      <Text
                        style={[styles.qCount, { color: colors.mutedForeground }]}
                      >
                        {currentQIndex + 1} / {questions.length}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[styles.verifyLabel, { color: colors.mutedForeground }]}
                  >
                    Secret question
                  </Text>

                  <Text style={[styles.questionText, { color: colors.foreground }]}>
                    {currentQuestion.question}
                  </Text>

                  {currentQuestion.difficulty && (
                    <View
                      style={[styles.diffChip, { backgroundColor: colors.muted }]}
                    >
                      <Text
                        style={[
                          styles.diffChipText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {currentQuestion.difficulty}
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.verifyBottom,
                    {
                      backgroundColor: colors.background,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <Input
                    placeholder="Type your answer…"
                    value={currentAnswer}
                    onChangeText={setCurrentAnswer}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={verifyAnswer}
                  />

                  {answerError ? (
                    <View style={styles.errorRow}>
                      <Feather
                        name="alert-circle"
                        size={13}
                        color={colors.destructive}
                      />
                      <Text
                        style={[styles.errorText, { color: colors.destructive }]}
                      >
                        {answerError}
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    label="Enter Circle"
                    onPress={verifyAnswer}
                    disabled={!currentAnswer.trim()}
                    size="lg"
                  />

                  <Pressable onPress={handleRequestJoin} style={styles.requestLink}>
                    <Text
                      style={[
                        styles.requestLinkText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Can't answer? Request approval
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── All other steps: simple scroll layout ────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={[styles.container, { paddingTop: Platform.OS === "web" ? 80 : 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                <Feather name={step === "request_sent" ? "x" : "arrow-left"} size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {step === "code" ? "Join a Trip"
                  : step === "locked" ? "Access Locked"
                    : step === "nickname" ? "Set your nickname"
                      : "Request sent!"}
              </Text>
              {foundCircle && step !== "code" && (
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {foundCircle.name}{foundCircle.destination ? ` · ${foundCircle.destination}` : ""}
                </Text>
              )}
            </View>

            {/* ── Code entry ───────────────────────────────────────────────── */}
            {step === "code" && (
              <View style={styles.form}>
                <Input
                  label="Invite Code"
                  placeholder="e.g. BTRIP1"
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase())}
                  error={codeError}
                  autoCapitalize="characters"
                  maxLength={8}
                  style={{ fontSize: 22, letterSpacing: 6, fontFamily: "Inter_700Bold", textAlign: "center" }}
                />
                <View style={[styles.hint, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
                  <Feather name="info" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                    Demo: try code{" "}
                    <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>BTRIP1</Text>
                    {" "}— answer the secret question to join
                  </Text>
                </View>
                <Button label="Find Circle" onPress={findCircle} disabled={!inviteCode.trim()} size="lg" />
              </View>
            )}

            {/* ── Locked ───────────────────────────────────────────────────── */}
            {step === "locked" && (
              <View style={styles.form}>
                <View style={[styles.lockedCard, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30", borderRadius: colors.radius }]}>
                  <Text style={styles.lockedEmoji}>🚨</Text>
                  <Text style={[styles.lockedTitle, { color: colors.destructive }]}>Waifu ALERT!!</Text>
                  <Text style={[styles.lockedSub, { color: colors.foreground }]}>Ask the BIG Bro for code</Text>
                  {lockRemainingSecs > 0 && (
                    <Text style={[styles.lockTimer, { color: colors.mutedForeground }]}>
                      Cooldown: {lockMins}:{String(lockSecs).padStart(2, "0")}
                    </Text>
                  )}
                </View>
                <View style={[styles.reentryBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                  <Text style={[styles.reentryLabel, { color: colors.mutedForeground }]}>Have the re-entry code?</Text>
                  <Input
                    label="Re-entry Code"
                    placeholder="6-character code"
                    value={reentryInput}
                    onChangeText={(v) => setReentryInput(v.toUpperCase())}
                    error={reentryError}
                    autoCapitalize="characters"
                    maxLength={6}
                    style={{ letterSpacing: 4, fontFamily: "Inter_700Bold", textAlign: "center" }}
                  />
                  <Button label="Unlock Access" onPress={submitReentryCode} disabled={reentryInput.trim().length !== 6} size="lg" />
                </View>
                <Pressable onPress={handleRequestJoin} style={styles.requestLink}>
                  <Text style={[styles.requestLinkText, { color: colors.mutedForeground }]}>Request approval from the creator</Text>
                </Pressable>
              </View>
            )}

            {/* ── Nickname ─────────────────────────────────────────────────── */}
            {step === "nickname" && (
              <View style={styles.form}>
                <View style={[styles.successBanner, { backgroundColor: colors.success + "15", borderRadius: colors.radius - 4, borderColor: colors.success + "40" }]}>
                  <Feather name="check-circle" size={20} color={colors.success} />
                  <Text style={[styles.successText, { color: colors.success }]}>You're in!</Text>
                </View>
                <Input
                  label="Your Nickname in This Circle"
                  placeholder="What do the bros call you?"
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="words"
                />
                <Text style={[styles.nicknameHint, { color: colors.mutedForeground }]}>
                  Only visible inside this circle. You can change it later.
                </Text>
                <Button label="Join Circle" onPress={handleJoin} loading={loading} size="lg" />
              </View>
            )}

            {/* ── Request sent ─────────────────────────────────────────────── */}
            {step === "request_sent" && (
              <View style={styles.form}>
                <View style={[styles.requestCard, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                  <Text style={styles.requestEmoji}>📨</Text>
                  <Text style={[styles.requestTitle, { color: colors.foreground }]}>Request sent!</Text>
                  <Text style={[styles.requestBodyText, { color: colors.mutedForeground }]}>
                    The creator of {foundCircle?.name} will review your request.
                  </Text>
                </View>
                <Button label="Done" onPress={() => router.back()} variant="ghost" size="lg" />
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Shared ──────────────────────────────────────────────────────────────────
  container: { flexGrow: 1, padding: 24, gap: 28, paddingBottom: 60 },
  header: { gap: 8 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14 },
  form: { gap: 18 },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  hintText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderWidth: 1 },
  successText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  nicknameHint: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, marginTop: -8 },
  requestCard: { alignItems: "center", padding: 32, gap: 14 },
  requestEmoji: { fontSize: 52 },
  requestTitle: { fontFamily: "Inter_700Bold", fontSize: 22 },
  requestBodyText: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 22 },
  requestLink: { alignItems: "center", paddingVertical: 4 },
  requestLinkText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  lockedCard: { alignItems: "center", padding: 32, gap: 10, borderWidth: 1 },
  lockedEmoji: { fontSize: 52 },
  lockedTitle: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -0.5 },
  lockedSub: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  lockTimer: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 },
  reentryBox: { borderWidth: 1, padding: 20, gap: 14 },
  reentryLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },

  // ── Verify step ──────────────────────────────────────────────────────────────
  timerBarTrack: { height: 3, width: "100%" },
  timerBarFill: { height: 3 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBack: { padding: 4 },
  navMeta: { flex: 1 },
  navCircle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  navDest: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timerPillText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  verifyScrollContainer: {
    flexGrow: 1,
  },
  verifyContent: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 32,
    gap: 24,
  },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  riskChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskChipText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  qCount: { fontFamily: "Inter_500Medium", fontSize: 13 },
  verifyLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
  },
  questionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  diffChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diffChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  verifyBottom: {
    padding: 20,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
});
