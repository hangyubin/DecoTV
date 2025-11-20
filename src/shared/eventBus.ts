import type { VideoEvent } from './types';

type EventCallback = (data: any, event: string) => void;

class EventBus {
  private channels = new Map<string, Set<EventCallback>>();
  private wildcardCallbacks = new Set<{ pattern: string; callback: EventCallback }>();

  on(eventPattern: string, callback: EventCallback): () => void {
    if (eventPattern.includes('*')) {
      const handler = { pattern: eventPattern, callback };
      this.wildcardCallbacks.add(handler);
      return () => this.wildcardCallbacks.delete(handler);
    }

    if (!this.channels.has(eventPattern)) {
      this.channels.set(eventPattern, new Set());
    }
    this.channels.get(eventPattern)!.add(callback);

    return () => this.channels.get(eventPattern)?.delete(callback);
  }

  emit(event: string, data?: any): void {
    // 精确匹配
    this.channels.get(event)?.forEach(callback => {
      try {
        callback(data, event);
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    });

    // 通配符匹配
    this.wildcardCallbacks.forEach(({ pattern, callback }) => {
      if (this.matchPattern(event, pattern)) {
        try {
          callback(data, event);
        } catch (error) {
          console.error(`Wildcard handler error for ${event}:`, error);
        }
      }
    });
  }

  private matchPattern(event: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(event);
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