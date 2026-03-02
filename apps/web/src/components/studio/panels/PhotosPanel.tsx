"use client";

import type { ImageNode } from "../types";
import { useStudio } from "../studio-context";
import { PAGE_WIDTH, PAGE_HEIGHT } from "../studio-context";
import { PHOTOS_LIST, getPhotoUrl } from "./photos-data";

const THUMB_SIZE = 120;
const ADD_WIDTH = 400;
const ADD_HEIGHT = 300;

export function PhotosPanel() {
  const { addNode } = useStudio();

  function addPhoto(src: string, w: number, h: number) {
    const image: Omit<ImageNode, "id"> = {
      type: "image",
      x: PAGE_WIDTH / 2 - w / 2,
      y: PAGE_HEIGHT / 2 - h / 2,
      width: w,
      height: h,
      src,
    };
    addNode(image);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <p className="text-sm text-muted-foreground p-4 pb-2 shrink-0">
        Click a photo to add to canvas.
      </p>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {PHOTOS_LIST.map((img) => (
            <button
              key={img.seed}
              type="button"
              onClick={() =>
                addPhoto(getPhotoUrl(img.seed, ADD_WIDTH, ADD_HEIGHT), ADD_WIDTH, ADD_HEIGHT)
              }
              className="rounded-lg border border-border overflow-hidden aspect-square hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <img
                src={getPhotoUrl(img.seed, THUMB_SIZE, THUMB_SIZE)}
                alt={img.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
