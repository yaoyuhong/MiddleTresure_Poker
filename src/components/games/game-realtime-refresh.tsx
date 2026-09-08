"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function GameRealtimeRefresh({ gameId }: { readonly gameId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 120);
    };
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${gameId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_transactions",
          filter: `game_id=eq.${gameId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_action_requests",
          filter: `game_id=eq.${gameId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [gameId, router]);

  return null;
}
