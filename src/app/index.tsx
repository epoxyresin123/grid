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
import { useRouter } from "expo-router";
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

export default function HomeScreen() {
  const router = useRouter();

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

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.bottomNav}>
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