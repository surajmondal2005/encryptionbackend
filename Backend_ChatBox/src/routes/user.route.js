import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  pinUser,
  unpinUser,
  getPinnedUsers,
  // ADD THESE TWO IMPORTS
  updatePublicKey,
  getUserPublicKey,
} from "../controllers/user.controller.js";

const router = express.Router();

// Protect all user routes
router.use(protectRoute);

// --- Encryption Key Routes ---
// Users call this to upload their public key after generating it locally
router.put("/public-key", updatePublicKey); 

// Users call this to get Bob's public key before sending him a message
router.get("/public-key/:id", getUserPublicKey);

// --- Existing Block/Unblock ---
router.post("/block/:id", blockUser);
router.post("/unblock/:id", unblockUser);
router.get("/blocked", getBlockedUsers);

// --- Existing Pin / Unpin ---
router.post("/pin/:id", pinUser);
router.post("/unpin/:id", unpinUser);
router.get("/pinned", getPinnedUsers);

export default router;