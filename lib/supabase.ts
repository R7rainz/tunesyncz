// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    // Enable real-time subscriptions
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          name: string;
          creator: string;
          created_at: number;
          queue: any[];
          members: string[];
          sync_play: boolean;
          synced_time: number;
          last_sync_update: number;
          current_song: any | null;
          is_playing: boolean;
          member_sync_states: Record<string, boolean>;
          sync_leader: string | null;
          last_activity: number;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          creator: string;
          created_at: number;
          queue?: any[];
          members?: string[];
          sync_play?: boolean;
          synced_time?: number;
          last_sync_update?: number;
          current_song?: any | null;
          is_playing?: boolean;
          member_sync_states?: Record<string, boolean>;
          sync_leader?: string | null;
          last_activity?: number;
        };
        Update: {
          id?: string;
          name?: string;
          creator?: string;
          created_at?: number;
          queue?: any[];
          members?: string[];
          sync_play?: boolean;
          synced_time?: number;
          last_sync_update?: number;
          current_song?: any | null;
          is_playing?: boolean;
          member_sync_states?: Record<string, boolean>;
          sync_leader?: string | null;
          last_activity?: number;
        };
      };
    };
  };
}

export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
export type RoomInsert = Database["public"]["Tables"]["rooms"]["Insert"];
export type RoomUpdate = Database["public"]["Tables"]["rooms"]["Update"];
