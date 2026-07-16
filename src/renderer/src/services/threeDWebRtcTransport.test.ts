import { beforeEach, describe, expect, it, vi } from 'vitest'

const socketMocks = vi.hoisted(() => ({
  bindView: vi.fn(),
  closeWebRtc3DTransport: vi.fn(),
  requestWebRtc3DConfig: vi.fn(),
  sendWebRtc3DOffer: vi.fn()
}))

vi.mock('./socket', () => socketMocks)

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'complete'
  localDescription: RTCSessionDescription | null = null
  ontrack: ((event: RTCTrackEvent) => void) | null = null
  onconnectionstatechange: (() => void) | null = null

  addTransceiver(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'local-offer' }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription
  }

  async setRemoteDescription(): Promise<void> {
    this.connectionState = 'connected'
    const stream = { id: 'stream-1' } as MediaStream
    this.ontrack?.({ streams: [stream], track: {} } as unknown as RTCTrackEvent)
    this.onconnectionstatechange?.()
  }

  close(): void {
    this.connectionState = 'closed'
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

describe('threeDWebRtcTransport', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    socketMocks.requestWebRtc3DConfig.mockResolvedValue({ ok: true, iceServers: [] })
    socketMocks.sendWebRtc3DOffer.mockResolvedValue({
      ok: true,
      viewId: 'view-3d',
      type: 'answer',
      sdp: 'remote-answer'
    })
  })

  it('negotiates a receive-only track and requests a render after the answer', async () => {
    const transport = await import('./threeDWebRtcTransport')

    transport.acquireThreeDWebRtcTransport('view-3d')
    await flushPromises()

    expect(socketMocks.requestWebRtc3DConfig).toHaveBeenCalledOnce()
    expect(socketMocks.sendWebRtc3DOffer).toHaveBeenCalledWith(
      'view-3d',
      expect.objectContaining({ type: 'offer', sdp: 'local-offer' })
    )
    expect(socketMocks.bindView).toHaveBeenCalledWith('view-3d')
    expect(transport.getThreeDWebRtcState('view-3d')).toBe('connected')
    expect(transport.getThreeDWebRtcStream('view-3d')).toEqual({ id: 'stream-1' })

    transport.releaseThreeDWebRtcTransport('view-3d')
    expect(socketMocks.closeWebRtc3DTransport).toHaveBeenCalledWith('view-3d')
  })

  it('falls back to WebP when signaling fails', async () => {
    socketMocks.sendWebRtc3DOffer.mockResolvedValue({ ok: false, message: 'no route' })
    const transport = await import('./threeDWebRtcTransport')

    transport.acquireThreeDWebRtcTransport('view-fallback')
    await flushPromises()

    expect(transport.getThreeDWebRtcState('view-fallback')).toBe('failed')
    expect(socketMocks.bindView).toHaveBeenCalledWith('view-fallback')
    expect(socketMocks.closeWebRtc3DTransport).toHaveBeenCalledWith('view-fallback')
    transport.releaseThreeDWebRtcTransport('view-fallback')
  })
})
