import * as React from "react";
import Grid from "@mui/material/Grid";
import { Link } from "@mui/material";
import { Documents, documents } from "./Document";

const PreviewMemberContract: React.FC  = () => {
  return (
    <Grid container>
      <Grid size={{ xs: 12 }}>
        <Link target="_blank" href={String(documents[Documents.MemberContract].src) + "?saved=true"}>View Member Contract</Link>
      </Grid>
    </Grid>
  )
}

export default PreviewMemberContract;
