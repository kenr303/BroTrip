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

/** Validate and parse "YYYY-MM-DD" format. Returns a Date or null. */
function parseYMD(s: string): Date | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export default function CreateTripScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, circle, createTrip } = useApp();

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give the trip a name";
    if (!destination.trim()) e.destination = "Where are you going?";
    if (!startDate.trim()) {
      e.startDate = "When does it start?";
    } else if (!parseYMD(startDate)) {
      e.startDate = "Use YYYY-MM-DD format (e.g. 2025-06-15)";
    }
    if (!endDate.trim()) {
      e.endDate = "When does it end?";
    } else if (!parseYMD(endDate)) {
      e.endDate = "Use YYYY-MM-DD format (e.g. 2025-06-20)";
    }
    if (!e.startDate && !e.endDate) {
      const s = parseYMD(startDate);
      const en = parseYMD(endDate);
      if (s && en && en < s) e.endDate = "End date must be after start date";
    }
    return e;
  };

  const handleCreate = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const now = new Date();
    const start = parseYMD(startDate)!;
    const status = now < start ? "upcoming" : "active";

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await createTrip({
      id,
      title: title.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      description: description.trim(),
      circleId: circle?.id || "",
      createdBy: currentUser?.id || "",
      members: [currentUser?.id || ""],
      itinerary: [],
      budget: [],
      totalBudget: parseFloat(budget) || 0,
      createdAt: new Date().toISOString(),
      status,
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
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>New Trip</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Trip Name"
              placeholder="Vegas for Dummies, The Redemption Arc..."
              value={title}
              onChangeText={setTitle}
              error={errors.title}
              autoCapitalize="words"
            />
            <Input
              label="Destination"
              placeholder="Las Vegas, NV or Barcelona, Spain"
              value={destination}
              onChangeText={setDestination}
              error={errors.destination}
              autoCapitalize="words"
            />
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Date"
                  placeholder="2025-06-15"
                  value={startDate}
                  onChangeText={setStartDate}
                  error={errors.startDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Date"
                  placeholder="2025-06-20"
                  value={endDate}
                  onChangeText={setEndDate}
                  error={errors.endDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Input
              label="Budget (optional)"
              placeholder="Total budget in $"
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
            <Input
              label="Description (optional)"
              placeholder="What's the vibe? The plan? The mission?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <Button
              label="Create Trip"
              onPress={handleCreate}
              loading={loading}
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 28, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26 },
  form: { gap: 18 },
  dateRow: { flexDirection: "row", gap: 12 },
});
