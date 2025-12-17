import express from "express";
import http from "http";
import { Server } from "socket.io";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";

export const app = express();
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: ENV.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  }
});

const onlineUsers = new Map();

// Use the separate auth middleware
io.use(socketAuthMiddleware);

export const getReceiverSocketId = (receiverId) => {
  return onlineUsers.get(receiverId);
};

io.on("connection", (socket) => {
  const userId = socket.userId;

  if (!userId) {
    console.error("Socket connected without userId");
    socket.disconnect();
    return;
  }

  onlineUsers.set(userId, socket.id);

  console.log("🟢 User connected:", userId);

  // Broadcast updated online users list
  io.emit("onlineUsers", Array.from(onlineUsers.keys()));

  socket.on("typing", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { from: userId });
    }
  });

  socket.on("stopTyping", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { from: userId });
    }
  });

  socket.on("messageRead", ({ messageId, senderId }) => {
    const receiverSocketId = getReceiverSocketId(senderId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageRead", { messageId });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    console.log("🔴 User disconnected:", userId);
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});