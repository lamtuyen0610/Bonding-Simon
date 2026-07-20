import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Tạo (hoặc tái sử dụng) 1 kết nối Socket.IO duy nhất, xác thực bằng token JWT.
 * Tự động reconnect khi mất mạng tạm thời (mặc định của socket.io-client).
 */
export function connectSocket(token: string): Socket {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  socket = io("/", {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
