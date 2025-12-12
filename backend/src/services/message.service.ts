import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ModelMessage, streamText } from "ai";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.config";
import ChatModel from "../models/chat.model";
import MessageModel from "../models/message.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  emitChatAI,
  emitLastMessageToParticipants,
  emitNewMessageToChatRoom,
} from "../lib/socket";
import { Env } from "../config/env.config";
import UserModel from "../models/user.model";

const google = createGoogleGenerativeAI({
  apiKey: Env.GOOGLE_API_KEY,
});

export const sendMessageService = async (
  userId: string,
  body: {
    chatId: string;
    content?: string;
    image?: string;
    replyToId?: string;
  }
) => {
  const { chatId, content, image, replyToId } = body;
  //这里的查询应该是确保用户在这个chat里吧?
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: {
      $in: [userId],
    },
  });
  if (!chat) throw new BadRequestException("Chat not found or unauthorized");
  //确保回复的消息是存在的，这里的replyToId是消息Id，而不是用户id
  if (replyToId) {
    const replyMessage = await MessageModel.findOne({
      _id: replyToId,
      chatId,
    });
    if (!replyMessage) throw new NotFoundException("Reply message not found");
  }

  let imageUrl;

  if (image) {
    //upload the image to cloudinary
    const uploadRes = await cloudinary.uploader.upload(image);
    imageUrl = uploadRes.secure_url;
  }

  const newMessage = await MessageModel.create({
    chatId,
    sender: userId,
    content,
    image: imageUrl,
    replyTo: replyToId || null,
  });

  await newMessage.populate([
    { path: "sender", select: "name avatar" },
    {
      path: "replyTo",
      select: "content image sender",
      populate: {
        path: "sender",
        select: "name avatar",
      },
    },
  ]);

  chat.lastMessage = newMessage._id as mongoose.Types.ObjectId;
  await chat.save();

  //websocket emit the new Message to the chat room
  emitNewMessageToChatRoom(userId, chatId, newMessage);

  //websocket emit the lastmessage to members (personnal room user)
  const allParticipantIds = chat.participants.map((id) => id.toString());
  emitLastMessageToParticipants(allParticipantIds, chatId, newMessage);

  let aiResponse: any = null;
  if (chat.isAiChat) {
    aiResponse = await getAiResponse(chatId, userId);
    if (aiResponse) {
      chat.lastMessage = aiResponse._id as mongoose.Types.ObjectId;
      await chat.save();
    }
  }

  return {
    userMessage: newMessage,
    aiResponse,
    chat,
  };
};

async function getAiResponse(chatId: string, userId: string) {
  const whopAi = await UserModel.findOne({ isAi: true });
  if (!whopAi) throw new NotFoundException("Ai User is not found");

  const chatHistory = await getChatHistory(chatId);
  const formattedMessages: ModelMessage[] = chatHistory.map((msg: any) => {
    const role = msg.sender.isAi ? "assistant" : "user";
    const parts: any[] = [];
    if (msg.image) {
      parts.push({
        type: "file",
        data: msg.image,
        mediaType: "image/png",
        filename: "image.png",
      });
      if (!msg.content) {
        parts.push({
          type: "text",
          text: "Describe what you see in the image",
        });
      }
    }
    if (msg.content) {
      parts.push({
        type: "text",
        text: msg.replyTo
          ? `[Replying to:"${msg.replyTo.content}"]\n${msg.content}`
          : msg.content,
      });
    }
    return { role, content: parts };
  });
  const result = streamText({
    model: google("gemini-2.5-flash"),
    messages: formattedMessages,
    system:
      "you are Whop AI, a helper and friendly assistant. Respond only with text and attend to the last user message only.",
  });

  let fullResponse = "";
  for await (const chunk of result.textStream) {
    emitChatAI({
      chatId,
      chunk,
      sender: whopAi,
      done: false,
      message: null,
    });
    fullResponse += chunk;
  }
  if (!fullResponse.trim()) return "";
  const aiMessage = await MessageModel.create({
    chatId,
    sender: whopAi._id,
    content: fullResponse,
  });
  await aiMessage.populate("sender", "name avatar isAi");
  //emit ai fullresponse
  emitChatAI({
    chatId,
    chunk: null,
    sender: whopAi,
    done: true,
    message: aiMessage,
  });
  emitLastMessageToParticipants([userId], chatId, aiMessage);
  return aiMessage;
}

async function getChatHistory(chatId: string) {
  const messages = await MessageModel.find({ chatId })
    .populate("sender", "isAi")
    .populate("replyTo", "content")
    .sort({ createAt: -1 })
    .limit(5)
    .lean();
  return messages.reverse();
}
