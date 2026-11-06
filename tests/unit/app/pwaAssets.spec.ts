import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const pwaRoot = path.join(root, 'src/pwa');

function pngDimensions(filename: string): [number, number] {
  const image = fs.readFileSync(filename);
  return [image.readUInt32BE(16), image.readUInt32BE(20)];
}

describe('PWA install assets', () => {
  it('provides valid, dimensionally accurate install icons', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(pwaRoot, 'manifest.webmanifest'), 'utf8'));

    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');

    for (const icon of manifest.icons) {
      const filename = icon.src === '/pwa-icon-192.png'
        ? 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'
        : `src/assets/${icon.src.replace(/^\//, '')}`;
      const dimensions = icon.sizes.split('x').map(Number) as [number, number];
      expect(pngDimensions(path.join(root, filename))).toEqual(dimensions);
    }
  });

  it('keeps navigations network-first and uses only a generic offline fallback', () => {
    const worker = fs.readFileSync(path.join(pwaRoot, 'service-worker.js'), 'utf8');

    expect(worker).toContain("event.request.mode !== 'navigate'");
    expect(worker).toContain('fetch(event.request).catch');
    expect(worker).not.toContain('cache.put');
  });
});
