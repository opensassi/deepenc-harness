export interface GlobalOptions {
  config?: string;
  verbose: boolean;
  output: 'text' | 'json' | 'csv';
}

export interface BuildOptions {
  variant: string;
  static: boolean;
  clean: boolean;
  jobs?: number;
  test: boolean;
  ml?: boolean;
}

export interface TestOptions {
  variant: string;
  static: boolean;
}

export type MlSubcommand =
  | 'data-generate'
  | 'data-split'
  | 'train'
  | 'encode'
  | 'bench'
  | 'sweep'
  | 'feedback';

export interface MlOptions {
  subcommand: MlSubcommand;
  scriptPath?: string;
  vvencappPath?: string;
  clipPath?: string;
  clip?: ClipSpec;
  clips?: ClipSpec[];
  qp?: number;
  qps?: number[];
  trainRatio?: number;
  confidence?: number;
  thns?: number;
  topk?: number;
  thresholds?: number[];
  modelDir?: string;
  dataDir?: string;
  clipWidth?: number;
  clipHeight?: number;
  clipFps?: number;
  clipFrames?: number;
  preset?: string;
}

export interface ClipSpec {
  path: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  frames?: number;
  preset?: string;
}

export interface DataGenerateReport {
  clipResults: Record<string, { csvPath: string; rows: number }>;
  totalRows: number;
}

export interface DataSplitReport {
  trainPath: string;
  valPath: string;
  trainRows: number;
  valRows: number;
}

export interface TrainReport {
  models: string[];
  perSplitAuc: Record<string, number>;
}

export interface EncodeReport {
  encodingTimeMs: number;
  mlSkipRate: number;
  avgConfidence: number;
  bitrate: number;
  psnr: number;
}

export interface BenchReport {
  baseline: EncodeReport;
  ml: EncodeReport;
  speedupPercent: number;
  bdRate: number;
}

export interface SweepReport {
  results: Record<number, BenchReport>;
}

export interface FeedbackReport {
  mispredictions: number;
  augmentedRows: number;
  trainReport: TrainReport;
}
