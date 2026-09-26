import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
let mockNative = true;
jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mockNative } }));
jest.mock('../../../src/native/transport', () => ({ portalOrigin: () => 'https://members.example.org' }));
jest.mock('ui/common/LoadingOverlay', () => ({ __esModule: true, default: () => <div role="status">Loading</div> }));
import { DocumentInternalFrame } from 'ui/documents/Document';
import { nativeDocumentUrl } from '../../../src/native/documentFrame';

describe('authenticated native document frames', () => {
  let root: Root; let host: HTMLDivElement;
  const originalFetch = window.fetch;
  const response = (html = '<h1>Agreement</h1>', status = 200) => ({
    ok: status === 200, status, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => html,
  });
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    mockNative = true;
    window.fetch = jest.fn().mockResolvedValue(response());
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); window.fetch = originalFetch; });
  it.each(['/api/documents/member_contract', '/api/documents/rental_agreement?resourceId=r1',
    '/api/billing/receipts/i1', '/api/admin/billing/receipts/i1'])('loads %s through the session transport, never a local API iframe navigation', async src => {
    await act(async () => root.render(<DocumentInternalFrame id="document" src={src} />));
    expect(window.fetch).toHaveBeenCalledWith('https://members.example.org' + src, expect.objectContaining({ credentials: 'include', signal: expect.any(AbortSignal) }));
    const frame = host.querySelector('iframe');
    expect(frame.getAttribute('src')).toBeNull();
    expect(frame.srcdoc).toContain('<h1>Agreement</h1>');
    expect(frame.srcdoc).toContain('href="https://members.example.org' + src + '"');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
  });
  it('keeps web frames unchanged and never proxies another origin', async () => {
    expect(nativeDocumentUrl('https://elsewhere.example/api/documents/private')).toBeUndefined();
    mockNative = false;
    await act(async () => root.render(<DocumentInternalFrame id="document" src="/api/documents/member_contract" />));
    expect(window.fetch).not.toHaveBeenCalled();
    expect(host.querySelector('iframe').getAttribute('src')).toBe('/api/documents/member_contract');
    expect(host.querySelector('iframe').hasAttribute('sandbox')).toBe(false);
  });
  it('shows failures with retry instead of rendering an API error as an agreement', async () => {
    (window.fetch as jest.Mock).mockResolvedValueOnce(response('Forbidden', 403));
    await act(async () => root.render(<DocumentInternalFrame id="document" src="/api/documents/member_contract" />));
    expect(host.querySelector('iframe')).toBeNull();
    expect(host.querySelector('[role="alert"]').textContent).toContain('403');
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(host.querySelector('iframe').srcdoc).toContain('Agreement');
  });
  it('aborts replaced requests and ignores late content', async () => {
    let resolve: (value: any) => void;
    (window.fetch as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => root.render(<DocumentInternalFrame id="document" src="/api/documents/member_contract" />));
    const signal = (window.fetch as jest.Mock).mock.calls[0][1].signal;
    await act(async () => root.render(<DocumentInternalFrame id="document" src="/api/billing/receipts/i1" />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response('<h1>Old document</h1>')));
    expect(host.querySelector('iframe').srcdoc).not.toContain('Old document');
  });
  it('releases downloaded binary URLs when unmounted', async () => {
    URL.createObjectURL = jest.fn().mockReturnValue('blob:document'); URL.revokeObjectURL = jest.fn();
    (window.fetch as jest.Mock).mockResolvedValue({ ok: true, headers: { get: () => 'application/pdf' }, blob: async () => new Blob(['pdf']) });
    await act(async () => root.render(<DocumentInternalFrame id="document" src="/api/documents/member_contract?saved=true" />));
    expect(host.querySelector('iframe').getAttribute('src')).toBe('blob:document');
    await act(async () => root.render(null));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:document');
  });
});
