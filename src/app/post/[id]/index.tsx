import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";

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

export default function PostScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{ id: string }>();

  const postId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<Profile | null>(null);

  const [likeCount, setLikeCount] = useState(0);

  async function loadPost() {
    if (!postId) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUser(user);

    if (user) {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, role, verification_tier"
        )
        .eq("id", user.id)
        .maybeSingle();

      setCurrentUserProfile(currentProfile);
    }

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select(
        "id, user_id, image_url, caption, created_at"
      )
      .eq("id", postId)
      .maybeSingle();

    if (postError || !postData) {
      console.log("POST ERROR:", postError);
      setPost(null);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, role, verification_tier"
      )
      .eq("id", postData.user_id)
      .maybeSingle();

    setPost({
      ...postData,
      profile: profileData || null,
    });

    const { data: likes } = await supabase
      .from("likes")
      .select("user_id")
      .eq("post_id", postId);

    setLikeCount(likes?.length || 0);

    setLiked(
      !!user &&
        !!likes?.some((like) => like.user_id === user.id)
    );

    if (user) {
      const { data: saveData } = await supabase
        .from("saves")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

      setSaved(!!saveData);
    }

    await loadComments();

    setLoading(false);
  }

  async function loadComments() {
    if (!postId) return;

    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, user_id, post_id, text, created_at"
      )
      .eq("post_id", postId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.log("COMMENTS ERROR:", error);
      setComments([]);
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
          profileMap.get(comment.user_id) || null,
      }))
    );
  }

  useEffect(() => {
    loadPost();
  }, [postId]);

  async function toggleLike() {
    if (!currentUser || !post) return;

    if (liked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);

      if (error) {
        Alert.alert(
          "Couldn't unlike",
          error.message
        );
        return;
      }

      setLiked(false);
      setLikeCount((count) => Math.max(0, count - 1));
    } else {
      const { error } = await supabase
        .from("likes")
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
        });

      if (error) {
        Alert.alert(
          "Couldn't like",
          error.message
        );
        return;
      }

      setLiked(true);
      setLikeCount((count) => count + 1);
    }
  }

  async function toggleSave() {
    if (!currentUser || !post) return;

    if (saved) {
      const { error } = await supabase
        .from("saves")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);

      if (error) {
        Alert.alert(
          "Couldn't unsave",
          error.message
        );
        return;
      }

      setSaved(false);
    } else {
      const { error } = await supabase
        .from("saves")
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
        });

      if (error) {
        Alert.alert(
          "Couldn't save",
          error.message
        );
        return;
      }

      setSaved(true);
    }
  }

  async function sharePost() {
    try {
      await Share.share({
        message: "Check out this post on Grid.",
      });
    } catch {}
  }

  async function deletePost() {
    if (!post || !currentUser) return;

    const canDelete =
      currentUser.id === post.user_id ||
      currentUserProfile?.role === "admin";

    if (!canDelete) return;

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
          onPress: async () => {
            const { data, error } =
              await supabase.rpc(
                "delete_grid_post",
                {
                  post_uuid: post.id,
                }
              );

            if (error) {
              Alert.alert(
                "Couldn't delete post",
                error.message
              );
              return;
            }

            if (data === false) {
              Alert.alert(
                "Couldn't delete post",
                "The post could not be deleted."
              );
              return;
            }

            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#fff"
        />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loading}>
        <Ionicons
          name="images-outline"
          size={55}
          color="#555"
        />

        <Text style={styles.notFound}>
          Post not found
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const canDelete =
    currentUser?.id === post.user_id ||
    currentUserProfile?.role === "admin";

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color="#fff"
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Post
          </Text>

          {canDelete ? (
            <Pressable
              style={styles.headerButton}
              onPress={deletePost}
              hitSlop={10}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={25}
                color="#fff"
              />
            </Pressable>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>

        <Pressable
          style={styles.author}
          onPress={() => {
            if (post.profile?.username) {
              router.push(
                `/profile/${post.profile.username}`
              );
            }
          }}
        >
          <Avatar
            profile={post.profile}
            size={45}
          />

          <View style={styles.authorInfo}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>
                {post.profile?.username || "user"}
              </Text>

              <VerificationBadge
                tier={
                  post.profile?.verification_tier ||
                  null
                }
              />
            </View>

            {post.profile?.display_name ? (
              <Text style={styles.displayName}>
                {post.profile.display_name}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {post.image_url ? (
          <Image
            source={{ uri: post.image_url }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.textPost}>
            <Text style={styles.textPostText}>
              {post.caption || ""}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <Pressable
              style={styles.actionButton}
              onPress={toggleLike}
            >
              <Ionicons
                name={
                  liked
                    ? "heart"
                    : "heart-outline"
                }
                size={29}
                color={
                  liked
                    ? "#ff3b5c"
                    : "#fff"
                }
              />
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={() => {}}
            >
              <Ionicons
                name="chatbubble-outline"
                size={26}
                color="#fff"
              />
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={sharePost}
            >
              <Ionicons
                name="paper-plane-outline"
                size={26}
                color="#fff"
              />
            </Pressable>
          </View>

          <Pressable
            style={styles.actionButton}
            onPress={toggleSave}
          >
            <Ionicons
              name={
                saved
                  ? "bookmark"
                  : "bookmark-outline"
              }
              size={26}
              color="#fff"
            />
          </Pressable>
        </View>

        {likeCount > 0 ? (
          <Text style={styles.likes}>
            {likeCount}{" "}
            {likeCount === 1
              ? "like"
              : "likes"}
          </Text>
        ) : null}

        {post.caption &&
        post.image_url ? (
          <View style={styles.captionRow}>
            <Text style={styles.captionUsername}>
              {post.profile?.username ||
                "user"}
            </Text>

            <Text style={styles.caption}>
              {" "}
              {post.caption}
            </Text>
          </View>
        ) : null}

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>
              No comments yet.
            </Text>
          ) : (
            comments.map((comment) => (
              <View
                key={comment.id}
                style={styles.comment}
              >
                <Avatar
                  profile={comment.profile}
                  size={36}
                />

                <View
                  style={styles.commentBody}
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
                      {comment.profile
                        ?.username ||
                        "user"}
                    </Text>

                    <VerificationBadge
                      tier={
                        comment.profile
                          ?.verification_tier ||
                        null
                      }
                    />
                  </View>

                  <Text
                    style={styles.commentText}
                  >
                    {comment.text}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
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

  header: {
    height: 68,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  author: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
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

  postImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#1b1b1b",
  },

  textPost: {
    minHeight: 350,
    backgroundColor: "#1b1b1b",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  textPostText: {
    color: "#fff",
    fontSize: 25,
    lineHeight: 34,
    textAlign: "center",
    fontWeight: "600",
  },

  actions: {
    height: 60,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionButton: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  likes: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  captionRow: {
    paddingHorizontal: 16,
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

  commentsSection: {
    paddingHorizontal: 16,
    marginTop: 25,
  },

  commentsTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 15,
  },

  noComments: {
    color: "#666",
    fontSize: 14,
  },

  comment: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
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
    fontWeight: "700",
    fontSize: 13,
  },

  commentText: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
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

  notFound: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 15,
  },

  backButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },

  backButtonText: {
    color: "#111",
    fontWeight: "700",
  },
});