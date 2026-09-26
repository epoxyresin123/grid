import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  account_number: number | null;
  role: string | null;
  verification_tier: string | null;
};

type Post = {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
};

function VerificationBadge({
  tier,
}: {
  tier: string | null;
}) {
  if (tier === "ceo") {
    return (
      <View style={styles.ceoBadge}>
        <Ionicons name="checkmark" size={10} color="#fff" />
        <Text style={styles.ceoText}>CEO</Text>
      </View>
    );
  }

  if (tier === "gold") {
    return (
      <View style={[styles.verifyBadge, styles.goldBadge]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }

  if (tier === "diamond") {
    return (
      <View style={[styles.verifyBadge, styles.diamondBadge]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }

  if (tier === "blue") {
    return (
      <View style={[styles.verifyBadge, styles.blueBadge]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }

  return null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username: string }>();

  const username = Array.isArray(params.username)
    ? params.username[0]
    : params.username;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadProfile() {
    if (!username) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, account_number, role, verification_tier"
      )
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      console.log("PROFILE ERROR:", profileError);
      setProfile(null);
      setPosts([]);
      setLoading(false);
      return;
    }

    if (!profileData) {
      setProfile(null);
      setPosts([]);
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select("id, user_id, image_url, caption, created_at")
      .eq("user_id", profileData.id)
      .order("created_at", { ascending: false });

    if (postError) {
      console.log("PROFILE POSTS ERROR:", postError);
      setPosts([]);
    } else {
      setPosts(postData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, [username]);

  async function refresh() {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }

  async function uploadProfilePicture(uri: string) {
    if (!currentUserId) return;

    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const filePath = `${currentUserId}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
        })
        .eq("id", currentUserId);

      if (profileError) {
        throw profileError;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              avatar_url: avatarUrl,
            }
          : current
      );

      Alert.alert(
        "Profile picture updated",
        "Your new profile picture is now live."
      );
    } catch (error: any) {
      console.error("AVATAR UPLOAD ERROR:", error);

      Alert.alert(
        "Upload failed",
        error?.message ||
          "Something went wrong while uploading your picture."
      );
    }
  }

  async function chooseFromGallery() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Grid needs access to your photos to choose a profile picture."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePicture(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Grid needs camera access to take a profile picture."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePicture(result.assets[0].uri);
    }
  }

  function changeProfilePicture() {
    if (!currentUserId || !profile) return;

    Alert.alert(
      "Profile picture",
      "Choose where you want your new profile picture from.",
      [
        {
          text: "Choose from gallery",
          onPress: chooseFromGallery,
        },
        {
          text: "Take a photo",
          onPress: takePhoto,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }

  function openPost(postId: string) {
    router.push(`/post/${postId}`);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loading}>
        <Ionicons name="person-outline" size={55} color="#555" />
        <Text style={styles.notFoundTitle}>Profile not found</Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isOwnProfile = currentUserId === profile.id;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.topButton}
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={25} color="#fff" />
          </Pressable>

          <Text style={styles.topUsername}>
            {profile.username}
          </Text>

          <Pressable
            style={styles.topButton}
            onPress={() => router.push("/settings")}
            hitSlop={10}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color="#fff"
            />
          </Pressable>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <Pressable
              onPress={
                isOwnProfile
                  ? changeProfilePicture
                  : undefined
              }
              disabled={!isOwnProfile}
              style={styles.avatarPressable}
            >
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons
                    name="person"
                    size={48}
                    color="#777"
                  />
                </View>
              )}
            </Pressable>

            {isOwnProfile ? (
              <View style={styles.avatarEditBadge}>
                <Ionicons
                  name="camera"
                  size={15}
                  color="#111"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>
                @{profile.username}
              </Text>

              <VerificationBadge
                tier={profile.verification_tier}
              />
            </View>

            {profile.display_name ? (
              <Text style={styles.displayName}>
                {profile.display_name}
              </Text>
            ) : null}

            {profile.account_number ? (
              <Text style={styles.accountNumber}>
                Account #{profile.account_number}
              </Text>
            ) : null}
          </View>
        </View>

        {isOwnProfile ? (
          <Pressable
            style={styles.editButton}
            onPress={() => router.push("/settings")}
          >
            <Text style={styles.editButtonText}>
              Edit profile
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.postsHeader}>
          <Ionicons
            name="grid-outline"
            size={22}
            color="#fff"
          />

          <Text style={styles.postsTitle}>Posts</Text>

          <Text style={styles.postCount}>
            {posts.length}
          </Text>
        </View>

        {posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Ionicons
              name="images-outline"
              size={50}
              color="#555"
            />

            <Text style={styles.emptyTitle}>
              No posts yet
            </Text>

            {isOwnProfile ? (
              <Pressable
                style={styles.createButton}
                onPress={() => router.push("/create")}
              >
                <Text style={styles.createButtonText}>
                  Create your first post
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.grid}>
            {posts.map((post) => (
              <Pressable
                key={post.id}
                style={styles.gridItem}
                onPress={() => openPost(post.id)}
              >
                {post.image_url ? (
                  <Image
                    source={{ uri: post.image_url }}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.textGridPost}>
                    <Text
                      style={styles.textGridPostText}
                      numberOfLines={5}
                    >
                      {post.caption || ""}
                    </Text>
                  </View>
                )}

                <View style={styles.postOverlay}>
                  <Ionicons
                    name="expand-outline"
                    size={18}
                    color="#fff"
                  />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable
          style={styles.navItem}
          onPress={() => router.replace("/")}
        >
          <Ionicons
            name="home-outline"
            size={24}
            color="#777"
          />
          <Text style={styles.navText}>Home</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/search")}
        >
          <Ionicons
            name="search-outline"
            size={24}
            color="#777"
          />
          <Text style={styles.navText}>Search</Text>
        </Pressable>

        <Pressable
          style={styles.createNav}
          onPress={() => router.push("/create")}
        >
          <Ionicons name="add" size={30} color="#111" />
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => {
            if (currentUserId === profile.id) {
              router.replace(
                `/profile/${profile.username}`
              );
            }
          }}
        >
          <Ionicons
            name="person"
            size={24}
            color="#fff"
          />
          <Text style={styles.navTextActive}>
            Profile
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/settings")}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color="#777"
          />
          <Text style={styles.navText}>Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },

  scroll: {
    flex: 1,
  },

  loading: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  topBar: {
    height: 68,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  topButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  topUsername: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  avatarWrapper: {
    width: 96,
    height: 96,
    position: "relative",
  },

  avatarPressable: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#222",
  },

  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#111",
  },

  profileInfo: {
    marginLeft: 18,
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  username: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },

  displayName: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 5,
  },

  accountNumber: {
    color: "#666",
    fontSize: 12,
    marginTop: 6,
  },

  verifyBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  blueBadge: {
    backgroundColor: "#1877f2",
  },

  goldBadge: {
    backgroundColor: "#d4a017",
  },

  diamondBadge: {
    backgroundColor: "#8b5cf6",
  },

  ceoBadge: {
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#444",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  ceoText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

  editButton: {
    marginHorizontal: 20,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#242424",
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#222",
    marginTop: 20,
  },

  postsHeader: {
    height: 55,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  postsTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  postCount: {
    color: "#666",
    fontSize: 13,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  gridItem: {
    width: "33.333%",
    aspectRatio: 1,
    padding: 1,
    backgroundColor: "#111",
  },

  gridImage: {
    width: "100%",
    height: "100%",
  },

  textGridPost: {
    width: "100%",
    height: "100%",
    backgroundColor: "#202020",
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  textGridPostText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },

  postOverlay: {
    position: "absolute",
    right: 7,
    bottom: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyPosts: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    color: "#777",
    fontSize: 16,
    marginTop: 12,
  },

  createButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 18,
  },

  createButtonText: {
    color: "#111",
    fontWeight: "700",
  },

  notFoundTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 15,
  },

  backButton: {
    marginTop: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },

  backButtonText: {
    color: "#111",
    fontWeight: "700",
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: "#111",
    borderTopWidth: 1,
    borderTopColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  navItem: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },

  navText: {
    color: "#777",
    fontSize: 10,
    marginTop: 3,
  },

  navTextActive: {
    color: "#fff",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "600",
  },

  createNav: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
