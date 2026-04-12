import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useApp, type VerificationQuestion } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  TIMER_SECONDS,
  applyCorrectAnswer,
  applyReentryCode,
  applyTimeout,
  applyCooldownExpiry,
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

interface Props {
  circleId: string;
  onVerified: () => void;
  onBack: () => void;
}

export function VerificationGate({ circleId, onVerified, onBack }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { circles, currentUser } = useApp();

  const circle = circles.find((c) => c.id === circleId);

  const [gateQ, setGateQ] = useState<VerificationQuestion | null>(null);
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateQuestions, setGateQuestions] = useState<VerificationQuestion[]>([]);
  const [gateIndex, setGateIndex] = useState(0);
  const [gateRiskLevel, setGateRiskLevel] = useState<"low" | "moderate" | "high" | "critical">("low");
  const [gateTimerSecs, setGateTimerSecs] = useState(0);
  const [gateTimerExpired, setGateTimerExpired] = useState(false);
  const [gateLocked, setGateLocked] = useState(false);
  const [gateLockRemainingSecs, setGateLockRemainingSecs] = useState(0);
  const [gateReentryCode, setGateReentryCode] = useState("");
  const [gateReentryError, setGateReentryError] = useState("");

  const gateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gateLockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep circles ref fresh for the focus callback
  const circlesRef = useRef(circles);
  useEffect(() => { circlesRef.current = circles; }, [circles]);

  const startGateTimer = useCallback((secs: number) => {
    if (gateTimerRef.current) clearInterval(gateTimerRef.current);
    setGateTimerSecs(secs);
    setGateTimerExpired(false);
    if (secs <= 0) return;
    gateTimerRef.current = setInterval(() => {
      setGateTimerSecs((prev) => {
        if (prev <= 1) {
          if (gateTimerRef.current) clearInterval(gateTimerRef.current);
          setGateTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startGateLockTimer = useCallback((until: string) => {
    if (gateLockTimerRef.current) clearInterval(gateLockTimerRef.current);
    const update = () => {
      const remain = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
      setGateLockRemainingSecs(remain);
      if (remain <= 0 && gateLockTimerRef.current) clearInterval(gateLockTimerRef.current);
    };
    update();
    gateLockTimerRef.current = setInterval(update, 1000);
  }, []);

  const beginGateVerification = useCallback(
    async (circleArg: typeof circle, errorMessage?: string) => {
      if (!circleArg || !currentUser) return;

      let state = await loadRiskState(currentUser.id, circleArg.id);
      state = applyCooldownExpiry(state);
      await saveRiskState(currentUser.id, circleArg.id, state);

      if (isLocked(state)) {
        setGateLocked(true);
        setGateError("");
        if (state.lockedUntil) startGateLockTimer(state.lockedUntil);
        return;
      }

      const level = getRiskLevel(state);
      setGateRiskLevel(level);

      const usage = await loadQuestionUsage(circleArg.id);
      const selected = selectQuestions(circleArg.questions, usage, level);

      if (!selected.length) {
        if (!circleArg.questions.length) {
          onVerified();
          return;
        }
        setGateLocked(false);
        setGateError("Verification required. Please try again.");
        return;
      }

      setGateQuestions(selected);
      setGateIndex(0);
      setGateQ(selected[0]);
      setGateAnswer("");
      setGateError(errorMessage || "");
      setGateLocked(false);
      startGateTimer(TIMER_SECONDS[level]);
    },
    [currentUser, startGateLockTimer, startGateTimer, onVerified]
  );

  useEffect(() => {
    if (!gateTimerExpired || !circle || !currentUser) return;
    (async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let state = await loadRiskState(currentUser.id, circle.id);
      state = applyTimeout(state);
      await saveRiskState(currentUser.id, circle.id, state);
      if (isLocked(state)) {
        setGateLocked(true);
        setGateError("");
        if (state.lockedUntil) startGateLockTimer(state.lockedUntil);
      } else {
        await beginGateVerification(circle, "Time's up! Try again.");
      }
    })();
  }, [gateTimerExpired, circle, currentUser, beginGateVerification, startGateLockTimer]);

  useFocusEffect(
    useCallback(() => {
      const c = circlesRef.current.find((c) => c.id === circleId);
      if (!c) return;
      setGateAnswer("");
      setGateError("");
      setGateLocked(false);
      setGateReentryCode("");
      setGateReentryError("");
      beginGateVerification(c);
      return () => {
        if (gateTimerRef.current) clearInterval(gateTimerRef.current);
        if (gateLockTimerRef.current) clearInterval(gateLockTimerRef.current);
      };
    }, [circleId, beginGateVerification])
  );

  const handleGateReentrySubmit = async () => {
    if (!circle || !currentUser) return;
    const state = await loadRiskState(currentUser.id, circle.id);
    const { success, state: next } = applyReentryCode(state, gateReentryCode);
    if (!success) {
      setGateReentryError("Invalid or expired code.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await saveRiskState(currentUser.id, circle.id, next);
    setGateReentryError("");
    setGateReentryCode("");
    setGateLocked(false);
    if (gateLockTimerRef.current) clearInterval(gateLockTimerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await beginGateVerification(circle);
  };

  const handleGateSubmit = async () => {
    if (!circle || !currentUser || !gateQ) return;
    if (gateTimerRef.current) clearInterval(gateTimerRef.current);

    const input = gateAnswer ?? "";
    const state = await loadRiskState(currentUser.id, circle.id);
    const correct = checkAnswer(input, gateQ.answers);

    if (!correct) {
      const next = applyWrongAnswer(state);
      await saveRiskState(currentUser.id, circle.id, next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (isLocked(next)) {
        setGateLocked(true);
        setGateError("");
        if (next.lockedUntil) startGateLockTimer(next.lockedUntil);
        return;
      }
      await beginGateVerification(
        circle,
        next.consecutiveFailures >= 3
          ? `Wrong. ${Math.max(0, 5 - next.consecutiveFailures)} attempt${5 - next.consecutiveFailures === 1 ? "" : "s"} left.`
          : "Wrong answer. Try again."
      );
      return;
    }

    const currentLevel = getRiskLevel(state);
    const totalSecs = TIMER_SECONDS[currentLevel];
    const nextState = applyCorrectAnswer(state, { remainingSecs: gateTimerSecs, totalSecs });
    await saveRiskState(currentUser.id, circle.id, nextState);
    await recordQuestionUsage(circle.id, [gateQ.id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const nextIndex = gateIndex + 1;
    if (nextIndex < gateQuestions.length) {
      setGateIndex(nextIndex);
      setGateQ(gateQuestions[nextIndex]);
      setGateAnswer("");
      setGateError("");
      const nextLevel = getRiskLevel(nextState);
      setGateRiskLevel(nextLevel);
      startGateTimer(TIMER_SECONDS[nextLevel]);
    } else {
      onVerified();
    }
  };

  const lockMins = Math.floor(gateLockRemainingSecs / 60);
  const lockSecs = gateLockRemainingSecs % 60;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.navy }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gateSafeTop}>
            <Pressable onPress={onBack} style={styles.gateBack}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>

            <View style={styles.gateLockWrap}>
              <View style={styles.gateLockCircle}>
                <Feather name={gateLocked ? "alert-triangle" : "lock"} size={28} color="#fff" />
              </View>
              <Text style={styles.gateCircleName}>{circle?.name}</Text>
              <Text style={styles.gateSubtitle}>
                {gateLocked ? "Access locked" : "Answer to enter"}
              </Text>
            </View>

            {gateLocked ? (
              <>
                <View style={[styles.gateCard, { backgroundColor: "#ffffff0F", borderColor: "#ffffff20" }]}>
                  <Text style={styles.gateQuestionLabel}>Locked</Text>
                  <Text style={styles.gateQuestion}>Ask the circle creator for a re-entry code</Text>
                  {gateLockRemainingSecs > 0 && (
                    <Text style={[styles.gateError, { color: "#fff", marginTop: 8 }]}>
                      Cooldown: {lockMins}:{String(lockSecs).padStart(2, "0")}
                    </Text>
                  )}
                </View>
                <View style={styles.gateInputWrap}>
                  <TextInput
                    style={[styles.gateInput, { borderColor: gateReentryError ? "#FF5C5C" : "#ffffff50" }]}
                    placeholder="Re-entry code"
                    placeholderTextColor="#ffffff60"
                    value={gateReentryCode}
                    onChangeText={(v) => { setGateReentryCode(v.toUpperCase()); setGateReentryError(""); }}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={handleGateReentrySubmit}
                  />
                  {gateReentryError ? <Text style={styles.gateError}>{gateReentryError}</Text> : null}
                </View>
                <Button label="Unlock Access" onPress={handleGateReentrySubmit} size="lg" style={{ marginHorizontal: 24 }} />
              </>
            ) : (
              <>
                {gateQ && (
                  <View style={[styles.gateCard, { backgroundColor: "#ffffff0F", borderColor: "#ffffff20" }]}>
                    <Text style={styles.gateQuestionLabel}>
                      Secret question · {gateRiskLevel} risk · {gateTimerSecs}s
                    </Text>
                    <Text style={styles.gateQuestion}>{gateQ.question}</Text>
                  </View>
                )}
                <View style={styles.gateInputWrap}>
                  <TextInput
                    style={[styles.gateInput, { borderColor: gateError ? "#FF5C5C" : "#ffffff50" }]}
                    placeholder="Your answer…"
                    placeholderTextColor="#ffffff60"
                    value={gateAnswer}
                    onChangeText={(v) => { setGateAnswer(v); setGateError(""); }}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={handleGateSubmit}
                  />
                  {gateError ? <Text style={styles.gateError}>{gateError}</Text> : null}
                </View>
                <Button label="Enter Circle" onPress={handleGateSubmit} size="lg" style={{ marginHorizontal: 24 }} />
              </>
            )}
          </View>
        </ScrollView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  gateSafeTop: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 12 },
  gateBack: { paddingHorizontal: 20, paddingVertical: 4 },
  gateLockWrap: { alignItems: "center", paddingTop: 32, paddingBottom: 24, gap: 10 },
  gateLockCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#ffffff20", alignItems: "center", justifyContent: "center" },
  gateCircleName: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", textAlign: "center", paddingHorizontal: 24 },
  gateSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: "#ffffff80" },
  gateCard: { marginHorizontal: 24, borderRadius: 14, borderWidth: 1, padding: 20, gap: 8, marginBottom: 20 },
  gateQuestionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FFD166", textTransform: "uppercase", letterSpacing: 1 },
  gateQuestion: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: "#fff", lineHeight: 26 },
  gateInputWrap: { marginHorizontal: 24, marginBottom: 16, gap: 8 },
  gateInput: { fontFamily: "Inter_400Regular", fontSize: 16, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff" },
  gateError: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#FF5C5C" },
});
