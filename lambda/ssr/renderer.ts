import puppeteer from 'puppeteer';

const ALLOWED_REQUEST_HEADERS = [
    'user-agent',
    'accept',
    'accept-language',
    'accept-encoding',
    'cache-control',
];

const ALLOWED_RESPONSE_HEADERS = [
    'content-type',
    'content-length',
    'last-modified',
    'etag',
    'accept-ranges',
];

const PUPPETEER_LAUNCH_CONFIG = {
    headless: true,
    args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
    ]
};

const renderUrl = async (url: string): Promise<string> => {

    const start = Date.now();
    const browser = await puppeteer.launch(PUPPETEER_LAUNCH_CONFIG);
    const page = await browser.newPage();

    try {
        // networkidle0 waits for the network to be idle (no requests for 500ms).
        // The page's JS has likely produced markup by this point, but wait longer
        // if your site lazy loads, etc.

        const response = await page.goto(url, {
            waitUntil: 'networkidle0',
        });

        const html = await page.content();
        await browser.close();
    
        const ttRenderMs = Date.now() - start;
        console.info(`Headless rendered page in: ${ttRenderMs}ms`);
        return html;

    } catch (err) {
        console.error(err);
        return `Error: ${err}`;
    }
};

export { renderUrl };
