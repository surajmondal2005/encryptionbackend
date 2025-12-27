import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true, // Unique identifier for conversation
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    senderDeviceId: {
      type: Number,
      required: true, // Device that sent the message
    },

    // Signal Protocol message types
    messageType: {
      type: String,
      enum: ["PreKeySignalMessage", "SignalMessage", "SenderKeyMessage"],
      required: true,
    },

    // Encrypted message content (ciphertext only)
    ciphertext: {
      type: String,
      required: true, // Base64 encoded encrypted message
    },

    // Message metadata
    sequenceNumber: {
      type: Number,
      default: null, // For Double Ratchet
    },

    // NOTE: Backend only stores ciphertext - never plaintext
    // Legacy fields removed to enforce E2EE security

    // Delivery status
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;
