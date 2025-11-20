// 核心类型定义
export interface VideoItem {
  id: string;
  path: string;
  name: string;
  duration: number;
  fileSize: number;
  format: string;
  thumbnail?: string;
  metadata?: VideoMetadata;
}

export interface VideoMetadata {
  width?: number;
  height?: number;
  bitrate?: number;
  codec?: string;
}

export interface PlaylistConfig {
  loop: boolean;
  shuffle: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  transitionEffect: TransitionType;
}

export interface VideoConfig {
  crossfade: boolean;
  crossfadeDuration: number;
  loop: boolean;
  shuffle: boolean;
  transitionEffect: TransitionType;
}

export interface DisplayConfig {
  fullscreen: boolean;
  alwaysOnTop: boolean;
  resolution: string;
}

export interface PerformanceConfig {
  cacheSize: number;
  maxFPS: number;
  hardwareAcceleration: boolean;
  enablePreloading: boolean;
}

export interface AudioConfig {
  volume: number;
  mute: boolean;
  visualization: boolean;
}

export interface AppConfig {
  video: VideoConfig;
  display: DisplayConfig;
  performance: PerformanceConfig;
  audio: AudioConfig;
}

export type TransitionType =
  | 'CROSSFADE'
  | 'SLIDE'
  | 'ZOOM'
  | 'PARTICLE'
  | 'GLITCH';

// 状态管理类型
export type PlayerState =
  | 'IDLE'
  | 'LOADING'
  | 'BUFFERING'
  | 'PLAYING'
  | 'PAUSED'
  | 'TRANSITIONING'
  | 'ERROR';

// 事件类型
export interface VideoEvent {
  type: string;
  videoId: string;
  timestamp: number;
  data?: unknown;
}

// 性能监控类型
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

export interface PerformanceReport {
  averageFPS: number;
  frameTimeVariance: number;
  memoryUsage?: NodeJS.MemoryUsage;
  metrics: PerformanceMetric[];
}