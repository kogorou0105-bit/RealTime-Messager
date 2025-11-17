import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { Env } from "../config/env.config";
import { validateChatParticipant } from "../services/chat.service";
import * as cookie from "cookie";
import ChatModel from "../models/chat.model";
import { BadRequestException } from "../utils/app-error";
interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let io: Server | null = null;

const onlineUsers = new Map<string, string>();

export const initializeSocket = (httpServer: HTTPServer) => {
  io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: Env.FRONTEND_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type"], // 很关键，否则预检失败
    },
  });

  io.on("connection_error", (err) => {
    console.error("Socket.IO connection error:", err);
  });

  io.on("error", (err) => {
    console.error("Socket.IO server error:", err);
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      //这里一次把浏览器发过来的所有cookie都拿到了，绝了
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) return next(new Error("Unauthorized"));

      const cookies = cookie.parse(rawCookie);

      const token = cookies["accessToken"];
      if (!token) return next(new Error("Unauthorized"));

      const decodedToken = jwt.verify(token, Env.JWT_SECRET) as {
        userId: string;
      };
      if (!decodedToken) return next(new Error("Unauthorized"));
      socket.userId = decodedToken.userId;
      next();
    } catch (error) {
      next(new Error("Internal server error"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const newSocketId = socket.id;
    if (!socket.userId) {
      socket.disconnect(true);
      return;
    }

    //register socket for the user
    onlineUsers.set(userId, newSocketId);

    //BroadCast online users to all socket
    io?.emit("online:users", Array.from(onlineUsers.keys()));

    //create personnal room for user
    socket.join(`user:${userId}`);
    socket.on("typing", ({ chatId, currentUserId, name }) => {
      if (!io) return;

      const senderSocketId = onlineUsers.get(currentUserId?.toString());
      if (senderSocketId) {
        io.to(`chat:${chatId}`)
          .except(senderSocketId)
          .emit("typing:msg", { currentUserId, name });
      } else {
        io.to(`chat:${chatId}`).emit("typing:msg", { currentUserId, name });
      }
    });
    socket.on("stopTyping", ({ chatId, currentUserId, name }) => {
      if (!io) return;
      const senderSocketId = onlineUsers.get(currentUserId?.toString());

      if (senderSocketId) {
        io.to(`chat:${chatId}`)
          .except(senderSocketId)
          .emit("stopTyping:msg", { currentUserId, name });
      } else {
        io.to(`chat:${chatId}`).emit("stopTyping:msg", { currentUserId, name });
      }
    });
    socket.on(
      "chat:join",
      async (chatId: string, callback?: (err?: string) => void) => {
        try {
          await validateChatParticipant(chatId, userId);
          socket.join(`chat:${chatId}`);

          callback?.();
        } catch (error) {
          callback?.("Error joining chat");
        }
      }
    );

    socket.on("chat:leave", (chatId: string) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
      }
    });

    socket.on("disconnect", () => {
      if (onlineUsers.get(userId) === newSocketId) {
        if (userId) onlineUsers.delete(userId);

        io?.emit("online:users", Array.from(onlineUsers.keys()));
      }
    });
  });
};

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export const emitIsTypingToParticpants = (
  participantIds: string[] = [],
  typingUserId: string
) => {
  const io = getIO();
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit("typing:someone", typingUserId);
  }
};

export const emitNewChatToParticpants = (
  participantIds: string[] = [],
  chat: any
) => {
  const io = getIO();
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit("chat:new", chat);
  }
};

export const emitNewMessageToChatRoom = (
  senderId: string, //userId that sent the message
  chatId: string,
  message: any
) => {
  const io = getIO();
  const senderSocketId = onlineUsers.get(senderId?.toString());

  if (senderSocketId) {
    io.to(`chat:${chatId}`).except(senderSocketId).emit("message:new", message);
  } else {
    io.to(`chat:${chatId}`).emit("message:new", message);
  }
};

export const emitLastMessageToParticipants = (
  participantIds: string[],
  chatId: string,
  lastMessage: any
) => {
  const io = getIO();
  const payload = { chatId, lastMessage };

  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit("chat:update", payload);
  }
};
