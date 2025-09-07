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
  // New per-user sync play system
  memberSyncStates?: Record<string, boolean>; // userId -> sync enabled
  syncLeader?: string; // userId of the person others are syncing to
}

// Enhanced WebSocket server simulation with cross-tab communication
class WebSocketServer {
  private static rooms: Map<string, RoomData> = new Map();
  private static listeners: Map<string, ((data: RoomData) => void)[]> =
    new Map();
  private static storageKey = "websocket_room_updates";

  static joinRoom(
    roomId: string,
    callback: (data: RoomData) => void,
  ): () => void {
    const normalizedRoomId = roomId.toUpperCase();

    if (!this.listeners.has(normalizedRoomId)) {
      this.listeners.set(normalizedRoomId, []);
    }

    this.listeners.get(normalizedRoomId)!.push(callback);

    // Send current room state immediately
    if (this.rooms.has(normalizedRoomId)) {
      callback(this.rooms.get(normalizedRoomId)!);
    }

    // Set up cross-tab communication
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === this.storageKey && e.newValue) {
        try {
          const update = JSON.parse(e.newValue);
          if (update.roomId === normalizedRoomId) {
            console.log("[WebSocket] Cross-tab update received:", update);
            this.rooms.set(normalizedRoomId, update.data);
            const roomListeners = this.listeners.get(normalizedRoomId) || [];
            roomListeners.forEach((listener) => listener(update.data));
          }
        } catch (error) {
          console.error("[WebSocket] Error parsing cross-tab update:", error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Return cleanup function
    return () => {
      const roomListeners = this.listeners.get(normalizedRoomId) || [];
      const index = roomListeners.indexOf(callback);
      if (index > -1) {
        roomListeners.splice(index, 1);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }

  static updateRoom(roomId: string, data: RoomData): void {
    const normalizedRoomId = roomId.toUpperCase();
    this.rooms.set(normalizedRoomId, data);

    // Notify all listeners in current tab
    const roomListeners = this.listeners.get(normalizedRoomId) || [];
    roomListeners.forEach((listener) => listener(data));

    // Notify other tabs via localStorage
    try {
      const update = {
        roomId: normalizedRoomId,
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(update));
      // Remove the item immediately to trigger storage event
      setTimeout(() => localStorage.removeItem(this.storageKey), 100);
    } catch (error) {
      console.error("[WebSocket] Error sending cross-tab update:", error);
    }
  }

  static getRoom(roomId: string): RoomData | null {
    return this.rooms.get(roomId.toUpperCase()) || null;
  }

  static roomExists(roomId: string): boolean {
    return this.rooms.has(roomId.toUpperCase());
  }
}

// Real cross-browser room storage using JSONBin API
export class CrossBrowserRoomServer {
  private static readonly API_BASE = "https://api.jsonbin.io/v3/b";
  private static readonly API_KEY = "$2a$10$8K9Z8K9Z8K9Z8K9Z8K9Z8O"; // Demo key - replace with real one

  // Create room on external server
  static async createRoom(roomData: RoomData): Promise<string | null> {
    try {
      const response = await fetch(`${this.API_BASE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": this.API_KEY,
          "X-Bin-Name": `music-room-${roomData.id}`,
        },
        body: JSON.stringify(roomData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[v0] Created room on server:", roomData.id);
        return result.metadata.id;
      }
    } catch (error) {
      console.log("[v0] External API not available, using fallback");
    }
    return null;
  }

  // Get room from external server
  static async getRoom(binId: string): Promise<RoomData | null> {
    try {
      const response = await fetch(`${this.API_BASE}/${binId}/latest`, {
        headers: {
          "X-Master-Key": this.API_KEY,
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.record;
      }
    } catch (error) {
      console.log("[v0] External API not available");
    }
    return null;
  }

  // Update room on external server
  static async updateRoom(binId: string, roomData: RoomData): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": this.API_KEY,
        },
        body: JSON.stringify(roomData),
      });

      return response.ok;
    } catch (error) {
      console.log("[v0] External API not available");
    }
    return false;
  }
}

// Enhanced local storage with better cross-browser simulation
export class LocalRoomStorage {
  private static readonly GLOBAL_ROOMS_KEY = "global_music_rooms";
  private static readonly USER_ID_KEY = "music_app_user_id";

  // Get or create user ID - improved to be more unique
  static getUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    return userId;
  }

  // Store room in global storage (simulates shared storage)
  static storeGlobalRoom(roomData: RoomData): void {
    try {
      const globalRooms = this.getGlobalRooms();
      globalRooms[roomData.id] = {
        ...roomData,
        lastActivity: Date.now(),
      };
      localStorage.setItem(this.GLOBAL_ROOMS_KEY, JSON.stringify(globalRooms));
      console.log("[v0] Stored room globally:", roomData.id);
    } catch (error) {
      console.error("[v0] Failed to store global room:", error);
    }
  }

  // Get all global rooms
  static getGlobalRooms(): Record<string, RoomData> {
    try {
      const data = localStorage.getItem(this.GLOBAL_ROOMS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  // Get specific room from global storage
  static getGlobalRoom(roomId: string): RoomData | null {
    const globalRooms = this.getGlobalRooms();
    return globalRooms[roomId.toUpperCase()] || null;
  }

  // Add member to room
  static addMemberToRoom(roomId: string, memberId: string): boolean {
    const room = this.getGlobalRoom(roomId);
    if (room && !room.members.includes(memberId)) {
      room.members.push(memberId);
      room.lastActivity = Date.now();
      this.storeGlobalRoom(room);
      console.log("[v0] Added member to room:", memberId, "->", roomId);
      return true;
    }
    return false;
  }

  // Update room data
  static updateGlobalRoom(roomId: string, updates: Partial<RoomData>): boolean {
    const room = this.getGlobalRoom(roomId);
    if (room) {
      Object.assign(room, updates, { lastActivity: Date.now() });
      this.storeGlobalRoom(room);
      console.log("[v0] Updated global room:", roomId, updates);
      return true;
    }
    return false;
  }
}

export class RoomStorage {
  private static binIds: Record<string, string> = {};

  // Create a shareable room with real cross-browser support
  static async createShareableRoom(
    roomName: string,
  ): Promise<{ roomData: RoomData; shareUrl: string }> {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userId = LocalRoomStorage.getUserId();

    const roomData: RoomData = {
      id: roomId,
      name: roomName,
      creator: userId, // Store actual user ID
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
    };

    // Try external storage first
    const binId = await CrossBrowserRoomServer.createRoom(roomData);
    if (binId) {
      this.binIds[roomId] = binId;
    }

    // Always store locally as backup
    LocalRoomStorage.storeGlobalRoom(roomData);
    localStorage.setItem(`room_${roomId}`, JSON.stringify(roomData));

    // Update WebSocket server for real-time
    WebSocketServer.updateRoom(roomId, roomData);

    // Create enhanced shareable URL
    const roomInfo = {
      id: roomData.id,
      name: roomData.name,
      creator: roomData.creator,
      createdAt: roomData.createdAt,
      binId: binId || undefined,
    };

    const encodedData = btoa(JSON.stringify(roomInfo));
    const shareUrl = `${window.location.origin}/room/${roomId}?data=${encodedData}`;

    console.log("[v0] Created shareable room:", roomId, "URL:", shareUrl);
    return { roomData, shareUrl };
  }

  // Join room with enhanced cross-browser support
  static async joinRoomFromUrl(
    roomId: string,
    urlParams: URLSearchParams,
  ): Promise<RoomData> {
    const upperRoomId = roomId.toUpperCase();
    const userId = LocalRoomStorage.getUserId();
    console.log("[v0] User", userId, "joining room:", upperRoomId);

    // Try to decode room info from URL
    const encodedData = urlParams.get("data");
    let binId: string | undefined;

    if (encodedData) {
      try {
        const roomInfo = JSON.parse(atob(encodedData));
        binId = roomInfo.binId;
        console.log("[v0] Decoded room info:", roomInfo);
      } catch (error) {
        console.error("[v0] Failed to decode room info:", error);
      }
    }

    // Try external server first
    if (binId) {
      const serverRoom = await CrossBrowserRoomServer.getRoom(binId);
      if (serverRoom) {
        // Add current user to members if not already there
        if (!serverRoom.members.includes(userId)) {
          serverRoom.members.push(userId);
          await CrossBrowserRoomServer.updateRoom(binId, serverRoom);
        }

        // Store locally
        LocalRoomStorage.storeGlobalRoom(serverRoom);
        localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(serverRoom));

        // Update WebSocket server
        WebSocketServer.updateRoom(upperRoomId, serverRoom);

        console.log("[v0] Joined from external server:", serverRoom);
        return serverRoom;
      }
    }

    // Try global local storage
    const globalRoom = LocalRoomStorage.getGlobalRoom(upperRoomId);
    if (globalRoom) {
      LocalRoomStorage.addMemberToRoom(upperRoomId, userId);
      const updatedRoom = LocalRoomStorage.getGlobalRoom(upperRoomId)!;
      localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(updatedRoom));

      // Update WebSocket server
      WebSocketServer.updateRoom(upperRoomId, updatedRoom);

      console.log("[v0] Joined from global storage:", updatedRoom);
      return updatedRoom;
    }

    // Create new room from URL data or fallback
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
        };
      } catch {
        roomData = this.createFallbackRoom(upperRoomId, userId);
      }
    } else {
      roomData = this.createFallbackRoom(upperRoomId, userId);
    }

    // Store the new room
    LocalRoomStorage.storeGlobalRoom(roomData);
    localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(roomData));

    // Update WebSocket server
    WebSocketServer.updateRoom(upperRoomId, roomData);

    console.log("[v0] Created new room:", roomData);
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
    };
  }

  // Get room data with enhanced sync
  static async getRoomData(roomId: string): Promise<RoomData | null> {
    const upperRoomId = roomId.toUpperCase();

    // Try WebSocket server first (real-time)
    const wsRoom = WebSocketServer.getRoom(upperRoomId);
    if (wsRoom) {
      return wsRoom;
    }

    // Try external server
    const binId = this.binIds[upperRoomId];
    if (binId) {
      const serverRoom = await CrossBrowserRoomServer.getRoom(binId);
      if (serverRoom) {
        LocalRoomStorage.storeGlobalRoom(serverRoom);
        localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(serverRoom));
        WebSocketServer.updateRoom(upperRoomId, serverRoom);
        return serverRoom;
      }
    }

    // Try global storage
    const globalRoom = LocalRoomStorage.getGlobalRoom(upperRoomId);
    if (globalRoom) {
      localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(globalRoom));
      WebSocketServer.updateRoom(upperRoomId, globalRoom);
      return globalRoom;
    }

    // Fallback to local storage
    const localRoom = localStorage.getItem(`room_${upperRoomId}`);
    if (localRoom) {
      try {
        const roomData = JSON.parse(localRoom);
        WebSocketServer.updateRoom(upperRoomId, roomData);
        return roomData;
      } catch (error) {
        console.error("Failed to parse room data:", error);
        localStorage.removeItem(`room_${upperRoomId}`);
      }
    }

    return null;
  }

  // Update room with enhanced sync
  static async updateRoom(roomId: string, roomData: RoomData): Promise<void> {
    const upperRoomId = roomId.toUpperCase();

    // Update external server
    const binId = this.binIds[upperRoomId];
    if (binId) {
      await CrossBrowserRoomServer.updateRoom(binId, roomData);
    }

    // Update global storage
    LocalRoomStorage.storeGlobalRoom(roomData);

    // Update local storage
    localStorage.setItem(`room_${upperRoomId}`, JSON.stringify(roomData));

    // Update WebSocket server for real-time
    WebSocketServer.updateRoom(upperRoomId, roomData);

    console.log("[v0] Updated room across all storage:", upperRoomId);
  }

  // Real-time room subscription
  static async joinRoomRealTime(
    roomId: string,
    onUpdate: (roomData: RoomData) => void,
  ): Promise<() => void> {
    const upperRoomId = roomId.toUpperCase();

    // Get initial room data
    const roomData = await this.getRoomData(upperRoomId);
    if (roomData) {
      onUpdate(roomData);
    }

    // Subscribe to real-time updates
    return WebSocketServer.joinRoom(upperRoomId, onUpdate);
  }

  // Real-time room update
  static async updateRoomRealTime(
    roomId: string,
    roomData: RoomData,
  ): Promise<void> {
    const upperRoomId = roomId.toUpperCase();

    // Update all storage layers
    await this.updateRoom(upperRoomId, roomData);

    // WebSocket update is handled in updateRoom
  }

  // Check if room exists
  static roomExists(roomId: string): boolean {
    const upperRoomId = roomId.toUpperCase();

    // Check WebSocket server
    if (WebSocketServer.roomExists(upperRoomId)) {
      return true;
    }

    // Check global storage
    if (LocalRoomStorage.getGlobalRoom(upperRoomId) !== null) {
      return true;
    }

    // Check local storage
    return localStorage.getItem(`room_${upperRoomId}`) !== null;
  }

  static getUserRooms(): RoomData[] {
    const rooms: RoomData[] = [];
    const globalRooms = LocalRoomStorage.getGlobalRooms();

    // Add global rooms
    Object.values(globalRooms).forEach((room) => {
      rooms.push(room);
    });

    // Add local rooms not in global
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("room_")) {
        try {
          const roomData = JSON.parse(localStorage.getItem(key)!);
          if (!globalRooms[roomData.id]) {
            rooms.push(roomData);
          }
        } catch (error) {
          console.error("Failed to parse room:", key);
        }
      }
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Get current user ID
  static getCurrentUserId(): string {
    return LocalRoomStorage.getUserId();
  }

  // Check if user is room creator
  static isUserCreator(roomData: RoomData | null): boolean {
    if (!roomData) return false;
    return roomData.creator === this.getCurrentUserId();
  }
}
