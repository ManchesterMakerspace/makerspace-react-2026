import * as React from "react";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { Capacitor } from '@capacitor/core';
import { Documents, documents, DocumentInternalFrame } from "./Document";

const PreviewMemberContract: React.FC  = () => {
  const [open, setOpen] = React.useState(false);
  const native = Capacitor.isNativePlatform();
  const src = String(documents[Documents.MemberContract].src) + '?saved=true';
  return (
    <Grid container>
      <Grid size={{ xs: 12 }}>
        {native ? <Link component="button" type="button" onClick={() => setOpen(true)}>View Member Contract</Link>
          : <Link target="_blank" rel="noopener" href={src}>View Member Contract</Link>}
        {native && <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" aria-labelledby="saved-member-contract-title">
          <DialogTitle id="saved-member-contract-title">Member Contract</DialogTitle>
          <DialogContent sx={{ position: 'relative', minHeight: 300 }}>
            {open && <DocumentInternalFrame id="saved-member-contract" src={src} style={{ height: '60vh' }} />}
          </DialogContent>
          <DialogActions><Button onClick={() => setOpen(false)}>Close</Button></DialogActions>
        </Dialog>}
      </Grid>
    </Grid>
  )
}

export default PreviewMemberContract;
