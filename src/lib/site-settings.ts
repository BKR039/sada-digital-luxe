import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SiteSetting {
  enabled: boolean;
  loaded: boolean;
}

export function useSiteSetting(key: string, fallback: boolean): SiteSetting {
  const [state, setState] = useState<SiteSetting>({ enabled: fallback, loaded: false });

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from("site_settings")
      .select("enabled")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }: { data: { enabled: boolean } | null }) => {
        if (active) setState({ enabled: data ? data.enabled : fallback, loaded: true });
      });
    return () => {
      active = false;
    };
  }, [key, fallback]);

  return state;
}
