import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { decode } from "base64-arraybuffer";
import { supabase } from "../../../lib/supabase";

export default function CreateScreen() {
  const router = useRouter();

  const [imageUri, setImageUri] =
    useState<string | null>(null);
  const [imageBase64, setImageBase64] =
    useState<string | null>(null);
  const [caption, setCaption] =
    useState("");
  const [posting, setPosting] = useState(false);

  const chooseImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Grid. needs access to your photos to choose an image."
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      });

    if (
      result.canceled ||
      !result.assets?.[0]
    ) {
      return;
    }

    const asset = result.assets[0];

    setImageUri(asset.uri);
    setImageBase64(asset.base64 ?? null);
  };

  const takePhoto = async () => {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Grid. needs camera access to take a photo."
      );
      return;
    }

    const result =
      await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      });

    if (
      result.canceled ||
      !result.assets?.[0]
    ) {
      return;
    }

    const asset = result.assets[0];

    setImageUri(asset.uri);
    setImageBase64(asset.base64 ?? null);
  };

  const removeImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const createPost = async () => {
    const cleanCaption = caption.trim();

    if (!imageUri && !cleanCaption) {
      Alert.alert(
        "Nothing to post",
        "Add a photo or write something first."
      );
      return;
    }

    setPosting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          "Not signed in",
          "Please sign in before posting."
        );
        return;
      }

      let imageUrl: string | null = null;

      if (imageUri) {
        if (!imageBase64) {
          Alert.alert(
            "Image error",
            "The image could not be prepared."
          );
          return;
        }

        const fileName = `${user.id}/${Date.now()}.jpg`;

        const { error: uploadError } =
          await supabase.storage
            .from("posts")
            .upload(
              fileName,
              decode(imageBase64),
              {
                contentType: "image/jpeg",
                upsert: false,
              }
            );

        if (uploadError) {
          console.error(
            "Upload error:",
            uploadError
          );

          Alert.alert(
            "Upload failed",
            uploadError.message
          );

          return;
        }

        const {
          data: publicUrlData,
        } = supabase.storage
          .from("posts")
          .getPublicUrl(fileName);

        imageUrl =
          publicUrlData.publicUrl;
      }

      const { error: postError } =
        await supabase.from("posts").insert({
          user_id: user.id,
          image_url: imageUrl,
          caption: cleanCaption || null,
        });

      if (postError) {
        console.error(
          "Post error:",
          postError
        );

        Alert.alert(
          "Post failed",
          postError.message
        );

        return;
      }

      setImageUri(null);
      setImageBase64(null);
      setCaption("");

      router.replace("/");
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Something went wrong",
        "Your post could not be created."
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          disabled={posting}
        >
          <Ionicons
            name="close"
            size={28}
            color="#F2F2F2"
          />
        </Pressable>

        <Text style={styles.title}>
          Create
        </Text>

        <Pressable
          style={[
            styles.postButton,
            posting &&
              styles.postButtonDisabled,
          ]}
          onPress={createPost}
          disabled={posting}
        >
          {posting ? (
            <ActivityIndicator
              size="small"
              color="#151515"
            />
          ) : (
            <Text style={styles.postButtonText}>
              Post
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {imageUri ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />

            <Pressable
              style={styles.removeImage}
              onPress={removeImage}
              disabled={posting}
            >
              <Ionicons
                name="close"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.imageOptions}>
            <Pressable
              style={styles.imageOption}
              onPress={chooseImage}
              disabled={posting}
            >
              <Ionicons
                name="images-outline"
                size={29}
                color="#DADADA"
              />

              <Text
                style={styles.imageOptionText}
              >
                Gallery
              </Text>
            </Pressable>

            <Pressable
              style={styles.imageOption}
              onPress={takePhoto}
              disabled={posting}
            >
              <Ionicons
                name="camera-outline"
                size={29}
                color="#DADADA"
              />

              <Text
                style={styles.imageOptionText}
              >
                Camera
              </Text>
            </Pressable>
          </View>
        )}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Write something..."
          placeholderTextColor="#666666"
          multiline
          maxLength={2200}
          style={styles.caption}
          textAlignVertical="top"
          editable={!posting}
        />

        <Text style={styles.characterCount}>
          {caption.length}/2200
        </Text>

        <View style={styles.info}>
          <Ionicons
            name="information-circle-outline"
            size={19}
            color="#666666"
          />

          <Text style={styles.infoText}>
            You can post a photo, text, or both.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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

  headerButton: {
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

  postButton: {
    minWidth: 64,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },

  postButtonDisabled: {
    opacity: 0.55,
  },

  postButtonText: {
    color: "#151515",
    fontSize: 14,
    fontWeight: "700",
  },

  content: {
    flex: 1,
    padding: 16,
  },

  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#222222",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  removeImage: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  imageOptions: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#202020",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  imageOption: {
    width: 125,
    height: 120,
    borderRadius: 18,
    backgroundColor: "#292929",
    alignItems: "center",
    justifyContent: "center",
  },

  imageOptionText: {
    color: "#DADADA",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 9,
  },

  caption: {
    minHeight: 140,
    marginTop: 18,
    padding: 16,
    borderRadius: 17,
    backgroundColor: "#202020",
    color: "#F2F2F2",
    fontSize: 16,
    lineHeight: 24,
  },

  characterCount: {
    color: "#666666",
    fontSize: 11,
    textAlign: "right",
    marginTop: 7,
    marginRight: 4,
  },

  info: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  infoText: {
    color: "#666666",
    fontSize: 12,
    marginLeft: 6,
  },
});