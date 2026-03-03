const PREFIX = 'finplan_'

export const StorageService = {
  get<T>(key: string, defaultValue: T): T {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return defaultValue
    try {
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key)
  },

  clearAll(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  },

  exportAll(): string {
    const data: Record<string, unknown> = {}
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => {
        const raw = localStorage.getItem(k)
        if (raw) data[k.slice(PREFIX.length)] = JSON.parse(raw)
      })
    return JSON.stringify(data, null, 2)
  },
}
