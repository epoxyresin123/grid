import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../../lib/supabase";

export default function SettingsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    if (error) {
      console.log(error);
    }

    if (data) {
      setUsername(data.username ?? "");
      setDisplayName(data.display_name ?? "");
    }

    setLoading(false);
  }

  async function saveChanges() {
    if (!userId) return;

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanUsername) {
      Alert.alert("Username required", "Please enter a username.");
      return;
    }

    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      Alert.alert(
        "Invalid username",
        "Use only lowercase letters, numbers, periods and underscores."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Username taken", "That username is already being used.");
      } else {
        Alert.alert("Couldn't save", error.message);
      }
      return;
    }

    setUsername(cleanUsername);

    Alert.alert("Saved", "Your profile has been updated.");
  }

  async function signOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/auth");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.title}>Settings</Text>

          <View style={styles.headerSpace} />
        </View>

        <Text style={styles.sectionTitle}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username"
            placeholderTextColor="#666666"
            style={styles.input}
          />

          <Text style={styles.label}>Display name</Text>

          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor="#666666"
            style={styles.input}
          />

          <Pressable
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={saveChanges}
            disabled={saving}
          >
            <Text style={styles.saveText}>
              {saving ? "Saving..." : "Save changes"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() => {
              if (username) {
                router.push(`/profile/${username}`);
              }
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="person-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.rowText}>View profile</Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#777777"
            />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.row}
            onPress={() => router.push("/")}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="home-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.rowText}>Home</Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#777777"
            />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.row}
            onPress={() => router.push("/create")}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="add-circle-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.rowText}>Create post</Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#777777"
            />
          </Pressable>
        </View>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color="#FF5555" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },

  content: {
    paddingTop: 55,
    paddingHorizontal: 18,
    paddingBottom: 50,
  },

  loading: {
    flex: 1,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#888888",
    fontSize: 15,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 35,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpace: {
    width: 42,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },

  sectionTitle: {
    color: "#777777",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 18,
    padding: 16,
    marginBottom: 28,
  },

  label: {
    color: "#999999",
    fontSize: 13,
    marginBottom: 7,
  },

  input: {
    backgroundColor: "#242424",
    color: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 18,
    fontSize: 15,
  },

  saveButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  disabled: {
    opacity: 0.5,
  },

  saveText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "700",
  },

  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  rowText: {
    color: "#FFFFFF",
    fontSize: 15,
  },

  divider: {
    height: 1,
    backgroundColor: "#292929",
  },

  signOut: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  signOutText: {
    color: "#FF5555",
    fontSize: 15,
    fontWeight: "600",
  },
});