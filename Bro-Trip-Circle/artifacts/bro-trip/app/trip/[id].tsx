import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  useApp,
  ItineraryItem,
  BudgetItem,
} from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Tab = "overview" | "itinerary" | "budget";

const BUDGET_CATEGORIES = ["transport", "food", "accommodation", "activities", "other"] as const;
const CATEGORY_ICONS: Record<string, string> = {
  transport: "truck",
  food: "coffee",
  accommodation: "home",
  activities: "activity",
  other: "more-horizontal",
};

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { trips, currentUser, addItineraryItem, removeItineraryItem, addBudgetItem, removeBudgetItem, deleteTrip } = useApp();

  const trip = trips.find((t) => t.id === id);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);

  const [itemTime, setItemTime] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [itemDay, setItemDay] = useState("1");
  const [itemExpenseAmount, setItemExpenseAmount] = useState("");
  const [itemExpenseCategory, setItemExpenseCategory] = useState<typeof BUDGET_CATEGORIES[number]>("activities");

  const [budgetTitle, setBudgetTitle] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCategory, setBudgetCategory] = useState<typeof BUDGET_CATEGORIES[number]>("food");

  if (!trip) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground }}>Trip not found</Text>
      </View>
    );
  }

  const totalSpent = trip.budget.reduce((s, b) => s + b.amount, 0);
  const budgetPct = trip.totalBudget > 0 ? Math.min(totalSpent / trip.totalBudget, 1) : 0;

  const sortedItinerary = [...trip.itinerary].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.time.localeCompare(b.time);
  });

  const days = [...new Set(sortedItinerary.map((i) => i.day))].sort((a, b) => a - b);

  const handleAddItem = async () => {
    if (!itemTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const expenseAmount = parseFloat(itemExpenseAmount);
    const hasExpense = !isNaN(expenseAmount) && expenseAmount > 0;
    const budgetItemId = hasExpense
      ? Date.now().toString() + Math.random().toString(36).substr(2, 6)
      : undefined;
    const item: ItineraryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      time: itemTime.trim(),
      title: itemTitle.trim(),
      notes: itemNotes.trim(),
      day: parseInt(itemDay) || 1,
      ...(hasExpense && {
        expenseAmount,
        expenseCategory: itemExpenseCategory,
        expenseBudgetItemId: budgetItemId,
      }),
    };
    const budgetItem: BudgetItem | undefined = hasExpense
      ? {
          id: budgetItemId!,
          title: itemTitle.trim(),
          amount: expenseAmount,
          paidBy: currentUser?.id || "",
          category: itemExpenseCategory,
          date: new Date().toISOString(),
        }
      : undefined;
    await addItineraryItem(trip.id, item, budgetItem);
    setItemTime("");
    setItemTitle("");
    setItemNotes("");
    setItemDay("1");
    setItemExpenseAmount("");
    setItemExpenseCategory("activities");
    setShowAddItem(false);
  };

  const handleAddBudget = async () => {
    if (!budgetTitle.trim() || !budgetAmount) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const item: BudgetItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      title: budgetTitle.trim(),
      amount: parseFloat(budgetAmount) || 0,
      paidBy: currentUser?.id || "",
      category: budgetCategory,
      date: new Date().toISOString(),
    };
    await addBudgetItem(trip.id, item);
    setBudgetTitle("");
    setBudgetAmount("");
    setBudgetCategory("food");
    setShowAddBudget(false);
  };

  const handleDeleteTrip = () => {
    Alert.alert("Delete trip?", "This will permanently delete the trip and all its data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTrip(trip.id);
          router.back();
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 70 : insets.top;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 30 }}>
        <View style={[styles.navBar, { paddingTop: topPad + 10, backgroundColor: colors.background }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>{trip.title}</Text>
          <Pressable onPress={handleDeleteTrip} style={styles.deleteBtn}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </Pressable>
        </View>

        <View style={[styles.heroCard, { backgroundColor: colors.navy, marginHorizontal: 16, borderRadius: colors.radius }]}>
          <View style={styles.heroDestination}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text style={styles.heroDestinationText}>{trip.destination}</Text>
          </View>
          <Text style={styles.heroTitle}>{trip.title}</Text>
          {trip.description ? (
            <Text style={styles.heroDesc}>{trip.description}</Text>
          ) : null}
          <View style={styles.heroDates}>
            <View style={styles.heroDateItem}>
              <Feather name="calendar" size={13} color="rgba(255,255,255,0.5)" />
              <Text style={styles.heroDateText}>
                {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" — "}
                {new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: trip.status === "active" ? colors.success + "30" : colors.primary + "30" }]}>
              <Text style={[styles.statusPillText, { color: trip.status === "active" ? colors.success : colors.primary }]}>
                {trip.status === "active" ? "In Progress" : trip.status === "upcoming" ? "Upcoming" : "Completed"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          {(["overview", "itinerary", "budget"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setActiveTab(t)}
              style={[
                styles.tab,
                {
                  borderBottomColor: activeTab === t ? colors.primary : "transparent",
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === t ? colors.primary : colors.mutedForeground },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "overview" && (
          <View style={styles.section}>
            <View style={[styles.statsGrid, { gap: 12 }]}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Feather name="list" size={20} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{trip.itinerary.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Activities</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Feather name="dollar-sign" size={20} color={colors.success} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>${totalSpent.toFixed(0)}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Spent</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <Feather name="users" size={20} color={colors.accent} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{trip.members.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Members</Text>
              </View>
            </View>
            {trip.totalBudget > 0 && (
              <View style={[styles.budgetCard, { backgroundColor: colors.card, borderRadius: colors.radius - 4, borderColor: colors.border }]}>
                <View style={styles.budgetHeader}>
                  <Text style={[styles.budgetCardTitle, { color: colors.foreground }]}>Budget</Text>
                  <Text style={[styles.budgetCardValue, { color: totalSpent > trip.totalBudget ? colors.destructive : colors.foreground }]}>
                    ${totalSpent.toFixed(0)} / ${trip.totalBudget}
                  </Text>
                </View>
                <View style={[styles.budgetTrack, { backgroundColor: colors.muted }]}>
                  <View style={[styles.budgetFill, { width: `${budgetPct * 100}%`, backgroundColor: budgetPct > 0.9 ? colors.destructive : colors.primary }]} />
                </View>
                <Text style={[styles.budgetRemaining, { color: colors.mutedForeground }]}>
                  ${Math.max(0, trip.totalBudget - totalSpent).toFixed(0)} remaining
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "itinerary" && (
          <View style={styles.section}>
            {days.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="list" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No activities yet. Plan your adventure.</Text>
              </View>
            ) : (
              days.map((day) => (
                <View key={day}>
                  <Text style={[styles.dayLabel, { color: colors.foreground }]}>Day {day}</Text>
                  {sortedItinerary.filter((i) => i.day === day).map((item) => (
                    <View key={item.id} style={[styles.itineraryItem, { backgroundColor: colors.card, borderRadius: colors.radius - 6, borderColor: colors.border }]}>
                      <View style={[styles.timeBlock, { backgroundColor: colors.primary + "15" }]}>
                        <Text style={[styles.timeText, { color: colors.primary }]}>{item.time || "--:--"}</Text>
                      </View>
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
                        {item.notes ? (
                          <Text style={[styles.itemNotes, { color: colors.mutedForeground }]}>{item.notes}</Text>
                        ) : null}
                        {item.expenseAmount ? (
                          <Text style={[styles.itemNotes, { color: colors.success }]}>${item.expenseAmount.toFixed(2)} · {item.expenseCategory}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => removeItineraryItem(trip.id, item.id)}>
                        <Feather name="x" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}

            {showAddItem ? (
              <View style={[styles.addForm, { backgroundColor: colors.card, borderRadius: colors.radius - 4, borderColor: colors.primary }]}>
                <View style={styles.addFormRow}>
                  <View style={{ flex: 1 }}>
                    <Input label="Day" placeholder="1" value={itemDay} onChangeText={setItemDay} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Time" placeholder="10:00 AM" value={itemTime} onChangeText={setItemTime} />
                  </View>
                </View>
                <Input label="Activity" placeholder="What are you doing?" value={itemTitle} onChangeText={setItemTitle} />
                <Input label="Notes (optional)" placeholder="Details, address, link..." value={itemNotes} onChangeText={setItemNotes} />
                <Input label="Expense Amount (optional)" placeholder="0.00" value={itemExpenseAmount} onChangeText={setItemExpenseAmount} keyboardType="decimal-pad" />
                {itemExpenseAmount.length > 0 && (
                  <View>
                    <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>EXPENSE CATEGORY</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                      {BUDGET_CATEGORIES.map((cat) => (
                        <Pressable
                          key={cat}
                          onPress={() => setItemExpenseCategory(cat)}
                          style={[
                            styles.catChip,
                            {
                              backgroundColor: itemExpenseCategory === cat ? colors.primary : colors.muted,
                              borderRadius: 12,
                            },
                          ]}
                        >
                          <Feather name={CATEGORY_ICONS[cat] as any} size={14} color={itemExpenseCategory === cat ? "#fff" : colors.mutedForeground} />
                          <Text style={[styles.catChipText, { color: itemExpenseCategory === cat ? "#fff" : colors.mutedForeground }]}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
                <View style={styles.addFormActions}>
                  <Button label="Cancel" onPress={() => setShowAddItem(false)} variant="ghost" size="sm" style={{ flex: 1 }} />
                  <Button label="Add" onPress={handleAddItem} size="sm" style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowAddItem(true)} style={[styles.addBtn, { borderColor: colors.primary, borderRadius: colors.radius - 4 }]}>
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Activity</Text>
              </Pressable>
            )}
          </View>
        )}

        {activeTab === "budget" && (
          <View style={styles.section}>
            {trip.budget.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No expenses tracked yet</Text>
              </View>
            ) : (
              trip.budget.map((item) => (
                <View key={item.id} style={[styles.budgetItem, { backgroundColor: colors.card, borderRadius: colors.radius - 6, borderColor: colors.border }]}>
                  <View style={[styles.categoryIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Feather name={CATEGORY_ICONS[item.category] as any} size={16} color={colors.primary} />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
                    <Text style={[styles.itemNotes, { color: colors.mutedForeground }]}>{item.category}</Text>
                  </View>
                  <Text style={[styles.budgetAmount, { color: colors.foreground }]}>${item.amount.toFixed(2)}</Text>
                  <Pressable onPress={() => removeBudgetItem(trip.id, item.id)}>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))
            )}

            {trip.budget.length > 0 && (
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total Spent</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>${totalSpent.toFixed(2)}</Text>
              </View>
            )}

            {showAddBudget ? (
              <View style={[styles.addForm, { backgroundColor: colors.card, borderRadius: colors.radius - 4, borderColor: colors.primary }]}>
                <Input label="What was it for?" placeholder="Dinner at the steakhouse" value={budgetTitle} onChangeText={setBudgetTitle} />
                <Input label="Amount ($)" placeholder="45.00" value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="decimal-pad" />
                <View>
                  <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {BUDGET_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setBudgetCategory(cat)}
                        style={[
                          styles.catChip,
                          {
                            backgroundColor: budgetCategory === cat ? colors.primary : colors.muted,
                            borderRadius: 12,
                          },
                        ]}
                      >
                        <Feather name={CATEGORY_ICONS[cat] as any} size={14} color={budgetCategory === cat ? "#fff" : colors.mutedForeground} />
                        <Text style={[styles.catChipText, { color: budgetCategory === cat ? "#fff" : colors.mutedForeground }]}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.addFormActions}>
                  <Button label="Cancel" onPress={() => setShowAddBudget(false)} variant="ghost" size="sm" style={{ flex: 1 }} />
                  <Button label="Add" onPress={handleAddBudget} size="sm" style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowAddBudget(true)} style={[styles.addBtn, { borderColor: colors.primary, borderRadius: colors.radius - 4 }]}>
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Expense</Text>
              </Pressable>
            )}
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
    gap: 10,
  },
  backBtn: { padding: 4 },
  navTitle: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 18 },
  deleteBtn: { padding: 4 },
  heroCard: { padding: 20, gap: 10, marginBottom: 8 },
  heroDestination: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroDestinationText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.6)" },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", lineHeight: 32 },
  heroDesc: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 20 },
  heroDates: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  heroDateItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroDateText: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.55)" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  tabBar: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#E5E0D8", marginBottom: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  section: { padding: 16, gap: 12 },
  statsGrid: { flexDirection: "row" },
  statCard: { flex: 1, alignItems: "center", padding: 14, gap: 6, borderWidth: 1 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  budgetCard: { padding: 16, gap: 10, borderWidth: 1 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between" },
  budgetCardTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  budgetCardValue: { fontFamily: "Inter_700Bold", fontSize: 16 },
  budgetTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 3 },
  budgetRemaining: { fontFamily: "Inter_400Regular", fontSize: 12 },
  dayLabel: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 8, marginTop: 4 },
  itineraryItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  timeBlock: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  timeText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  itemContent: { flex: 1, gap: 2 },
  itemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  itemNotes: { fontFamily: "Inter_400Regular", fontSize: 13 },
  budgetItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  budgetAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1 },
  totalLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  empty: { alignItems: "center", gap: 10, paddingTop: 40, paddingBottom: 20 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 14 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  addForm: { borderWidth: 1.5, padding: 16, gap: 14 },
  addFormRow: { flexDirection: "row", gap: 12 },
  addFormActions: { flexDirection: "row", gap: 10 },
  catLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
