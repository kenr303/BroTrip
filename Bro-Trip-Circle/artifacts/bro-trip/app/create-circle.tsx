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
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

/** Validate and parse "MM/DD/YYYY" format. Returns a Date or null. */
function parseMDY(s: string): Date | null {
  if (!s) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s.trim())) return null;
  const [m, d, y] = s.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

const SUGGESTED_QUESTIONS = [
  "What was the name of our first camping trip?",
  "What did we eat at the gas station on the way to Vegas?",
  "What's the nickname we gave the broken-down car?",
  "Who fell asleep first at the New Year's party?",
  "What did we name the group chat?",
  "What restaurant did we go to after graduation?",
];

type Step = "info" | "questions";

interface QuestionDraft {
  question: string;
  answers: string; // comma-separated
}

export default function CreateCircleScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, createCircle } = useApp();

  const [step, setStep] = useState<Step>("info");

  // Step 1: Trip info
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState(currentUser?.name || "");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");

  // Step 2: Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ question: "", answers: "" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const goNext = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Give your circle a name";
    if (!nickname.trim()) e.nickname = "What should your crew call you in this circle?";
    if (startDate && !parseMDY(startDate)) e.startDate = "Use MM/DD/YYYY format (e.g. 07/01/2025)";
    if (endDate && !parseMDY(endDate)) e.endDate = "Use MM/DD/YYYY format (e.g. 07/05/2025)";
    if (!e.startDate && !e.endDate && startDate && endDate) {
      const s = parseMDY(startDate);
      const en = parseMDY(endDate);
      if (s && en && en < s) e.endDate = "End date must be after start date";
    }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep("questions");
  };

  const addQuestion = () => setQuestions((q) => [...q, { question: "", answers: "" }]);
  const removeQuestion = (i: number) => {
    if (questions.length <= 1) return;
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  };
  const updateQ = (i: number, field: keyof QuestionDraft, val: string) =>
    setQuestions((q) => q.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  const handleCreate = async () => {
    const filled = questions.filter((q) => q.question.trim() && q.answers.trim());
    const e: Record<string, string> = {};
    if (filled.length === 0) e.questions = "Add at least one question with answers";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const now = new Date();
    const start = parseMDY(startDate);
    const status = !start ? "upcoming" : now < start ? "upcoming" : "active";

    await createCircle({
      id: uid(),
      name: name.trim(),
      description: description.trim(),
      inviteCode: genCode(),
      createdBy: currentUser?.id || "",
      members: [
        {
          userId: currentUser?.id || "",
          nickname: nickname.trim() || currentUser?.name || "",
          joinedAt: new Date().toISOString(),
          role: "creator",
        },
      ],
      questions: filled.map((q) => ({
        id: uid(),
        question: q.question.trim(),
        answers: q.answers
          .split(",")
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean),
        addedBy: currentUser?.id || "",
      })),
      joinRequests: [],
      destination: destination.trim(),
      startDate,
      endDate,
      totalBudget: parseFloat(budget) || 0,
      status,
      itinerary: [],
      budget: [],
      timeline: [],
      createdAt: new Date().toISOString(),
    });

    setLoading(false);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: Platform.OS === "web" ? 80 : 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => (step === "questions" ? setStep("info") : router.back())} style={styles.backBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {step === "info" ? "New Trip Circle" : "Set Secret Questions"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {step === "info"
                  ? "Each circle is a private trip for your crew"
                  : "Only real bros will know the answers"}
              </Text>
            </View>
          </View>

          {step === "info" && (
            <View style={styles.form}>
              <Input
                label="Circle / Trip Name"
                placeholder="Vegas Redemption Arc, Beach Week..."
                value={name}
                onChangeText={setName}
                error={errors.name}
                autoCapitalize="words"
              />
              <Input
                label="Your Nickname in This Circle"
                placeholder="What do your friends call you?"
                value={nickname}
                onChangeText={setNickname}
                error={errors.nickname}
                autoCapitalize="words"
              />
              <Input
                label="Destination (optional)"
                placeholder="Las Vegas, NV"
                value={destination}
                onChangeText={setDestination}
                autoCapitalize="words"
              />
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Start Date"
                    placeholder="07/01/2025"
                    value={startDate}
                    onChangeText={setStartDate}
                    keyboardType="numbers-and-punctuation"
                    error={errors.startDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="End Date"
                    placeholder="07/05/2025"
                    value={endDate}
                    onChangeText={setEndDate}
                    keyboardType="numbers-and-punctuation"
                    error={errors.endDate}
                  />
                </View>
              </View>
              <Input
                label="Total Budget $ (optional)"
                placeholder="e.g. 1500"
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
              />
              <Input
                label="Description (optional)"
                placeholder="What's the vibe? The mission?"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
                style={{ minHeight: 70, textAlignVertical: "top" }}
              />
              <Button label="Next: Set Secret Questions" onPress={goNext} size="lg" />
            </View>
          )}

          {step === "questions" && (
            <View style={styles.form}>
              <View style={[styles.hint, { backgroundColor: colors.primary + "12", borderRadius: colors.radius - 4 }]}>
                <Feather name="lock" size={15} color={colors.primary} />
                <Text style={[styles.hintText, { color: colors.primary }]}>
                  New members must correctly answer one question to join. You can add multiple accepted answers separated by commas.
                </Text>
              </View>

              {questions.map((q, i) => (
                <View
                  key={i}
                  style={[styles.qCard, { backgroundColor: colors.card, borderRadius: colors.radius - 4, borderColor: colors.border }]}
                >
                  <View style={styles.qHeader}>
                    <Text style={[styles.qNum, { color: colors.primary }]}>Q{i + 1}</Text>
                    {questions.length > 1 && (
                      <Pressable onPress={() => removeQuestion(i)}>
                        <Feather name="trash-2" size={15} color={colors.destructive} />
                      </Pressable>
                    )}
                  </View>
                  <Input
                    placeholder="The question your friends will see..."
                    value={q.question}
                    onChangeText={(v) => updateQ(i, "question", v)}
                  />
                  <Input
                    placeholder="Accepted answers, comma-separated (e.g. rex, Rex, the dog rex)"
                    value={q.answers}
                    onChangeText={(v) => updateQ(i, "answers", v)}
                  />
                  <Text style={[styles.answerHint, { color: colors.mutedForeground }]}>
                    Tip: add different spellings or phrasings as separate answers so everyone can get in.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {SUGGESTED_QUESTIONS.filter(
                      (s) => !questions.some((item, idx) => idx !== i && item.question === s)
                    ).slice(0, 4).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          updateQ(i, "question", s);
                          Haptics.selectionAsync();
                        }}
                        style={[styles.suggestion, { backgroundColor: colors.muted, borderRadius: 12 }]}
                      >
                        <Text style={[styles.suggestionText, { color: colors.mutedForeground }]}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))}

              {errors.questions && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.questions}</Text>
              )}

              <Pressable
                onPress={addQuestion}
                style={[styles.addBtn, { borderColor: colors.primary, borderRadius: colors.radius - 4 }]}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Another Question</Text>
              </Pressable>

              <Button label="Create Circle" onPress={handleCreate} loading={loading} size="lg" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 28, paddingBottom: 60 },
  header: { gap: 10 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 4 },
  form: { gap: 18 },
  dateRow: { flexDirection: "row", gap: 12 },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  hintText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  qCard: { padding: 16, gap: 12, borderWidth: 1 },
  qHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qNum: { fontFamily: "Inter_700Bold", fontSize: 14 },
  answerHint: { fontFamily: "Inter_400Regular", fontSize: 12, fontStyle: "italic" },
  suggestion: { paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  suggestionText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 14 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
