import { enrollmentDestination } from './enrollmentLink';
import { installNativeTransport } from './transport';
import { App } from '@capacitor/app';
import { closeTopmostDialog } from './backButton';

void installNativeTransport().then(async () => {
  const openEnrollment = (url: string) => {
    const destination = enrollmentDestination(url);
    if (destination) window.location.assign('/login?redirect=' + encodeURIComponent(destination));
  };
  await App.addListener('appUrlOpen', ({ url }) => openEnrollment(url));
  const launch = await App.getLaunchUrl();
  if (launch?.url) {
    const destination = enrollmentDestination(launch.url);
    if (destination) window.history.replaceState(null, '', '/login?redirect=' + encodeURIComponent(destination));
  }
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
