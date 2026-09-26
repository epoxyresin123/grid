import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  verification_tier: string | null;
};

type Post = {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
  profile: Profile | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
};

type Comment = {
  id: string;
  user_id: string;
  post_id: string;
  text: string;
  created_at: string;
  profile: Profile | null;
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
        <Ionicons name="checkmark" size={13} color="#fff" />
      </View>
    );
  }

  if (tier === "diamond") {
    return (
      <View style={[styles.verifyBadge, styles.diamondBadge]}>
        <Ionicons name="checkmark" size={13} color="#fff" />
      </View>
    );
  }

  if (tier === "blue") {
    return (
      <View style={[styles.verifyBadge, styles.blueBadge]}>
        <Ionicons name="checkmark" size={13} color="#fff" />
      </View>
    );
  }

  return null;
}

function Avatar({
  profile,
  size = 42,
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
        size={size * 0.45}
        color="#777"
      />
    </View>
  );
}


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

function Stories({
  currentUser,
  currentUserProfile,
}: {
  currentUser: any;
  currentUserProfile: Profile | null;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [creatingStory, setCreatingStory] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] =
    useState<string | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] =
    useState(0);

  const loadStories = useCallback(async () => {
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
      setStoriesLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setStories([]);
      setStoriesLoading(false);
      return;
    }

    const userIds = [
      ...new Set(data.map((story) => story.user_id)),
    ];

    const { data: profileRows, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, role, verification_tier"
        )
        .in("id", userIds);

    if (profileError) {
      console.log(
        "LOAD STORY PROFILES ERROR:",
        profileError
      );
    }

    const profileMap = new Map(
      (profileRows || []).map((profile) => [
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

    setStoriesLoading(false);
  }, []);

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
  }, [loadStories]);

  const groupedStories = Array.from(
    stories.reduce((groups, story) => {
      if (!groups.has(story.user_id)) {
        groups.set(story.user_id, []);
      }

      groups.get(story.user_id)!.push(story);
      return groups;
    }, new Map<string, Story[]>()).values()
  );

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

    try {
      setCreatingStory(true);

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const extension =
        asset.fileName?.split(".").pop()?.toLowerCase() ||
        "jpg";

      const filePath =
        `stories/${currentUser.id}/${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("posts")
          .upload(filePath, blob, {
            contentType:
              asset.mimeType || "image/jpeg",
            upsert: false,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } =
        supabase.storage
          .from("posts")
          .getPublicUrl(filePath);

      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: storyError } =
        await supabase.from("stories").insert({
          user_id: currentUser.id,
          media_url: publicData.publicUrl,
          media_type: "image",
          caption: null,
          expires_at: expiresAt,
        });

      if (storyError) {
        throw storyError;
      }

      await loadStories();

      Alert.alert(
        "Story posted",
        "Your story is live for 24 hours."
      );
    } catch (error: any) {
      console.log("CREATE STORY ERROR:", error);

      Alert.alert(
        "Couldn't create story",
        error?.message ||
          "Something went wrong while creating your story."
      );
    } finally {
      setCreatingStory(false);
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
    if (
      selectedStoryIndex <
      selectedStories.length - 1
    ) {
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

  return (
    <>
      <View style={styles.storiesWrapper}>
        {storiesLoading ? (
          <View style={styles.storiesLoading}>
            <ActivityIndicator
              size="small"
              color="#777"
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.storiesScroll
            }
          >
            <Pressable
              style={styles.storyItem}
              onPress={createStory}
            >
              <View style={styles.storyAddCircle}>
                <Avatar
                  profile={currentUserProfile}
                  size={64}
                />

                <View style={styles.storyPlus}>
                  <Ionicons
                    name="add"
                    size={17}
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
                      <View style={styles.storyAvatar}>
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
        )}
      </View>

      <Modal
        visible={viewerOpen}
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.storyViewer}>
          {selectedStory ? (
            <>
              <View style={styles.storyProgressRow}>
                {selectedStories.map(
                  (story, index) => (
                    <View
                      key={story.id}
                      style={[
                        styles.storyProgressBar,
                        index <=
                        selectedStoryIndex
                          ? styles.storyProgressActive
                          : null,
                      ]}
                    />
                  )
                )}
              </View>

              <View style={styles.storyViewerHeader}>
                <View style={styles.storyViewerUser}>
                  <Avatar
                    profile={
                      selectedStory.profile
                    }
                    size={38}
                  />

                  <Text
                    style={
                      styles.storyViewerUsername
                    }
                  >
                    {selectedStory.profile
                      ?.username || "user"}
                  </Text>

                  <VerificationBadge
                    tier={
                      selectedStory.profile
                        ?.verification_tier ||
                      null
                    }
                  />
                </View>

                <Pressable
                  onPress={closeViewer}
                  hitSlop={12}
                  style={styles.storyCloseButton}
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
                style={styles.storyViewerImage}
                resizeMode="contain"
              />

              <Pressable
                style={styles.storyLeftTap}
                onPress={previousStory}
              />

              <Pressable
                style={styles.storyRightTap}
                onPress={nextStory}
              />

              {selectedStory.caption ? (
                <View style={styles.storyCaption}>
                  <Text
                    style={styles.storyCaptionText}
                  >
                    {selectedStory.caption}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </Modal>

      {creatingStory ? (
        <View style={styles.storyUploadOverlay}>
          <ActivityIndicator
            size="large"
            color="#fff"
          />

          <Text style={styles.storyUploadText}>
            Uploading story...
          </Text>
        </View>
      ) : null}
    </>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [menuPost, setMenuPost] = useState<Post | null>(null);

  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUser(user);

    if (!user) {
      setCurrentUserProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, role, verification_tier"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.log("CURRENT PROFILE ERROR:", error);
      return;
    }

    setCurrentUserProfile(data);
  }, []);

  const loadPosts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: postRows, error } = await supabase
      .from("posts")
      .select(
        "id, user_id, image_url, caption, created_at"
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.log("LOAD POSTS ERROR:", error);
      setPosts([]);
      return;
    }

    if (!postRows || postRows.length === 0) {
      setPosts([]);
      return;
    }

    const userIds = [
      ...new Set(
        postRows.map((post) => post.user_id)
      ),
    ];

    const postIds = postRows.map(
      (post) => post.id
    );

    const [
      { data: profiles },
      { data: likes },
      { data: saves },
      { data: comments },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, role, verification_tier"
        )
        .in("id", userIds),

      supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", postIds),

      supabase
        .from("saves")
        .select("post_id, user_id")
        .in("post_id", postIds),

      supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds),
    ]);

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const likeCounts = new Map<string, number>();

    for (const like of likes || []) {
      likeCounts.set(
        like.post_id,
        (likeCounts.get(like.post_id) || 0) + 1
      );
    }

    const commentCounts = new Map<string, number>();

    for (const comment of comments || []) {
      commentCounts.set(
        comment.post_id,
        (commentCounts.get(comment.post_id) || 0) + 1
      );
    }

    const likedSet = new Set(
      (likes || [])
        .filter(
          (like) => like.user_id === user?.id
        )
        .map((like) => like.post_id)
    );

    const savedSet = new Set(
      (saves || [])
        .filter(
          (save) => save.user_id === user?.id
        )
        .map((save) => save.post_id)
    );

    const formattedPosts: Post[] =
      postRows.map((post) => ({
        ...post,
        profile:
          profileMap.get(post.user_id) || null,
        likeCount:
          likeCounts.get(post.id) || 0,
        commentCount:
          commentCounts.get(post.id) || 0,
        liked: likedSet.has(post.id),
        saved: savedSet.has(post.id),
      }));

    setPosts(formattedPosts);
  }, []);

  const loadEverything = useCallback(
    async () => {
      setLoading(true);

      await loadCurrentUser();
      await loadPosts();

      setLoading(false);
    },
    [loadCurrentUser, loadPosts]
  );

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  useEffect(() => {
    const channel = supabase
      .channel("grid-home")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "likes",
        },
        () => {
          loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        () => {
          loadPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  async function toggleLike(post: Post) {
    if (!currentUser) return;

    if (post.liked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);

      if (error) {
        console.log("UNLIKE ERROR:", error);
        return;
      }
    } else {
      const { error } = await supabase
        .from("likes")
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
        });

      if (error) {
        console.log("LIKE ERROR:", error);
        return;
      }
    }

    await loadPosts();
  }

  async function toggleSave(post: Post) {
    if (!currentUser) return;

    if (post.saved) {
      const { error } = await supabase
        .from("saves")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);

      if (error) {
        console.log("UNSAVE ERROR:", error);
        return;
      }
    } else {
      const { error } = await supabase
        .from("saves")
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
        });

      if (error) {
        console.log("SAVE ERROR:", error);
        return;
      }
    }

    await loadPosts();
  }

  function openPost(post: Post) {
    router.push(`/post/${post.id}`);
  }

  function showPostMenu(post: Post) {
    setMenuPost(post);
  }

  function confirmDeletePost(post: Post) {
    Alert.alert(
      "Delete post?",
      "This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePost(post),
        },
      ]
    );
  }

async function deletePost(post: Post) {
  console.log("DELETE BUTTON FIRED");
  console.log("POST ID:", post.id);
  console.log("CURRENT USER:", currentUser?.id);
  console.log("CURRENT PROFILE:", currentUserProfile);

  Alert.alert(
    "Delete test",
    `Delete button fired.\n\nPost: ${post.id}\nUser: ${
      currentUser?.id ?? "NO USER"
    }`,
    [
      {
        text: "Continue",
        onPress: async () => {
          if (!currentUser) {
            Alert.alert(
              "Error",
              "There is no logged-in user."
            );
            return;
          }

          Alert.alert(
            "Deleting",
            "The delete request is now being sent to Supabase."
          );

          const { data, error } = await supabase.rpc(
            "delete_grid_post",
            {
              post_uuid: post.id,
            }
          );

          console.log("RPC DATA:", data);
          console.log("RPC ERROR:", error);

          if (error) {
            Alert.alert(
              "Supabase delete error",
              error.message
            );
            return;
          }

          if (!data) {
            Alert.alert(
              "Delete failed",
              "Supabase returned false."
            );
            return;
          }

          setPosts((current) =>
            current.filter(
              (existingPost) =>
                existingPost.id !== post.id
            )
          );

          Alert.alert(
            "Deleted",
            "The post was deleted successfully."
          );
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]
  );
}

  async function openComments(post: Post) {
    setCommentPost(post);
    setCommentsLoading(true);

    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, user_id, post_id, text, created_at"
      )
      .eq("post_id", post.id)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.log(
        "COMMENTS ERROR:",
        error
      );

      setComments([]);
      setCommentsLoading(false);
      return;
    }

    const userIds = [
      ...new Set(
        (data || []).map(
          (comment) => comment.user_id
        )
      ),
    ];

    let profiles: Profile[] = [];

    if (userIds.length > 0) {
      const { data: profileRows } =
        await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, role, verification_tier"
          )
          .in("id", userIds);

      profiles = profileRows || [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ])
    );

    setComments(
      (data || []).map((comment) => ({
        ...comment,
        profile:
          profileMap.get(comment.user_id) ||
          null,
      }))
    );

    setCommentsLoading(false);
  }

  async function addComment() {
    if (
      !currentUser ||
      !commentPost ||
      !commentText.trim()
    ) {
      return;
    }

    const text = commentText.trim();

    const { error } = await supabase
      .from("comments")
      .insert({
        user_id: currentUser.id,
        post_id: commentPost.id,
        text,
      });

    if (error) {
      Alert.alert(
        "Couldn't comment",
        error.message
      );

      return;
    }

    setCommentText("");

    await openComments(commentPost);
    await loadPosts();
  }

  async function deleteComment(
    comment: Comment
  ) {
    const canDelete =
      currentUser?.id === comment.user_id ||
      currentUserProfile?.role === "admin";

    if (!canDelete) return;

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id);

    if (error) {
      Alert.alert(
        "Couldn't delete comment",
        error.message
      );

      return;
    }

    if (commentPost) {
      await openComments(commentPost);
    }

    await loadPosts();
  }

  async function sharePost(post: Post) {
    try {
      await Share.share({
        message:
          "Check out this post on Grid.",
      });
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);

    await loadEverything();

    setRefreshing(false);
  }

  function goProfile(username: string) {
    router.push(`/profile/${username}`);
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#fff"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.feed}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.logo}>
            Grid.
          </Text>

          <Pressable
            style={styles.headerButton}
            onPress={() =>
              router.push("/settings")
            }
            hitSlop={10}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color="#fff"
            />
          </Pressable>
        </View>

        <Stories
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
        />

        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="images-outline"
              size={55}
              color="#555"
            />

            <Text style={styles.emptyTitle}>
              No posts yet
            </Text>

            <Text style={styles.emptyText}>
              Be the first person to post
              something.
            </Text>

            <Pressable
              style={styles.createButton}
              onPress={() =>
                router.push("/create")
              }
            >
              <Text
                style={
                  styles.createButtonText
                }
              >
                Create a post
              </Text>
            </Pressable>
          </View>
        ) : (
          posts.map((post) => (
            <View
              key={post.id}
              style={styles.post}
            >
              <View style={styles.postHeader}>
                <Pressable
                  style={styles.authorButton}
                  onPress={() => {
                    if (
                      post.profile?.username
                    ) {
                      goProfile(
                        post.profile.username
                      );
                    }
                  }}
                >
                  <Avatar
                    profile={post.profile}
                    size={43}
                  />

                  <View
                    style={
                      styles.authorInfo
                    }
                  >
                    <View
                      style={
                        styles.usernameRow
                      }
                    >
                      <Text
                        style={
                          styles.username
                        }
                      >
                        {post.profile
                          ?.username ||
                          "user"}
                      </Text>

                      <VerificationBadge
                        tier={
                          post.profile
                            ?.verification_tier ||
                          null
                        }
                      />
                    </View>

                    {post.profile
                      ?.display_name ? (
                      <Text
                        style={
                          styles.displayName
                        }
                      >
                        {
                          post.profile
                            .display_name
                        }
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  style={styles.moreButton}
                  hitSlop={12}
                  onPress={() =>
                    showPostMenu(post)
                  }
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={25}
                    color="#fff"
                  />
                </Pressable>
              </View>

              <Pressable
                style={styles.postContent}
                onPress={() =>
                  openPost(post)
                }
              >
                {post.image_url ? (
                  <Image
                    source={{
                      uri: post.image_url,
                    }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={
                      styles.textPost
                    }
                  >
                    <Text
                      style={
                        styles.textPostText
                      }
                    >
                      {post.caption || ""}
                    </Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.actions}>
                <View
                  style={
                    styles.leftActions
                  }
                >
                  <Pressable
                    style={
                      styles.actionButton
                    }
                    hitSlop={8}
                    onPress={() =>
                      toggleLike(post)
                    }
                  >
                    <Ionicons
                      name={
                        post.liked
                          ? "heart"
                          : "heart-outline"
                      }
                      size={27}
                      color={
                        post.liked
                          ? "#ff3b5c"
                          : "#fff"
                      }
                    />
                  </Pressable>

                  <Pressable
                    style={
                      styles.actionButton
                    }
                    hitSlop={8}
                    onPress={() =>
                      openComments(post)
                    }
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={25}
                      color="#fff"
                    />
                  </Pressable>

                  <Pressable
                    style={
                      styles.actionButton
                    }
                    hitSlop={8}
                    onPress={() =>
                      sharePost(post)
                    }
                  >
                    <Ionicons
                      name="paper-plane-outline"
                      size={25}
                      color="#fff"
                    />
                  </Pressable>
                </View>

                <Pressable
                  style={
                    styles.actionButton
                  }
                  hitSlop={8}
                  onPress={() =>
                    toggleSave(post)
                  }
                >
                  <Ionicons
                    name={
                      post.saved
                        ? "bookmark"
                        : "bookmark-outline"
                    }
                    size={25}
                    color="#fff"
                  />
                </Pressable>
              </View>

              <View style={styles.postInfo}>
                {post.likeCount > 0 ? (
                  <Text
                    style={styles.likes}
                  >
                    {post.likeCount}{" "}
                    {post.likeCount === 1
                      ? "like"
                      : "likes"}
                  </Text>
                ) : null}

                {post.caption &&
                post.image_url ? (
                  <View
                    style={
                      styles.captionRow
                    }
                  >
                    <Text
                      style={
                        styles.captionUsername
                      }
                    >
                      {post.profile
                        ?.username ||
                        "user"}
                    </Text>

                    <Text
                      style={
                        styles.caption
                      }
                    >
                      {" "}
                      {post.caption}
                    </Text>
                  </View>
                ) : null}

                {post.commentCount > 0 ? (
                  <Pressable
                    onPress={() =>
                      openComments(post)
                    }
                  >
                    <Text
                      style={
                        styles.commentsLink
                      }
                    >
                      View all{" "}
                      {post.commentCount}{" "}
                      {post.commentCount ===
                      1
                        ? "comment"
                        : "comments"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 110 + insets.bottom }} />
      </ScrollView>

      <View
        style={[
          styles.bottomNav,
          { height: 78 + insets.bottom },
        ]}
      >
        <Pressable
          style={styles.navItem}
          onPress={() =>
            router.replace("/")
          }
        >
          <Ionicons
            name="home"
            size={24}
            color="#fff"
          />

          <Text
            style={styles.navTextActive}
          >
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() =>
            router.push("/search")
          }
        >
          <Ionicons
            name="search-outline"
            size={24}
            color="#777"
          />

          <Text style={styles.navText}>
            Search
          </Text>
        </Pressable>

        <Pressable
          style={styles.createNav}
          onPress={() =>
            router.push("/create")
          }
        >
          <Ionicons
            name="add"
            size={30}
            color="#111"
          />
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => {
            if (
              currentUserProfile?.username
            ) {
              router.push(
                `/profile/${currentUserProfile.username}`
              );
            }
          }}
        >
          <Ionicons
            name="person-outline"
            size={24}
            color="#777"
          />

          <Text style={styles.navText}>
            Profile
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() =>
            router.push("/settings")
          }
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color="#777"
          />

          <Text style={styles.navText}>
            Settings
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={menuPost !== null}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMenuPost(null)
        }
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() =>
            setMenuPost(null)
          }
        >
          <Pressable
            style={styles.postMenu}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <Text
              style={styles.postMenuTitle}
            >
              Post options
            </Text>

            <Pressable
              style={styles.menuOption}
              onPress={() => {
                if (!menuPost) return;

                const post = menuPost;

                const canDelete =
                  currentUser?.id ===
                    post.user_id ||
                  currentUserProfile?.role ===
                    "admin";

                setMenuPost(null);

                if (!canDelete) {
                  Alert.alert(
                    "Can't delete",
                    "You don't have permission to delete this post."
                  );
                  return;
                }

                setTimeout(() => {
                  confirmDeletePost(post);
                }, 200);
              }}
            >
              <Ionicons
                name="trash-outline"
                size={21}
                color="#ff3b30"
              />

              <Text
                style={
                  styles.deleteMenuText
                }
              >
                Delete post
              </Text>
            </Pressable>

            <Pressable
              style={styles.menuCancel}
              onPress={() =>
                setMenuPost(null)
              }
            >
              <Text
                style={
                  styles.menuCancelText
                }
              >
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={commentPost !== null}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCommentPost(null)
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.commentsModal}
          >
            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                Comments
              </Text>

              <Pressable
                hitSlop={10}
                onPress={() =>
                  setCommentPost(null)
                }
              >
                <Ionicons
                  name="close"
                  size={28}
                  color="#fff"
                />
              </Pressable>
            </View>

            {commentsLoading ? (
              <View
                style={
                  styles.commentsLoading
                }
              >
                <ActivityIndicator
                  color="#fff"
                />
              </View>
            ) : (
              <ScrollView
                style={styles.commentsList}
              >
                {comments.length === 0 ? (
                  <View
                    style={styles.noComments}
                  >
                    <Text
                      style={
                        styles.noCommentsText
                      }
                    >
                      No comments yet.
                    </Text>
                  </View>
                ) : (
                  comments.map(
                    (comment) => {
                      const canDelete =
                        currentUser?.id ===
                          comment.user_id ||
                        currentUserProfile?.role ===
                          "admin";

                      return (
                        <View
                          key={comment.id}
                          style={
                            styles.comment
                          }
                        >
                          <Avatar
                            profile={
                              comment.profile
                            }
                            size={36}
                          />

                          <View
                            style={
                              styles.commentBody
                            }
                          >
                            <View
                              style={
                                styles.commentUsernameRow
                              }
                            >
                              <Text
                                style={
                                  styles.commentUsername
                                }
                              >
                                {comment
                                  .profile
                                  ?.username ||
                                  "user"}
                              </Text>

                              <VerificationBadge
                                tier={
                                  comment
                                    .profile
                                    ?.verification_tier ||
                                  null
                                }
                              />
                            </View>

                            <Text
                              style={
                                styles.commentText
                              }
                            >
                              {comment.text}
                            </Text>
                          </View>

                          {canDelete ? (
                            <Pressable
                              hitSlop={10}
                              onPress={() =>
                                Alert.alert(
                                  "Delete comment?",
                                  "This cannot be undone.",
                                  [
                                    {
                                      text: "Cancel",
                                      style:
                                        "cancel",
                                    },
                                    {
                                      text: "Delete",
                                      style:
                                        "destructive",
                                      onPress:
                                        () =>
                                          deleteComment(
                                            comment
                                          ),
                                    },
                                  ]
                                )
                              }
                            >
                              <Ionicons
                                name="trash-outline"
                                size={18}
                                color="#777"
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    }
                  )
                )}
              </ScrollView>
            )}

            <View
              style={
                styles.commentInputRow
              }
            >
              <TextInput
                value={commentText}
                onChangeText={
                  setCommentText
                }
                placeholder="Add a comment..."
                placeholderTextColor="#666"
                style={
                  styles.commentInput
                }
                multiline
              />

              <Pressable
                style={
                  styles.sendButton
                }
                onPress={addComment}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color="#111"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  feed: {
    flex: 1,
  },

  header: {
    height: 72,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  logo: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
  },

  headerButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  storiesWrapper: {
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#202020",
  },

  storiesLoading: {
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },

  storiesScroll: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },

  storyItem: {
    width: 70,
    alignItems: "center",
  },

  storyAddCircle: {
    position: "relative",
  },

  storyPlus: {
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

  storyAvatar: {
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

  storyViewer: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },

  storyProgressRow: {
    position: "absolute",
    top: 16,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: "row",
    gap: 4,
  },

  storyProgressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#444",
  },

  storyProgressActive: {
    backgroundColor: "#fff",
  },

  storyViewerHeader: {
    position: "absolute",
    top: 30,
    left: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  storyViewerUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  storyViewerUsername: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  storyCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  storyViewerImage: {
    width: "100%",
    height: "100%",
  },

  storyLeftTap: {
    position: "absolute",
    left: 0,
    top: 80,
    bottom: 80,
    width: "35%",
  },

  storyRightTap: {
    position: "absolute",
    right: 0,
    top: 80,
    bottom: 80,
    width: "65%",
  },

  storyCaption: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 45,
    alignItems: "center",
  },

  storyCaptionText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },

  storyUploadOverlay: {
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

  storyUploadText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 15,
  },

  post: {
    marginBottom: 20,
  },

  postHeader: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  authorButton: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  authorInfo: {
    marginLeft: 11,
    flex: 1,
  },

  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  username: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  displayName: {
    color: "#777",
    fontSize: 12,
    marginTop: 2,
  },

  moreButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  postContent: {
    width: "100%",
  },

  postImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#1b1b1b",
  },

  textPost: {
    width: "100%",
    minHeight: 280,
    padding: 30,
    backgroundColor: "#1b1b1b",
    justifyContent: "center",
    alignItems: "center",
  },

  textPostText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 32,
    textAlign: "center",
    fontWeight: "600",
  },

  actions: {
    height: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  actionButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },

  postInfo: {
    paddingHorizontal: 16,
  },

  likes: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 6,
  },

  captionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  captionUsername: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  caption: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },

  commentsLink: {
    color: "#777",
    marginTop: 7,
    fontSize: 14,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 130,
    paddingHorizontal: 30,
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 15,
  },

  emptyText: {
    color: "#777",
    fontSize: 14,
    marginTop: 7,
    textAlign: "center",
  },

  createButton: {
    marginTop: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 10,
  },

  createButtonText: {
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
    paddingHorizontal: 6,
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

  verifyBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
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

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  postMenu: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1c1c1c",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2d2d2d",
  },

  postMenuTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },

  menuOption: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#292929",
  },

  deleteMenuText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
  },

  menuCancel: {
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: "#292929",
    alignItems: "center",
    justifyContent: "center",
  },

  menuCancelText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },

  commentsModal: {
    height: "75%",
    backgroundColor: "#171717",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
  },

  modalHeader: {
    height: 55,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#292929",
  },

  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  commentsLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },

  noComments: {
    alignItems: "center",
    paddingTop: 60,
  },

  noCommentsText: {
    color: "#777",
  },

  comment: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 10,
  },

  commentBody: {
    flex: 1,
  },

  commentUsernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  commentUsername: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  commentText: {
    color: "#ddd",
    fontSize: 14,
    marginTop: 3,
    lineHeight: 20,
  },

  commentInputRow: {
    borderTopWidth: 1,
    borderTopColor: "#292929",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  commentInput: {
    flex: 1,
    maxHeight: 90,
    backgroundColor: "#242424",
    color: "#fff",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
  },

  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});