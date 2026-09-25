import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

export default function SearchScreen() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchProfiles = async () => {
      const text = query.trim();

      if (!text) {
        setProfiles([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, role"
        )
        .ilike("username", `%${text}%`)
        .limit(30);

      if (error) {
        console.error("Search error:", error);
        setProfiles([]);
      } else {
        setProfiles(data ?? []);
      }

      setLoading(false);
    };

    const timer = setTimeout(
      searchProfiles,
      250
    );

    return () => clearTimeout(timer);
  }, [query]);

  const openProfile = (username: string) => {
    router.push({
      pathname: "/profile/[username]",
      params: { username },
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={25}
            color="#F2F2F2"
          />
        </Pressable>

        <Text style={styles.title}>Search</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={21}
          color="#777777"
        />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users"
          placeholderTextColor="#666666"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          autoFocus
        />

        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery("")}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color="#666666"
            />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.results}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator
              color="#AAAAAA"
            />
          </View>
        )}

        {!loading &&
          query.trim().length === 0 && (
            <View style={styles.empty}>
              <Ionicons
                name="search-outline"
                size={42}
                color="#555555"
              />

              <Text style={styles.emptyTitle}>
                Find people
              </Text>

              <Text style={styles.emptyText}>
                Search for a Grid. username.
              </Text>
            </View>
          )}

        {!loading &&
          query.trim().length > 0 &&
          profiles.length === 0 && (
            <View style={styles.empty}>
              <Ionicons
                name="person-outline"
                size={42}
                color="#555555"
              />

              <Text style={styles.emptyTitle}>
                No users found
              </Text>

              <Text style={styles.emptyText}>
                Try another username.
              </Text>
            </View>
          )}

        {profiles.map((profile) => (
          <Pressable
            key={profile.id}
            style={styles.profile}
            onPress={() =>
              openProfile(profile.username)
            }
          >
            {profile.avatar_url ? (
              <Image
                source={{
                  uri: profile.avatar_url,
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text
                  style={styles.avatarLetter}
                >
                  {profile.username
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.profileInfo}>
              <View
                style={styles.usernameRow}
              >
                <Text style={styles.username}>
                  @{profile.username}
                </Text>

                {profile.role === "admin" && (
                  <View style={styles.badge}>
                    <Ionicons
                      name="checkmark"
                      size={10}
                      color="#151515"
                    />
                  </View>
                )}
              </View>

              {profile.display_name && (
                <Text
                  style={styles.displayName}
                >
                  {profile.display_name}
                </Text>
              )}
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#555555"
            />
          </Pressable>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={styles.tab}
          onPress={() => router.replace("/")}
        >
          <Ionicons
            name="home-outline"
            size={25}
            color="#777777"
          />

          <Text style={styles.label}>
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() =>
            router.replace("/search")
          }
        >
          <Ionicons
            name="search"
            size={25}
            color="#F2F2F2"
          />

          <Text style={styles.activeLabel}>
            Search
          </Text>
        </Pressable>

        <Pressable
          style={styles.createButton}
          onPress={() =>
            router.push("/create")
          }
        >
          <Ionicons
            name="add"
            size={31}
            color="#151515"
          />
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() =>
            router.push("/settings")
          }
        >
          <Ionicons
            name="person-outline"
            size={25}
            color="#777777"
          />

          <Text style={styles.label}>
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#151515",
  },

  header: {
    height: 70,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#303030",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: "#F2F2F2",
    fontSize: 19,
    fontWeight: "600",
  },

  headerSpacer: {
    width: 44,
  },

  searchContainer: {
    height: 50,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#222222",
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    color: "#F2F2F2",
    fontSize: 15,
    marginLeft: 10,
    paddingVertical: 0,
  },

  results: {
    flex: 1,
    marginTop: 8,
  },

  profile: {
    minHeight: 72,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#292929",
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },

  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#292929",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarLetter: {
    color: "#D8D8D8",
    fontSize: 18,
    fontWeight: "600",
  },

  profileInfo: {
    flex: 1,
  },

  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  username: {
    color: "#F2F2F2",
    fontSize: 15,
    fontWeight: "600",
  },

  displayName: {
    color: "#777777",
    fontSize: 13,
    marginTop: 3,
  },

  badge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },

  center: {
    paddingTop: 30,
  },

  empty: {
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyTitle: {
    color: "#F2F2F2",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
  },

  emptyText: {
    color: "#777777",
    fontSize: 14,
    marginTop: 7,
    textAlign: "center",
  },

  bottomBar: {
    height: 76,
    backgroundColor: "#1C1C1C",
    borderTopWidth: 1,
    borderTopColor: "#353535",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  tab: {
    width: 72,
    height: 65,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    color: "#777777",
    fontSize: 10,
    marginTop: 4,
  },

  activeLabel: {
    color: "#F2F2F2",
    fontSize: 10,
    marginTop: 4,
  },

  createButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
  },
});