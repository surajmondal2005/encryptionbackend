import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import firebase from "../lib/firebase.js";

/** Helper: build base URL for uploaded files */
const getBaseUrl = () =>
  process.env.BASE_URL ||
  `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3000}`;

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const users = await User.find({ 
      _id: { $ne: loggedInUserId },
      blockedUsers: { $ne: loggedInUserId }
    }).select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByConversationId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { conversationId } = req.params;

    // Find messages by conversation ID
    const messages = await Message.find({ conversationId }).sort("createdAt");

    // Verify user is part of this conversation
    const userInConversation = messages.some(msg =>
      msg.senderId.toString() === myId.toString() ||
      msg.receiverId.toString() === myId.toString()
    );

    if (messages.length > 0 && !userInConversation) {
      return res.status(403).json({ message: "Not authorized to access this conversation" });
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessagesByConversationId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { id: receiverId } = req.params;
    const {
      ciphertext,
      messageType,
      senderDeviceId,
      conversationId,
      sequenceNumber
    } = req.body;

    // E2EE: Backend only handles ciphertext - never plaintext
    if (!ciphertext || !messageType) {
      return res.status(400).json({
        message: "ciphertext and messageType are required for encrypted messages."
      });
    }

    if (!senderDeviceId || !conversationId) {
      return res.status(400).json({
        message: "senderDeviceId and conversationId are required."
      });
    }

    // Validate Signal Protocol message type
    const validTypes = ["PreKeySignalMessage", "SignalMessage", "SenderKeyMessage"];
    if (!validTypes.includes(messageType)) {
      return res.status(400).json({
        message: "Invalid messageType. Must be one of: " + validTypes.join(", ")
      });
    }

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }

    const [receiver, sender] = await Promise.all([
      User.findById(receiverId).select("blockedUsers fcmTokens fullName"),
      User.findById(senderId).select("blockedUsers fullName")
    ]);

    if (!receiver) return res.status(404).json({ message: "Receiver not found." });

    if (receiver.blockedUsers?.includes(senderId)) {
      return res.status(403).json({ message: "You are blocked by this user" });
    }

    if (sender.blockedUsers?.includes(receiverId)) {
      return res.status(403).json({ message: "You have blocked this user" });
    }

    // Create encrypted message object (ciphertext only)
    const messageData = {
      conversationId,
      senderId,
      receiverId,
      senderDeviceId,
      messageType,
      ciphertext, // Backend never sees plaintext
      sequenceNumber,
      status: "sent",
    };

    let newMessage = await Message.create(messageData);

    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      newMessage.status = "delivered";
      newMessage.deliveredAt = new Date();
      await newMessage.save();

      io.to(receiverSocketId).emit("newMessage", {
        messageId: newMessage._id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        senderDeviceId: newMessage.senderDeviceId,
        messageType: newMessage.messageType,
        ciphertext: newMessage.ciphertext, // Backend only sends ciphertext
        sequenceNumber: newMessage.sequenceNumber,
        status: newMessage.status,
        timestamp: newMessage.createdAt
      });
    }

    // Send push notification if Firebase is initialized and receiver has tokens
    if (receiver.fcmTokens && receiver.fcmTokens.length > 0 && firebase.admin?.messaging) {
      console.log(`🔔 Sending push to ${receiver.fcmTokens.length} device(s)`);

      // Send to ALL device tokens (not just first one)
      const sendPromises = receiver.fcmTokens.map(async (token) => {
        try {
          const message = {
            token: token,
            notification: {
              title: `New message from ${sender.fullName}`,
              body: "New encrypted message",
            },
            data: {
              type: "MESSAGE",
              senderId: senderId.toString(),
              messageId: newMessage._id.toString(),
              conversationId: conversationId,
              click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "chat_messages",
                sound: "default"
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                  contentAvailable: true
                }
              }
            }
          };

          // ✅ Use direct Firebase Admin SDK for background notifications
          const response = await firebase.admin.messaging().send(message);
          console.log(`✅ Push sent to ${token.substring(0, 10)}...`);
          return response;

        } catch (error) {
          console.error(`❌ Failed to send to token ${token.substring(0, 10)}...:`, error.message || error.code);

          // Remove invalid tokens
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            console.log(`🗑️ Removing invalid token: ${token.substring(0, 10)}...`);
            await User.findByIdAndUpdate(receiverId, {
              $pull: { fcmTokens: token }
            });
          }
          return null;
        }
      });

      // Send all notifications in parallel
      await Promise.all(sendPromises).catch(err =>
        console.error('Batch notification error:', err)
      );
    }

    res.status(201).json({
      messageId: newMessage._id,
      conversationId: newMessage.conversationId,
      status: newMessage.status,
      timestamp: newMessage.createdAt,
      messageType: newMessage.messageType,
      ciphertext: newMessage.ciphertext, // Backend only returns ciphertext
      sequenceNumber: newMessage.sequenceNumber
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    message.status = "read";
    message.readAt = new Date();
    await message.save();

    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageRead", {
        messageId,
        readAt: message.readAt,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error in markMessageAsRead:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const myId = req.user._id;

    // Get messages where current user is sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: myId }, { receiverId: myId }],
    }).sort({ createdAt: -1 });

    const chatMap = new Map();

    for (let msg of messages) {
      const partnerId =
        msg.senderId.toString() === myId.toString()
          ? msg.receiverId.toString()
          : msg.senderId.toString();

      if (!chatMap.has(partnerId)) {
        // E2EE: Backend cannot read message content - show generic message type
        const lastMessageText = msg.messageType === "PreKeySignalMessage"
          ? "🔐 Initial encrypted message"
          : msg.messageType === "SignalMessage"
            ? "💬 Encrypted message"
            : "🔑 Encrypted group message";

        chatMap.set(partnerId, {
          partnerId,
          lastMessage: msg,
          lastMessageAt: msg.createdAt,
          lastMessageText: lastMessageText,
          unreadCount: 0,
        });
      }

      // Count unread messages
      if (msg.receiverId.toString() === myId.toString() && msg.status !== "read") {
        const entry = chatMap.get(partnerId);
        if (entry) {
          entry.unreadCount = (entry.unreadCount || 0) + 1;
        }
      }
    }

    const partnerIds = Array.from(chatMap.keys());

    if (partnerIds.length === 0) {
      return res.status(200).json([]);
    }

    const users = await User.find({ 
      _id: { $in: partnerIds },
      blockedUsers: { $ne: myId }
    }).select("-password");

    // Build result with proper fallbacks
    const result = users.map((user) => {
      const userObj = user.toObject();
      const partnerId = user._id.toString();
      const chatData = chatMap.get(partnerId) || {
        lastMessage: null,
        lastMessageAt: null,
        lastMessageText: "",
        unreadCount: 0,
      };

      return {
        ...userObj,
        lastMessage: chatData.lastMessage,
        lastMessageAt: chatData.lastMessageAt,
        lastMessageText: chatData.lastMessageText || "",
        unreadCount: chatData.unreadCount || 0,
      };
    });

    // Sort by last message time (most recent first)
    result.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getChatPartners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const searchMessages = async (req, res) => {
  // E2EE: Backend cannot search ciphertext content
  // Search functionality must be implemented on the client side after decryption
  res.json({
    message: "Message search is not available on the server due to end-to-end encryption. Please search decrypted messages on the client side.",
    results: []
  });
};
