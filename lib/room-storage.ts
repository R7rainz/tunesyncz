// lib/room-storage-supabase.ts
import { supabase, type RoomRow, type RoomInsert, type RoomUpdate } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface RoomData {
  id: string;
  name: string;
  creator: string;
  createdAt: number;
  queue: any[];
  members: string[];
  syncPlay: boolean;
  syncedTime: number;
  lastSyncUpdate: number;
  currentSong: any;
  isPlaying: boolean;
  lastActivity?: number;
  memberSyncStates?: Record<string, boolean>;
  syncLeader?: string;
}

// Convert database row to RoomData format
function dbRowToRoomData(row: RoomRow): RoomData {
  return {
    id: row.id,
    name: row.name,
    creator: row.creator,
    createdAt: row.created_at,
    queue: row.queue || [],
    members: row.members || [],
    syncPlay: row.sync_play,
    syncedTime: row.synced_time,
    lastSyncUpdate: row.last_sync_update,
    currentSong: row.current_song,
    isPlaying: row.is_playing,
    lastActivity: row.last_activity,
    memberSyncStates: row.member_sync_states || {},
    syncLeader: row.sync_leader || undefined,
  }
}

// Convert RoomData to database insert format
function roomDataToDbInsert(roomData: RoomData): RoomInsert {
  return {
    id: roomData.id,
    name: roomData.name,
    creator: roomData.creator,
    created_at: roomData.createdAt,
    queue: roomData.queue,
    members: roomData.members,
    sync_play: roomData.syncPlay,
    synced_time: roomData.syncedTime,
    last_sync_update: roomData.lastSyncUpdate,
    current_song: roomData.currentSong,
    is_playing: roomData.isPlaying,
    last_activity: roomData.lastActivity || Date.now(),
    member_sync_states: roomData.memberSyncStates || {},
    sync_leader: roomData.syncLeader || null,
  }
}

// Convert RoomData to database update format
function roomDataToDbUpdate(updates: Partial<RoomData>): RoomUpdate {
  const dbUpdate: RoomUpdate = {}
  
  if (updates.name !== undefined) dbUpdate.name = updates.name
  if (updates.queue !== undefined) dbUpdate.queue = updates.queue
  if (updates.members !== undefined) dbUpdate.members = updates.members
  if (updates.syncPlay !== undefined) dbUpdate.sync_play = updates.syncPlay
  if (updates.syncedTime !== undefined) dbUpdate.synced_time = updates.syncedTime
  if (updates.lastSyncUpdate !== undefined) dbUpdate.last_sync_update = updates.lastSyncUpdate
  if (updates.currentSong !== undefined) dbUpdate.current_song = updates.currentSong
  if (updates.isPlaying !== undefined) dbUpdate.is_playing = updates.isPlaying
  if (updates.memberSyncStates !== undefined) dbUpdate.member_sync_states = updates.memberSyncStates
  if (updates.syncLeader !== undefined) dbUpdate.sync_leader = updates.syncLeader
  if (updates.lastActivity !== undefined) dbUpdate.last_activity = updates.lastActivity
  
  return dbUpdate
}

// Enhanced local storage with better user ID generation
export class LocalRoomStorage {
  private static readonly USER_ID_KEY = "music_app_user_id";
  private static readonly USER_NAME_KEY = "music_app_user_name";

  static getUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    if (!userId) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      userId = `user_${timestamp}_${random}`;
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    return userId;
  }

  static getUserName(): string {
    let userName = localStorage.getItem(this.USER_NAME_KEY);
    if (!userName) {
      userName = `User_${this.getUserId().split('_')[1]}`;
      localStorage.setItem(this.USER_NAME_KEY, userName);
    }
    return userName;
  }

  static setUserName(name: string): void {
    localStorage.setItem(this.USER_NAME_KEY, name);
  }
}

// Real-time subscription manager for Supabase
class SupabaseRealTimeManager {
  private static channels = new Map<string, RealtimeChannel>();

  static subscribe(roomId: string, callback: (data: RoomData) => void): () => void {
    const normalizedRoomId = roomId.toUpperCase();
    
    // Clean up existing channel
    this.unsubscribe(normalizedRoomId);

    // Create new channel
    const channel = supabase
      .channel(`room_${normalizedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${normalizedRoomId}`,
        },
        (payload) => {
          if (payload.new) {
            const roomData = dbRowToRoomData(payload.new as RoomRow);
            callback(roomData);
          }
        }
      )
      .subscribe((status) => {
      });

    this.channels.set(normalizedRoomId, channel);

    // Return cleanup function
    return () => this.unsubscribe(normalizedRoomId);
  }

  static unsubscribe(roomId: string): void {
    const normalizedRoomId = roomId.toUpperCase();
    const channel = this.channels.get(normalizedRoomId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(normalizedRoomId);
    }
  }
}

export class RoomStorage {
  // Create a room that works across devices
  static async createShareableRoom(roomName: string): Promise<{ roomData: RoomData; shareUrl: string }> {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userId = LocalRoomStorage.getUserId();

    const roomData: RoomData = {
      id: roomId,
      name: roomName,
      creator: userId,
      createdAt: Date.now(),
      queue: [],
      members: [userId],
      syncPlay: false,
      syncedTime: 0,
      lastSyncUpdate: Date.now(),
      currentSong: null,
      isPlaying: false,
      memberSyncStates: {},
      syncLeader: undefined,
      lastActivity: Date.now(),
    };

    // Create room in Supabase
    const { data, error } = await supabase
      .from('rooms')
      .insert(roomDataToDbInsert(roomData))
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Failed to create room:', error);
      throw new Error('Failed to create room on server');
    }

    // Also store locally as backup
    localStorage.setItem(`room_${roomId}`, JSON.stringify(roomData));

    // Create shareable URL
    const roomInfo = {
      id: roomData.id,
      name: roomData.name,
      creator: roomData.creator,
      createdAt: roomData.createdAt,
    };

    const encodedData = btoa(JSON.stringify(roomInfo));
    const shareUrl = `${window.location.origin}/room/${roomId}?data=${encodedData}`;

    return { roomData, shareUrl };
  }

  // Join room from URL
  static async joinRoomFromUrl(roomId: string, urlParams: URLSearchParams): Promise<RoomData> {
    const upperRoomId = roomId.toUpperCase();
    const userId = LocalRoomStorage.getUserId();
    

    // Try to get existing room from Supabase
    const { data: existingRoom, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', upperRoomId)
      .single();

    if (existingRoom && !fetchError) {
      // Add user to members if not already there
      const roomData = dbRowToRoomData(existingRoom);
      if (!roomData.members.includes(userId)) {
        roomData.members.push(userId);
        await this.updateRoom(upperRoomId, { members: roomData.members });
      }
      
      // Store locally as cache
      localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(roomData));
      return roomData;
    }

    // If room doesn't exist, try to create it from URL data
    const encodedData = urlParams.get("data");
    let roomData: RoomData;

    if (encodedData) {
      try {
        const roomInfo = JSON.parse(atob(encodedData));
        roomData = {
          id: upperRoomId,
          name: roomInfo.name || "Shared Room",
          creator: roomInfo.creator || "Unknown",
          createdAt: roomInfo.createdAt || Date.now(),
          queue: [],
          members: [userId],
          syncPlay: false,
          syncedTime: 0,
          lastSyncUpdate: Date.now(),
          currentSong: null,
          isPlaying: false,
          memberSyncStates: {},
          syncLeader: undefined,
          lastActivity: Date.now(),
        };
      } catch {
        roomData = this.createFallbackRoom(upperRoomId, userId);
      }
    } else {
      // Do NOT create a new room when no data is present; treat as missing room
      console.warn('[RoomStorage] Room not found and no share data provided. Aborting join.');
      throw new Error('Room not found');
    }

    // Create room in Supabase
    const { error: insertError } = await supabase
      .from('rooms')
      .insert(roomDataToDbInsert(roomData));

    if (insertError) {
      console.error('[Supabase] Failed to create room:', insertError);
      // If creation fails, propagate error so UI can report room not found
      throw new Error('Failed to create room on server');
    }
    
    return roomData;
  }

  private static createFallbackRoom(roomId: string, userId: string): RoomData {
    return {
      id: roomId,
      name: `Room ${roomId}`,
      creator: "Unknown",
      createdAt: Date.now(),
      queue: [],
      members: [userId],
      syncPlay: false,
      syncedTime: 0,
      lastSyncUpdate: Date.now(),
      currentSong: null,
      isPlaying: false,
      memberSyncStates: {},
      syncLeader: undefined,
      lastActivity: Date.now(),
    };
  }

  // Get room data from Supabase
  static async getRoomData(roomId: string): Promise<RoomData | null> {
    const upperRoomId = roomId.toUpperCase();

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', upperRoomId)
        .single();

      if (data && !error) {
        const roomData = dbRowToRoomData(data);
        // Update local cache
        localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(roomData));
        return roomData;
      }
    } catch (error) {
      console.error('[Supabase] Failed to get room:', error);
    }

    // Fallback to local cache
    const localRoom = localStorage.getItem(`room_${upperRoomId}`);
    if (localRoom) {
      try {
        return JSON.parse(localRoom);
      } catch (error) {
        console.error('Failed to parse local room data:', error);
        localStorage.removeItem(`room_${upperRoomId}`);
      }
    }

    return null;
  }

  // Update room in Supabase
  static async updateRoom(roomId: string, updates: Partial<RoomData>): Promise<void> {
    const upperRoomId = roomId.toUpperCase();
    
    // Add lastActivity to updates
    const updatesWithActivity = {
      ...updates,
      lastActivity: Date.now(),
    };

    try {
      const { error } = await supabase
        .from('rooms')
        .update(roomDataToDbUpdate(updatesWithActivity))
        .eq('id', upperRoomId);

      if (error) {
        console.error('[Supabase] Failed to update room:', error);
      } else {
      }
    } catch (error) {
      console.error('[Supabase] Update room error:', error);
    }

    // Always update local cache
    const localRoom = localStorage.getItem(`room_${upperRoomId}`);
    if (localRoom) {
      try {
        const roomData = JSON.parse(localRoom);
        const updatedRoom = { ...roomData, ...updatesWithActivity };
        localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(updatedRoom));
      } catch (error) {
        console.error('Failed to update local cache:', error);
      }
    }
  }

  // Real-time room subscription using Supabase
  static async joinRoomRealTime(
    roomId: string,
    onUpdate: (roomData: RoomData) => void,
  ): Promise<() => void> {
    const upperRoomId = roomId.toUpperCase();

    // Get initial room data
    const roomData = await this.getRoomData(upperRoomId);
    if (roomData) {
      // Ensure current user is part of members and has a sync state entry
      const currentUserId = this.getCurrentUserId();
      const needsMemberAdd = !roomData.members.includes(currentUserId);
      const needsSyncStateAdd = !roomData.memberSyncStates || roomData.memberSyncStates[currentUserId] === undefined;

      if (needsMemberAdd || needsSyncStateAdd) {
        try {
          const updatedMembers = needsMemberAdd ? [...roomData.members, currentUserId] : roomData.members;
          const updatedSyncStates = {
            ...(roomData.memberSyncStates || {}),
            // default to not syncing on join
            [currentUserId]: roomData.memberSyncStates?.[currentUserId] ?? false,
          };

          await this.updateRoom(upperRoomId, {
            members: updatedMembers,
            memberSyncStates: updatedSyncStates,
          });

          // Optimistically update local cache/state before realtime event arrives
          onUpdate({ ...roomData, members: updatedMembers, memberSyncStates: updatedSyncStates });
        } catch (e) {
          console.error('[RoomStorage] Failed to ensure membership/sync state:', e);
          onUpdate(roomData);
        }
      } else {
        onUpdate(roomData);
      }
    }

    // Subscribe to real-time updates
    return SupabaseRealTimeManager.subscribe(upperRoomId, onUpdate);
  }

  // Real-time room update
  static async updateRoomRealTime(roomId: string, updates: Partial<RoomData>): Promise<void> {
    await this.updateRoom(roomId, updates);
  }

  // Check if room exists
  static async roomExists(roomId: string): Promise<boolean> {
    const roomData = await this.getRoomData(roomId);
    return roomData !== null;
  }

  // Get current user info
  static getCurrentUserId(): string {
    return LocalRoomStorage.getUserId();
  }

  static getCurrentUserName(): string {
    return LocalRoomStorage.getUserName();
  }

  static setCurrentUserName(name: string): void {
    LocalRoomStorage.setUserName(name);
  }

  // Check if user is room creator
  static isUserCreator(roomData: RoomData | null): boolean {
    if (!roomData) return false;
    return roomData.creator === this.getCurrentUserId();
  }

  // Get user rooms from Supabase
  static async getUserRooms(): Promise<RoomData[]> {
    const userId = this.getCurrentUserId();
    
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .contains('members', [userId])
        .order('created_at', { ascending: false });

      if (data && !error) {
        return data.map(dbRowToRoomData);
      }
    } catch (error) {
      console.error('[Supabase] Failed to get user rooms:', error);
    }

    // Fallback to local storage
    const rooms: RoomData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("room_")) {
        try {
          const roomData = JSON.parse(localStorage.getItem(key)!);
          if (roomData.members.includes(userId)) {
            rooms.push(roomData);
          }
        } catch (error) {
          console.error("Failed to parse room:", key);
        }
      }
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Clean up old rooms (can be called periodically)
  static async cleanupOldRooms(): Promise<void> {
    try {
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      
      const { error } = await supabase
        .from('rooms')
        .delete()
        .lt('last_activity', thirtyMinutesAgo);

      if (error) {
        console.error('[Supabase] Failed to cleanup old rooms:', error);
      } else {
      }
    } catch (error) {
      console.error('[Supabase] Cleanup error:', error);
    }
  }
}