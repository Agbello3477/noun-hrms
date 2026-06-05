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
    const pending = new Map<number, (res: any) => void>();

    function send(method: string, params: any = {}) {
        const msgId = id++;
        const payload = JSON.stringify({ id: msgId, method, params });
        ws.send(payload);
        return new Promise((resolve) => {
            pending.set(msgId, resolve);
        });
    }

    ws.on('message', (data: WebSocket.Data) => {
        try {
            const dataStr = data.toString();
            const msg = JSON.parse(dataStr);
            if (msg.id && pending.has(msg.id)) {
                pending.get(msg.id)!(msg.result);
                pending.delete(msg.id);
            }

            // Listen for console logs
            if (msg.method === 'Runtime.consoleAPICalled') {
                const args = msg.params.args.map((a: any) => {
                    if (a.value !== undefined) return String(a.value);
                    if (a.description !== undefined) return a.description;
                    return JSON.stringify(a);
                }).join(' ');
                console.log(`[BROWSER CONSOLE ${msg.params.type.toUpperCase()}]`, args);
            }

            if (msg.method === 'Runtime.exceptionThrown') {
                console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails.exception.description);
            }
        } catch (e: any) {
            console.error('Error in message handler:', e.message);
        }
    });

    ws.on('open', async () => {
        console.log('WebSocket connected. Enabling Page/Runtime...');
        await send('Page.enable');
        await send('Runtime.enable');

        // Let's navigate explicitly to http://localhost:3000 to see what it is
        console.log('Navigating to http://localhost:3000...');
        await send('Page.navigate', { url: 'http://localhost:3000' });

        console.log('Waiting 3 seconds for load...');
        await new Promise(r => setTimeout(r, 3000));

        console.log('Fetching URL...');
        const urlResult: any = await send('Runtime.evaluate', { expression: 'window.location.href' });
        console.log('Current URL:', urlResult.result?.value);

        console.log('Fetching DOM HTML...');
        const domResult: any = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML' });
        fs.writeFileSync('/Users/abdulgaffarbello/.gemini/antigravity/brain/1244a186-946b-403c-abc6-6a332179a6f0/current_page.html', domResult.result?.value || '');
        console.log('HTML saved.');

        console.log('Capturing screenshot...');
        const screenshotResult: any = await send('Page.captureScreenshot');
        if (screenshotResult && screenshotResult.data) {
            const buffer = Buffer.from(screenshotResult.data, 'base64');
            fs.writeFileSync('/Users/abdulgaffarbello/.gemini/antigravity/brain/1244a186-946b-403c-abc6-6a332179a6f0/current_screenshot.png', buffer);
            console.log('Screenshot saved.');
        } else {
            console.log('Failed to capture screenshot');
        }

        ws.close();
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
    });
}

run().catch(console.error);
