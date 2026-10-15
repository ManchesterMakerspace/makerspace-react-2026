import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
const mockGenerate = jest.fn();
jest.mock('api/toolCheckouts', () => ({ generateCheckoutRequiredSheet: (...args: unknown[]) => mockGenerate(...args) }));
import CheckoutRequiredSheetButton from 'ui/common/CheckoutRequiredSheetButton';
import CheckoutRequiredSheetModal from 'ui/common/CheckoutRequiredSheetModal';

const resource = { id: 'tool1', name: 'Bandsaw', canGenerateCheckoutRequiredSheet: true };
const deferred = () => {
  let resolve: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve: value => resolve(value) };
};
const button = (name: string) => Array.from(document.querySelectorAll('button')).find(node => node.textContent === name)!;

describe('Checkout Required sheet preview', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn().mockReturnValue('blob:sheet');
    URL.revokeObjectURL = jest.fn();
    mockGenerate.mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', missingChannel: false });
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('requires the server capability and defaults missing capabilities to false', async () => {
    await act(async () => root.render(<CheckoutRequiredSheetButton kind="tool" resource={{ id: 't', name: 'Tool' }} />));
    expect(container.textContent).toBe('');
    await act(async () => root.render(<CheckoutRequiredSheetButton kind="tool" resource={resource} />));
    expect(button('Checkout Required Sheet')).toBeTruthy();
    await act(async () => button('Checkout Required Sheet').click());
    expect(mockGenerate).toHaveBeenCalledWith('tool', 'tool1', 2);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Print on US Letter, landscape, at 100% / actual size.');
  });

  it('previews and downloads the same blob, warns about a blank footer, and cleans up', async () => {
    mockGenerate.mockResolvedValue({ svg: '<svg/>', missingChannel: true });
    await act(async () => root.render(<CheckoutRequiredSheetModal kind="shop" resource={resource} onClose={jest.fn()} />));
    const image = document.querySelector('img')!;
    const download = document.querySelector('a[download]')!;
    expect(image.getAttribute('src')).toBe(download.getAttribute('href'));
    expect(download.getAttribute('download')).toBe('checkout-required-shop-tool1.svg');
    expect(document.body.textContent).toContain('blank footer');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    act(() => root.render(null));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sheet');
  });

  it('offers one sign and ignores stale double-sign results', async () => {
    const first = deferred();
    mockGenerate.mockReturnValueOnce(first.promise);
    await act(async () => root.render(<CheckoutRequiredSheetModal kind="tool" resource={resource} onClose={jest.fn()} />));
    expect(document.querySelector('a[download]')).toBeNull();
    expect(document.querySelector('[role="status"]')).toBeTruthy();
    await act(async () => (document.querySelector('input[value="1"]') as HTMLInputElement).click());
    expect(mockGenerate).toHaveBeenLastCalledWith('tool', 'tool1', 1);
    expect(document.querySelector('img')?.getAttribute('alt')).toContain('One Checkout Required sign');
    await act(async () => first.resolve({ svg: '<svg>stale</svg>', missingChannel: true }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('blank footer');
  });

  it('shows retry without a download on failure and recovers', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('The short link is unavailable.'));
    await act(async () => root.render(<CheckoutRequiredSheetModal kind="tool" resource={resource} onClose={jest.fn()} />));
    expect(document.body.textContent).toContain('The short link is unavailable.');
    expect(document.querySelector('a[download]')).toBeNull();
    await act(async () => button('Retry').click());
    expect(document.querySelector('a[download]')).toBeTruthy();
  });

  it('does not create a URL after closing during generation', async () => {
    const pending = deferred(); mockGenerate.mockReturnValue(pending.promise);
    await act(async () => root.render(<CheckoutRequiredSheetModal kind="tool" resource={resource} onClose={jest.fn()} />));
    act(() => root.render(null));
    await act(async () => pending.resolve({ svg: '<svg/>', missingChannel: false }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
