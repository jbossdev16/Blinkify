"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Konva from "konva";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Ellipse,
  Text,
  Image as KonvaImage,
  Star,
  Line,
  Arrow,
  RegularPolygon,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import { useStudio } from "./studio-context";
import { PAGE_WIDTH, PAGE_HEIGHT } from "./studio-context";
import type { StudioNode, ImageNode, TextNode, LineNode, RegularPolygonNode } from "./types";

function ImageNodeItem({
  node,
  onSelect,
  setRef,
  onDragEnd,
  onTransformEnd,
}: {
  node: ImageNode;
  onSelect: () => void;
  setRef: (id: string, r: Konva.Node | null) => void;
  onDragEnd: (id: string, attrs: Partial<StudioNode>) => void;
  onTransformEnd: (id: string, attrs: Partial<StudioNode>) => void;
}) {
  const [img] = useImage(node.src, "anonymous");
  const ref = useRef<Konva.Image>(null);
  useEffect(() => {
    if (ref.current) setRef(node.id, ref.current);
  }, [node.id, setRef]);
  const handlePointer = () => {
    onSelect();
  };
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const t = e.target;
    onDragEnd(node.id, { x: t.x(), y: t.y() });
  };
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const t = e.target;
    onTransformEnd(node.id, {
      x: t.x(),
      y: t.y(),
      width: t.width() * (t.scaleX() ?? 1),
      height: t.height() * (t.scaleY() ?? 1),
      scaleX: 1,
      scaleY: 1,
      rotation: t.rotation(),
    });
  };
  return (
    <KonvaImage
      ref={ref}
      image={img}
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      rotation={node.rotation ?? 0}
      scaleX={node.scaleX ?? 1}
      scaleY={node.scaleY ?? 1}
      draggable={!node.locked}
      listening={true}
      onClick={(e) => {
        e.cancelBubble = true;
        handlePointer();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        handlePointer();
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    />
  );
}

function NodeShape({
  node,
  onSelect,
  setRef,
  onDragEnd,
  onTransformEnd,
}: {
  node: StudioNode;
  onSelect: () => void;
  setRef: (id: string, r: Konva.Node | null) => void;
  onDragEnd: (id: string, attrs: Partial<StudioNode>) => void;
  onTransformEnd: (id: string, attrs: Partial<StudioNode>) => void;
}) {
  const shapeRef = useRef<Konva.Node>(null);
  useEffect(() => {
    if (shapeRef.current) setRef(node.id, shapeRef.current);
  }, [node.id, setRef]);

  const common = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation ?? 0,
    scaleX: node.scaleX ?? 1,
    scaleY: node.scaleY ?? 1,
    draggable: !node.locked,
    onClick: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      onSelect();
    },
    onTap: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      onSelect();
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const t = e.target;
      onDragEnd(node.id, { x: t.x(), y: t.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const t = e.target;
      onTransformEnd(node.id, {
        x: t.x(),
        y: t.y(),
        width: t.width() * (t.scaleX() ?? 1),
        height: t.height() * (t.scaleY() ?? 1),
        scaleX: 1,
        scaleY: 1,
        rotation: t.rotation(),
      });
    },
  };

  if (node.type === "rect") {
    return (
      <Rect
        ref={shapeRef as React.RefObject<Konva.Rect>}
        {...common}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth}
      />
    );
  }
  if (node.type === "ellipse") {
    return (
      <Ellipse
        ref={shapeRef as React.RefObject<Konva.Ellipse>}
        {...common}
        offsetX={node.width / 2}
        offsetY={node.height / 2}
        radiusX={node.width / 2}
        radiusY={node.height / 2}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth}
      />
    );
  }
  if (node.type === "text") {
    const tn = node as TextNode;
    return (
      <Text
        ref={shapeRef as React.RefObject<Konva.Text>}
        {...common}
        text={tn.text}
        fontSize={tn.fontSize ?? 24}
        fontFamily={tn.fontFamily ?? "sans-serif"}
        fontStyle={tn.fontStyle}
        fill={tn.fill ?? "#000"}
        listening={true}
      />
    );
  }
  if (node.type === "image") {
    return (
      <ImageNodeItem
        node={node as ImageNode}
        onSelect={onSelect}
        setRef={setRef}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
      />
    );
  }
  if (node.type === "star") {
    return (
      <Star
        ref={shapeRef as React.RefObject<Konva.Star>}
        {...common}
        numPoints={5}
        innerRadius={node.height / 4}
        outerRadius={node.height / 2}
        offsetX={node.width / 2}
        offsetY={node.height / 2}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth}
      />
    );
  }
  if (node.type === "line") {
    const ln = node as LineNode;
    const isArrow =
      (ln.pointerLength != null && ln.pointerLength > 0) ||
      (ln.pointerWidth != null && ln.pointerWidth > 0);
    const lineProps = {
      points: ln.points,
      tension: ln.tension ?? 0,
      lineCap: (ln.lineCap as "butt" | "round" | "square") ?? "round",
      lineJoin: (ln.lineJoin as "miter" | "round" | "bevel") ?? "round",
      stroke: ln.stroke ?? "#000",
      strokeWidth: ln.strokeWidth ?? 2,
      fill: isArrow ? ln.stroke ?? "#000" : undefined,
      draggable: !node.locked,
      ref: shapeRef as React.RefObject<Konva.Line>,
      onClick: (e: Konva.KonvaEventObject<Event>) => {
        e.cancelBubble = true;
        onSelect();
      },
      onTap: (e: Konva.KonvaEventObject<Event>) => {
        e.cancelBubble = true;
        onSelect();
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const t = e.target;
        onDragEnd(node.id, { x: t.x(), y: t.y() });
      },
    };
    if (isArrow) {
      return (
        <Arrow
          {...lineProps}
          ref={shapeRef as React.RefObject<Konva.Arrow>}
          pointerLength={ln.pointerLength ?? 10}
          pointerWidth={ln.pointerWidth ?? 10}
          pointerAtBeginning={ln.pointerAtBeginning ?? false}
          pointerAtEnding={ln.pointerAtEnding ?? true}
        />
      );
    }
    return <Line {...lineProps} />;
  }
  if (node.type === "regularPolygon") {
    const pn = node as RegularPolygonNode;
    const radius = Math.min(node.width, node.height) / 2;
    return (
      <RegularPolygon
        ref={shapeRef as React.RefObject<Konva.RegularPolygon>}
        {...common}
        offsetX={node.width / 2}
        offsetY={node.height / 2}
        sides={pn.sides}
        radius={radius}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth}
      />
    );
  }
  return null;
}

export function StudioCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const {
    nodes,
    selectedIds,
    setSelection,
    setStageSize,
    updateNode,
    zoom,
    registerExportCanvas,
  } = useStudio();
  const layerRef = useRef<Konva.Layer>(null);
  const [isExporting, setIsExporting] = useState(false);

  const doExport = useCallback(() => {
    setIsExporting(true);
  }, []);

  useEffect(() => {
    registerExportCanvas(doExport);
    return () => registerExportCanvas(null);
  }, [registerExportCanvas, doExport]);

  useEffect(() => {
    if (!isExporting) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!layerRef.current) {
          setIsExporting(false);
          return;
        }
        try {
          const dataUrl = layerRef.current.toDataURL({
            x: 0,
            y: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            pixelRatio: 1,
          });
          const link = document.createElement("a");
          link.download = "design.png";
          link.href = dataUrl;
          link.click();
        } finally {
          setIsExporting(false);
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [isExporting]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 800, height: 600 };
      setSize({ width, height });
      setStageSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setStageSize]);

  useEffect(() => {
    if (!transformerRef.current) return;
    const refs = selectedIds.map((id) => nodeRefs.current[id]).filter((r): r is Konva.Node => r != null);
    transformerRef.current.nodes(refs);
  }, [selectedIds, nodes.length]);

  const setNodeRef = useCallback((id: string, r: Konva.Node | null) => {
    nodeRefs.current[id] = r;
  }, []);

  const handleDragEnd = useCallback(
    (id: string, attrs: Partial<StudioNode>) => {
      updateNode(id, attrs);
    },
    [updateNode]
  );

  const handleTransformEnd = useCallback(
    (id: string, attrs: Partial<StudioNode>) => {
      updateNode(id, attrs);
    },
    [updateNode]
  );

  const stageScale = zoom;
  const stageX = size.width / 2 - (PAGE_WIDTH * stageScale) / 2;
  const stageY = size.height / 2 - (PAGE_HEIGHT * stageScale) / 2;

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      if (e.target === e.target.getStage()) setSelection([]);
    },
    [setSelection]
  );

  return (
    <div ref={containerRef} className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
      <Stage
        width={size.width}
        height={size.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stageX}
        y={stageY}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer ref={layerRef}>
          <Group x={0} y={0}>
            <Rect
              width={PAGE_WIDTH}
              height={PAGE_HEIGHT}
              fill="white"
              stroke="#2563eb"
              strokeWidth={2}
              listening={false}
            />
            {nodes.map((node) => (
              <NodeShape
                key={node.id}
                node={node}
                onSelect={() =>
                  setSelection(selectedIds.includes(node.id) ? [] : [node.id])
                }
                setRef={setNodeRef}
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
              />
            ))}
            {selectedIds.length > 0 && !isExporting && (
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
