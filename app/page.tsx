"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Music, Users, Vote, Play, Sparkles, Zap, Radio } from "lucide-react";
import { RoomStorage } from "@/lib/room-storage";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user was in a room and redirect
    const savedRoom = localStorage.getItem("currentRoom");
    if (savedRoom) {
      router.push(`/room/${savedRoom}`);
      return;
    }
    setIsLoading(false);
  }, [router]);

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
          <p className="text-lg animate-pulse text-foreground">
            Loading SyncTunes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/5 rounded-full animate-pulse"></div>
        <div
          className="absolute top-3/4 right-1/4 w-24 h-24 bg-accent/5 rounded-full animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 left-3/4 w-16 h-16 bg-primary/10 rounded-full animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="max-w-4xl w-full space-y-8 relative z-10">
        <div className="text-center space-y-4 animate-in fade-in-0 slide-in-from-top-4 duration-1000">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative p-3 bg-primary/20 rounded-full">
              <Music className="h-8 w-8 text-primary" />
              <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping"></div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient bg-300% text-balance">
              SyncTunes
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Create collaborative music rooms, search YouTube, and vote on tracks
            together
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>Real-time collaboration</span>
            <span>•</span>
            <Zap className="h-4 w-4 text-primary" />
            <span>Instant sync</span>
            <span>•</span>
            <Radio className="h-4 w-4 text-accent" />
            <span>Live voting</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-300">
          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/10 group">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 p-2 bg-primary/10 rounded-full w-fit group-hover:bg-primary/20 transition-colors">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">
                Create Rooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Start a room and invite friends with a simple room ID
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-card/50 backdrop-blur-sm hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-accent/10 group">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 p-2 bg-accent/10 rounded-full w-fit group-hover:bg-accent/20 transition-colors">
                <Play className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="group-hover:text-accent transition-colors">
                YouTube Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Search and add songs directly from YouTube
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/10 group">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 p-2 bg-primary/10 rounded-full w-fit group-hover:bg-primary/20 transition-colors">
                <Vote className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">
                Vote & Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Upvote and downvote tracks to control the queue order
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-1000 delay-500">
          <CreateRoomCard />
          <JoinRoomCard />
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground animate-in fade-in-0 duration-1000 delay-700">
          <p>
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd>{" "}
            to navigate •{" "}
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> to
            submit
          </p>
        </div>
      </div>
    </div>
  );
}

function CreateRoomCard() {
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    if (!roomName.trim()) return;

    setIsCreating(true);

    try {
      const { roomData, shareUrl } =
        await RoomStorage.createShareableRoom(roomName);
      localStorage.setItem("currentRoom", roomData.id);

      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).catch(() => {
          console.log("Could not copy to clipboard");
        });
      }

      router.push(
        `/room/${roomData.id}?data=${btoa(
          JSON.stringify({
            id: roomData.id,
            name: roomData.name,
            creator: roomData.creator, // Pass the actual creator ID
            createdAt: roomData.createdAt,
          }),
        )}`,
      );
    } catch (error) {
      console.error("Error creating room:", error);
      // Show error toast
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && roomName.trim()) {
      createRoom();
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1 bg-primary/20 rounded">
            <Music className="h-5 w-5 text-primary" />
          </div>
          Create New Room
        </CardTitle>
        <CardDescription>
          Start a new music room and invite your friends
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Enter room name..."
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="transition-all duration-200 focus:scale-[1.02]"
          disabled={isCreating}
        />
        <Button
          onClick={createRoom}
          disabled={!roomName.trim() || isCreating}
          className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          {isCreating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
              Creating Room...
            </div>
          ) : (
            "Create Room"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
function JoinRoomCard() {
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const joinRoom = (targetRoomId?: string) => {
    const idToJoin = targetRoomId || roomId;
    if (!idToJoin.trim()) return;

    setIsJoining(true);
    setError("");

    setTimeout(() => {
      const upperRoomId = idToJoin.toUpperCase();

      localStorage.setItem("currentRoom", upperRoomId);
      setIsJoining(false);
      router.push(`/room/${upperRoomId}`);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && roomId.trim()) {
      joinRoom();
    }
  };

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 hover:from-accent/10 hover:to-accent/15 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1 bg-accent/20 rounded">
            <Users className="h-5 w-5 text-accent" />
          </div>
          Join Existing Room
        </CardTitle>
        <CardDescription>
          Enter a room ID or use a shared room link
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Enter room ID..."
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={handleKeyDown}
          className={`transition-all duration-200 focus:scale-[1.02] ${
            error ? "border-destructive focus:border-destructive" : ""
          }`}
          disabled={isJoining}
        />
        {error && (
          <p className="text-sm text-destructive animate-in slide-in-from-top-2 duration-200">
            {error}
          </p>
        )}

        <Button
          onClick={() => joinRoom()}
          disabled={!roomId.trim() || isJoining}
          variant="secondary"
          className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          {isJoining ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin"></div>
              Joining Room...
            </div>
          ) : (
            "Join Room"
          )}
        </Button>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
          <p>
            💡 Tip: Room creators can share the URL directly for easy joining
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
