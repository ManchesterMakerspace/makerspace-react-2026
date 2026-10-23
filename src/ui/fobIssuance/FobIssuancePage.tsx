import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import ScanNfc from "ui/nfc/ScanNfc";
import { fobIssuanceApi, FobIssuanceMember } from "./api";

const MIN_SEARCH = 2;

const displayName = (member: FobIssuanceMember) => `${member.firstname} ${member.lastname}`;

// Volunteers with the fob-issuer checkout register a member's FIRST key fob here.
// The server enforces every rule (fob issuer, no existing fob, not yourself); this
// screen only walks the volunteer through checking ID and importing the fob.
const FobIssuancePage: React.FC = () => {
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<FobIssuanceMember[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<FobIssuanceMember>();
  const [candidate, setCandidate] = React.useState<string>();
  const [source, setSource] = React.useState<"import" | "nfc">("import");
  const [idVerified, setIdVerified] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const term = search.trim();
    if (term.length < MIN_SEARCH) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const outcome = await fobIssuanceApi.searchMembers(term);
      if (cancelled) return;
      setSearching(false);
      if (outcome.error) setError(outcome.error);
      else setResults(outcome.data || []);
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search]);

  const chooseMember = (member: FobIssuanceMember) => {
    setSelected(member);
    setCandidate(undefined);
    setSource("import");
    setIdVerified(false);
    setError("");
    setSuccess("");
  };

  const importNewKey = async () => {
    setError("");
    const outcome = await fobIssuanceApi.newCard();
    if (outcome.error) return setError(outcome.error);
    setSource("import");
    setCandidate(outcome.data?.uid || undefined);
    if (!outcome.data?.uid) setError("No fob found. Scan the new fob at the front door, then try Import New Key again.");
  };

  const issue = async () => {
    if (!selected) return;
    if (!selected.memberContractOnFile) {
      return setError("This member has not signed the member contract. A key fob cannot be issued until it is on file.");
    }
    if (!candidate) return setError("Import the new key fob before issuing it.");
    if (!idVerified) return setError("Check the member's ID before issuing a key.");

    setBusy(true);
    setError("");
    const outcome = await fobIssuanceApi.issue(selected.id, candidate, source);
    setBusy(false);
    if (outcome.error) return setError(outcome.error);
    setSuccess(`Key fob issued to ${displayName(selected)}. They can try it at the front door now.`);
    setResults((existing) => existing.filter((member) => member.id !== selected.id));
    setSelected(undefined);
    setCandidate(undefined);
    setIdVerified(false);
    setSearch("");
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" gutterBottom>Issue a Key Fob</Typography>
      <Typography variant="body2" gutterBottom>
        For a member who does not have a key fob yet. Check their ID, then register their new fob.
        Members who already have a fob must see a board member.
      </Typography>

      {success && <Alert id="fob-issuance-success" severity="success" sx={{ my: 2 }}>{success}</Alert>}
      {error && <Alert id="fob-issuance-error" severity="error" sx={{ my: 2 }}>{error}</Alert>}

      <TextField
        id="fob-issuance-search"
        label="Find a member by name or email"
        value={search}
        onChange={(event) => { setSearch(event.target.value); setError(""); }}
        fullWidth
        margin="normal"
        helperText={search.trim().length > 0 && search.trim().length < MIN_SEARCH ? "Type at least two letters." : "Only members without a key fob are listed."}
      />

      {searching && <Typography variant="body2">Searching…</Typography>}
      {!searching && search.trim().length >= MIN_SEARCH && results.length === 0 && (
        <Typography id="fob-issuance-no-results" variant="body2">
          No members without a key fob match that search.
        </Typography>
      )}
      {results.length > 0 && (
        <Paper variant="outlined" sx={{ my: 2 }}>
          <List dense disablePadding>
            {results.map((member) => (
              <ListItemButton
                key={member.id}
                selected={selected?.id === member.id}
                onClick={() => chooseMember(member)}
                id={`fob-issuance-member-${member.id}`}
              >
                <ListItemText primary={displayName(member)} secondary={member.email} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      {selected && (
        <Paper id="fob-issuance-selected" variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6">{displayName(selected)}</Typography>
          <Typography variant="body2">{selected.email}{selected.phone ? ` · ${selected.phone}` : ""}</Typography>
          <Typography variant="body2" gutterBottom>Status: {selected.status}</Typography>

          {!selected.memberContractOnFile && (
            <Alert severity="warning" sx={{ my: 1 }}>
              This member has not signed the member contract, so a key fob cannot be issued yet.
            </Alert>
          )}

          <Box
            component="table"
            sx={{ border: "3px solid", borderColor: "error.main", borderCollapse: "collapse", my: 2 }}
          >
            <thead><tr><th>Address on ID must <strong>exactly</strong> match this:</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>{selected.addressStreet}</strong></td>
                <td>Unit: <strong>{selected.addressUnit}</strong></td>
              </tr>
              <tr>
                <td><strong>{selected.addressCity}</strong> <strong>{selected.addressState}</strong></td>
                <td>{selected.addressPostalCode}</td>
              </tr>
            </tbody>
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                id="fob-issuance-id-verified"
                checked={idVerified}
                onChange={(event) => { setIdVerified(event.currentTarget.checked); setError(""); }}
              />
            }
            label="Verified member's name and address with valid identification"
          />

          <Box sx={{ my: 2 }}>
            <Typography variant="body2" gutterBottom>
              Scan the new key fob at the front door, then import it. Or use this device's scan option.
            </Typography>
            <Button id="fob-issuance-import" variant="contained" onClick={importNewKey}>Import New Key</Button>
            <ScanNfc
              onUid={(uid) => { setSource("nfc"); setCandidate(uid); setError(""); }}
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Key fob:{" "}
              <span id="fob-issuance-uid">
                {candidate ? <strong>{candidate}</strong> : <span style={{ color: "red" }}>No fob found yet</span>}
              </span>
            </Typography>
          </Box>

          <Button
            id="fob-issuance-submit"
            variant="contained"
            color="primary"
            disabled={busy || !selected.memberContractOnFile}
            onClick={issue}
          >
            Issue Key Fob
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default FobIssuancePage;
