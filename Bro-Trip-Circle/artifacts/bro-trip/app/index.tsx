import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, TextInput, Button } from "react-native";;
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "../lib/supabase";

export default function RootIndex() {
  const { currentUser, isLoading } = useApp();
  const router = useRouter();
  const colors = useColors();

  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  const fetchNotes = async () => {
    const { data, error } = await supabase.from("notes").select("*");

    if (error) {
      console.log("Supabase error:", error);
    } else {
      console.log("Supabase notes:", data);
      setNotes(data ?? []);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    const { error } = await supabase.from("notes").insert([
      {
        content: newNote,
      },
    ]);

    if (error) {
      console.log("Insert error:", error);
    } else {
      setNewNote("");
      fetchNotes();
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser) {
      // router.replace("/welcome");
    } else {
      //router.replace("/(tabs)/");
    }
  }, [isLoading, currentUser]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        padding: 20,
      }}
    >
      <ActivityIndicator color={colors.primary} size="large" />

      <TextInput
        value={newNote}
        onChangeText={setNewNote}
        placeholder="Type a new note"
        style={{
          borderWidth: 1,
          borderColor: "gray",
          width: "80%",
          padding: 10,
          marginBottom: 12,
          backgroundColor: "white",
        }}
      />

      <Button title="Add Note" onPress={addNote} />

      {notes.map((note) => (
        <Text
          key={note.id}
          style={{ color: "black", marginTop: 12, fontSize: 16 }}
        >
          {note.content}
        </Text>
      ))}
    </View>
  );
}
