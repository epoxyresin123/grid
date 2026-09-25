import { Slot, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  View,
  StyleSheet,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        if (pathname !== "/auth") {
          router.replace("/auth");
        }
      } else {
        if (pathname === "/auth") {
          router.replace("/");
        }
      }

      setSessionChecked(true);
      setLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        if (!session) {
          if (pathname !== "/auth") {
            router.replace("/auth");
          }
        } else {
          if (pathname === "/auth") {
            router.replace("/");
          }
        }

        setSessionChecked(true);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading || !sessionChecked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />
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