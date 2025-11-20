interface TrackedResource {
  resource: any;
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

  track(resource: any, type: string, id?: string): string {
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

  access(id: string): any {
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

    this.resources.forEach((tracked, id) => {
      if (now - tracked.lastAccessed > this.maxResourceAge) {
        console.warn(`Potential memory leak detected:`, {
          type: tracked.type,
          age: now - tracked.createdAt,
          stack: tracked.stackTrace
        });
        
        this.forceCleanup(tracked);
        this.resources.delete(id);
        leakedCount++;
      }
    });

    if (leakedCount > 0) {
      console.log(`Cleaned up ${leakedCount} potentially leaked resources`);
    }
  }

  private forceCleanup(tracked: TrackedResource): void {
    const { resource } = tracked;
    
    // 根据资源类型进行清理
    if (resource instanceof HTMLVideoElement) {
      resource.pause();
      resource.src = '';
      resource.load();
    } else if (resource.dispose && typeof resource.dispose === 'function') {
      resource.dispose();
    } else if (resource.destroy && typeof resource.destroy === 'function') {
      resource.destroy();
    }
    
    tracked.resource = null;
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