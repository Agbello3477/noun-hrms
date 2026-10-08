import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

class S3Service {
    private client: any | null = null;
    private bucketName: string | null = null;
    private isEnabled = false;

    constructor() {
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
            try {
                this.client = new S3Client({
                    region: process.env.AWS_REGION || 'eu-west-1', // Default to AWS Ireland (closest to Nigeria)
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                    }
                });
                this.bucketName = process.env.AWS_S3_BUCKET;
                this.isEnabled = true;
                console.log('[S3 Service] AWS S3 client initialized successfully.');
            } catch (err) {
                console.error('[S3 Service] Failed to initialize S3 client:', err);
            }
        }
    }

    /**
     * Uploads file to AWS S3 bucket for horizontal stateless execution.
     * Fallbacks to local uploads path if AWS S3 environment variables are missing.
     */
    async uploadFile(fileBuffer: Buffer, originalName: string, mimeType: string): Promise<string> {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${originalName}`;
        
        if (!this.isEnabled || !this.client || !this.bucketName) {
            console.warn('[S3 Service] S3 is not configured. Falling back to local disk uploads.');
            // Local fallback logic return mock path
            return `/uploads/${uniqueName}`;
        }

        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: uniqueName,
                Body: fileBuffer,
                ContentType: mimeType,
                ACL: 'public-read' // Public readable for profile picture/attachments
            });

            await this.client.send(command);
            const s3Url = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com/${uniqueName}`;
            console.log(`[S3 Service] File uploaded to S3 successfully: ${s3Url}`);
            return s3Url;
        } catch (error) {
            console.error('[S3 Service] Upload failed. Falling back to local store:', error);
            return `/uploads/${uniqueName}`;
        }
    }
}

export const s3Service = new S3Service();
export default s3Service;
