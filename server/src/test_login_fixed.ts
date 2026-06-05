import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';

function getPageSocket(): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const targets = JSON.parse(data);
                const pageTarget = targets.find((t: any) => t.type === 'page');
                if (pageTarget) {
                    resolve(pageTarget.webSocketDebuggerUrl);
                } else {
                    reject(new Error('No active page target found'));
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    const wsUrl = await getPageSocket();
    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    let id = 1;

    function send(method: string, params: any = {}) {
        const msgId = id++;
        const payload = JSON.stringify({ id: msgId, method, params });
        console.log('SENDING:', payload);
        ws.send(payload);
    }

    ws.on('message', (data: WebSocket.Data) => {
        try {
            console.log('RECEIVED:', data.toString().substring(0, 1000));
            // Check if it's screenshot data
            const msg = JSON.parse(data.toString());
            if (msg.result && msg.result.data && msg.id === 1) {
                const buffer = Buffer.from(msg.result.data, 'base64');
                const destPath = '/Users/abdulgaffarbello/.gemini/antigravity/brain/1244a186-946b-403c-abc6-6a332179a6f0/current_screenshot.png';
                fs.writeFileSync(destPath, buffer);
                console.log('Screenshot saved to:', destPath);
            }
        } catch (e) {
            console.error('Error handling message:', e);
        }
    });

    ws.on('open', async () => {
        console.log('WebSocket connected. Sending commands...');
        
        send('Page.captureScreenshot');
        send('Runtime.evaluate', { expression: 'window.location.href' });
        send('Runtime.evaluate', { expression: 'document.title' });

        // Wait 5 seconds to receive all responses
        await new Promise(r => setTimeout(r, 5000));
        console.log('Exiting...');
        ws.close();
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
    });
}

run().catch(console.error);
