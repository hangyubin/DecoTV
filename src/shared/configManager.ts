import type { AppConfig } from './types';

// 移除 require 语句，使用动态导入
const loadNodeModules = async () => {
  if (typeof window === 'undefined') {
    const fs = await import('fs');
    const path = await import('path');
    return { fs, path };
  }
  return null;
};

const defaultConfig: AppConfig = {
  video: {
    crossfade: true,
    crossfadeDuration: 1000,
    loop: false,
    shuffle: false,
    transitionEffect: 'CROSSFADE'
  },
  display: {
    fullscreen: true,
    alwaysOnTop: false,
    resolution: 'auto'
  },
  performance: {
    cacheSize: 5,
    maxFPS: 60,
    hardwareAcceleration: true,
    enablePreloading: true
  },
  audio: {
    volume: 1,
    mute: false,
    visualization: true
  }
};

export class ConfigManager {
  private config: AppConfig = defaultConfig;
  private listeners: Array<(config: AppConfig) => void> = [];

  async loadConfig(): Promise<AppConfig> {
    try {
      // 从文件系统或 localStorage 加载配置
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('decoTV-config');
        if (saved) {
          this.config = this.mergeConfigs(defaultConfig, JSON.parse(saved));
        }
      } else {
        // 主进程中的配置加载
        const nodeModules = await loadNodeModules();
        if (nodeModules) {
          const { fs, path } = nodeModules;
          const configPath = path.join(process.cwd(), 'config.json');
          
          if (fs.existsSync(configPath)) {
            const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            this.config = this.mergeConfigs(defaultConfig, saved);
          }
        }
      }
    } catch (error) {
      // 使用更具体的错误处理
      this.handleError('Failed to load config', error);
    }
    
    return this.config;
  }

  async saveConfig(updates: Partial<AppConfig>): Promise<void> {
    this.config = this.mergeConfigs(this.config, updates);
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('decoTV-config', JSON.stringify(this.config));
      } else {
        const nodeModules = await loadNodeModules();
        if (nodeModules) {
          const { fs, path } = nodeModules;
          const configPath = path.join(process.cwd(), 'config.json');
          fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        }
      }
      
      // 通知监听器
      this.listeners.forEach(listener => listener(this.config));
    } catch (error) {
      this.handleError('Failed to save config', error);
    }
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  onUpdate(listener: (config: AppConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private mergeConfigs(target: AppConfig, source: unknown): AppConfig {
    const result = { ...target };
    
    if (source && typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          (result as Record<string, unknown>)[key] = this.mergeConfigs(
            (result as Record<string, unknown>)[key] as AppConfig,
            value
          );
        } else if (value !== undefined) {
          (result as Record<string, unknown>)[key] = value;
        }
      }
    }
    
    return result;
  }

  private handleError(message: string, error: unknown): void {
    // 在生产环境中可以发送到错误监控服务
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(message, error);
    }
  }
}

export const configManager = new ConfigManager();