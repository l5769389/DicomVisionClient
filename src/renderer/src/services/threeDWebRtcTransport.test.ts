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
    this.ontrack?.({ streams: [stream], track: {}, receiver: fakeReceiver as RTCRtpReceiver } as unknown as RTCTrackEvent)
    this.onconnectionstatechange?.()
  }

  close(): void {
    this.connectionState = 'closed'
  }
}

const fakeReceiver: { jitterBufferTarget?: number | null; playoutDelayHint?: number | null } = {}

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
    delete fakeReceiver.jitterBufferTarget
    delete fakeReceiver.playoutDelayHint
    socketMocks.requestWebRtc3DConfig.mockResolvedValue({
      ok: true,
      transport: 'webrtc',
      iceServers: [],
      videoCodec: 'vp8',
      videoBitrateBps: 4_000_000,
      videoFps: 60
    })
    socketMocks.sendWebRtc3DOffer.mockResolvedValue({
      ok: true,
      viewId: 'view-3d',
      type: 'answer',
      sdp: 'remote-answer'
    })
  })

  it('negotiates a receive-only track and requests a render after the answer', async () => {
    const transport = await import('./threeDWebRtcTransport')

    await transport.initializeThreeDTransport()
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
    expect(fakeReceiver.playoutDelayHint).toBe(0)
    expect(fakeReceiver.jitterBufferTarget).toBe(0)

    transport.releaseThreeDWebRtcTransport('view-3d')
    expect(socketMocks.closeWebRtc3DTransport).toHaveBeenCalledWith('view-3d')
  })

  it('falls back to WebP when signaling fails', async () => {
    socketMocks.sendWebRtc3DOffer.mockResolvedValue({ ok: false, message: 'no route' })
    const transport = await import('./threeDWebRtcTransport')

    await transport.initializeThreeDTransport()
    transport.acquireThreeDWebRtcTransport('view-fallback')
    await flushPromises()

    expect(transport.getThreeDWebRtcState('view-fallback')).toBe('failed')
    expect(socketMocks.bindView).toHaveBeenCalledWith('view-fallback')
    expect(socketMocks.closeWebRtc3DTransport).toHaveBeenCalledWith('view-fallback')
    transport.releaseThreeDWebRtcTransport('view-fallback')
  })

  it('uses WebP without negotiating when the server startup mode is WebP', async () => {
    socketMocks.requestWebRtc3DConfig.mockResolvedValue({ ok: true, transport: 'webp' })
    const transport = await import('./threeDWebRtcTransport')

    expect(await transport.initializeThreeDTransport()).toBe('webp')
    transport.acquireThreeDWebRtcTransport('view-webp')
    await flushPromises()

    expect(socketMocks.sendWebRtc3DOffer).not.toHaveBeenCalled()
    expect(transport.threeDTransportMode.value).toBe('webp')
    transport.releaseThreeDWebRtcTransport('view-webp')
  })
})
