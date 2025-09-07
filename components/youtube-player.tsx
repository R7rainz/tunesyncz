"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Users,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";

interface YouTubePlayerProps {
  currentSong: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  syncPlay: boolean;
  isCreator: boolean;
  roomId: string;
  syncedTime?: number;
  lastSyncUpdate?: number;
  // New per-user sync props
  memberSyncStates?: Record<string, boolean>;
  syncLeader?: string;
  userId?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubePlayer({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onSeek,
  syncPlay,
  isCreator,
  roomId,
  syncedTime = 0,
  lastSyncUpdate = 0,
  memberSyncStates = {},
  syncLeader,
  userId,
}: YouTubePlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isUserSeeking, setIsUserSeeking] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState(-1);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(0);
  const apiLoadedRef = useRef(false);

  // Load YouTube API
  useEffect(() => {
    if (apiLoadedRef.current) return;

    if (typeof window !== "undefined" && !window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setApiReady(true);
        apiLoadedRef.current = true;
      };
    } else if (window.YT) {
      setApiReady(true);
      apiLoadedRef.current = true;
    }
  }, []);

  // Initialize player when API is ready and we have a song
  useEffect(() => {
    if (!apiReady || !currentSong) return;

    const newVideoId = currentSong.id.videoId;

    // Only create new player if video ID changed
    if (newVideoId !== currentVideoId) {

      // Clean up existing player
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error("[YouTube] Error destroying player:", error);
        }
      }

      setCurrentVideoId(newVideoId);
      setPlayerReady(false);
      setCurrentTime(0);
      setDuration(0);

      // Create new player
      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          height: "200",
          width: "300",
          videoId: newVideoId,
          playerVars: {
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              setPlayerReady(true);

              try {
                const videoDuration = event.target.getDuration();
                if (videoDuration > 0) {
                  setDuration(videoDuration);
                }
                event.target.setVolume(volume);

                // Seek to synced position immediately on ready
                if (typeof syncedTime === "number" && syncedTime > 0) {
                  try {
                    event.target.seekTo(syncedTime, true);
                    setCurrentTime(syncedTime);
                  } catch (err) {
                    console.error("[YouTube] Error seeking onReady:", err);
                  }
                }

                // Set initial playback state
                if (isPlaying) {
                  event.target.playVideo();
                } else {
                  event.target.pauseVideo();
                }
              } catch (error) {
                console.error("[YouTube] Error in onReady:", error);
              }
            },
            onStateChange: (event: any) => {
              const newState = event.data;
              setPlayerState(newState);

              // Handle video end (only leader or creator triggers next)
              if (newState === window.YT.PlayerState.ENDED) {
                const isUserSyncing = userId ? (memberSyncStates[userId] || false) : false;
                const canControl = isCreator || isUserSyncing;
                if (canControl) {
                  setTimeout(() => {
                    onNext();
                  }, 300);
                }
              }
            },
            onError: (event: any) => {
              console.error("[YouTube] Player error:", event.data);
            },
          },
        });
      } catch (error) {
        console.error("[YouTube] Error creating player:", error);
      }
    }
  }, [apiReady, currentSong, currentVideoId]);

  // Control playback based on isPlaying prop
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    const controlPlayback = () => {
      try {
        const currentState = playerRef.current.getPlayerState();

        if (isPlaying && currentState !== window.YT.PlayerState.PLAYING) {
          playerRef.current.playVideo();
        } else if (
          !isPlaying &&
          currentState === window.YT.PlayerState.PLAYING
        ) {
          playerRef.current.pauseVideo();
        }
      } catch (error) {
        console.error("[YouTube] Error controlling playback:", error);
      }
    };

    // Small delay to prevent rapid state changes; also re-apply on window focus
    const timeout = setTimeout(controlPlayback, 120);
    const onFocus = () => controlPlayback();
    const onVisibility = () => controlPlayback();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isPlaying, playerReady]);

  // Update current time when playing
  useEffect(() => {
    if (
      playerReady &&
      playerRef.current &&
      playerState === window.YT.PlayerState.PLAYING
    ) {
      intervalRef.current = setInterval(() => {
        try {
          const time = playerRef.current.getCurrentTime();
          if (typeof time === "number" && !isNaN(time)) {
            setCurrentTime(time);
            
            // If user is the sync leader, update synced time for others
            const isUserLeader = syncLeader === userId;
            if (isUserLeader && userId) {
              // Send time update every 2 seconds for sync
              if (Math.floor(time) % 2 === 0) {
                onSeek(time);
              }
            }
          }
        } catch (error) {
          console.error("[YouTube] Error getting current time:", error);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playerReady, playerState, syncLeader, userId, onSeek]);

  // Handle sync time updates - sync if user is syncing and not the leader
  useEffect(() => {
    if (!playerReady || !playerRef.current || !userId) return;

    const isUserSyncing = memberSyncStates[userId] || false;
    const isUserLeader = syncLeader === userId;
    
    // Always compute fresh current time to avoid stale state when paused
    let playerTime = currentTime;
    try {
      const t = playerRef.current.getCurrentTime();
      if (typeof t === "number" && !isNaN(t)) playerTime = t;
    } catch {}

    const shouldSync =
      isUserSyncing &&
      !isUserLeader &&
      syncedTime >= 0 &&
      lastSyncUpdate > 0 &&
      Math.abs(playerTime - syncedTime) > 0.35 &&
      !isUserSeeking;

    if (shouldSync) {
      try {
        playerRef.current.seekTo(syncedTime, true);
        // Ensure we don't auto-resume if room says paused
        if (!isPlaying) {
          playerRef.current.pauseVideo();
        }
      } catch (error) {
        console.error("[YouTube] Error syncing:", error);
      }
    }
  }, [
    syncedTime,
    lastSyncUpdate,
    playerReady,
    memberSyncStates,
    syncLeader,
    userId,
    isPlaying,
    isUserSeeking,
    currentTime,
  ]);

  // Handle playback state sync - sync play/pause with leader
  useEffect(() => {
    if (!playerReady || !playerRef.current || !userId) return;

    const isUserSyncing = memberSyncStates[userId] || false;
    const isUserLeader = syncLeader === userId;
    
    // If user is syncing and not the leader, sync playback state
    if (isUserSyncing && !isUserLeader) {
      try {
        const currentState = playerRef.current.getPlayerState();
        
        if (isPlaying && currentState !== window.YT.PlayerState.PLAYING) {
          playerRef.current.playVideo();
        } else if (!isPlaying && currentState === window.YT.PlayerState.PLAYING) {
          playerRef.current.pauseVideo();
        }
      } catch (error) {
        console.error("[YouTube] Error syncing playback state:", error);
      }
    }
  }, [isPlaying, playerReady, memberSyncStates, syncLeader, userId]);

  // Handle volume changes
  useEffect(() => {
    if (playerReady && playerRef.current) {
      try {
        playerRef.current.setVolume(isMuted ? 0 : volume);
      } catch (error) {
        console.error("[YouTube] Error setting volume:", error);
      }
    }
  }, [volume, isMuted, playerReady]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setIsUserSeeking(true);
    setCurrentTime(newTime);

    if (playerReady && playerRef.current) {
      try {
        playerRef.current.seekTo(newTime, true);
      } catch (error) {
        console.error("[YouTube] Error seeking:", error);
      }
    }

    if (canControl) {
      onSeek(newTime);
    } else {
    }

    setTimeout(() => setIsUserSeeking(false), 1000);
  };

  const handlePlayPause = () => {
    if (canControl) {
      onPlayPause();
    } else {
    }
  };

  const handleNext = () => {
    if (canControl) {
      onNext();
    } else {
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // New sync play logic - user can control if they're the creator or have sync enabled
  const isUserSyncing = userId ? (memberSyncStates[userId] || false) : false;
  const canControl = isCreator || isUserSyncing;

  if (!currentSong) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <Play className="h-5 w-5" />
            Now Playing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No song playing</p>
            <p className="text-sm">Add songs to the queue to start playing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      {/* Hidden YouTube player */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          width: "300px",
          height: "200px",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <Card className="bg-gray-900/80 border-gray-700 backdrop-blur-sm relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-100">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Now Playing
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={isUserSyncing ? "default" : "secondary"}
                className="flex items-center gap-1 bg-gray-800 text-gray-200 border-gray-600"
              >
                {isUserSyncing ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    <Users className="h-3 w-3" />
                    Syncing
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <User className="h-3 w-3" />
                    {isCreator ? "Creator" : "Viewer"}
                  </>
                )}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative">
              <img
                src={
                  currentSong.snippet.thumbnails.medium.url ||
                  "/placeholder.svg"
                }
                alt={currentSong.snippet.title}
                className="w-16 h-16 object-cover rounded border border-gray-700"
              />
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-cyan-400 animate-pulse"></div>
                    <div
                      className="w-1 h-4 bg-cyan-400 animate-pulse"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-1 h-3 bg-cyan-400 animate-pulse"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium line-clamp-2 mb-1 text-gray-100">
                {currentSong.snippet.title}
              </h4>
              <p className="text-sm text-gray-400">
                {currentSong.snippet.channelTitle}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              disabled={!canControl}
              className={`w-full ${!canControl ? "opacity-50" : ""}`}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handlePlayPause}
                disabled={!canControl}
                variant={canControl ? "default" : "secondary"}
                className={
                  canControl
                    ? "bg-cyan-600 hover:bg-cyan-700"
                    : "bg-gray-700 text-gray-400"
                }
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNext}
                disabled={!canControl}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleMute}
                className="text-gray-400 hover:text-gray-200 hover:bg-gray-700"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          </div>

          {!canControl && (
            <div className="text-center text-xs text-gray-500 p-2 bg-gray-800/50 rounded">
              {isCreator 
                ? "You are the room creator" 
                : "Enable sync play to control playback"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
