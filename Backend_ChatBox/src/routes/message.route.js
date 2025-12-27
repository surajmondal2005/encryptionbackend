// src/routes/message.route.js - FIXED VERSION
import express from "express";
import {
  getAllContacts,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
  markMessageAsRead,
  searchMessages,
} from "../controllers/message.controller.js";

import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadSingle, debugUpload } from "../middleware/upload.middleware.js";

const router = express.Router();

// Debug route for testing uploads
router.post("/debug-upload", debugUpload, (req, res) => {
  res.json({ 
    message: "Debug endpoint",
    headers: req.headers,
    body: req.body 
  });
});

// ALL MESSAGE ROUTES REQUIRE AUTH
router.use(protectRoute);

// GET CONTACTS
router.get("/contacts", getAllContacts);

// GET CHAT PARTNERS LIST
router.get("/chats", getChatPartners);

// GET MESSAGES BY CONVERSATION ID (E2EE requirement)
router.get("/:conversationId", getMessagesByUserId);

// SEND MESSAGE (TEXT OR IMAGE)
router.post("/send/:id", sendMessage);

// SEND MESSAGE WITH FILE ATTACHMENT
// IMPORTANT: frontend must send field name as "file"
router.post("/send/:id/with-file", uploadSingle, sendMessage);

// MARK AS READ (BLUE TICKS)
router.put("/read/:messageId", markMessageAsRead);

// SEARCH MESSAGES
router.get("/search/:userId", searchMessages);

export default router;
