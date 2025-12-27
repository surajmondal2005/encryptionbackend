// src/lib/utils.js
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

// Generate unique conversation ID for two users
export const generateConversationId = (userId1, userId2) => {
  // Sort user IDs to ensure consistent conversation ID regardless of order
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

export const generateToken = (userId, res) => {
  const { JWT_SECRET } = ENV;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  });

  if (res && typeof res.cookie === "function") {
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: ENV.NODE_ENV !== "development",
    });
  }

  return token;
};
