/**
 * This is app for running the SSR locally.
 * https://developers.google.com/web/tools/puppeteer/articles/ssr
 */

import express from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { renderUrl } from './renderer';

const hostname: string = process.env.HOSTNAME || '127.0.0.1';
const port: number = parseInt(<string>process.env.PORT, 10) || 80;
const originBaseUrl: string = process.env.ORIGIN_BASE_URL || 'http://localhost:8080';

const app = express();

const onProxyRes =  responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    if (proxyRes.headers['content-type'] !== 'text/html') {
        return responseBuffer;
    }

    console.log('Rendering HTML');
    const url = originBaseUrl + req.url;
    console.log(url);
    //NOTE: This will make 2 round-trip to the servers.
    // But since this is only for crawler and will be cached anyway,
    // this overhead should be okay.
    const start = Date.now();
    const renderedHtml = await renderUrl(url);
    const ttrMs = Date.now() - start;
    res.setHeader('X-SSR-Render', 'true');
    res.setHeader('X-SSR-Render-Time', `${ttrMs}ms`);
    return renderedHtml;
});

const proxy = createProxyMiddleware({
    target: originBaseUrl,
    selfHandleResponse: true,
    onProxyRes: onProxyRes
});

app.use('*', proxy);

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
