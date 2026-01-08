// Types for DTM Filter Tool

export interface DTMFilterParams {
  sensitivityMultiplier: number; // 0.5-3.0, default 1.0
  numberOfIterations: number; // 50-500, default 200
}

export interface DTMFilterConfig extends DTMFilterParams {
  baseThreshold: number; // meters, default 0.5
  slopeFactor: number; // default 0.05
  wMin: number; // min window size, default 3
  wMax: number; // max window size, default 51
}

export interface GeoTIFFMetadata {
  width: number;
  height: number;
  data: Float32Array | Int16Array | Uint16Array;
  noDataValue: number | null;
  pixelScale: [number, number, number]; // ModelPixelScale
  modelTiepoint: [number, number, number, number, number, number]; // ModelTiepoint
  geoKeys: any;
  fileDirectory: any;
  crs: string | null;
}

export interface WorkerMessage {
  type: 'process' | 'progress' | 'complete' | 'error';
  data?: any;
  progress?: number;
  error?: string;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  percentage: number;
  stage: string;
}












