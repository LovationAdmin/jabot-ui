"use client";

import { useState, useRef } from "react";
import { MediaFile } from "@/lib/types";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface PhotoUploadProps {
  photos: MediaFile[];
  maxPhotos?: number;
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function PhotoUpload({
  photos,
  maxPhotos = 3,
  onAdd,
  onRemove,
  disabled = false,
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canAdd = photos.length < maxPhotos;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file && file.type.startsWith("image/")) {
      onAdd(file);
    }
    // Reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canAdd || disabled) return;

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      onAdd(file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        {/* Existing photos */}
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-border group"
          >
            <Image
              src={photo.url}
              alt="Photo"
              fill
              className="object-cover"
              sizes="80px"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {photo.order === 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-white text-center text-[10px] py-0.5">
                Principale
              </div>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {canAdd && !disabled && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-20 h-20 rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/60 hover:bg-accent"
            )}
          >
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground text-center leading-tight">
              Ajouter
            </span>
          </div>
        )}
      </div>

      {canAdd && !disabled && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs"
          >
            <Upload className="w-3 h-3 mr-1.5" />
            Ajouter une photo
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            {photos.length}/{maxPhotos} photos · JPG, PNG, WebP
          </p>
        </div>
      )}

      {photos.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucune photo</p>
      )}
    </div>
  );
}
