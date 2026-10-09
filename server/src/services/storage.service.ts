import fs from 'fs';
import path from 'path';

// Mock Storage Service
// In production, replace this with AWS S3 or Supabase Storage SDK

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    try {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    } catch (e) {}
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

    saveBase64Image: async (base64Data: string, prefix: string = 'passport'): Promise<string> => {
        if (!base64Data || !base64Data.startsWith('data:image/')) {
            return base64Data;
        }

        try {
            const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return base64Data;
            }

            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            let ext = '.png';
            if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = '.jpg';
            else if (mimeType === 'image/webp') ext = '.webp';
            else if (mimeType === 'image/gif') ext = '.gif';

            const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            const targetPath = path.join(UPLOAD_DIR, filename);

            if (!fs.existsSync(UPLOAD_DIR)) {
                fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }

            await fs.promises.writeFile(targetPath, buffer);
            return `/uploads/${filename}`;
        } catch (error) {
            console.error('Error saving base64 image:', error);
            return base64Data;
        }
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
