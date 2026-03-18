export type ThemeMode = "light" | "dark";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CaptureResponse = {
  imageBase64: string;
  width: number;
  height: number;
  platformNote: string;
};

export type OcrResponse = {
  text: string;
  engine: string;
};

export type MonitorInfo = {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary: boolean;
};

export type HistoryItem = {
  id: string;
  imageBase64: string;
  text: string;
  date: string;
};

export type ToastState = {
  kind: "hidden" | "success" | "error";
  message: string;
};
