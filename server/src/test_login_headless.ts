import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

    ws.on('message', (data: string) => {
        const msg = JSON.parse(data);
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
    });

    ws.on('open', async () => {
        console.log('WebSocket connected. Setting up listeners...');
        await send('Page.enable');
        await send('Runtime.enable');

        console.log('Navigating to http://localhost:3000/login...');
        await send('Page.navigate', { url: 'http://localhost:3000/login' });

        // Wait 5 seconds to see what happens after redirect
        await new Promise(r => setTimeout(r, 5000));

        // Take a screenshot
        console.log('Capturing screenshot...');
        const screenshotResult: any = await send('Page.captureScreenshot');
        if (screenshotResult && screenshotResult.data) {
            const buffer = Buffer.from(screenshotResult.data, 'base64');
            const destPath = '/Users/abdulgaffarbello/.gemini/antigravity/brain/1244a186-946b-403c-abc6-6a332179a6f0/login_result.png';
            fs.writeFileSync(destPath, buffer);
            console.log('Screenshot saved to:', destPath);
        } else {
            console.log('Failed to capture screenshot');
        }

        // Dump DOM HTML to a file too for inspection
        const domResult: any = await send('Runtime.evaluate', {
            expression: 'document.documentElement.outerHTML'
        });
        const htmlDest = '/Users/abdulgaffarbello/.gemini/antigravity/brain/1244a186-946b-403c-abc6-6a332179a6f0/login_result.html';
        fs.writeFileSync(htmlDest, domResult.result?.value || '');
        console.log('HTML saved to:', htmlDest);

        const urlResult: any = await send('Runtime.evaluate', {
            expression: 'window.location.href'
        });
        console.log('Current URL:', urlResult.result?.value);

        // Close page
        await send('Page.close');
        ws.close();
        process.exit(0);
    });
}

run().catch(console.error);
