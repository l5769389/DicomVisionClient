export interface LatestRequestHandle {
  signal: AbortSignal
  token: number
}

export interface LatestRequestGuard {
  cancel: () => void
  finish: (token: number) => void
  isCurrent: (token: number) => boolean
  start: () => LatestRequestHandle
}

export interface KeyedLatestRequestGuard<Key> {
  cancel: (key: Key) => void
  finish: (key: Key, token: number) => void
  isCurrent: (key: Key, token: number) => boolean
  start: (key: Key) => LatestRequestHandle
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let nextToken = 0
  let activeToken: number | null = null
  let activeController: AbortController | null = null

  return {
    cancel() {
      activeController?.abort()
      activeToken = null
      activeController = null
    },
    start() {
      activeController?.abort()
      activeController = new AbortController()
      nextToken += 1
      activeToken = nextToken
      return {
        signal: activeController.signal,
        token: activeToken
      }
    },
    isCurrent(token) {
      return activeToken === token
    },
    finish(token) {
      if (activeToken === token) {
        activeToken = null
        activeController = null
      }
    }
  }
}

export function createKeyedLatestRequestGuard<Key>(): KeyedLatestRequestGuard<Key> {
  const activeTokens = new Map<Key, number>()
  const nextTokens = new Map<Key, number>()
  const activeControllers = new Map<Key, AbortController>()

  return {
    cancel(key) {
      activeControllers.get(key)?.abort()
      activeTokens.delete(key)
      activeControllers.delete(key)
    },
    start(key) {
      activeControllers.get(key)?.abort()
      const controller = new AbortController()
      const nextToken = (nextTokens.get(key) ?? 0) + 1
      nextTokens.set(key, nextToken)
      activeTokens.set(key, nextToken)
      activeControllers.set(key, controller)
      return {
        signal: controller.signal,
        token: nextToken
      }
    },
    isCurrent(key, token) {
      return activeTokens.get(key) === token
    },
    finish(key, token) {
      if (activeTokens.get(key) === token) {
        activeTokens.delete(key)
        activeControllers.delete(key)
      }
    }
  }
}
