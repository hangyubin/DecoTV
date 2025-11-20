import type { AppConfig } from './types';

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
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(process.cwd(), 'config.json');
        
        if (fs.existsSync(configPath)) {
          const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          this.config = this.mergeConfigs(defaultConfig, saved);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    
    return this.config;
  }

  async saveConfig(updates: Partial<AppConfig>): Promise<void> {
    this.config = this.mergeConfigs(this.config, updates);
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('decoTV-config', JSON.stringify(this.config));
      } else {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(process.cwd(), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      }
      
      // 通知监听器
      this.listeners.forEach(listener => listener(this.config));
    } catch (error) {
      console.error('Failed to save config:', error);
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

  private mergeConfigs(target: AppConfig, source: any): AppConfig {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key as keyof AppConfig] = this.mergeConfigs(
          result[key as keyof AppConfig] as any,
          source[key]
        ) as any;
      } else if (source[key] !== undefined) {
        result[key as keyof AppConfig] = source[key];
      }
    }
    
    return result;
  }
}

export const configManager = new ConfigManager();