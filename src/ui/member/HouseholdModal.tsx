import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";

import { Member } from "makerspace-ts-api-client";
import { ActionButton } from "ui/common/ButtonRow";
import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import LoadingOverlay from "ui/common/LoadingOverlay";
import useModal from "ui/hooks/useModal";
import MemberSearchInput from "ui/common/MemberSearchInput";
import { SelectOption } from "ui/common/AsyncSelect";

interface HouseholdMember {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
}

interface Household {
  id: string;
  groupName: string;
  groupRep: string;
  expiry: number;
  primaryMember: HouseholdMember;
  secondaryMembers: HouseholdMember[];
}

interface Props {
  member: Member;
  onUpdate: () => void;
}

const getCsrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const headers = () => ({
  "Content-Type": "application/json",
  "X-XSRF-TOKEN": getCsrfToken(),
});

const HouseholdModal: React.FC<Props> = ({ member, onUpdate }) => {
  const { isOpen, openModal, closeModal } = useModal();
  const [household, setHousehold] = React.useState<Household | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [selectedMember, setSelectedMember] = React.useState<SelectOption | null>(null);
  const [addingMember, setAddingMember] = React.useState(false);

  const memberAny = member as any;
  const isInHousehold = !!memberAny.groupName;
  const isPrimary = memberAny.householdRole === "primary";

  const fetchHousehold = React.useCallback(async () => {
    if (!isInHousehold) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/groups/for_member?member_id=${member.id}`, {
        headers: headers(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || body?.error?.message || "Failed to load household.");
      } else {
        const body = await res.json();
        setHousehold(body);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [member.id, isInHousehold]);

  const handleOpen = React.useCallback(async () => {
    openModal();
    await fetchHousehold();
  }, [openModal, fetchHousehold]);

  const handleClose = React.useCallback(() => {
    closeModal();
    setError("");
    setSelectedMember(null);
    setHousehold(null);
  }, [closeModal]);

  const createHousehold = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ primary_member_id: member.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || body?.error?.message || "Failed to create household.");
      } else {
        const body = await res.json();
        setHousehold(body);
        onUpdate();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [member.id, onUpdate]);

  const addSecondaryMember = React.useCallback(async () => {
    if (!selectedMember || !household) return;
    setAddingMember(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/groups/${household.id}/add_member`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ secondary_member_id: selectedMember.value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || body?.error?.message || "Failed to add member.");
      } else {
        const body = await res.json();
        setHousehold(body);
        setSelectedMember(null);
        onUpdate();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setAddingMember(false);
    }
  }, [selectedMember, household, onUpdate]);

  const removeSecondaryMember = React.useCallback(async (secondaryId: string) => {
    if (!household) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/groups/${household.id}/remove_member`, {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ secondary_member_id: secondaryId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || body?.error?.message || "Failed to remove member.");
      } else {
        const body = await res.json();
        setHousehold(body);
        onUpdate();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [household, onUpdate]);

  const dissolveHousehold = React.useCallback(async () => {
    if (!household) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/groups/${household.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || body?.error?.message || "Failed to dissolve household.");
      } else {
        setHousehold(null);
        onUpdate();
        handleClose();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [household, onUpdate, handleClose]);

  // Exclude current household members from search
  const excludeIds = React.useMemo(() => {
    if (!household) return [member.id];
    const ids = [household.primaryMember?.id, ...household.secondaryMembers.map(m => m.id)];
    return ids.filter(Boolean);
  }, [household, member.id]);

  const modalTitle = isInHousehold
    ? isPrimary ? "Manage Household" : "Household Details"
    : "Create Household";

  return (
    <>
      <ActionButton
        id="household-manage-button"
        color="primary"
        variant="outlined"
        disabled={!member.id}
        label={isInHousehold ? "Manage Household" : "Create Household"}
        onClick={handleOpen}
      />

      {isOpen && (
        <FormModal
          id="household-modal"
          isOpen={true}
          title={modalTitle}
          closeHandler={handleClose}
          onSubmit={undefined}
          submitText={undefined}
          loading={loading}
          error={error}
        >
          {loading && <LoadingOverlay id="household-loading" contained={true} />}

          {/* No household yet — create one */}
          {!isInHousehold && !household && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body1">
                  Create a household with <strong>{member.firstname} {member.lastname}</strong> as the primary member.
                </Typography>
                <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                  The primary member must be on a household membership plan before a household can be created.
                </Typography>
              </Grid>
              {error && (
                <Grid size={{ xs: 12 }}>
                  <ErrorMessage id="household-create-error" error={error} />
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Button
                  id="create-household-button"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                  onClick={createHousehold}
                >
                  Create Household
                </Button>
              </Grid>
            </Grid>
          )}

          {/* Household exists */}
          {household && (
            <Grid container spacing={2}>

              {/* Primary member */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>Primary Member</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary={`${household.primaryMember.firstname} ${household.primaryMember.lastname}`}
                      secondary={household.primaryMember.email}
                    />
                  </ListItem>
                </List>
              </Grid>

              <Grid size={{ xs: 12 }}><Divider /></Grid>

              {/* Secondary members */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>Secondary Member(s)</Typography>
                {household.secondaryMembers.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No secondary members linked yet.
                  </Typography>
                ) : (
                  <List dense>
                    {household.secondaryMembers.map(m => (
                      <ListItem key={m.id}>
                        <ListItemText
                          primary={`${m.firstname} ${m.lastname}`}
                          secondary={m.email}
                        />
                        {isPrimary && (
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              aria-label="remove"
                              onClick={() => removeSecondaryMember(m.id)}
                              disabled={loading}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
              </Grid>

              {/* Add secondary member — only primary can do this */}
              {isPrimary && (
                <>
                  <Grid size={{ xs: 12 }}><Divider /></Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>Add Secondary Member</Typography>
                    <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                      The secondary member must have the same street address and postal code as the primary member.
                    </Typography>
                    <MemberSearchInput
                      name="household-member-search"
                      placeholder="Search by name or email..."
                      excludeIds={excludeIds}
                      onChange={(selection) => setSelectedMember(selection)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button
                      id="add-household-member-button"
                      variant="contained"
                      color="primary"
                      disabled={!selectedMember || addingMember}
                      onClick={addSecondaryMember}
                    >
                      {addingMember ? "Adding..." : "Add Member"}
                    </Button>
                  </Grid>

                  <Grid size={{ xs: 12 }}><Divider /></Grid>

                  {/* Dissolve household */}
                  <Grid size={{ xs: 12 }}>
                    <Button
                      id="dissolve-household-button"
                      variant="outlined"
                      style={{ color: "#c62828", borderColor: "#c62828" }}
                      disabled={loading}
                      onClick={dissolveHousehold}
                    >
                      Dissolve Household
                    </Button>
                    <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 4 }}>
                      This will remove all members from the household and revert their expirations.
                    </Typography>
                  </Grid>
                </>
              )}

              {error && (
                <Grid size={{ xs: 12 }}>
                  <ErrorMessage id="household-error" error={error} />
                </Grid>
              )}
            </Grid>
          )}
        </FormModal>
      )}
    </>
  );
};

export default HouseholdModal;
