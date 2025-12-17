// src/middleware/upload.middleware.js - COMPLETE FIXED VERSION
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// Disk storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create safe filename
    const originalName = path.parse(file.originalname).name;
    const extension = path.extname(file.originalname);
    const safeName = originalName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${Date.now()}_${safeName}${extension}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'video/mp4', 'video/quicktime',
    'audio/mpeg', 'audio/mp3'
  ];
  
  // Allowed file extensions
  const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|mp4|mov|mp3/;
  
  // Check both MIME type and extension
  const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.test(extname);
  
  if (isValidMimeType && isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed: ${allowedExtensions.source}`), false);
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 15 * 1024 * 1024, // 15MB limit
    files: 1 // Only one file at a time
  },
});

// Export different upload options
export const uploadSingle = upload.single("file"); // For field name "file"
export const uploadSingleImage = upload.single("image"); // For field name "image"
export const uploadSingleAttachment = upload.single("attachment"); // For field name "attachment"

// Debug middleware to see what's being uploaded
export const debugUpload = (req, res, next) => {
  console.log('📁 Upload debug - Content-Type:', req.headers['content-type']);
  console.log('📁 Upload debug - Body keys:', Object.keys(req.body));
  console.log('📁 Upload debug - File field expected: "file"');
  next();
};

// Main export for backward compatibility
export { upload };