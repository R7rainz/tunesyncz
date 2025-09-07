"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  LogOut,
  Users,
  Settings,
  Music,
  Copy,
  Check,
  Edit3,
  UserMinus,
  Share2,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { YouTubeSearch } from "@/components/youtube-search";
import { YouTubePlayer } from "@/components/youtube-player";
import { RoomStorage } from "@/lib/room-storage";

interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    thumbnails: {
      medium: { url: string };
      high: { url: string };
    };
    publishedAt: string;
  };
}

interface QueueItem extends YouTubeVideo {
  addedBy: string;
  addedAt: number;
  votes: number;
  voters: string[];
  upvoters: string[];
  downvoters: string[];
}

// Use the same RoomData interface as room-storage.ts
interface RoomData {
  id: string;
  name: string;
  creator: string;
  createdAt: number;
  queue: any[];
  members: string[];
  syncPlay: boolean; // Keep for backward compatibility
  syncedTime: number;
  lastSyncUpdate: number;
  currentSong: any;
  isPlaying: boolean;
  lastActivity?: number;
  // New per-user sync play system
  memberSyncStates?: Record<string, boolean>; // userId -> sync enabled
  syncLeader?: string; // userId of the person others are syncing to
}

interface RoomManagerProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export function RoomManager({ roomId, onLeaveRoom }: RoomManagerProps) {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    const user = RoomStorage.getCurrentUserId();
    setUserId(user);
  }, []);

  // Helper functions for new sync play system
  const getMemberSyncStates = () => {
    return roomData?.memberSyncStates || {};
  };

  const isUserSyncing = (user: string) => {
    return getMemberSyncStates()[user] || false;
  };

  const getSyncLeader = () => {
    return roomData?.syncLeader;
  };

  const getSyncedUsers = () => {
    const syncStates = getMemberSyncStates();
    return Object.keys(syncStates).filter((user) => syncStates[user]);
  };

  const canUserControl = (user: string) => {
    if (!roomData) return false;
    // Creator can always control
    if (user === roomData.creator) return true;
    // User can control if they have sync play enabled
    return isUserSyncing(user);
  };

  const loadRoomData = useCallback(async () => {
    try {
      console.log("loading room:", roomId);

      // Use the enhanced getRoomData that checks server first
      const data = await RoomStorage.getRoomData(roomId);

      if (data) {
        setRoomData(data);
      } else {
        console.error("No room data found for:", roomId);
        toast({
          title: "Room not found",
          description: "The room you're trying to join doesn't exist.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading room data:", error);
      toast({
        title: "Error loading room",
        description: "There was an issue loading the room data.",
        variant: "destructive",
      });
    }
  }, [roomId, toast]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupRealTimeSync = async () => {
      try {
        console.log(
          "[RoomManager] Setting up real-time sync for room:",
          roomId,
        );
        // Use real-time subscription instead of polling
        unsubscribe = await RoomStorage.joinRoomRealTime(roomId, (data) => {
          console.log("[RoomManager] Real-time update received:", {
            roomId: data.id,
            members: data.members,
            queueLength: data.queue.length,
            isPlaying: data.isPlaying,
            currentSong: data.currentSong?.snippet?.title,
          });
          setRoomData(data);
        });
        console.log("[RoomManager] Real-time sync setup successful");
      } catch (error) {
        console.error("[RoomManager] Failed to setup real-time sync:", error);
        // Fallback to polling if real-time fails
        console.log("[RoomManager] Falling back to polling");
        loadRoomData();
        const interval = setInterval(loadRoomData, 2000);
        return () => clearInterval(interval);
      }
    };

    setupRealTimeSync();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [roomId, loadRoomData]);

  const updateRoomData = useCallback(
    async (updates: Partial<RoomData>) => {
      if (!roomData) return;

      const updatedRoom = { ...roomData, ...updates, lastActivity: Date.now() };

      console.log("[RoomManager] Updating room data:", {
        roomId,
        updates,
        newMemberCount: updatedRoom.members?.length,
        newQueueLength: updatedRoom.queue?.length,
      });

      // Optimistically update local state for immediate UX response
      setRoomData(updatedRoom);

      // Persist to Supabase; realtime will reconcile if needed
      try {
        await RoomStorage.updateRoomRealTime(roomId, updatedRoom);
      } catch (err) {
        console.error("[RoomManager] Failed to persist room update:", err);
      }
    },
    [roomData, roomId],
  );

  const addToQueue = useCallback(
    (video: YouTubeVideo) => {
      if (!roomData) return;

      const queueItem: QueueItem = {
        ...video,
        addedBy: userId,
        addedAt: Date.now(),
        votes: 0,
        voters: [],
        upvoters: [],
        downvoters: [],
      };

      const newQueue = [...roomData.queue, queueItem].sort(
        (a, b) => b.votes - a.votes,
      );

      // If no current song and queue was empty, start playing
      const updateData: Partial<RoomData> = { queue: newQueue };
      if (!roomData.currentSong && roomData.queue.length === 0) {
        updateData.currentSong = queueItem;
        updateData.isPlaying = true;
        updateData.syncedTime = 0;
        updateData.lastSyncUpdate = Date.now();
      }

      updateRoomData(updateData);
    },
    [roomData, updateRoomData],
  );

  const handleVote = useCallback(
    (songId: string, voteType: "up" | "down") => {
      if (!roomData) return;

      const updatedQueue = roomData.queue.map((song) => {
        if (`${song.id.videoId}-${song.addedAt}` === songId) {
          const hasUpvoted = song.upvoters.includes(userId);
          const hasDownvoted = song.downvoters.includes(userId);

          let newUpvoters = [...song.upvoters];
          let newDownvoters = [...song.downvoters];

          if (voteType === "up") {
            if (hasUpvoted) {
              // Remove upvote
              newUpvoters = newUpvoters.filter((voter) => voter !== userId);
            } else {
              // Add upvote, remove downvote if exists
              newUpvoters.push(userId);
              newDownvoters = newDownvoters.filter((voter) => voter !== userId);
            }
          } else {
            if (hasDownvoted) {
              // Remove downvote
              newDownvoters = newDownvoters.filter((voter) => voter !== userId);
            } else {
              // Add downvote, remove upvote if exists
              newDownvoters.push(userId);
              newUpvoters = newUpvoters.filter((voter) => voter !== userId);
            }
          }

          const newVotes = newUpvoters.length - newDownvoters.length;

          return {
            ...song,
            upvoters: newUpvoters,
            downvoters: newDownvoters,
            votes: newVotes,
            voters: [...newUpvoters, ...newDownvoters],
          };
        }
        return song;
      });

      // Sort queue by votes (highest first)
      const sortedQueue = updatedQueue.sort((a, b) => b.votes - a.votes);

      updateRoomData({ queue: sortedQueue });

      const action = voteType === "up" ? "upvoted" : "downvoted";
      toast({
        title: `Song ${action}`,
        description: "Queue has been reordered based on votes.",
      });
    },
    [roomData, updateRoomData, toast],
  );

  const handlePlayPause = useCallback(() => {
    if (!roomData) return;

    const canControl = canUserControl(userId);
    if (!canControl) return;

    const newPlayingState = !roomData.isPlaying;

    // If this user is enabling sync play, they become the sync leader
    const updates: Partial<RoomData> = {
      isPlaying: newPlayingState,
      lastSyncUpdate: Date.now(),
    };

    // If user is syncing and starting playback, they become the leader
    if (newPlayingState && isUserSyncing(userId)) {
      updates.syncLeader = userId;
    }

    updateRoomData(updates);
  }, [roomData, updateRoomData, userId, canUserControl, isUserSyncing]);

  const handleSeek = useCallback(
    (time: number) => {
      if (!roomData) return;

      const canControl = canUserControl(userId);
      if (!canControl) return;

      // Only update if user is the sync leader or creator
      const isUserLeader = getSyncLeader() === userId;
      const isCreator = roomData.creator === userId;

      if (isUserLeader || isCreator) {
        updateRoomData({
          syncedTime: time,
          lastSyncUpdate: Date.now(),
        });
      }
    },
    [roomData, updateRoomData, userId, canUserControl, getSyncLeader],
  );

  const handleNext = useCallback(() => {
    if (!roomData) return;

    const canControl = canUserControl(userId);
    if (!canControl) return;

    const nextSong = roomData.queue[0];
    const newQueue = roomData.queue.slice(1);

    updateRoomData({
      currentSong: nextSong || null,
      queue: newQueue,
      isPlaying: !!nextSong,
      syncedTime: 0,
      lastSyncUpdate: Date.now(),
    });
  }, [roomData, updateRoomData, userId, canUserControl]);

  const leaveRoom = useCallback(async () => {
    if (roomData) {
      const updatedMembers = roomData.members.filter(
        (member) => member !== userId,
      );

      if (updatedMembers.length === 0 || roomData.creator === userId) {
        // Delete room if empty or creator leaves
        localStorage.removeItem(`room_${roomId}`);
        // Room will be cleaned up automatically by the storage system
      } else {
        // Update room without current user
        await updateRoomData({ members: updatedMembers });
      }
    }

    localStorage.removeItem("currentRoom");
    onLeaveRoom();
  }, [roomData, roomId, updateRoomData, onLeaveRoom]);

  const copyRoomId = async () => {
    try {
      const shareUrl = `${window.location.origin}/room/${roomId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Room link copied!",
        description: "Share this link with friends to invite them.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback to copying just the room ID
      try {
        await navigator.clipboard.writeText(roomId);
        toast({
          title: "Room ID copied!",
          description: "Share this ID with friends to invite them.",
        });
      } catch (fallbackError) {
        toast({
          title: "Failed to copy",
          description: "Please copy the room ID manually.",
          variant: "destructive",
        });
      }
    }
  };

  const saveRoomName = () => {
    if (newRoomName.trim() && roomData?.creator === userId) {
      updateRoomData({ name: newRoomName.trim() });
      setIsEditingName(false);
      toast({
        title: "Room name updated",
        description: `Room renamed to "${newRoomName.trim()}"`,
      });
    }
  };

  const toggleSyncPlay = () => {
    if (roomData?.creator === userId) {
      const newSyncPlay = !roomData.syncPlay;
      updateRoomData({
        syncPlay: newSyncPlay,
        lastSyncUpdate: Date.now(),
      });
      toast({
        title: `Sync play ${newSyncPlay ? "enabled" : "disabled"}`,
        description: newSyncPlay
          ? "All members can now control playback"
          : "Only you can control playback",
      });
    }
  };

  const toggleUserSyncPlay = useCallback(
    (targetUserId: string) => {
      if (!roomData) return;

      const currentSyncStates = getMemberSyncStates();
      const newSyncState = !currentSyncStates[targetUserId];
      const currentLeader = getSyncLeader();

      const updatedSyncStates = {
        ...currentSyncStates,
        [targetUserId]: newSyncState,
      };

      const updates: Partial<RoomData> = {
        memberSyncStates: updatedSyncStates,
        lastSyncUpdate: Date.now(),
      };

      // If user is enabling sync
      if (newSyncState) {
        // If there's no current leader, they become the leader
        if (!currentLeader) {
          updates.syncLeader = targetUserId;
          console.log("[RoomManager] User became sync leader:", targetUserId);
        }
        // If there's already a leader, they join the sync group
        else {
          console.log(
            "[RoomManager] User joined sync group, leader:",
            currentLeader,
          );
        }
      }
      // If user is disabling sync
      else {
        // If they were the leader, transfer leadership to another syncing user
        if (currentLeader === targetUserId) {
          const syncingUsers = Object.keys(updatedSyncStates).filter(
            (user) => updatedSyncStates[user],
          );
          if (syncingUsers.length > 0) {
            updates.syncLeader = syncingUsers[0];
            console.log(
              "[RoomManager] Leadership transferred to:",
              syncingUsers[0],
            );
          } else {
            updates.syncLeader = undefined;
            console.log("[RoomManager] No more syncing users, cleared leader");
          }
        }
      }

      updateRoomData(updates);

      const action = newSyncState ? "enabled" : "disabled";
      const targetName = targetUserId === userId ? "You" : targetUserId;
      const leaderInfo =
        newSyncState && updates.syncLeader === targetUserId
          ? " (now leader)"
          : "";
      toast({
        title: `Sync play ${action}`,
        description: `${targetName} ${action} sync play${leaderInfo}`,
      });
    },
    [roomData, updateRoomData, userId, getMemberSyncStates, getSyncLeader],
  );

  const removeMember = (memberId: string) => {
    if (roomData?.creator === userId && memberId !== userId) {
      const updatedMembers = roomData.members.filter(
        (member) => member !== memberId,
      );
      updateRoomData({ members: updatedMembers });
      toast({
        title: "Member removed",
        description: "Member has been removed from the room.",
      });
    }
  };

  if (!roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <Music className="h-12 w-12 text-cyan-400 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-100">Loading room...</p>
        </div>
      </div>
    );
  }

  const isCreator = roomData.creator === userId;

  return (
    <div className="min-h-screen p-4 bg-gray-950">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Room Header */}
        <Card className="border-gray-700 bg-gray-900/80 backdrop-blur-sm relative overflow-hidden">
          {roomData.isPlaying && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-orange-400 to-cyan-400 animate-pulse"></div>
          )}

          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Music className="h-6 w-6 text-cyan-400" />
                  {isEditingName && isCreator ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRoomName();
                          if (e.key === "Escape") setIsEditingName(false);
                        }}
                        className="text-2xl font-bold h-auto py-1 bg-gray-800 border-gray-600 text-gray-100"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={saveRoomName}
                        className="bg-cyan-600 hover:bg-cyan-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-gray-100">
                        {roomData.name}
                      </h1>
                      {isCreator && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewRoomName(roomData.name);
                            setIsEditingName(true);
                          }}
                          className="text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>Room ID:</span>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer bg-gray-700 text-gray-200 hover:bg-gray-600"
                      onClick={copyRoomId}
                    >
                      {roomId}
                      {copied ? (
                        <Check className="h-3 w-3 ml-1" />
                      ) : (
                        <Copy className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  </div>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {roomData.members.length} members
                  </span>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span>
                      Synced: {getSyncedUsers().length}/
                      {roomData.members.length}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRoomId}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Link
                </Button>

                {/* Settings Dialog */}
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-700">
                    <DialogHeader>
                      <DialogTitle className="text-gray-100">
                        Room Settings
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      {/* Sync Play Setting */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-100">Sync Play</p>
                          <p className="text-sm text-gray-400">
                            Allow all members to control playback and sync
                            across devices
                          </p>
                        </div>
                        <Switch
                          checked={roomData.syncPlay}
                          onCheckedChange={toggleSyncPlay}
                          disabled={!isCreator}
                        />
                      </div>

                      <Separator className="bg-gray-700" />

                      {/* Room Info */}
                      <div className="space-y-3">
                        <p className="font-medium text-gray-100">
                          Room Information
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Created:</span>
                            <span className="text-gray-200">
                              {new Date(
                                roomData.createdAt,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Creator:</span>
                            <span className="text-gray-200">
                              {roomData.creator}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Members:</span>
                            <span className="text-gray-200">
                              {roomData.members.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isCreator && (
                        <p className="text-xs text-gray-500">
                          Only the room creator can modify settings.
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="destructive" size="sm" onClick={leaveRoom}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Room
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Player and Queue */}
          <div className="lg:col-span-2 space-y-4">
            <YouTubePlayer
              currentSong={roomData.currentSong}
              isPlaying={roomData.isPlaying || false}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onSeek={handleSeek}
              syncPlay={roomData.syncPlay}
              isCreator={isCreator}
              roomId={roomId}
              syncedTime={roomData.syncedTime || 0}
              lastSyncUpdate={roomData.lastSyncUpdate || 0}
              memberSyncStates={getMemberSyncStates()}
              syncLeader={getSyncLeader()}
              userId={userId}
            />

            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100">
                  Music Queue ({roomData.queue.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {roomData.queue.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No songs in queue yet</p>
                    <p className="text-sm">
                      Search and add some music to get started!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {roomData.queue.map((song, index) => {
                      const songId = `${song.id.videoId}-${song.addedAt}`;
                      const hasUpvoted = song.upvoters.includes(userId);
                      const hasDownvoted = song.downvoters.includes(userId);

                      return (
                        <div
                          key={songId}
                          className="flex gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors border border-gray-700/30"
                        >
                          <div className="relative">
                            <img
                              src={
                                song.snippet.thumbnails.medium.url ||
                                "/placeholder.svg"
                              }
                              alt={song.snippet.title}
                              className="w-12 h-12 object-cover rounded border border-gray-600"
                            />
                            {roomData.isPlaying && index === 0 && (
                              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-orange-400 rounded animate-pulse opacity-30 -z-10"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-1 mb-1 text-gray-100">
                              {song.snippet.title}
                            </h4>
                            <p className="text-xs text-gray-400 mb-1">
                              {song.snippet.channelTitle}
                            </p>
                            <p className="text-xs text-gray-500">
                              Added by {song.addedBy}
                            </p>
                          </div>

                          {/* Vote Controls */}
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <Button
                                size="sm"
                                variant={hasUpvoted ? "default" : "ghost"}
                                onClick={() => handleVote(songId, "up")}
                                className={`h-6 w-6 p-0 ${hasUpvoted ? "bg-green-600 hover:bg-green-700" : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"}`}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <span
                                className={`text-xs font-medium ${
                                  song.votes > 0
                                    ? "text-green-400"
                                    : song.votes < 0
                                      ? "text-red-400"
                                      : "text-gray-400"
                                }`}
                              >
                                {song.votes}
                              </span>
                              <Button
                                size="sm"
                                variant={hasDownvoted ? "destructive" : "ghost"}
                                onClick={() => handleVote(songId, "down")}
                                className={`h-6 w-6 p-0 ${hasDownvoted ? "bg-red-600 hover:bg-red-700" : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"}`}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Queue Position */}
                            <div className="flex flex-col items-center gap-1">
                              <Badge
                                variant={index === 0 ? "default" : "secondary"}
                                className={`text-xs ${index === 0 ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-300"}`}
                              >
                                #{index + 1}
                              </Badge>
                              {index === 0 && (
                                <span className="text-xs text-cyan-400 font-medium">
                                  Next
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <YouTubeSearch roomId={roomId} onAddToQueue={addToQueue} />

            {/* Members */}
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between text-gray-100">
                  Room Members
                  <Badge
                    variant="secondary"
                    className="bg-gray-700 text-gray-200"
                  >
                    {roomData.members.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {roomData.members.map((memberId, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-200">
                          {memberId === userId ? "You" : memberId}
                        </span>
                        {memberId === roomData.creator && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-cyan-600 text-white"
                          >
                            Creator
                          </Badge>
                        )}
                        {isUserSyncing(memberId) && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-green-600 text-white"
                          >
                            Syncing
                          </Badge>
                        )}
                        {getSyncLeader() === memberId && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-orange-600 text-white"
                          >
                            Leader
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Sync play toggle for each member */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserSyncPlay(memberId)}
                          className={`h-6 w-6 p-0 ${
                            isUserSyncing(memberId)
                              ? "text-green-400 hover:text-green-300"
                              : "text-gray-400 hover:text-gray-200"
                          } hover:bg-gray-700`}
                          title={
                            isUserSyncing(memberId)
                              ? "Disable sync play"
                              : "Enable sync play"
                          }
                        >
                          {isUserSyncing(memberId) ? (
                            <Wifi className="h-3 w-3" />
                          ) : (
                            <WifiOff className="h-3 w-3" />
                          )}
                        </Button>
                        {/* Remove member button (only for creator) */}
                        {isCreator && memberId !== userId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMember(memberId)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-gray-700"
                          >
                            <UserMinus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sync Play Status */}
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-100">
                  <Users className="h-5 w-5 text-cyan-400" />
                  Sync Play Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Synced Users:</span>
                    <Badge variant="default" className="bg-cyan-600 text-white">
                      {getSyncedUsers().length}
                    </Badge>
                  </div>

                  {getSyncLeader() && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">
                        Sync Leader:
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-orange-600 text-white"
                      >
                        {getSyncLeader() === userId ? "You" : getSyncLeader()}
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">
                      Users with sync play enabled can control playback and will
                      sync with the leader.
                    </p>
                    <p className="text-xs text-gray-500">
                      • Creator can always control
                      <br />
                      • Members can control when syncing
                      <br />• Sync leader controls the timeline for others
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleUserSyncPlay(userId)}
                      className={`w-full bg-transparent border-gray-600 hover:bg-gray-700 ${
                        isUserSyncing(userId)
                          ? "text-green-400 border-green-600"
                          : "text-gray-300"
                      }`}
                    >
                      {isUserSyncing(userId) ? (
                        <>
                          <WifiOff className="h-4 w-4 mr-2" />
                          Disable Your Sync
                        </>
                      ) : (
                        <>
                          <Wifi className="h-4 w-4 mr-2" />
                          Enable Your Sync
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
