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

### 🟢 Online Presence (optional depending on your implementation)

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
