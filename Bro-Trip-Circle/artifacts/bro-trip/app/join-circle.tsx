import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/hooks/useColors";
import { useApp, Circle, VerificationQuestion } from "@/context/AppContext";

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
      {
        id: "q1",
        question: "What was the name of the dog at our first camping trip?",
        answers: ["rex", "the dog rex", "rex the dog"],
        addedBy: "alex",
      },
      {
        id: "q2",
        question: "How much did we lose at the casino?",
        answers: ["1800", "$1800", "1800 dollars", "eighteen hundred"],
        addedBy: "mike",
      },
    ],
    joinRequests: [],
    destination: "Las Vegas, NV",
    startDate: "2026-06-15",
    endDate: "2026-06-19",
    totalBudget: 2000,
    status: "upcoming",
    itinerary: [],
    budget: [],
    timeline: [
      {
        id: "t1",
        userId: "alex",
        type: "event",
        day: 1,
        eventTime: "8:00 PM",
        eventLabel: "Day 1, 8pm – Arrived and checked in",
        caption: "We're here! Hotel is actually nicer than expected.",
        images: [],
        reactions: [],
        comments: [],
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
];

type Step = "code" | "verify" | "nickname" | "request_sent";

export default function JoinCircleScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, joinCircle, circles, requestJoin } = useApp();

  const [inviteCode, setInviteCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [foundCircle, setFoundCircle] = useState<Circle | null>(null);
  const [question, setQuestion] = useState<VerificationQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [nickname, setNickname] = useState(currentUser?.name || "");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("code");
  const [wrongAttempts, setWrongAttempts] = useState(0);

  // Check all circles user already has (local + demo) for the code
  const findCircle = () => {
    const code = inviteCode.trim().toUpperCase();
    const local = circles.find((c) => c.inviteCode === code);
    const demo = DEMO_CIRCLES.find((c) => c.inviteCode === code);
    const found = local || demo;
    if (!found) {
      setCodeError("No circle found. Double-check the code.");
      return;
    }
    if (found.members.some((m) => m.userId === currentUser?.id)) {
      setCodeError("You're already in this circle.");
      return;
    }
    setCodeError("");
    setFoundCircle(found);
    const q = found.questions[Math.floor(Math.random() * found.questions.length)];
    setQuestion(q);
    setStep("verify");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const verifyAnswer = () => {
    if (!foundCircle || !question) return;
    const userAnswer = answer.trim().toLowerCase();
    const correct = question.answers.some((a) => a.toLowerCase() === userAnswer);
    if (correct) {
      setAnswerError("");
      setStep("nickname");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setWrongAttempts((n) => n + 1);
      setAnswerError(
        wrongAttempts >= 1
          ? "Still not right. You can request approval from the creator instead."
          : "That's not right. Try another answer, or ask your bro for a hint."
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: Platform.OS === "web" ? 80 : 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                if (step === "verify" || step === "nickname") {
                  setStep("code");
                  setFoundCircle(null);
                  setAnswer("");
                  setAnswerError("");
                  setWrongAttempts(0);
                } else {
                  router.back();
                }
              }}
              style={styles.backBtn}
            >
              <Feather name={step === "request_sent" ? "x" : "arrow-left"} size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {step === "code" ? "Join a Trip" : step === "verify" ? "Prove you're a bro" : step === "nickname" ? "Set your nickname" : "Request sent!"}
            </Text>
            {foundCircle && step !== "code" && (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {foundCircle.name}
                {foundCircle.destination ? ` · ${foundCircle.destination}` : ""}
              </Text>
            )}
          </View>

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

          {step === "verify" && question && (
            <View style={styles.form}>
              <View style={[styles.questionBox, { backgroundColor: colors.navy, borderRadius: colors.radius }]}>
                <Feather name="shield" size={28} color={colors.primary} />
                <Text style={styles.questionText}>{question.question}</Text>
                <Text style={styles.questionHint}>
                  {question.answers.length > 1
                    ? `${question.answers.length} accepted answers`
                    : "One correct answer"}
                </Text>
              </View>
              <Input
                label="Your Answer"
                placeholder="Type your answer..."
                value={answer}
                onChangeText={setAnswer}
                error={answerError}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={verifyAnswer}
              />
              <Button
                label="Verify"
                onPress={verifyAnswer}
                disabled={!answer.trim()}
                size="lg"
              />
              {wrongAttempts >= 1 && (
                <Pressable
                  onPress={handleRequestJoin}
                  style={[styles.requestBtn, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}
                >
                  <Feather name="send" size={16} color={colors.foreground} />
                  <Text style={[styles.requestBtnText, { color: colors.foreground }]}>
                    Request approval from the creator
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {step === "nickname" && (
            <View style={styles.form}>
              <View style={[styles.successBanner, { backgroundColor: colors.success + "15", borderRadius: colors.radius - 4, borderColor: colors.success + "40" }]}>
                <Feather name="check-circle" size={20} color={colors.success} />
                <Text style={[styles.successText, { color: colors.success }]}>Answer correct! You're in.</Text>
              </View>
              <Input
                label="Your Nickname in This Circle"
                placeholder="What do the bros call you?"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="words"
              />
              <Text style={[styles.nicknameHint, { color: colors.mutedForeground }]}>
                This name is only used inside this circle. You can change it later.
              </Text>
              <Button label="Join Circle" onPress={handleJoin} loading={loading} size="lg" />
            </View>
          )}

          {step === "request_sent" && (
            <View style={styles.form}>
              <View style={[styles.requestCard, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                <Text style={styles.requestEmoji}>📨</Text>
                <Text style={[styles.requestTitle, { color: colors.foreground }]}>Request sent!</Text>
                <Text style={[styles.requestText, { color: colors.mutedForeground }]}>
                  The creator of {foundCircle?.name} will review your request. Once approved, the circle will appear in your trips.
                </Text>
              </View>
              <Button label="Done" onPress={() => router.back()} variant="ghost" size="lg" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 28, paddingBottom: 60 },
  header: { gap: 8 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14 },
  form: { gap: 18 },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  hintText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  questionBox: { padding: 28, gap: 12, alignItems: "center" },
  questionText: { fontFamily: "Inter_600SemiBold", fontSize: 20, color: "#fff", textAlign: "center", lineHeight: 28 },
  questionHint: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.5)" },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    paddingVertical: 14,
  },
  requestBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderWidth: 1,
  },
  successText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  nicknameHint: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, marginTop: -8 },
  requestCard: { alignItems: "center", padding: 32, gap: 14 },
  requestEmoji: { fontSize: 52 },
  requestTitle: { fontFamily: "Inter_700Bold", fontSize: 22 },
  requestText: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 22 },
});
