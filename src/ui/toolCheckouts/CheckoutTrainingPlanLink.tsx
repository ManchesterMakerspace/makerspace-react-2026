import * as React from 'react';
import Chip from '@mui/material/Chip';

export default function CheckoutTrainingPlanLink({ url }: { url?: string | null }) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  } catch { return null; }
  return <Chip component="a" clickable size="small" variant="outlined" label="Checkout training plan"
    href={url} target="_blank" rel="noopener noreferrer" sx={{ m: 0.5, maxWidth: '100%' }} />;
}
