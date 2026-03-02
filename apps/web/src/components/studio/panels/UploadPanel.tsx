"use client";

import { useRef } from "react";
import { CloudUpload } from "lucide-react";
import type { ImageNode } from "../types";
import { useStudio } from "../studio-context";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../studio-context";

export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { addNode } = useStudio();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const src = URL.createObjectURL(file);
    const image: Omit<ImageNode, "id"> = {
      type: "image",
      x: PAGE_WIDTH / 2 - 200,
      y: PAGE_HEIGHT / 2 - 150,
      width: 400,
      height: 300,
      src,
    };
    addNode(image);
    e.target.value = "";
  }

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-muted-foreground">Upload an image to add to the canvas.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-border hover:border-blue-400 hover:bg-blue-50/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        <CloudUpload className="size-10" />
        <span className="text-sm font-medium">Choose file</span>
      </button>
    </div>
  );
}
