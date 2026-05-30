"use client";

import { useState, useRef, useEffect } from "react";
import { MediaFile } from "@/lib/types";
import { Play, Pause, Volume2, SkipBack } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audio: MediaFile;
  compact?: boolean;
}

export function AudioPlayer({ audio, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audio.duration || 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const el = new Audio(audio.url);
    audioRef.current = el;

    el.addEventListener("loadedmetadata", () => {
      setDuration(el.duration);
      setIsLoading(false);
    });

    el.addEventListener("timeupdate", () => {
      setCurrentTime(el.currentTime);
    });

    el.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    el.addEventListener("loadstart", () => setIsLoading(true));
    el.addEventListener("canplay", () => setIsLoading(false));

    return () => {
      el.pause();
      el.src = "";
    };
  }, [audio.url]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrentTime(t);
  };

  const handleRestart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    setCurrentTime(0);
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
        <button
          onClick={togglePlay}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
            isPlaying
              ? "bg-primary text-white"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {isPlaying ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3 ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="w-full bg-border rounded-full h-1">
            <div
              className="bg-primary h-1 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatDuration(duration)}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Volume2 className={cn("w-5 h-5 text-primary", isPlaying && "audio-playing")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {audio.name || "Commentaire audio"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 rounded-full appearance-none bg-border cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(28,80%,45%) ${progress}%, hsl(38,20%,82%) ${progress}%)`,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleRestart}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm",
            isPlaying
              ? "bg-primary text-white hover:bg-primary/90"
              : "bg-primary text-white hover:bg-primary/90"
          )}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
