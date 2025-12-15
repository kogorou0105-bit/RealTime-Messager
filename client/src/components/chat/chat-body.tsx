import { useChat } from "@/hooks/use-chat";
import { useSocket } from "@/hooks/use-socket";
import type { MessageType } from "@/types/chat.type";
import { useEffect, useState } from "react";
import ChatBodyMessage from "./chat-body-message";
import { useVirtualizer } from "@tanstack/react-virtual";
interface Props {
  chatId: string | null;
  messages: MessageType[];
  onReply: (message: MessageType) => void;
  scrollElement: HTMLDivElement | null;
}
const ChatBody = ({ chatId, messages, onReply, scrollElement }: Props) => {
  const { socket } = useSocket();
  const { addNewMessage, addOrUpdateMessage } = useChat();

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollElement, // 滚动容器
    estimateSize: () => 50, // 给一个初始的预估高度
    overscan: 5, // 预加载数量，防止滚动太快出现白屏
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setAiChunk] = useState<string>("");
  useEffect(() => {
    if (!socket) return;
    if (!chatId) return;
    const handleAiStream = ({
      chatId: streamChatId,
      chunk,
      done,
      message,
    }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any) => {
      if (streamChatId != chatId) return;
      const lastMsg = messages.at(-1);
      if (!lastMsg) return;
      if (!lastMsg._id && lastMsg.streaming) return;
      if (chunk?.trim() && !done) {
        setAiChunk((prev) => {
          const newContent = prev + chunk;
          addOrUpdateMessage(
            chatId,
            {
              ...lastMsg,
              content: newContent,
            } as MessageType,
            lastMsg?._id
          );
          return newContent;
        });
        return;
      }
      if (done) {
        console.log("ai full message:", message);
        setAiChunk("");
      }
    };
    socket.on("chat:ai", handleAiStream);
    return () => {
      socket.off("chat:ai", handleAiStream);
    };
  }, [addOrUpdateMessage, chatId, messages, socket]);

  useEffect(() => {
    if (!chatId) return;
    if (!socket) return;

    const handleNewMessage = (msg: MessageType) => addNewMessage(chatId, msg);

    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, chatId, addNewMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior: "auto",
      });
    }
  }, [messages, rowVirtualizer]); // 监听 messages 变化

  return (
    // <div className="w-full max-w-6xl mx-auto flex flex-col px-3 py-2">
    //   {messages.map((message) => (
    //     <ChatBodyMessage
    //       key={message._id}
    //       message={message}
    //       onReply={onReply}
    //     />
    //   ))}
    //   <div ref={bottomRef} />
    // </div>
    <div
      className="w-full max-w-6xl mx-auto relative"
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`, // 撑开总高度
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualItem) => {
        const message = messages[virtualItem.index];
        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={rowVirtualizer.measureElement} // 关键：测量真实高度
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`, // 定位到正确位置
              paddingLeft: "12px", // 手动补回之前的 px-3
              paddingRight: "12px",
            }}
          >
            <ChatBodyMessage
              key={message._id}
              message={message}
              onReply={onReply}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ChatBody;
