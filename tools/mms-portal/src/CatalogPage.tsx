import * as React from 'react';
import { Alert, Button, CircularProgress, List, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { Navigate, Route, useLocation, useParams, useNavigate } from 'react-router-dom';
import { platform, NATIVE_PENDING_PATH } from 'app/platform';

type Shop = { id: string; name: string; wiki_url?: string };
type Catalog = Shop & { description?: string; open?: boolean; shop?: Shop; tools?: { id: string; name: string; open: boolean }[] };
export const CatalogPage = ({ kind }: { kind: 'shop' | 'tool' }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [value, setValue] = React.useState<Catalog>();
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setValue(undefined); setError('');
    fetch('/api/' + kind + '/' + id + '/public.json', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'This resource is no longer available.' : 'Unable to load this resource. Please try again.');
        return response.json();
      }).then(result => { if (active) setValue(result); })
      .catch(reason => { if (active) setError(reason.message || 'Check your connection and try again.'); });
    return () => { active = false; };
  }, [kind, id, retry]);
  return <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
    {error ? <Stack spacing={2}><Alert severity="error">{error}</Alert><Button onClick={() => setRetry(count => count + 1)}>Try again</Button></Stack>
      : !value ? <CircularProgress aria-label="Loading resource" /> : <Stack spacing={2}>
        <Typography component="h1" variant="h4">{value.name}</Typography>
        {value.description && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value.description}</Typography>}
        {kind === 'tool' && <Typography>{value.open ? 'Open access tool' : 'Checkout approval required'}</Typography>}
        {value.shop && <Button onClick={() => navigate('/mobile/catalog/shops/' + value.shop!.id)}>View {value.shop.name}</Button>}
        {value.wiki_url && <Button onClick={() => platform.openExternal?.(value.wiki_url!)}>Open wiki in browser</Button>}
        {kind === 'tool' && <Button variant="contained" onClick={() => navigate('/tools/' + value.id + '/request-checkout')}>Request checkout</Button>}
        {value.tools && <List aria-label="Shop tools">{value.tools.map(tool =>
          <ListItemButton key={tool.id} onClick={() => navigate('/mobile/catalog/tools/' + tool.id)}><ListItemText primary={tool.name}
            secondary={tool.open ? 'Open access' : 'Checkout approval required'} /></ListItemButton>)}</List>}
      </Stack>}
  </Paper>;
};

const RequireCheckoutLogin = () => {
  const location = useLocation();
  React.useEffect(() => { sessionStorage.setItem(NATIVE_PENDING_PATH, location.pathname); }, [location.pathname]);
  return <Navigate to={'/login?return_to=' + encodeURIComponent(location.pathname)} replace />;
};
export const NativeRoutes = (authenticated: boolean) => {
  return <>
    <Route path="/mobile/catalog/shops/:id" element={<CatalogPage kind="shop" />} />
    <Route path="/mobile/catalog/tools/:id" element={<CatalogPage kind="tool" />} />
    {!authenticated && <Route path="/tools/:id/request-checkout" element={<RequireCheckoutLogin />} />}
  </>;
};
