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

export interface PlaylistConfig {
  loop: boolean;
  shuffle: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  transitionEffect: TransitionType;
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
  data?: any;
}

// 补充缺失的类型定义
export interface VideoMetadata {
  // 可以根据实际需求添加视频元数据字段
  resolution?: string;
  codec?: string;
  bitrate?: number;
  creationDate?: string;
  [key: string]: any;
}

export interface VideoConfig {
  // 视频配置相关字段
  crossfade: boolean;
  crossfadeDuration: number;
  loop: boolean;
  shuffle: boolean;
  transitionEffect: TransitionType;
  defaultVolume?: number;
  autoplay?: boolean;
  playNextAutomatically?: boolean;
  [key: string]: any;
}

export interface DisplayConfig {
  // 显示配置相关字段
  fullscreen: boolean;
  alwaysOnTop: boolean;
  resolution: string;
  theme?: string;
  subtitlesEnabled?: boolean;
  interfaceScale?: number;
  [key: string]: any;
}

export interface PerformanceConfig {
  // 性能配置相关字段
  cacheSize: number;
  maxFPS: number;
  hardwareAcceleration: boolean;
  enablePreloading: boolean;
  maxResolution?: string;
  [key: string]: any;
}

export interface AudioConfig {
  // 音频配置相关字段
  volume: number;
  mute: boolean;
  visualization: boolean;
  outputDevice?: string;
  audioBalance?: number;
  equalizerSettings?: Record<string, number>;
  [key: string]: any;
}