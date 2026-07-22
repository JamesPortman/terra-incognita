import { describe, it, expect, afterEach } from 'vitest';
import config from '../api/config.js';

const call = async () => {
  const res = {
    code: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; },
  };
  await config({ method: 'GET', query: {} }, res);
  return res;
};

describe('config', () => {
  const OLD = process.env.GOOGLE_MAPS_KEY;
  afterEach(() => {
    if (OLD === undefined) delete process.env.GOOGLE_MAPS_KEY;
    else process.env.GOOGLE_MAPS_KEY = OLD;
  });

  it('serves the maps key when configured', async () => {
    process.env.GOOGLE_MAPS_KEY = 'k123';
    const r = await call();
    expect(r.body.mapsKey).toBe('k123');
    expect(r.headers['Cache-Control']).toMatch(/max-age/);
  });

  it('serves null when not configured', async () => {
    delete process.env.GOOGLE_MAPS_KEY;
    expect((await call()).body.mapsKey).toBeNull();
  });
});
