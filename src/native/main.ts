import { installNativeTransport } from './transport';
import { App } from '@capacitor/app';
import { closeTopmostDialog } from './backButton';

void installNativeTransport().then(async () => {
  await import('../app/main');
  await App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopmostDialog()) return;
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}).catch(error => {
  document.body.textContent = error.message;
  const retry = document.createElement('button');
  retry.textContent = 'Retry'; retry.onclick = () => window.location.reload(); document.body.appendChild(retry);
});
