// The game is served two ways: at its own domain root, and under /terra-incognita
// when www.portman.ca proxies it as a subpath. Both must address the API and the
// architecture page correctly, so this spec drives the real client through a local
// stand-in for that proxy and asserts on the URLs the client actually requests.
const http = require('node:http');
const { test, expect } = require('@playwright/test');

const PREFIX = '/terra-incognita';
const UPSTREAM = 'http://localhost:3300';
const PROXY_PORT = 3311;

let proxy;

// Strips the prefix and forwards, exactly as the portman.ca rewrite does.
test.beforeAll(async () => {
  proxy = http.createServer(async (req, res) => {
    if (req.url === PREFIX) { res.writeHead(308, { location: PREFIX + '/' }); return res.end(); }
    if (!req.url.startsWith(PREFIX + '/')) { res.writeHead(404); return res.end(); }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const up = await fetch(UPSTREAM + req.url.slice(PREFIX.length), {
      method: req.method,
      headers: { ...req.headers, host: 'localhost:3300' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      redirect: 'manual',
    });
    const headers = Object.fromEntries(up.headers);
    delete headers['content-encoding'];
    delete headers['content-length'];
    res.writeHead(up.status, headers);
    res.end(Buffer.from(await up.arrayBuffer()));
  });
  await new Promise((r) => proxy.listen(PROXY_PORT, r));
});

test.afterAll(async () => { await new Promise((r) => proxy.close(r)); });

// Starts a solo game, which is the shortest path to a real API call from the client.
async function apiUrlsFrom(page, root) {
  const seen = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) seen.push(r.url()); });
  await page.goto(root + '?plainmap=1');
  await page.click('#menuSolo');
  await expect.poll(() => seen.length).toBeGreaterThan(0);
  return seen;
}

test('behind the portman.ca proxy, every API call carries the prefix', async ({ page }) => {
  const urls = await apiUrlsFrom(page, `http://localhost:${PROXY_PORT}${PREFIX}/`);
  for (const u of urls) expect(u).toContain(`${PREFIX}/api/`);

  const arch = await page.getAttribute('a.ghost[data-i18n="menu.arch"]', 'href');
  expect(new URL(arch, page.url()).pathname).toBe(`${PREFIX}/architecture`);
});

test('at the domain root, API calls stay unprefixed', async ({ page }) => {
  const urls = await apiUrlsFrom(page, `${UPSTREAM}/`);
  for (const u of urls) {
    expect(u).toContain('/api/');
    expect(u).not.toContain(PREFIX);
  }
});

test('behind the proxy, the Farsi search names load from under the prefix', async ({ page }) => {
  const res = page.waitForResponse((r) => r.url().includes('search-fa.json'));
  await page.goto(`http://localhost:${PROXY_PORT}${PREFIX}/?plainmap=1`);
  await page.locator('#langSelect').selectOption('fa');
  const r = await res;
  expect(new URL(r.url()).pathname).toBe(`${PREFIX}/search-fa.json`);
  expect(r.status()).toBe(200);
});

test('behind the proxy, ?lang=fa opens the game in Farsi', async ({ page }) => {
  await page.goto(`http://localhost:${PROXY_PORT}${PREFIX}/?lang=fa`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#menuSolo')).toHaveText('بازی تک‌نفره');
});
