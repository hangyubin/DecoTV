/* eslint-disable @typescript-eslint/no-explicit-any */

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

export class LocalStorage implements IStorage {
  // 检查是否在服务器端环境
  private readonly isServer: boolean;
  // 服务器端内存存储
  private serverMemoryStorage: Map<string, string>;

  constructor() {
    // 检测是否在服务器端（Next.js环境）
    this.isServer = typeof window === 'undefined';
    // 初始化服务器端内存存储
    this.serverMemoryStorage = new Map();
  }

  // 基础的本地存储操作方法
  private getItem(key: string): any {
    try {
      if (this.isServer) {
        // 服务器端使用内存存储
        const item = this.serverMemoryStorage.get(key);
        return item ? JSON.parse(item) : null;
      } else {
        // 客户端使用localStorage
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch (error) {
      console.error('读取本地存储失败:', error);
      return null;
    }
  }

  private setItem(key: string, value: any): void {
    try {
      const jsonValue = JSON.stringify(value);
      if (this.isServer) {
        // 服务器端使用内存存储
        this.serverMemoryStorage.set(key, jsonValue);
      } else {
        // 客户端使用localStorage
        localStorage.setItem(key, jsonValue);
      }
    } catch (error) {
      console.error('写入本地存储失败:', error);
    }
  }

  private removeItem(key: string): void {
    try {
      if (this.isServer) {
        // 服务器端使用内存存储
        this.serverMemoryStorage.delete(key);
      } else {
        // 客户端使用localStorage
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('删除本地存储失败:', error);
    }
  }

  // 生成用户相关的key
  private getUserKey(userName: string, type: string): string {
    return `deco_tv_${userName}_${type}`;
  }

  // 播放记录相关方法
  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    const records = this.getItem(this.getUserKey(userName, 'play_records')) || {};
    return records[key] || null;
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    const records = this.getItem(this.getUserKey(userName, 'play_records')) || {};
    records[key] = record;
    this.setItem(this.getUserKey(userName, 'play_records'), records);
  }

  async getAllPlayRecords(userName: string): Promise<{ [key: string]: PlayRecord }> {
    return this.getItem(this.getUserKey(userName, 'play_records')) || {};
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    const records = this.getItem(this.getUserKey(userName, 'play_records')) || {};
    delete records[key];
    this.setItem(this.getUserKey(userName, 'play_records'), records);
  }

  // 收藏相关方法
  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const favorites = this.getItem(this.getUserKey(userName, 'favorites')) || {};
    return favorites[key] || null;
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    const favorites = this.getItem(this.getUserKey(userName, 'favorites')) || {};
    favorites[key] = favorite;
    this.setItem(this.getUserKey(userName, 'favorites'), favorites);
  }

  async getAllFavorites(userName: string): Promise<{ [key: string]: Favorite }> {
    return this.getItem(this.getUserKey(userName, 'favorites')) || {};
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    const favorites = this.getItem(this.getUserKey(userName, 'favorites')) || {};
    delete favorites[key];
    this.setItem(this.getUserKey(userName, 'favorites'), favorites);
  }

  // 用户相关方法
  async registerUser(userName: string, password: string): Promise<void> {
    const users = this.getItem('deco_tv_users') || {};
    users[userName] = password; // 注意：实际应用中应该加密密码
    this.setItem('deco_tv_users', users);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const users = this.getItem('deco_tv_users') || {};
    return users[userName] === password;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    const users = this.getItem('deco_tv_users') || {};
    return !!users[userName];
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    const users = this.getItem('deco_tv_users') || {};
    if (users[userName]) {
      users[userName] = newPassword;
      this.setItem('deco_tv_users', users);
    }
  }

  async deleteUser(userName: string): Promise<void> {
    // 删除用户信息
    const users = this.getItem('deco_tv_users') || {};
    delete users[userName];
    this.setItem('deco_tv_users', users);

    // 删除用户相关数据
    this.removeItem(this.getUserKey(userName, 'play_records'));
    this.removeItem(this.getUserKey(userName, 'favorites'));
    this.removeItem(this.getUserKey(userName, 'search_history'));
    this.removeItem(this.getUserKey(userName, 'skip_configs'));
  }

  // 搜索历史相关方法
  async getSearchHistory(userName: string): Promise<string[]> {
    return this.getItem(this.getUserKey(userName, 'search_history')) || [];
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    let history = this.getItem(this.getUserKey(userName, 'search_history')) || [];
    // 移除重复项
    history = history.filter((item: string) => item !== keyword);
    // 添加到开头
    history.unshift(keyword);
    // 限制数量
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    this.setItem(this.getUserKey(userName, 'search_history'), history);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    if (keyword) {
      let history = this.getItem(this.getUserKey(userName, 'search_history')) || [];
      history = history.filter((item: string) => item !== keyword);
      this.setItem(this.getUserKey(userName, 'search_history'), history);
    } else {
      this.removeItem(this.getUserKey(userName, 'search_history'));
    }
  }

  // 用户列表
  async getAllUsers(): Promise<string[]> {
    const users = this.getItem('deco_tv_users') || {};
    return Object.keys(users);
  }

  // 管理员配置相关方法
  async getAdminConfig(): Promise<AdminConfig | null> {
    return this.getItem('deco_tv_admin_config');
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    this.setItem('deco_tv_admin_config', config);
  }

  // 跳过片头片尾配置相关方法
  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    const skipConfigs = this.getItem(this.getUserKey(userName, 'skip_configs')) || {};
    const key = `${source}_${id}`;
    return skipConfigs[key] || null;
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    const skipConfigs = this.getItem(this.getUserKey(userName, 'skip_configs')) || {};
    const key = `${source}_${id}`;
    skipConfigs[key] = config;
    this.setItem(this.getUserKey(userName, 'skip_configs'), skipConfigs);
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    const skipConfigs = this.getItem(this.getUserKey(userName, 'skip_configs')) || {};
    const key = `${source}_${id}`;
    delete skipConfigs[key];
    this.setItem(this.getUserKey(userName, 'skip_configs'), skipConfigs);
  }

  async getAllSkipConfigs(userName: string): Promise<{ [key: string]: SkipConfig }> {
    return this.getItem(this.getUserKey(userName, 'skip_configs')) || {};
  }

  // 数据清理相关方法
  async clearAllData(): Promise<void> {
    try {
      if (this.isServer) {
        // 服务器端清空内存存储中所有匹配的键
        for (const key of this.serverMemoryStorage.keys()) {
          if (key.startsWith('deco_tv_')) {
            this.serverMemoryStorage.delete(key);
          }
        }
      } else {
        // 客户端清空localStorage中所有匹配的键
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('deco_tv_')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }
}