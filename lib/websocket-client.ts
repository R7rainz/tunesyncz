export class WebSocketClient {
  private roomId: string
  private userId: string
  private userName: string
  private onRoomUpdate?: (data: any) => void
  private onNotification?: (notification: any) => void
  private pollInterval?: NodeJS.Timeout

  constructor(roomId: string, userId: string, userName: string) {
    this.roomId = roomId
    this.userId = userId
    this.userName = userName
  }

  async connect(): Promise<void> {
    console.log("[WebSocketClient] Attempting connection to room:", this.roomId)

    // Try to join room via HTTP API
    try {
      const response = await fetch("/api/websocket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.roomId,
          action: "join_room",
          data: {
            userId: this.userId,
            userName: this.userName,
          },
        }),
      })

      if (response.ok) {
        console.log("[WebSocketClient] Connected via HTTP fallback")
        this.startPolling()
        return
      }
    } catch (error) {
      console.log("[WebSocketClient] HTTP fallback failed, using localStorage only")
    }

    // If HTTP fails, we'll rely on localStorage sync from room-storage.ts
    throw new Error("WebSocket and HTTP fallback unavailable")
  }

  private startPolling() {
    // Poll for room updates every 3 seconds
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/websocket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: this.roomId,
            action: "get_room",
          }),
        })

        if (response.ok) {
          const { room } = await response.json()
          if (room && this.onRoomUpdate) {
            this.onRoomUpdate(room)
          }
        }
      } catch (error) {
        console.error("[WebSocketClient] Polling error:", error)
      }
    }, 3000)
  }

  updateRoom(updates: any) {
    // Send update via HTTP API
    fetch("/api/websocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        action: "update_room",
        data: updates,
      }),
    }).catch(console.error)
  }

  addSongToQueue(song: any) {
    fetch("/api/websocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        action: "add_song",
        data: {
          song,
          userId: this.userId,
        },
      }),
    }).catch(console.error)
  }

  removeSongFromQueue(songIndex: number) {
    fetch("/api/websocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        action: "remove_song",
        data: {
          songIndex,
          userId: this.userId,
        },
      }),
    }).catch(console.error)
  }

  playNextSong() {
    fetch("/api/websocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        action: "play_next",
        data: {
          userId: this.userId,
        },
      }),
    }).catch(console.error)
  }

  updatePlaybackState(isPlaying: boolean, currentTime: number) {
    fetch("/api/websocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        action: "update_playback",
        data: {
          isPlaying,
          currentTime,
          userId: this.userId,
        },
      }),
    }).catch(console.error)
  }

  seekTo(time: number) {
    fetch("/api/websocket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        action: "seek",
        data: {
          time,
          userId: this.userId,
        },
      }),
    }).catch(console.error)
  }

  getRoom() {
    // Handled by polling
  }

  onRoomData(callback: (data: any) => void) {
    this.onRoomUpdate = callback
  }

  onNotificationReceived(callback: (notification: any) => void) {
    this.onNotification = callback
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = undefined
    }
  }
}