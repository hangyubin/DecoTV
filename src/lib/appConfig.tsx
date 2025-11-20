/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppConfig } from '@/shared/types';
import { configManager } from '@/shared/configManager';

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化加载配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      const loadedConfig = await configManager.loadConfig();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load config in provider:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新配置
  const updateConfig = async (updates: Partial<AppConfig>) => {
    try {
      await configManager.saveConfig(updates);
      // configManager会通过监听器通知更新，这里不需要手动设置
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  };

  // 刷新配置
  const refreshConfig = async () => {
    await loadConfig();
  };

  // 初始化
  useEffect(() => {
    loadConfig();

    // 监听配置变化
    const unsubscribe = configManager.onUpdate((newConfig) => {
      setConfig(newConfig);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value = {
    config,
    loading,
    updateConfig,
    refreshConfig,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

// 自定义Hook方便组件使用配置
export const useAppConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useAppConfig must be used within a ConfigProvider');
  }
  return context;
};

// 直接操作配置的便捷函数
export const updateAppConfig = async (updates: Partial<AppConfig>) => {
  await configManager.saveConfig(updates);
};

export const getAppConfig = (): AppConfig | null => {
  try {
    return configManager.getConfig();
  } catch (error) {
    console.error('Failed to get config:', error);
    return null;
  }
};