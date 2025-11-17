import { io, Socket } from "socket.io-client";
import { create } from "zustand";

const BASE_URL =
  import.meta.env.MODE === "development" ? import.meta.env.VITE_API_URL : "/";

interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useSocket = create<SocketState>()((set, get) => ({
  socket: null,
  onlineUsers: [],

  connectSocket: () => {
    const { socket } = get();
    // console.log(socket, "socket");
    if (socket?.connected) return;
    const newSocket = io(BASE_URL, {
      path: "/socket.io/",
      withCredentials: true,
      autoConnect: true,
      forceNew: true, // ★ 必须，避免旧 session 复用
    });

    newSocket.on("connect_error", (err) => {
      console.log("connect_error:", err.message);
      console.log("details:", err);
    });

    newSocket.on("error", (err) => {
      console.log("socket error:", err);
    });
    set({ socket: newSocket });

    newSocket.on("connect", () => {
      console.log("Socket connected", newSocket.id);
    });

    newSocket.on("online:users", (userIds) => {
      // console.log("Online users", userIds);
      set({ onlineUsers: userIds });
    });
  },
  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
