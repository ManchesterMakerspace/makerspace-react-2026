import * as React from 'react';
import { Link, List, ListItem } from '@mui/material';
import { ToolOutageResult } from 'api/fixTickets';

export default function AffectedReservations({ reservations }: { reservations: ToolOutageResult['affectedReservations'] }) {
  return reservations.length ? <List aria-label="Affected reservations">{reservations.map(r =>
    <ListItem key={r.id}><Link href={`/reservations?edit=${r.id}`}>{new Date(r.startAt).toLocaleString()}</Link></ListItem>
  )}</List> : null;
}
