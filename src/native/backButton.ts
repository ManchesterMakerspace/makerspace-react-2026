/** MUI hides covered modals from accessibility; ignore them and exiting dialogs. */
export function topmostDialog(): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
    .filter(dialog => !dialog.closest('[aria-hidden="true"], [inert]') &&
      getComputedStyle(dialog).display !== 'none' && getComputedStyle(dialog).visibility !== 'hidden')
    .sort((a, b) => {
      const level = (element: HTMLElement) => Number(getComputedStyle(element.closest('.MuiModal-root') || element).zIndex) || 0;
      return level(a) - level(b);
    }).pop();
}

export function closeTopmostDialog(): boolean {
  const dialog = topmostDialog();
  if (!dialog) return false;
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return true;
}
