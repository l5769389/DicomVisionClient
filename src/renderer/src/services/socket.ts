import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(origin: string): Socket {
  if (socket) {
    socket.disconnect()
  }

  socket = io(origin, {
    transports: ['websocket', 'polling']
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}
