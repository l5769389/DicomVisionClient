export const WORKSPACE_HEADER = 'X-DicomVision-Workspace-Id'

const WORKSPACE_STORAGE_KEY = 'dicomVision.workspaceId'
const WORKSPACE_BROADCAST_CHANNEL = 'dicomvision-workspace-presence'

type WorkspacePresenceMessage =
  | { type: 'probe'; workspaceId: string; instanceId: string }
  | { type: 'conflict'; workspaceId: string; instanceId: string; targetInstanceId: string }
  | { type: 'claim'; workspaceId: string; instanceId: string }

let workspaceId = ''
let browserInstanceId = ''
let channel: BroadcastChannel | null = null
let initialized = false

function createWorkspaceId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  const bytes = new Uint8Array(16)
  cryptoApi?.getRandomValues?.(bytes)
  if (bytes.some((value) => value !== 0)) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`
}

function readStoredWorkspaceId(): string {
  try {
    return String(globalThis.sessionStorage?.getItem(WORKSPACE_STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

function storeWorkspaceId(nextWorkspaceId: string): void {
  try {
    globalThis.sessionStorage?.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId)
  } catch {
    // Storage can be unavailable in constrained browser contexts. The in-memory
    // ID still isolates this page lifetime.
  }
}

function rotateWorkspaceId(): void {
  workspaceId = createWorkspaceId()
  storeWorkspaceId(workspaceId)
  channel?.postMessage({ type: 'claim', workspaceId, instanceId: browserInstanceId } satisfies WorkspacePresenceMessage)
}

function handlePresenceMessage(event: MessageEvent<WorkspacePresenceMessage>): void {
  const message = event.data
  if (!message || message.instanceId === browserInstanceId || message.workspaceId !== workspaceId) {
    return
  }

  if (message.type === 'probe' || message.type === 'claim') {
    channel?.postMessage({
      type: 'conflict',
      workspaceId,
      instanceId: browserInstanceId,
      targetInstanceId: message.instanceId
    } satisfies WorkspacePresenceMessage)
    return
  }

  if (message.type === 'conflict' && message.targetInstanceId === browserInstanceId) {
    rotateWorkspaceId()
  }
}

function initializeWorkspaceIdentity(): void {
  if (initialized) {
    return
  }
  initialized = true
  browserInstanceId = createWorkspaceId()
  workspaceId = readStoredWorkspaceId() || createWorkspaceId()
  storeWorkspaceId(workspaceId)

  if (typeof globalThis.BroadcastChannel !== 'function') {
    return
  }

  channel = new BroadcastChannel(WORKSPACE_BROADCAST_CHANNEL)
  channel.onmessage = handlePresenceMessage
  globalThis.setTimeout(() => {
    channel?.postMessage({ type: 'probe', workspaceId, instanceId: browserInstanceId } satisfies WorkspacePresenceMessage)
  }, 0)
}

export function getWorkspaceId(): string {
  initializeWorkspaceIdentity()
  return workspaceId
}

export function resetWorkspaceIdentityForTest(nextWorkspaceId = ''): void {
  channel?.close()
  channel = null
  workspaceId = nextWorkspaceId
  browserInstanceId = ''
  initialized = false
  if (nextWorkspaceId) {
    storeWorkspaceId(nextWorkspaceId)
  }
}
