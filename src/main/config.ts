/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

/**
 * 主进程配置管理
 * 注意：由于项目使用Next.js架构，此文件提供的是Electron-like主进程配置管理方案
 * 在实际的Next.js应用中，服务端配置应通过环境变量或配置文件结合server-side functions处理
 */

import { AppConfig } from '@/shared/types';
import { configManager } from '@/shared/configManager';
import fs from 'fs';
import path from 'path';

// 扩展配置管理功能，添加服务端特定的功能
export class ServerConfigManager {
  private configPath: string;

  constructor() {
    // 在Next.js中，推荐将配置文件放在public目录或使用环境变量
    this.configPath = path.join(process.cwd(), 'public', 'config.json');
  }

  // 初始化服务器配置
  async initializeConfig(): Promise<void> {
    try {
      // 确保配置目录存在
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 加载配置
      await configManager.loadConfig();
      console.log('Server configuration initialized');
    } catch (error) {
      console.error('Failed to initialize server configuration:', error);
    }
  }

  // 获取完整配置
  getConfig(): AppConfig {
    return configManager.getConfig();
  }

  // 更新配置
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    try {
      await configManager.saveConfig(updates);
      console.log('Server configuration updated successfully');
    } catch (error) {
      console.error('Failed to update server configuration:', error);
      throw error;
    }
  }

  // 重置配置到默认值
  async resetConfig(): Promise<void> {
    try {
      // 删除现有的配置文件
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
      // 重新加载默认配置
      await configManager.loadConfig();
      console.log('Server configuration reset to defaults');
    } catch (error) {
      console.error('Failed to reset server configuration:', error);
      throw error;
    }
  }

  // 导出配置
  async exportConfig(): Promise<string> {
    try {
      const config = configManager.getConfig();
      return JSON.stringify(config, null, 2);
    } catch (error) {
      console.error('Failed to export configuration:', error);
      throw error;
    }
  }

  // 导入配置
  async importConfig(configData: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configData) as AppConfig;
      await configManager.saveConfig(importedConfig);
      console.log('Configuration imported successfully');
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const serverConfigManager = new ServerConfigManager();

// Next.js服务端配置处理函数
export const getServerConfig = async (): Promise<AppConfig> => {
  // 确保配置已加载
  await configManager.loadConfig();
  return configManager.getConfig();
};

// Next.js API路由使用的配置更新函数
export const updateServerConfig = async (updates: Partial<AppConfig>): Promise<AppConfig> => {
  await configManager.saveConfig(updates);
  return configManager.getConfig();
};