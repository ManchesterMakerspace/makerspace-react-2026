
import * as React from "react";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import { adminGetNewCard, adminCreateCard, getMember, Member, isApiErrorResponse } from "makerspace-ts-api-client";
import ScanNfc from 'ui/nfc/ScanNfc';

import FormModal from "ui/common/FormModal";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useModal from "../hooks/useModal";
import { ActionButton } from "../common/ButtonRow";

const AccessCardForm: React.FC<{ memberId: string }> = ({ memberId }) => {
  const [error, setError] = React.useState<string>();
  const [idVerified, setIdVerified] = React.useState(false);
  const [candidate, setCandidate] = React.useState<string>();
  const [candidateSource, setCandidateSource] = React.useState<'import' | 'nfc'>('import');
  const [newCardLoading, setNewCardLoading] = React.useState(false);
  const candidateVersion = React.useRef(0);
  const toggleVerified = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setIdVerified(event.currentTarget.checked);
    setError("");
  }, [setError, setIdVerified]);

  const { isOpen, openModal, closeModal } = useModal();
  const getNewCard = async () => {
    const version = ++candidateVersion.current;
    setCandidate(undefined); setCandidateSource('import'); setError(''); setNewCardLoading(true);
    try {
      const result = await adminGetNewCard();
      if (version !== candidateVersion.current) return;
      if (isApiErrorResponse(result)) setError(result.error.message);
      else setCandidate(result.data?.uid || undefined);
    } catch (error) { if (version === candidateVersion.current) setError((error as Error).message); }
    finally { if (version === candidateVersion.current) setNewCardLoading(false); }
  };
  React.useEffect(() => {
    candidateVersion.current++; setCandidate(undefined); setIdVerified(false); setError(''); setNewCardLoading(false);
    return () => { candidateVersion.current++; };
  }, [isOpen, memberId]);

  const {
    isRequesting: memberLoading,
    refresh: refreshMember,
    data: member = {} as Member
  } = useReadTransaction(getMember, { id: memberId });

  const onSuccess = React.useCallback(({ reset }) => {
    refreshMember();
    closeModal();
    reset();
  }, [refreshMember, closeModal]);
  const { isRequesting: createLoading, error: createError, call: createCard, data: newCard } = useWriteTransaction(adminCreateCard, onSuccess);
  const onSubmit = React.useCallback(() => {
    if (!member.memberContractOnFile) {
      setError("Member has not signed the member contract. A key fob cannot be issued until the contract is on file.");
      return;
    }

    if (!candidate) {
      setError("Import new key fob before proceeding.");
      return;
    }

    if (!idVerified) {
      setError("Member ID verification required to issue key.");
      return;
    }

    createCard({
      body: {
        ...{ source: candidateSource },
        memberId: member.id,
        uid: candidate,
      }
    });
  }, [candidate, candidateSource, createCard, setError, member.id, member.memberContractOnFile, idVerified]);

  return (
    <>
      <ActionButton
        id="member-detail-open-card-modal"
        color="primary"
        variant={member && member.cardId ? "outlined" : "contained"}
        disabled={memberLoading || !member.memberContractOnFile}
        label={member && member.cardId ? "Replace Fob" : "Register Fob"}
        onClick={openModal}
      />
      {!member.memberContractOnFile && (
        <Typography variant="body2" color="error" style={{ marginTop: 8 }}>
          Member has not signed the member contract. A key fob cannot be issued until the contract is on file.
        </Typography>
      )}
      {isOpen && <FormModal
        id="card-form"
        loading={createLoading || newCardLoading}
        isOpen={true}
        title="Register New Fob"
        closeHandler={closeModal}
        onSubmit={onSubmit}
        error={createError || error}
      >
        <Typography variant="body1" gutterBottom>Instructions to register new member key fob</Typography>
        {(member && member.cardId) ?
          <Typography variant="body1" gutterBottom>Access card exists for {member.firstname}</Typography>
          : <Typography color="secondary" variant="body1" gutterBottom>No access card exists for {member.firstname}</Typography>
        }
        <ol className="instruction-list">
          <li>Scan a new keyfob at the front door and import it, or use this device's SCAN NFC option.</li>
          <li>
            <div>Click the following button to import the new key fob's ID</div>
            <div>
              <Button
                id="card-form-import-new-key"
                color="primary"
                variant="contained"
                onClick={getNewCard}
              >
                Import New Key
              </Button>
              <ScanNfc onUid={uid => { candidateVersion.current++; setCandidateSource('nfc'); setCandidate(uid); setError(''); setNewCardLoading(false); }} />
            </div>
          </li>
          <li>Confirm new card identifier is displayed here:
            <span id="card-form-key-confirmation">
              {
                candidate ?
                  <span> {candidate}</span>
                  : <span style={{ color: "red" }}> No Card Found</span>
              }
            </span>
          </li>
          <ul>
            <li>If 'No Card Found', check for error message in this form.  If no error, try steps 1 and 2 again</li>
            <li>If card number displayed, click 'Submit' button</li>
          </ul>
        </ol>

         <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="id-verified"
                  id="card-form-id-verified"
                  value="id-verified"
                  checked={idVerified}
                  onChange={toggleVerified}
                  
                />
              }
              label="Verified member's name and address with valid identification"
            />
          </Grid><table style={{ border: '3px solid #FF1100', borderCollapse: 'collapse' }}><thead><tr><th>Address on ID must <strong>exactly</strong> match this:</th></tr></thead>
           <tbody><tr><td><strong>{member.address?.street}</strong></td><td>Unit: </td><td><strong>{member.address?.unit}</strong></td></tr>
          <tr><td><strong>{member.address?.city}</strong></td><td><strong>{member.address?.state}</strong></td><td>{member.address?.postalCode}</td></tr></tbody>
          </table>
      </FormModal>}
    </>
  );
};

export default AccessCardForm;
