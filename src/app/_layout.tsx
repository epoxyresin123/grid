import { Slot, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { supabase } from "../../lib/supabase";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session && pathname !== "/auth") {
        router.replace("/auth");
      } else if (session && pathname === "/auth") {
        router.replace("/");
      }

      setLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session && pathname !== "/auth") {
        router.replace("/auth");
      } else if (session && pathname === "/auth") {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
});