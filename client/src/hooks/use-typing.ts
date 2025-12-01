import { useEffect, useRef, useState } from "react";
import { useSocket } from "./use-socket";
import type { ChatType } from "@/types/chat.type";
import type { ControllerRenderProps } from "react-hook-form";
import { useAuth } from "./use-auth";

type typingData = {
  currentUserId: string;
  name: string;
};

export default function useIsTyping(chat: ChatType) {
  const { socket } = useSocket();
  const { user } = useAuth();

  let isTyping = false;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleTyping(
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<
      {
        message?: string | undefined;
      },
      "message"
    >,
    currentUserId: string | null
  ) {
    // 1. 保持 react-hook-form 的输入同步
    field.onChange(e);
    if (!socket) return;
    // 2. 如果之前没有正在 typing，通知服务器
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing", {
        chatId: chat._id,
        currentUserId,
        name: user?.name,
      });
    }

    // 3. 重置停止计时器
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTyping = false;
      socket.emit("stopTyping", {
        chatId: chat._id,
        currentUserId,
        name: user?.name,
      });
    }, 1000);
  }
  const [typingUsers, setTypingUsers] = useState<typingData[]>([]);
  useEffect(() => {
    if (!socket || !chat._id) return;
    const handleTyping = (data: typingData) => {
      setTypingUsers((prev) => {
        // 如果已经存在，则不要重复添加
        if (prev.some((u) => u.currentUserId === data.currentUserId)) {
          return prev;
        }
        return [
          ...prev,
          {
            currentUserId: data.currentUserId,
            name: data.name,
          },
        ];
      });
    };

    const handleStopTyping = (data: typingData) => {
      setTypingUsers((prev) =>
        prev.filter((u) => u.currentUserId !== data.currentUserId)
      );
    };
    // 绑定事件
    socket.on("typing:msg", handleTyping);
    socket.on("stopTyping:msg", handleStopTyping);
    return () => {
      socket.off("typing:msg", handleTyping);
      socket.off("stopTyping:msg", handleStopTyping);
    };
  }, [socket, chat._id]);
  return {
    typingUsers,
    handleTyping,
    isTyping,
  };
}
