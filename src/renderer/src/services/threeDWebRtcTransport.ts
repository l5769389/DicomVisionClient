import { readonly, ref, shallowReactive } from 'vue'
import {
  bindView,
  closeWebRtc3DTransport,
  requestWebRtc3DConfig,
  sendWebRtc3DOffer,
  type WebRtc3DConfigResponse
} from './socket'

export type ThreeDWebRtcState = 'idle' | 'connecting' | 'connected' | 'failed'
export type ThreeDTransportMode = 'webp' | 'webrtc'

interface PeerEntry {
  peer: RTCPeerConnection
  generation: number
}

const peers = new Map<string, PeerEntry>()
const referenceCounts = new Map<string, number>()
const streams = shallowReactive(new Map<string, MediaStream>())
const states = shallowReactive(new Map<string, ThreeDWebRtcState>())
const configuredTransport = ref<ThreeDTransportMode>('webp')
export const threeDTransportMode = readonly(configuredTransport)
let serverConfig: WebRtc3DConfigResponse | null = null
let configRequest: Promise<ThreeDTransportMode> | null = null
let generation = 0

type LowLatencyRtpReceiver = RTCRtpReceiver & { playoutDelayHint?: number | null }

function configureReceiverForLowLatency(receiver: RTCRtpReceiver | undefined): void {
  if (!receiver) {
    return
  }
  const lowLatencyReceiver = receiver as LowLatencyRtpReceiver
  try {
    lowLatencyReceiver.playoutDelayHint = 0
  } catch {
    // Browser does not expose the optional WebRTC playout hint.
  }
  try {
    lowLatencyReceiver.jitterBufferTarget = 0
  } catch {
    // Chromium-only experimental property; absence is harmless.
  }
}

function waitForIceGatheringComplete(peer: RTCPeerConnection, timeoutMs = 5000): Promise<void> {
  if (peer.iceGatheringState === 'complete') {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const timeout = window.setTimeout(finish, timeoutMs)
    function finish(): void {
      window.clearTimeout(timeout)
      peer.removeEventListener('icegatheringstatechange', handleStateChange)
      resolve()
    }
    function handleStateChange(): void {
      if (peer.iceGatheringState === 'complete') {
        finish()
      }
    }
    peer.addEventListener('icegatheringstatechange', handleStateChange)
  })
}

function disposeLocalPeer(viewId: string): void {
  const entry = peers.get(viewId)
  peers.delete(viewId)
  streams.delete(viewId)
  if (entry) {
    entry.peer.ontrack = null
    entry.peer.onconnectionstatechange = null
    entry.peer.close()
  }
}

async function establish(viewId: string): Promise<void> {
  if (configuredTransport.value !== 'webrtc' || !viewId || peers.has(viewId) || typeof RTCPeerConnection === 'undefined') {
    if (typeof RTCPeerConnection === 'undefined') {
      states.set(viewId, 'failed')
    }
    return
  }

  const currentGeneration = ++generation
  states.set(viewId, 'connecting')
  try {
    const config = serverConfig ?? await requestWebRtc3DConfig()
    if (!config.ok) {
      throw new Error(config.message || 'WebRTC configuration was rejected')
    }
    if ((referenceCounts.get(viewId) ?? 0) <= 0) {
      return
    }

    const peer = new RTCPeerConnection({ iceServers: config.iceServers ?? [] })
    peers.set(viewId, { peer, generation: currentGeneration })
    peer.addTransceiver('video', { direction: 'recvonly' })
    peer.ontrack = (event) => {
      if (peers.get(viewId)?.generation !== currentGeneration) {
        return
      }
      configureReceiverForLowLatency(event.receiver)
      const stream = event.streams[0] ?? new MediaStream([event.track])
      streams.set(viewId, stream)
      states.set(viewId, 'connected')
    }
    peer.onconnectionstatechange = () => {
      if (peers.get(viewId)?.generation !== currentGeneration) {
        return
      }
      if (peer.connectionState === 'connected') {
        states.set(viewId, 'connected')
        // The render requested immediately after SDP exchange may have used
        // WebP while ICE/DTLS was still connecting. Request the first frame
        // again now that the video transport can receive it.
        bindView(viewId)
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        states.set(viewId, 'failed')
        streams.delete(viewId)
      }
    }

    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    await waitForIceGatheringComplete(peer)
    const answer = await sendWebRtc3DOffer(viewId, peer.localDescription ?? offer)
    if (!answer.ok || !answer.sdp || !answer.type) {
      throw new Error(answer.message || 'WebRTC answer was rejected')
    }
    await peer.setRemoteDescription({ sdp: answer.sdp, type: answer.type })
    if ((referenceCounts.get(viewId) ?? 0) > 0) {
      bindView(viewId)
    }
  } catch (error) {
    console.warn(`3D WebRTC transport failed for ${viewId}; continuing with WebP.`, error)
    disposeLocalPeer(viewId)
    states.set(viewId, 'failed')
    closeWebRtc3DTransport(viewId)
    if ((referenceCounts.get(viewId) ?? 0) > 0) {
      bindView(viewId)
    }
  }
}

export function acquireThreeDWebRtcTransport(viewId: string): void {
  if (!viewId) {
    return
  }
  referenceCounts.set(viewId, (referenceCounts.get(viewId) ?? 0) + 1)
  if (configuredTransport.value === 'webrtc') {
    void establish(viewId)
  }
}

export function initializeThreeDTransport(): Promise<ThreeDTransportMode> {
  if (configRequest) {
    return configRequest
  }
  configRequest = requestWebRtc3DConfig()
    .then((config) => {
      serverConfig = config
      configuredTransport.value = config.ok && config.transport === 'webrtc' ? 'webrtc' : 'webp'
      if (configuredTransport.value === 'webp') {
        closeAllThreeDWebRtcTransports()
      }
      return configuredTransport.value
    })
    .catch(() => {
      serverConfig = null
      configuredTransport.value = 'webp'
      closeAllThreeDWebRtcTransports()
      return 'webp' as const
    })
    .finally(() => {
      configRequest = null
    })
  return configRequest
}

export function releaseThreeDWebRtcTransport(viewId: string): void {
  if (!viewId) {
    return
  }
  const nextCount = Math.max(0, (referenceCounts.get(viewId) ?? 1) - 1)
  if (nextCount > 0) {
    referenceCounts.set(viewId, nextCount)
    return
  }
  referenceCounts.delete(viewId)
  disposeLocalPeer(viewId)
  states.delete(viewId)
  closeWebRtc3DTransport(viewId)
}

export function getThreeDWebRtcStream(viewId: string | null | undefined): MediaStream | null {
  return viewId ? streams.get(viewId) ?? null : null
}

export function getThreeDWebRtcState(viewId: string | null | undefined): ThreeDWebRtcState {
  return viewId ? states.get(viewId) ?? 'idle' : 'idle'
}

export function restartThreeDWebRtcTransports(): void {
  if (configuredTransport.value !== 'webrtc') {
    return
  }
  for (const viewId of referenceCounts.keys()) {
    disposeLocalPeer(viewId)
    states.set(viewId, 'idle')
    void establish(viewId)
  }
}

export function closeAllThreeDWebRtcTransports(): void {
  for (const viewId of peers.keys()) {
    disposeLocalPeer(viewId)
  }
  streams.clear()
  states.clear()
}
