// src/db/db.ts
import Dexie, { type Table } from "dexie";
import type { ChatType, MessageType } from "@/types/chat.type";

export class WhopDatabase extends Dexie {
  // 定义表和对应的类型
  chats!: Table<ChatType>;
  messages!: Table<MessageType>;

  constructor() {
    super("WhopChatDB");

    // 定义 Schema
    // & 表示主键 (backend _id)
    // 索引字段用于排序和查询
    this.version(1).stores({
      chats: "&_id, updatedAt", // 使用 _id 作为主键，updatedAt 用于列表排序
      messages: "&_id, chatId, createdAt", // chatId 用于查找某段对话的消息
    });
  }
}

export const db = new WhopDatabase();
