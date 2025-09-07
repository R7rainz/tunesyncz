"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Play, Clock, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface YouTubeVideo {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    description: string
    thumbnails: {
      medium: { url: string }
      high: { url: string }
    }
    publishedAt: string
  }
}

interface YouTubeSearchProps {
  roomId: string
  onAddToQueue: (video: YouTubeVideo) => void
}

export function YouTubeSearch({ roomId, onAddToQueue }: YouTubeSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [addingVideos, setAddingVideos] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const searchYouTube = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}&maxResults=6`)
      const data = await response.json()

      if (response.ok) {
        setSearchResults(data.items || [])
        setHasSearched(true)
      } else {
        throw new Error(data.error || "Search failed")
      }
    } catch (error) {
      console.error("YouTube search error:", error)
      toast({
        title: "Search failed",
        description: "Unable to search YouTube. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddToQueue = async (video: YouTubeVideo) => {
    const videoId = video.id.videoId
    setAddingVideos((prev) => new Set(prev).add(videoId))

    // Simulate network delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    onAddToQueue(video)
    setAddingVideos((prev) => {
      const newSet = new Set(prev)
      newSet.delete(videoId)
      return newSet
    })

    toast({
      title: "Added to queue",
      description: `"${video.snippet.title}" has been added to the queue.`,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim() && !isSearching) {
      searchYouTube()
    }
  }

  const formatDuration = (publishedAt: string) => {
    const date = new Date(publishedAt)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return "Today"
    if (diffInDays === 1) return "Yesterday"
    if (diffInDays < 30) return `${diffInDays} days ago`
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`
    return `${Math.floor(diffInDays / 365)} years ago`
  }

  return (
    <Card className="transition-all duration-300 hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Search YouTube
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Search for songs, artists, or videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 transition-all duration-200 focus:scale-[1.01]"
            disabled={isSearching}
          />
          <Button
            onClick={searchYouTube}
            disabled={isSearching || !searchQuery.trim()}
            className="transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
                <p className="text-sm">Try different search terms</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{searchResults.length} results found</p>
                {searchResults.map((video, index) => {
                  const isAdding = addingVideos.has(video.id.videoId)

                  return (
                    <div
                      key={video.id.videoId}
                      className="flex gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all duration-300 hover:scale-[1.01] group animate-in fade-in-0 slide-in-from-left-4"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Thumbnail */}
                      <div className="relative flex-shrink-0 overflow-hidden rounded">
                        <img
                          src={video.snippet.thumbnails.medium.url || "/placeholder.svg"}
                          alt={video.snippet.title}
                          className="w-20 h-14 object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Play className="h-4 w-4 text-white" />
                        </div>
                      </div>

                      {/* Video Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                          {video.snippet.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">{video.snippet.channelTitle}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDuration(video.snippet.publishedAt)}
                          </Badge>
                        </div>
                      </div>

                      {/* Add Button */}
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleAddToQueue(video)}
                          className="h-8 transition-all duration-200 hover:scale-105 active:scale-95"
                          disabled={isAdding}
                        >
                          {isAdding ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!hasSearched && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Search YouTube to add songs</p>
            <p className="text-sm">Enter a song name, artist, or video title</p>
            <p className="text-xs mt-2 opacity-75">
              Press <kbd>Enter</kbd> to search
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
