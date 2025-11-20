// 移除未使用的导入
// import type { VideoEvent } from './types';

type EventCallback = (data: unknown, event: string) => void;

interface WildcardHandler {
  pattern: string;
  callback: EventCallback;
}

class EventBus {
  private channels = new Map<string, Set<EventCallback>>();
  private wildcardCallbacks = new Set<WildcardHandler>();

  on(eventPattern: string, callback: EventCallback): () => void {
    if (eventPattern.includes('*')) {
      const handler: WildcardHandler = { pattern: eventPattern, callback };
      this.wildcardCallbacks.add(handler);
      return () => this.wildcardCallbacks.delete(handler);
    }

    if (!this.channels.has(eventPattern)) {
      this.channels.set(eventPattern, new Set());
    }
    
    const channel = this.channels.get(eventPattern);
    if (channel) {
      channel.add(callback);
    }

    return () => this.channels.get(eventPattern)?.delete(callback);
  }

  emit(event: string, data?: unknown): void {
    // 精确匹配
    this.channels.get(event)?.forEach(callback => {
      try {
        callback(data, event);
      } catch (error) {
        this.handleError(`Event handler error for ${event}`, error);
      }
    });

    // 通配符匹配
    this.wildcardCallbacks.forEach(({ pattern, callback }) => {
      if (this.matchPattern(event, pattern)) {
        try {
            callback(data, event);
          } catch (error) {
            this.handleError(`Wildcard handler error for ${event}`, error);
          }
      }
    });
  }

  private matchPattern(event: string, pattern: string): boolean {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(event);
  }

  private handleError(message: string, error: unknown): void {
    // 在生产环境中可以发送到错误监控服务
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(message, error);
    }
  }
}

// 导出单例
export const eventBus = new EventBus();

// 事件常量
export const VIDEO_EVENTS = {
  LOAD_START: 'video:load-start',
  LOADED_METADATA: 'video:loaded-metadata',
  TIME_UPDATE: 'video:time-update',
  ENDED: 'video:ended',
  ERROR: 'video:error',
  TRANSITION_START: 'video:transition-start',
  TRANSITION_END: 'video:transition-end'
} as const;