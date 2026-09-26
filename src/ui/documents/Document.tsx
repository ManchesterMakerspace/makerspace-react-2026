import * as React from "react";

import Grid from "@mui/material/Grid";
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { FrameContent, loadNativeDocument, nativeDocumentUrl } from '../../native/documentFrame';

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
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <DocumentInternalFrame {...props} />
      </Grid>
    </Grid>
  );
}

interface Props { 
  src: string;
  id: string;
  fullHeight?: boolean;
  onReadyChange?: (ready: boolean) => void;
  style?: { [key: string]: any } ;
}

export const DocumentInternalFrame: React.FC<Props> = ({ id, src, style, fullHeight, onReadyChange }) => {
  const [loading, setLoading] = React.useState(true);
  const [height, setHeight] = React.useState(style?.height || "300px");
  const frame = React.useRef<HTMLIFrameElement>(null);
  const nativeUrl = nativeDocumentUrl(src);
  const [content, setContent] = React.useState<FrameContent & { source: string }>();
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setLoading(true); setError(''); setContent(undefined); setHeight(style?.height || '300px');
    onReadyChange?.(false);
    if (!nativeUrl) return;
    const controller = new AbortController();
    let disposed = false;
    let result: FrameContent;
    void loadNativeDocument(nativeUrl, controller.signal).then(value => {
      if (disposed) { value.dispose(); return; }
      result = value;
      setContent({ ...value, source: src });
    }).catch(error => {
      if (!disposed) { setError(error.message); setLoading(false); }
    });
    return () => { disposed = true; controller.abort(); result?.dispose(); };
  }, [src, nativeUrl, attempt, onReadyChange]);

  const onLoad = React.useCallback(() => {
    // Native HTML is rendered locally; external web frames may deny DOM access.
    try {
      const scrollHeight = frame.current?.contentDocument?.documentElement.scrollHeight;
      if (fullHeight && scrollHeight) setHeight(scrollHeight + 'px');
    } catch { /* Keep the default height for cross-origin or binary frames. */ }
    setLoading(false);
    onReadyChange?.(true);
  }, [fullHeight, onReadyChange]);

  return (
    <>
      {loading && <LoadingOverlay id={id} contained={true}/>}
      {error && <Alert severity="error" action={<Button onClick={() => setAttempt(value => value + 1)}>Retry</Button>}>{error}</Alert>}
      {(!nativeUrl || content?.source === src) && <iframe
        ref={frame}
        key={src + attempt}
        id={id}
        name={id}
        title={id.replace(/-/g, ' ')}
        src={nativeUrl ? content?.src : src}
        srcDoc={nativeUrl ? content?.srcDoc : undefined}
        sandbox={nativeUrl ? 'allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox' : undefined}
        style={{ height, width: "100%", overflow: "scroll", ...style }}
        onLoad={onLoad}
        frameBorder={0}
      />}
    </>
  )
}

export default DocumentFrame;
