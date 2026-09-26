import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verification_tier: string | null;
};

type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profile: Profile | null;
};

type StoriesProps = {
  currentUser: any;
  currentUserProfile: Profile | null;
};

function Avatar({
  profile,
  size = 64,
}: {
  profile: Profile | null;
  size?: number;
}) {
  if (profile?.avatar_url) {
    return (
      <Image
        source={{ uri: profile.avatar_url }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#292929",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name="person"
        size={size * 0.42}
        color="#777"
      />
    </View>
  );
}

export default function Stories({
  currentUser,
  currentUserProfile,
}: StoriesProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    null
  );
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);

  async function loadStories() {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("stories")
      .select(
        "id, user_id, media_url, media_type, caption, created_at, expires_at"
      )
      .gt("expires_at", now)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.log("LOAD STORIES ERROR:", error);
      setStories([]);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setStories([]);
      setLoading(false);
      return;
    }

    const userIds = [
      ...new Set(data.map((story) => story.user_id)),
    ];

    const { data: profiles, error: profilesError } =
      await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, verification_tier"
        )
        .in("id", userIds);

    if (profilesError) {
      console.log(
        "LOAD STORY PROFILES ERROR:",
        profilesError
      );
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    setStories(
      data.map((story) => ({
        ...story,
        profile:
          profileMap.get(story.user_id) || null,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadStories();

    const channel = supabase
      .channel("grid-stories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
        },
        () => {
          loadStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const groupedStories = useMemo(() => {
    const groups = new Map<string, Story[]>();

    for (const story of stories) {
      if (!groups.has(story.user_id)) {
        groups.set(story.user_id, []);
      }

      groups.get(story.user_id)!.push(story);
    }

    return Array.from(groups.values());
  }, [stories]);

  const selectedStories = selectedUserId
    ? stories.filter(
        (story) => story.user_id === selectedUserId
      )
    : [];

  const selectedStory =
    selectedStories[selectedStoryIndex] || null;

  async function createStory() {
    if (!currentUser) {
      Alert.alert(
        "Sign in required",
        "You need to be logged in to create a story."
      );
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Grid needs access to your photos to create a story."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.9,
        });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      setCreating(true);

      const asset = result.assets[0];

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const extension =
        asset.fileName?.split(".").pop()?.toLowerCase() ||
        "jpg";

      const filePath = `stories/${currentUser.id}/${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("posts")
          .upload(filePath, blob, {
            contentType:
              asset.mimeType || "image/jpeg",
            upsert: false,
          });

      if (uploadError) {
        console.log(
          "STORY UPLOAD ERROR:",
          uploadError
        );

        Alert.alert(
          "Couldn't upload story",
          uploadError.message
        );

        setCreating(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("posts")
        .getPublicUrl(filePath);

      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: storyError } =
        await supabase.from("stories").insert({
          user_id: currentUser.id,
          media_url: publicUrl,
          media_type: "image",
          caption: null,
          expires_at: expiresAt,
        });

      if (storyError) {
        console.log(
          "CREATE STORY ERROR:",
          storyError
        );

        Alert.alert(
          "Couldn't create story",
          storyError.message
        );

        setCreating(false);
        return;
      }

      await loadStories();

      setCreating(false);

      Alert.alert(
        "Story posted",
        "Your story is live for 24 hours."
      );
    } catch (error) {
      console.log("CREATE STORY ERROR:", error);

      setCreating(false);

      Alert.alert(
        "Couldn't create story",
        "Something went wrong while creating your story."
      );
    }
  }

  function openStory(userId: string) {
    setSelectedUserId(userId);
    setSelectedStoryIndex(0);
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
    setSelectedUserId(null);
    setSelectedStoryIndex(0);
  }

  function nextStory() {
    if (selectedStoryIndex < selectedStories.length - 1) {
      setSelectedStoryIndex(
        selectedStoryIndex + 1
      );
      return;
    }

    const currentGroupIndex =
      groupedStories.findIndex(
        (group) =>
          group[0]?.user_id === selectedUserId
      );

    if (
      currentGroupIndex >= 0 &&
      currentGroupIndex <
        groupedStories.length - 1
    ) {
      const nextGroup =
        groupedStories[currentGroupIndex + 1];

      setSelectedUserId(
        nextGroup[0].user_id
      );
      setSelectedStoryIndex(0);
      return;
    }

    closeViewer();
  }

  function previousStory() {
    if (selectedStoryIndex > 0) {
      setSelectedStoryIndex(
        selectedStoryIndex - 1
      );
      return;
    }

    const currentGroupIndex =
      groupedStories.findIndex(
        (group) =>
          group[0]?.user_id === selectedUserId
      );

    if (currentGroupIndex > 0) {
      const previousGroup =
        groupedStories[currentGroupIndex - 1];

      setSelectedUserId(
        previousGroup[0].user_id
      );

      setSelectedStoryIndex(
        previousGroup.length - 1
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="small"
          color="#777"
        />
      </View>
    );
  }

  return (
    <>
      <View style={styles.wrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Pressable
            style={styles.storyItem}
            onPress={createStory}
          >
            <View style={styles.addCircle}>
              <Avatar
                profile={currentUserProfile}
                size={64}
              />

              <View style={styles.plus}>
                <Ionicons
                  name="add"
                  size={18}
                  color="#111"
                />
              </View>
            </View>

            <Text
              style={styles.storyName}
              numberOfLines={1}
            >
              Your Story
            </Text>
          </Pressable>

          {groupedStories
            .filter(
              (group) =>
                group[0]?.user_id !==
                currentUser?.id
            )
            .map((group) => {
              const story = group[0];

              return (
                <Pressable
                  key={story.user_id}
                  style={styles.storyItem}
                  onPress={() =>
                    openStory(story.user_id)
                  }
                >
                  <View style={styles.storyRing}>
                    <View style={styles.storyInner}>
                      <Avatar
                        profile={story.profile}
                        size={64}
                      />
                    </View>
                  </View>

                  <Text
                    style={styles.storyName}
                    numberOfLines={1}
                  >
                    {story.profile?.username ||
                      "user"}
                  </Text>
                </Pressable>
              );
            })}
        </ScrollView>
      </View>

      <Modal
        visible={viewerOpen}
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.viewer}>
          {selectedStory ? (
            <>
              <View style={styles.progressRow}>
                {selectedStories.map(
                  (story, index) => (
                    <View
                      key={story.id}
                      style={[
                        styles.progressBar,
                        index <=
                        selectedStoryIndex
                          ? styles.progressActive
                          : null,
                      ]}
                    />
                  )
                )}
              </View>

              <View style={styles.viewerHeader}>
                <View style={styles.viewerUser}>
                  <Avatar
                    profile={
                      selectedStory.profile
                    }
                    size={38}
                  />

                  <Text
                    style={
                      styles.viewerUsername
                    }
                  >
                    {selectedStory.profile
                      ?.username || "user"}
                  </Text>
                </View>

                <Pressable
                  onPress={closeViewer}
                  hitSlop={12}
                  style={styles.closeButton}
                >
                  <Ionicons
                    name="close"
                    size={30}
                    color="#fff"
                  />
                </Pressable>
              </View>

              <Image
                source={{
                  uri: selectedStory.media_url,
                }}
                style={styles.viewerImage}
                resizeMode="contain"
              />

              <Pressable
                style={styles.leftTap}
                onPress={previousStory}
              />

              <Pressable
                style={styles.rightTap}
                onPress={nextStory}
              />

              {selectedStory.caption ? (
                <View style={styles.caption}>
                  <Text
                    style={styles.captionText}
                  >
                    {selectedStory.caption}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </Modal>

      {creating ? (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator
            size="large"
            color="#fff"
          />
          <Text style={styles.uploadText}>
            Uploading story...
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#202020",
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },

  storyItem: {
    width: 70,
    alignItems: "center",
  },

  addCircle: {
    position: "relative",
  },

  plus: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#111",
  },

  storyRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  storyInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: "hidden",
  },

  storyName: {
    color: "#ddd",
    fontSize: 11,
    marginTop: 5,
    maxWidth: 68,
    textAlign: "center",
  },

  loading: {
    height: 100,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  viewer: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },

  progressRow: {
    position: "absolute",
    top: 16,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: "row",
    gap: 4,
  },

  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#444",
  },

  progressActive: {
    backgroundColor: "#fff",
  },

  viewerHeader: {
    position: "absolute",
    top: 30,
    left: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  viewerUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  viewerUsername: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  viewerImage: {
    width: "100%",
    height: "100%",
  },

  leftTap: {
    position: "absolute",
    left: 0,
    top: 80,
    bottom: 80,
    width: "35%",
  },

  rightTap: {
    position: "absolute",
    right: 0,
    top: 80,
    bottom: 80,
    width: "65%",
  },

  caption: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 45,
    alignItems: "center",
  },

  captionText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },

  uploadOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },

  uploadText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 15,
  },
});