"use client"

import { RoomManager } from "@/components/room-manager"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Music } from "lucide-react"
import { RoomStorage } from "@/lib/room-storage"

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const [isLoading, setIsLoading] = useState(true)
  const [roomExists, setRoomExists] = useState(false)

  useEffect(() => {
    const loadRoom = async () => {
      if (roomId) { 
        console.log("[v0] Loading room:", roomId)
        
        try {
          // First try to get existing room data
          let roomData = await RoomStorage.getRoomData(roomId)

          // If room doesn't exist locally, try to join from URL parameters
          if (!roomData) {
            console.log("[v0] Room not found locally, joining from URL")
            roomData = await RoomStorage.joinRoomFromUrl(roomId, searchParams)
          }

          console.log("[v0] Final room data:", roomData)
          if (roomData) {
            localStorage.setItem("currentRoom", roomId)
            setRoomExists(true)
          } else {
            console.log("[v0] Failed to load or create room")
            setRoomExists(false)
          }
        } catch (error) {
          console.error("[v0] Error loading room:", error)
          setRoomExists(false)
        }
      }
      setIsLoading(false)
    }

    loadRoom()
  }, [roomId, searchParams])

  const handleLeaveRoom = () => {
    localStorage.removeItem("currentRoom")
    router.push("/dashboard")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative">
            <Music className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
            <div className="absolute inset-0 animate-ping">
              <Music className="h-12 w-12 text-primary/30 mx-auto" />
            </div>
          </div>
          <p className="text-lg animate-pulse text-foreground">Loading room...</p>
        </div>
      </div>
    )
  }

  if (!roomExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="relative">
            <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Room not found</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The room <span className="font-mono bg-muted px-2 py-1 rounded">{roomId}</span> doesn't exist or the link is
            invalid.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </button>
            <p className="text-xs text-muted-foreground">
              💡 Make sure you're using the complete room link shared by the creator
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <RoomManager roomId={roomId} onLeaveRoom={handleLeaveRoom} />
}
