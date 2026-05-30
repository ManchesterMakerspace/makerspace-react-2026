import * as React from "react";
import SignatureCanvas from "react-signature-canvas";
import { updateMember } from "makerspace-ts-api-client";
import Grid from "@mui/material/Grid";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ExpandMore from "@mui/icons-material/ExpandMore";
import DocumentFrame, { documents, Documents } from "ui/documents/Document";
import { Form } from "components/Form/Form";
import { SignatureBlock } from "ui/documents/SignatureBlock";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { useAuthState } from "ui/reducer/hooks";
import { CheckboxInput } from "components/Form/inputs/CheckboxInput";
import { FormField } from "components/Form/FormField";

interface Props {
  onSuccess?(): void;
  hideFooter?: boolean;
  children?: React.ReactNode;
}

const { 
  [Documents.CodeOfConduct]: codeOfConduct,
  [Documents.MemberContract]: memberContract,
} = documents;

export const MembershipAgreement: React.FC<Props> = ({ onSuccess, hideFooter, children }) => {
  const [signatureRef, setSignatureRef] = React.useState<SignatureCanvas>();
  const { currentUser: { id: currentUserId } } = useAuthState();

  const {
    isRequesting: updating,
    error,
    call: update
  } = useWriteTransaction(updateMember, onSuccess);

  const onSubmit = React.useCallback(async () => {
    await update({ id: currentUserId, body: { signature: signatureRef.toDataURL() }});
    return true;
  }, [update, signatureRef, currentUserId]);

  return (
    <Form
      id={`agreements-form`}
      onSubmit={onSubmit}
      hideFooter={hideFooter}
      loading={updating}
      error={error}
      style={{ maxWidth: "900px", margin: "auto" }}
    >
      <Typography>Please review and accept the following makerspace documents.</Typography>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMore />}
          aria-controls="panel1a-content"
          id="panel1a-header"
          style={{ backgroundColor: "#F6F6F6" }}
        >
          <Typography id="panel1a-content">Code of Conduct</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DocumentFrame {...codeOfConduct} src={String(codeOfConduct.src)} />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded={true}>
        <AccordionSummary
          expandIcon={<ExpandMore />}
          aria-controls="panel2a-content"
          id="panel2a-header"
          style={{ backgroundColor: "#F6F6F6" }}
        >
          <Typography id="panel2a-content">Member Contract</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DocumentFrame {...memberContract} src={String(memberContract.src)} />
        </AccordionDetails>
      </Accordion>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <CheckboxInput
            fieldName={codeOfConduct.name}
            required={true}
            label={codeOfConduct.label}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <CheckboxInput
            fieldName={memberContract.name}
            required={true}
            label={memberContract.label}
          />
        </Grid>

        <SignatureBlock takeSignature={setSignatureRef} />
        {children}
      </Grid>
    </Form>
  );
};
