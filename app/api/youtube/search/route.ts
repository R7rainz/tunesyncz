import { type NextRequest, NextResponse } from "next/server"
import { mockResults } from "@/app/api/youtube/search/mock"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const maxResults = searchParams.get("maxResults") || "10"
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API key not configured" }, { status: 500 })
  }

  try {
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`

    const response = await fetch(youtubeUrl)

    if (!response.ok) {
      console.warn("YouTube API failed, using mock data")
      return getMockResults(query, maxResults)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.warn("YouTube API error, using mock data:", error)
    return getMockResults(query, maxResults)
  }
}

function getMockResults(query: string, maxResults: string) {
  // Filter results based on query
  const filteredResults = mockResults.filter(
    (result) =>
      result.snippet.title.toLowerCase().includes(query.toLowerCase()) ||
      result.snippet.channelTitle.toLowerCase().includes(query.toLowerCase()),
  )

  return NextResponse.json({
    items: filteredResults.slice(0, Number.parseInt(maxResults)),
  })
}
