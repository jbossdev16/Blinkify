export type LeftPanelTab =
  | "templates"
  | "text"
  | "photos"
  | "elements"
  | "draw"
  | "upload";

export type NodeType = "rect" | "ellipse" | "text" | "image" | "star" | "line" | "regularPolygon";

export interface BaseNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  draggable?: boolean;
  locked?: boolean;
}

export interface TextNode extends BaseNode {
  type: "text";
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
}

export interface ImageNode extends BaseNode {
  type: "image";
  src: string;
}

export interface LineNode extends BaseNode {
  type: "line";
  points: number[];
  tension?: number;
  lineCap?: string;
  lineJoin?: string;
  pointerLength?: number;
  pointerWidth?: number;
  pointerAtBeginning?: boolean;
  pointerAtEnding?: boolean;
}

export interface RegularPolygonNode extends BaseNode {
  type: "regularPolygon";
  sides: number;
}

export type StudioNode = BaseNode | TextNode | ImageNode | LineNode | RegularPolygonNode;

export interface TemplateItem {
  id: string;
  name: string;
  thumbnail: string;
  width: number;
  height: number;
  nodes?: StudioNode[];
}
