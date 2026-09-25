import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../../lib/supabase";

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleAuth() {
    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "signup") {
      if (!cleanUsername) {
        setError("Please choose a username.");
        return;
      }

      if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
        setError(
          "Username can only contain lowercase letters, numbers, dots and underscores."
        );
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (loginError) {
          setError(loginError.message);
          return;
        }

        router.replace("/");
        return;
      }

      const { data, error: signupError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      if (!data.user) {
        setError("Account creation failed.");
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          username: cleanUsername,
          display_name: cleanDisplayName || cleanUsername,
        });

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (data.session) {
        router.replace("/");
      } else {
        setSuccess("Account created. You can now log in.");
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>Grid.</Text>
        </View>

        <Text style={styles.title}>
          {mode === "login" ? "Welcome back" : "Join Grid."}
        </Text>

        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Log in to continue to Grid."
            : "Create your Grid. account."}
        </Text>

        {mode === "signup" && (
          <>
            <View style={styles.inputWrapper}>
              <Ionicons name="at-outline" size={20} color="#777777" />

              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#666666"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#777777"
              />

              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor="#666666"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
          </>
        )}

        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color="#777777" />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#777777"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {success ? (
          <Text style={styles.success}>{success}</Text>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            loading && styles.primaryButtonDisabled,
          ]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#111111" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === "login" ? "Log in" : "Create account"}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchButton}
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
            setSuccess("");
          }}
        >
          <Text style={styles.switchText}>
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Log in"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 35,
  },

  logo: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -2,
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: "#888888",
    fontSize: 16,
    marginBottom: 28,
  },

  inputWrapper: {
    height: 54,
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#292929",
  },

  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    marginLeft: 12,
  },

  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  primaryButtonDisabled: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "800",
  },

  switchButton: {
    alignItems: "center",
    paddingVertical: 22,
  },

  switchText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  error: {
    color: "#ff6b6b",
    marginBottom: 12,
    lineHeight: 20,
  },

  success: {
    color: "#7ee787",
    marginBottom: 12,
    lineHeight: 20,
  },
});