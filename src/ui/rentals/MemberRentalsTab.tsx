import * as React from "react";
import Grid from "@mui/material/Grid2";
import Divider from "@mui/material/Divider";
import { Member } from "makerspace-ts-api-client";

import MemberRentalsList from "ui/rentals/MemberRentalsList";
import RentalSpotsBrowser from "ui/rentalSpots/RentalSpotsBrowser";
import CreateRentalAdmin from "ui/rentals/CreateRentalAdmin";
import { useAuthState } from "ui/reducer/hooks";
import { useCapabilities } from "app/permissions";

interface Props {
  member:    Member;
  onUpdate?: () => void;
}

const MemberRentalsTab: React.FC<Props> = ({ member, onUpdate }) => {
  const { currentUser: { id: currentUserId } } = useAuthState();
  const { canManageRentals: canManage } = useCapabilities();
  const isOwnProfile = currentUserId === member.id;

  const [browserKey, setBrowserKey] = React.useState(0);

  const handleRentalCreated = React.useCallback(() => {
    setBrowserKey(k => k + 1);
    onUpdate?.();
  }, [onUpdate]);

  return (
    <Grid container spacing={4}>
      {/* Admin/RM create rental button when viewing another member's profile */}
      {canManage && !isOwnProfile && (
        <Grid size={{ xs: 12 }}>
          <CreateRentalAdmin member={member} onCreate={handleRentalCreated} />
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <MemberRentalsList member={member} onUpdate={onUpdate} />
      </Grid>

      {/* Member's own rental browser */}
      {isOwnProfile && (
        <>
          <Grid size={{ xs: 12 }}>
            <Divider />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <RentalSpotsBrowser
              key={browserKey}
              member={member}
              onRentalCreated={handleRentalCreated}
            />
          </Grid>
        </>
      )}
    </Grid>
  );
};

export default MemberRentalsTab;
