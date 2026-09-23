import * as React from "react";
import { Alert, Button, Stack } from '@mui/material';
import { platform, portalUrl } from 'app/platform';

import Grid from "@mui/material/Grid";

import LoadingOverlay from "../common/LoadingOverlay";
import { FormField } from "../common/Form";

export interface DocDetails extends FormField {
  id: string;
  src: string | ((...args: any) => string);
}

export enum Documents {
  CodeOfConduct = "code-of-conduct",
  MemberContract = "member-contract",
  RentalAgreement = "rental-agreement",
}

const buildDocumentUrl = (documentName: string) => `${process.env.BASE_URL || ""}/api/documents/${documentName}`;
export const documents: { [K in Documents]: DocDetails} = {
  [Documents.MemberContract]: {
    id: Documents.MemberContract,
    src: buildDocumentUrl("member_contract"),
    displayName: "Member Contract",
    name: `${Documents.MemberContract}-checkbox`,
    transform: (val: string) => !!val,
    validate: (val: boolean) => val,
    error: "You must accept to continue",
    label: "I have read and agree to the Manchester Makerspace Member Contract",
  },
  [Documents.CodeOfConduct]: {
    id: Documents.CodeOfConduct,
    src: buildDocumentUrl("code_of_conduct"),
    displayName: "Code of Conduct",
    name: `${Documents.CodeOfConduct}-checkbox`,
    transform: (val: string) => !!val,
    validate: (val: boolean) => val,
    error: "You must accept to continue",
    label: "I have read and agree to the Manchester Makerspace Code of Conduct",
  },
  [Documents.RentalAgreement]: {
    id: Documents.RentalAgreement,
    src: (rentalId: string) => buildDocumentUrl(`rental_agreement?resourceId=${rentalId}`),
    displayName: "Rental Agreement",
    name: `${Documents.RentalAgreement}-checkbox`,
    transform: (val: string) => !!val,
    validate: (val: boolean) => val,
    error: "You must accept to continue",
    label: "I have read and agree to the Manchester Makerspace Rental Agreement",
  },
}

const DocumentFrame: React.FC<Props> = (props) => {
  if (platform.native) return <NativeDocument {...props} />;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <DocumentInternalFrame {...props} />
      </Grid>
    </Grid>
  );
}

const NativeDocument: React.FC<Props> = ({ id, src }) => {
  const [html, setHtml] = React.useState<string>();
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setHtml(undefined); setError('');
    fetch(src, { headers: { Accept: 'text/html' }, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load this document. Check your session and connection.');
        return response.text();
      }).then(text => {
        const parsed = new DOMParser().parseFromString(text, 'text/html');
        parsed.querySelectorAll('script, base').forEach(element => element.remove());
        const base = parsed.createElement('base'); base.href = portalUrl(src); parsed.head.prepend(base);
        if (active) setHtml('<!doctype html>' + parsed.documentElement.outerHTML);
      }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [src, attempt]);
  if (error) return <Stack spacing={1}><Alert severity="error">{error}</Alert><Button onClick={() => setAttempt(value => value + 1)}>Try again</Button></Stack>;
  if (!html) return <LoadingOverlay id={id} contained />;
  return <iframe title="Makerspace agreement" id={id} srcDoc={html} sandbox="allow-same-origin"
    style={{ width: '100%', height: '60vh', border: 0 }} onLoad={event => {
      event.currentTarget.contentDocument?.addEventListener('click', click => {
        const anchor = (click.target as Element)?.closest('a[href]') as HTMLAnchorElement | null;
        if (anchor) { click.preventDefault(); void platform.openExternal?.(anchor.href); }
      });
    }} />;
};

interface Props { 
  src: string;
  id: string;
  fullHeight?: boolean;
  style?: { [key: string]: any } ;
}

export const DocumentInternalFrame: React.FC<Props> = ({ id, src, style, fullHeight }) => {
  const [loading, setLoading] = React.useState(true);
  const [height, setHeight] = React.useState(style?.height || "300px");

  const onLoad = React.useCallback(() => {
    fullHeight && setHeight((document.getElementById(id) as HTMLIFrameElement).contentWindow.document.documentElement.scrollHeight + "px");
    setLoading(false);
  }, [setLoading]);

  return (
    <>
      {loading && <LoadingOverlay id={id} contained={true}/>}
      <iframe
        id={id}
        name={id}
        src={src}
        style={{ height, width: "100%", overflow: "scroll", ...style }}
        onLoad={onLoad}
        frameBorder={0}
      />
    </>
  )
}

export default DocumentFrame;
