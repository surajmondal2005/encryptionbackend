// src/models/Message.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    image: { type: String, default: null },

    // FILE FIELD (PDF, DOC, XLS…)
    file: {
      type: String,
      default: null,
    },

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

// Guard against model overwrite in watch / hot-reload environments
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
