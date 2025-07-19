export const REDIS_STATUS_KEY = {
  default: 'processor:status:default',
  fallback: 'processor:status:fallback',
} as const;

export const REDIS_WATCHER_LOCK_KEY = 'watcher:lock' as const;
