# 💬 Real-Time Chat Application

A full-featured real-time chat application built with **React**, **TypeScript**, **Node.js**, and **Socket.IO**.  
Supports private chat, group chat, real-time messaging, image messages, “is typing” indicators, and more.  
AI chat integration is planned as the next major feature.

---

## 🚀 Features

### 🔐 Authentication

- User registration & login
- Secure session handling with JWT cookies
- Input validation and form management

### 💬 Real-Time Messaging

- Real-time private chat
- Real-time group chat using Socket.IO rooms
- Message delivery status and UI updates

### ✏️ Typing Indicator

- Shows when other users are typing in the conversation
- Works in both 1-on-1 and group chats

### 🖼️ Image Messages

- Upload images using Cloudinary
- Preview and send images inside chat

### 🟢 Online Presence

- Track online/offline status of users

---

## 📚 Tech Stack

### Frontend

- React + TypeScript
- Zustand / Redux (if used)
- TailwindCSS + shadcn/ui
- Socket.IO Client
- React Hook Form + Zod

### Backend

- Node.js + Express + TypeScript
- Socket.IO Server
- MongoDB + Mongoose (or Prisma)
- Cloudinary image upload
- JWT + cookies for auth

---

## Implementation

### Real-Time-Message

#### Real-Time Message System (基于 Socket.IO) 本系统使用 socket.io（后端） + socket.io-client（前端） 实现实时聊天、在线状态、最新消息推送等能力

- 1.关键概念：会话管理器 (io) 与 会话对象 (socket)
  Socket.IO 的通信体系包含两层：
  - 会话管理器(io):全局层级，io 代表整个 WebSocket 服务，它负责：
    - 1.附着于 http 服务器，监听网络连接
    - 2.处理连接握手：处理 socket.io 的协议握手（第一次连接）
    - 3.全局中间件(io.use)：鉴权、解析 Cookie、提取 userId
    - 4.全局广播(io.emit)：向所有连接的客户端发送事件
    - 5.创建 socket 对象：每个客户端连接都会生成一个独立的 socket
  - 会话对象职责：
    - 1.一对一通信：socket.emit() 只发消息给这个客户端；socket.on() 只监听这个客户端发来的消息
    - 2.存储会话信息：你可以在 socket 对象上挂载数据（如 socket.userId = ...），这些数据在整个连接生命周期内都有效
    - 3.加入/离开房间：socket.join(roomId) 让这个客户端加入一个“房间”，方便进行分组广播
    - 4.断开连接：当客户端断开时，这个 socket 对象也随之失效
- 2.服务器工作流程:

  - 1.创建 io 并附着到 HTTP 服务
  - 2.配置跨域与中间件:解析 Cookie,获取 userId,拦截非法用户
  - 3.让会话管理器监听来自客户端的连接，当有客户端发起连接时：
    - 1.创建该用户专属 socket
    - 2.把用户加入**在线用户列表**
    - 3.广播在线用户列表给所有人 (io.emit)
    - 4.创建用户专属房间：user:{userId},用于推送“最新消息更新”、“新会话创建”等**非房间内事件**
  - 4.客户端点击某个聊天 = 告诉服务器：`socket.emit("chat:join", chatId)`,服务器把该用户加入房间：chat:{chatId},用于房间内实时接收消息、输入状态等
  - 5.当用户发送消息：
    - 1.客户端先通过 HTTP API 将消息写入数据库
    - 2.服务器拿到这条新消息后，用 io 给聊天房间所有人实时广播：`io.to(`chat:${chatId}`).emit("chat:new-message", message)`
    - 3.同时需要更新聊天的**最新消息**:但是不能用房间广播，因为
      - 1.用户 A 在线且属于该聊天频道，但不在该 chat 房间
      - 2.他应该收到“最新消息更新”
      - 3.但不应收到实际聊天内容
      - 4.服务器根据 chatId 获取该 chat 所有参与者 → 向每个用户的 user:{userId} 专属房间推送最新消息更新
  - 6.新会话 newChat 推送：
    - 创建一个 chat 后：1.所有人都不在 chat:{chatId} 房间 2.但他们必须收到左侧会话栏更新
    - 也通过`io.to(`user:${userId}`).emit("chat:new-chat", chatInfo)`
  - 7.输入中状态（typing）:输入状态只对当前聊天上下文生效：
    - `io.to(`chat:${chatId}`).emit("chat:typing", { userId, typing: true })`
    - 这里使用 chat 房间广播是适合的，因为只有正在聊天的人应该看到谁在打字。
  - 8.用户断开连接
    - 从在线用户列表移除
    - io 广播新的在线列表

| 功能               | 数据来源         | 事件触发方式   | 使用的房间             |
| ------------------ | ---------------- | -------------- | ---------------------- |
| 聊天消息实时显示   | 新消息（数据库） | 服务端主动推送 | chat 房间              |
| 最新消息更新       | 新消息           | 服务端主动推送 | user 房间              |
| 创建新会话 newChat | 用户创建 chat    | 服务端主动推送 | user 房间              |
| 在线状态           | io 连接/断开     | io 全局广播    | 无房间（直接 io.emit） |
| 输入状态 typing    | 客户端输入       | 房间广播       | chat 房间              |
