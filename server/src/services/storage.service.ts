import fs from 'fs';
import path from 'path';

// Mock Storage Service
// In production, replace this with AWS S3 or Supabase Storage SDK

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const StorageService = {
    uploadFile: async (file: Express.Multer.File, folder: string = 'docs'): Promise<string> => {
        // If file is already processed and written by diskStorage with a filename, reuse it directly
        if (file.filename) {
            return `/uploads/${file.filename}`;
        }

        const sanitized = file.originalname ? file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_') : 'file.bin';
        const filename = `${Date.now()}-${sanitized}`;
        const targetPath = path.join(UPLOAD_DIR, filename);

        // Ensure upload directory exists asynchronously
        try {
            await fs.promises.access(UPLOAD_DIR);
        } catch {
            await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
        }

        if (file.buffer) {
            await fs.promises.writeFile(targetPath, file.buffer);
        } else if (file.path) {
            // If multer saved to temp, move it
            await fs.promises.rename(file.path, targetPath);
        }

        return `/uploads/${filename}`;
    },

    deleteFile: async (fileUrl: string): Promise<void> => {
        // Remove local file
        const filename = path.basename(fileUrl);
        const targetPath = path.join(UPLOAD_DIR, filename);
        try {
            await fs.promises.access(targetPath);
            await fs.promises.unlink(targetPath);
        } catch (error) {
            // File doesn't exist or is inaccessible, ignore safely
        }
    },

    getUrl: (path: string): string => {
        // In S3 this would sign a URL
        return path;
    }
};
