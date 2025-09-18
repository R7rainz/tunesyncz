"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Music } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user was in a room and redirect
    const savedRoom = localStorage.getItem("currentRoom");
    if (savedRoom) {
      router.push(`/room/${savedRoom}`);
      return;
    }

    // Redirect to dashboard
    router.push("/dashboard");
  }, [router]);

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
          Redirecting to TuneSyncz...
        </p>
      </div>
    </div>
  );
}
