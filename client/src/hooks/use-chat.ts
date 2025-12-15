/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { db } from "@/db/db"; // 引入刚才创建的 db
import type { UserType } from "@/types/auth.type";
import type {
  ChatType,
  CreateChatType,
  CreateMessageType,
  MessageType,
} from "@/types/chat.type";
import { API } from "@/lib/axios-client";
import { toast } from "sonner";
import { useAuth } from "./use-auth";
import { generateUUID } from "@/lib/helper";

interface ChatState {
  chats: ChatType[];
  users: UserType[];
  singleChat: {
    chat: ChatType;
    messages: MessageType[];
  } | null;

  currentAIStreamId: string | null;

  isChatsLoading: boolean;
  isUsersLoading: boolean;
  isCreatingChat: boolean;
  isSingleChatLoading: boolean;
  isSendingMsg: boolean;

  fetchAllUsers: () => void;
  fetchChats: () => void;
  createChat: (payload: CreateChatType) => Promise<ChatType | null>;
  fetchSingleChat: (chatId: string) => void;
  sendMessage: (payload: CreateMessageType, isAiChat?: boolean) => void;

  addNewChat: (newChat: ChatType) => void;
  updateChatLastMessage: (chatId: string, lastMessage: MessageType) => void;
  addNewMessage: (chatId: string, message: MessageType) => void;
  addOrUpdateMessage: (
    chatId: string,
    tempMessage: MessageType,
    tempUserId: string
  ) => void;
}

export const useChat = create<ChatState>()((set, get) => ({
  chats: [],
  users: [],
  singleChat: null,

  isChatsLoading: false,
  isUsersLoading: false,
  isCreatingChat: false,
  isSingleChatLoading: false,
  isSendingMsg: false,

  currentAIStreamId: null,

  fetchAllUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const { data } = await API.get("/user/all");
      set({ users: data.users });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  fetchChats: async () => {
    set({ isChatsLoading: true });
    try {
      // 【新增】1. 优先从 DB 读取缓存，实现秒开
      const localChats = await db.chats
        .orderBy("updatedAt")
        .reverse()
        .toArray();

      // 如果本地有数据，先展示，并结束 Loading 状态（让用户觉得加载完了）
      if (localChats.length > 0) {
        set({ chats: localChats, isChatsLoading: false });
      }
      const { data } = await API.get("/chat/all");
      // 【新增】3. 将最新数据通过 bulkPut (批量更新/插入) 同步到 DB
      // 这样下次刷新时，本地就是最新的
      await db.chats.bulkPut(data.chats);
      set({ chats: data.chats });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
    } finally {
      set({ isChatsLoading: false });
    }
  },

  createChat: async (payload: CreateChatType) => {
    set({ isCreatingChat: true });
    try {
      const response = await API.post("/chat/create", {
        ...payload,
      });
      get().addNewChat(response.data.chat);
      toast.success("Chat created successfully");
      return response.data.chat;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
      return null;
    } finally {
      set({ isCreatingChat: false });
    }
  },

  fetchSingleChat: async (chatId: string) => {
    set({ isSingleChatLoading: true });
    try {
      // 【新增】1. 先尝试读取本地消息
      // 获取该会话的所有消息，按时间排序
      const localMessages = await db.messages
        .where("chatId")
        .equals(chatId)
        .sortBy("createdAt");

      // 还要尝试获取本地缓存的 chat 详情信息（如果 fetchChats 还没跑完）
      const localChatInfo = await db.chats.get(chatId);
      if (localChatInfo) {
        set({
          singleChat: {
            chat: localChatInfo,
            messages: localMessages, // 即使是空数组也可以
          },
          isSingleChatLoading: localMessages.length === 0, // 如果有消息，就不 loading 了
        });
      }
      const { data } = await API.get(`/chat/${chatId}`);
      // 【新增】3. 同步数据到 DB
      // data.chat 是详情，data.messages 是数组
      if (data.chat) await db.chats.put(data.chat);
      if (data.messages && data.messages.length > 0) {
        await db.messages.bulkPut(data.messages);
      }
      set({ singleChat: data });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
    } finally {
      set({ isSingleChatLoading: false });
    }
  },

  sendMessage: async (payload: CreateMessageType, isAiChat?: boolean) => {
    set({ isSendingMsg: true });
    const { chatId, replyTo, content, image } = payload;
    const { user } = useAuth.getState();
    const chat = get().singleChat?.chat;
    const aiSender = chat?.participants.find((p) => p.isAi);

    if (!chatId || !user?._id) return;

    const tempUserId = generateUUID();
    const tempAiId = generateUUID();
    const tempMessage = {
      _id: tempUserId,
      chatId,
      content: content || "",
      image: image || null,
      sender: user,
      replyTo: replyTo || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: !isAiChat ? "sending..." : "",
    };
    get().addOrUpdateMessage(chatId, tempMessage, tempUserId);
    if (isAiChat && aiSender) {
      const tempAiMessage = {
        _id: tempAiId,
        chatId,
        content: "",
        image: null,
        sender: aiSender,
        replyTo: null,
        streaming: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      get().addOrUpdateMessage(chatId, tempAiMessage, tempAiId);
      // // ==================================================
      // // 【新增】前端模拟 AI 回复的核心逻辑 (Mock AI Response)

      // // 1. 假装过个 600ms 后端处理完了，用户消息发送成功
      // setTimeout(() => {
      //   const successUserMsg = { ...tempMessage, status: "sent" };
      //   get().addOrUpdateMessage(chatId, successUserMsg, tempUserId);
      // }, 600);
      // const mockResponseText = `这是一个 **前端模拟** 的 AI 回复。\n\n即使后端没有连接，我也可以通过 \`setInterval\` 来模拟流式打字的效果。\n\n- 模拟速度：50ms/字\n- 状态更新：直接修改 Zustand Store\n\n希望能帮到你调试 UI！🚀`;

      // let currentIndex = 0;
      // // 3. 开启定时器，模拟 Socket 推流
      // const intervalId = setInterval(() => {
      //   // 如果字打完了
      //   if (currentIndex >= mockResponseText.length) {
      //     clearInterval(intervalId);

      //     // 模拟结束：把 streaming 关掉
      //     const finalAiMessage = {
      //       ...tempAiMessage,
      //       content: mockResponseText,
      //       streaming: false, // 关掉动画
      //     };
      //     get().addOrUpdateMessage(chatId, finalAiMessage, tempAiId);
      //     set({ isSendingMsg: false }); // 解锁发送按钮
      //     return;
      //   }

      //   // 取出当前要显示的文字片段 (例如: "这", "这是", "这是一"...)
      //   const currentContent = mockResponseText.slice(0, currentIndex + 1);

      //   // 更新 Store，界面会随之重绘
      //   get().addOrUpdateMessage(
      //     chatId,
      //     {
      //       ...tempAiMessage,
      //       content: currentContent,
      //     },
      //     tempAiId
      //   );

      //   currentIndex++;
      // }, 30); // 调整这里可以控制打字速度，30ms 比较像 AI
      // return;
      // // ==================================================
    }

    try {
      const { data } = await API.post("/chat/message/send", {
        chatId,
        content,
        image,
        replyToId: replyTo?._id,
      });
      if (isAiChat && aiSender && !data.aiResponse) {
        // 手动抛出错误，强行跳转到 catch 块
        // 如果后端返回了错误信息在 data.message 里，就用它，否则用默认文案
        throw new Error(data.message || "服务器业务异常 (200)");
      }
      const { userMessage, aiResponse } = data;

      get().addOrUpdateMessage(chatId, userMessage, tempUserId);
      // 【新增】写入 DB
      await db.messages.put(userMessage); // 存入真实用户消息

      if (isAiChat && aiSender) {
        get().addOrUpdateMessage(chatId, aiResponse, tempAiId);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send message");
      // ✅ 新增：把卡死的气泡救活，变成错误提示
      if (isAiChat && aiSender) {
        get().addOrUpdateMessage(
          chatId,
          {
            _id: tempAiId, // 找到那个假消息 ID
            chatId,
            content: "🔴 AI 回复失败：后端没有响应错误信息。", // 显式写出来
            sender: aiSender,
            streaming: false, // 关掉动画！
            // ...其他字段补全，
            image: null,
            replyTo: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          tempAiId
        );
      }
    } finally {
      set({ isSendingMsg: false });
    }
  },

  addNewChat: (newChat: ChatType) => {
    db.chats
      .put(newChat)
      .catch((err) => console.error("Failed to save chat to DB", err));
    set((state) => {
      const existingChatIndex = state.chats.findIndex(
        (c) => c._id === newChat._id
      );
      if (existingChatIndex !== -1) {
        //move the chat to the top
        return {
          chats: [newChat, ...state.chats.filter((c) => c._id !== newChat._id)],
        };
      } else {
        return {
          chats: [newChat, ...state.chats],
        };
      }
    });
  },

  updateChatLastMessage: (chatId, lastMessage) => {
    db.chats
      .update(chatId, {
        lastMessage,
        updatedAt: lastMessage.updatedAt, // 确保时间同步
      })
      .catch((err) => console.error("Failed to update chat in DB", err));
    set((state) => {
      const chat = state.chats.find((c) => c._id === chatId);
      if (!chat) return state;
      return {
        chats: [
          { ...chat, lastMessage },
          ...state.chats.filter((c) => c._id !== chatId),
        ],
      };
    });
  },

  // 修改 addNewMessage 方法，或者新建一个 handleIncomingMessage
  addNewMessage: async (chatId, message) => {
    // 改为 async
    // 1. 存入 DB
    await db.messages.put(message);

    // 2. 更新最后一条消息到 Chat 表 (用于列表展示预览)
    // 这一步很重要，否则列表页的预览不会更新
    const chat = await db.chats.get(chatId);
    if (chat) {
      await db.chats.update(chatId, { lastMessage: message });
    }

    // 3. 原有的 Zustand 更新逻辑
    const singleChat = get().singleChat;
    if (singleChat?.chat._id === chatId) {
      set({
        singleChat: {
          chat: singleChat.chat,
          messages: [...singleChat.messages, message],
        },
      });
    }

    // 4. 同时更新列表 Store (如果需要)
    // ...
  },

  addOrUpdateMessage: (chatId: string, msg: MessageType, tempId?: string) => {
    const singleChat = get().singleChat;
    if (!singleChat || singleChat.chat._id != chatId) return;
    const messages = singleChat.messages;
    const msgIndex = tempId
      ? messages.findIndex((msg) => msg._id === tempId)
      : -1;
    let updatedMessages;
    if (msgIndex !== -1) {
      updatedMessages = messages.map((message, i) =>
        i === msgIndex ? { ...msg } : message
      );
    } else {
      updatedMessages = [...messages, msg];
    }
    set({
      singleChat: {
        chat: singleChat.chat,
        messages: updatedMessages,
      },
    });
  },
}));
