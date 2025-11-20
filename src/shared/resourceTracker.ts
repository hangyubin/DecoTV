interface TrackedResource {
  resource: unknown;
  type: string;
  id: string;
  createdAt: number;
  lastAccessed: number;
  stackTrace?: string;
}

export class ResourceTracker {
  private resources = new Map<string, TrackedResource>();
  private readonly maxResourceAge = 5 * 60 * 1000; // 5分钟
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  track(resource: unknown, type: string, id?: string): string {
    const resourceId = id || this.generateId();
    
    this.resources.set(resourceId, {
      resource,
      type,
      id: resourceId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      stackTrace: new Error().stack?.split('\n').slice(2, 6).join('\n')
    });

    return resourceId;
  }

  untrack(id: string): boolean {
    return this.resources.delete(id);
  }

  access(id: string): unknown {
    const resource = this.resources.get(id);
    if (resource) {
      resource.lastAccessed = Date.now();
    }
    return resource?.resource;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  private cleanup(): void {
    const now = Date.now();
    let leakedCount = 0;
    const idsToRemove: string[] = [];

    this.resources.forEach((tracked, id) => {
      if (now - tracked.lastAccessed > this.maxResourceAge) {
        this.logPotentialLeak(tracked);
        
        this.forceCleanup(tracked);
        idsToRemove.push(id);
        leakedCount++;
      }
    });

    // 在forEach外部删除，避免迭代过程中修改集合
    idsToRemove.forEach(id => this.resources.delete(id));

    if (leakedCount > 0 && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`Cleaned up ${leakedCount} potentially leaked resources`);
    }
  }

  private logPotentialLeak(tracked: TrackedResource): void {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Potential memory leak detected:', {
        type: tracked.type,
        age: Date.now() - tracked.createdAt,
        stack: tracked.stackTrace
      });
    }
  }

  private forceCleanup(tracked: TrackedResource): void {
    const { resource } = tracked;
    
    // 根据资源类型进行清理
    if (resource && typeof resource === 'object') {
      const videoElement = resource as Partial<HTMLVideoElement>;
      if (videoElement.pause && typeof videoElement.pause === 'function') {
        videoElement.pause();
        videoElement.src = '';
        if (videoElement.load) {
          videoElement.load();
        }
      } else {
        const disposable = resource as { dispose?: () => void };
        if (disposable.dispose && typeof disposable.dispose === 'function') {
          disposable.dispose();
        } else {
          const destroyable = resource as { destroy?: () => void };
          if (destroyable.destroy && typeof destroyable.destroy === 'function') {
            destroyable.destroy();
          }
        }
      }
    }
  }

  private generateId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // 清理所有资源
    this.resources.forEach((tracked) => {
      this.forceCleanup(tracked);
    });
    this.resources.clear();
  }
}

// 导出单例
export const resourceTracker = new ResourceTracker();