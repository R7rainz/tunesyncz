
import type { NextRequest } from "next/server"

// In-memory storage for rooms
const rooms = new Map<string, any>()
const connections = new Map<string, Set<any>>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("roomId")

  if (!roomId) {
    return new Response("Room ID required", { status: 400 })
  }

  // For now, return a simple response since WebSocket upgrade needs special configuration
  // In production, you would use a WebSocket library like 'ws' or deploy to a platform that supports WebSockets
  return new Response(
    JSON.stringify({
      message: "WebSocket endpoint ready",
      roomId: roomId,
      fallback: "Using localStorage sync",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  )
}

export async function POST(request: NextRequest) {
  try {
    const { roomId, action, data } = await request.json()

    switch (action) {
      case "join_room":
        handleJoinRoom(roomId, data)
        break
      case "update_room":
        handleUpdateRoom(roomId, data)
        break
      case "get_room":
        return Response.json({ room: rooms.get(roomId) || null })
    }

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }
}

function handleJoinRoom(roomId: string, data: any) {
  const { userId, userName } = data

  let roomData = rooms.get(roomId)

  if (!roomData) {
    roomData = {
      id: roomId,
      name: `${userName}'s Room`,
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
    }
  } else if (!roomData.members.includes(userId)) {
    roomData.members.push(userId)
    roomData.lastActivity = Date.now()
  }

  rooms.set(roomId, roomData)
}

function handleUpdateRoom(roomId: string, updates: any) {
  const roomData = rooms.get(roomId)
  if (roomData) {
    Object.assign(roomData, updates, { lastActivity: Date.now() })
    rooms.set(roomId, roomData)
  }
}