declare module 'y-websocket/bin/utils' {
    import { IncomingMessage } from 'http';
    import { WebSocket } from 'ws';
    import { Doc } from 'yjs';

    export function setupWSConnection(
        conn: WebSocket,
        req: IncomingMessage,
        options?: {
            docName?: string;
            gc?: boolean;
        }
    ): void;

    export const docs: Map<string, Doc>;
}
