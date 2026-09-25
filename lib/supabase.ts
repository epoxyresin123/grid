import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://qzokrfcpbrjmeonkdmef.supabase.co";

const supabaseKey =
  "sb_publishable_btfQs3L4NRLrUD_JklvqhA_V5oDn6KB";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);