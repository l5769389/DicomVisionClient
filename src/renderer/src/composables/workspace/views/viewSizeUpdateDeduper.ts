interface ViewSizeUpdateLike {
  viewId: string
  size: {
    width: number
    height: number
  }
}

type SendViewSizeUpdate = () => Promise<void>

function getViewSizeUpdateSignature(update: ViewSizeUpdateLike, renderOnBind: boolean): string {
  return `${update.viewId}:${update.size.width}x${update.size.height}:${renderOnBind ? 'render' : 'silent'}`
}

export function createViewSizeUpdateDeduper() {
  const pending = new Map<string, Promise<void>>()

  async function run(update: ViewSizeUpdateLike, renderOnBind: boolean, send: SendViewSizeUpdate): Promise<void> {
    const signature = getViewSizeUpdateSignature(update, renderOnBind)
    const pendingUpdate = pending.get(signature)
    if (pendingUpdate) {
      await pendingUpdate
      return
    }

    const request = send()
    pending.set(signature, request)
    try {
      await request
    } finally {
      if (pending.get(signature) === request) {
        pending.delete(signature)
      }
    }
  }

  return {
    run
  }
}
