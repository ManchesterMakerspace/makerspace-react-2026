import * as React from "react";
import { useParams } from 'react-router-dom';
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormLabel from "@mui/material/FormLabel";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Paper from "@mui/material/Paper";

import { Member, getMember } from "makerspace-ts-api-client";
import { memberIsAdmin, memberIsBoardMember, memberIsResourceManager } from "ui/member/utils";
import { useAuthState } from "ui/reducer/hooks";
import useReadTransaction from "ui/hooks/useReadTransaction";
import LoadingOverlay from "ui/common/LoadingOverlay";
import ErrorMessage from "ui/common/ErrorMessage";
import { timeToDate } from "ui/utils/timeToDate";

interface CheckInRecord {
  _id?: string;
  time?: number;
  dateOf?: Date;
  validity?: string;
  where?: string;
  [key: string]: any;
}

const MemberCheckInActivity: React.FC = () => {
  const { memberId } = useParams();
  const { currentUser: { id: currentUserId, isAdmin } } = useAuthState();
  const [weekRange, setWeekRange] = React.useState(1);
  const [records, setRecords] = React.useState<CheckInRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string>();

  const {
    isRequesting: memberLoading,
    data: member = {} as Member,
    error: memberError,
  } = useReadTransaction(getMember, { id: memberId });

  // Check authorization
  const isOwnProfile = currentUserId === memberId;
  const hasPermission = isOwnProfile ||
    isAdmin ||
    (member && (memberIsAdmin(member) || memberIsBoardMember(member) || memberIsResourceManager(member)));

  // Fetch check-in data when member loads or week range changes
  React.useEffect(() => {
    if (!member.id || !hasPermission) {
      console.log("No access to view CheckInActivity");
      return;
    }
    else console.log("Viewing {member.id} CheckInActivity");

    const fetchCheckInData = async () => {
      setIsLoading(true);
      setLoadError(undefined);
      try {
        // Calculate timeframe
        const endTime = Date.now();
        const startTime = endTime - (weekRange * 7 * 24 * 60 * 60 * 1000);

        // Fetch cards for this member
        const cardsResponse = await fetch(`/api/admin/cards?memberId=${member.id}`, {
          credentials: "include",
        });

        if (!cardsResponse.ok) {
          throw new Error("Failed to fetch member cards");
        }

        const cards = await cardsResponse.json();
        const cardUids = cards.map((card: any) => card.uid);

        if (cardUids.length === 0) {
          setRecords([]);
          setIsLoading(false);
          console.log("No cardUids for {member.id} CheckInActivity");
          return;
        }

        // Fetch checkins and rejections
        const checkinsQuery = {
          uids: cardUids,
          startTime,
          endTime,
        };

        const checkinsResponse = await fetch(
          `/api/admin/checkins?${new URLSearchParams({
            uids: JSON.stringify(cardUids),
            startTime: String(startTime),
            endTime: String(endTime),
          })}`,
          { credentials: "include" }
        );

        const rejectionsResponse = await fetch(
          `/api/admin/rejections?${new URLSearchParams({
            uids: JSON.stringify(cardUids),
            startTime: String(startTime),
            endTime: String(endTime),
          })}`,
          { credentials: "include" }
        );

        let allRecords: CheckInRecord[] = [];

        if (checkinsResponse.ok) {
          const checkinsPayload = await checkinsResponse.json();
          const checkins = checkinsPayload.checkins || [];
          allRecords = allRecords.concat(checkins);
        }

        if (rejectionsResponse.ok) {
          const rejectionsPayload = await rejectionsResponse.json();
          const rejections = rejectionsPayload.rejections || [];
          allRecords = allRecords.concat(rejections);
        }

        // Sort by _id in descending order
        allRecords.sort((a, b) => {
          const aId = String(a._id || "");
          const bId = String(b._id || "");
          return bId.localeCompare(aId);
        });

        // Filter fields if not admin
        if (!isAdmin) {
          allRecords = allRecords.map((record) => {
            const filtered: CheckInRecord = {};
            if (record._id) filtered._id = record._id;
            if (record.time) filtered.time = record.time;
            if (record.dateOf) filtered.dateOf = record.dateOf;
            if (record.validity) filtered.validity = record.validity;
            if (record.where) filtered.where = record.where;
            return filtered;
          });
        }

        setRecords(allRecords);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCheckInData();
  }, [member.id, member, weekRange, hasPermission, isAdmin]);

  if (memberLoading) {
    return <LoadingOverlay />;
  }

  if (memberError || !member.id) {
    console.log("No member when fetching CheckInActivity");
    return (
      <Paper style={{ padding: "16px" }}>
        <ErrorMessage error="Member not found" />
      </Paper>
    );
  }

  if (!hasPermission) {
    return (
      <Paper style={{ padding: "16px" }}>
        <Typography color="error">
          You do not have permission to view this member's check-in activity.
        </Typography>
      </Paper>
    );
  }

  // Format timestamp
  const formatTimestamp = (record: CheckInRecord): string => {
    if (record.dateOf) {
      return timeToDate(new Date(record.dateOf).getTime());
    }
    if (record.time) {
      return timeToDate(record.time);
    }
    return "-";
  };

  // Filter out empty/zero/negative values
  const shouldDisplay = (value: any): boolean => {
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "number" && value <= 0) return false;
    return true;
  };

  return (
    <Grid container spacing={2} style={{ padding: "16px" }}>
      <Grid item xs={12}>
        <Typography variant="h6">
          Check-In Activity for {member.firstname} {member.lastname}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormLabel style={{ display: "block", marginBottom: "8px" }}>
          Time Period (Weeks)
        </FormLabel>
        <Select
          value={weekRange}
          onChange={(e) => setWeekRange(e.target.value as number)}
          disabled={isLoading}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((week) => (
            <MenuItem key={week} value={week}>
              {week} week{week !== 1 ? "s" : ""}
            </MenuItem>
          ))}
        </Select>
      </Grid>

      {loadError && (
        <Grid item xs={12}>
          <ErrorMessage error={loadError} />
        </Grid>
      )}

      {isLoading && (
        <Grid item xs={12}>
          <LoadingOverlay />
        </Grid>
      )}

      {!isLoading && records.length === 0 && (
        <Grid item xs={12}>
          <Typography>No check-in activity found for the selected time period.</Typography>
        </Grid>
      )}

      {!isLoading && records.length > 0 && (
        <Grid item xs={12}>
          <Paper style={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow style={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell><strong>Timestamp</strong></TableCell>
                  {isAdmin && <TableCell><strong>Additional Details</strong></TableCell>}
                  {!isAdmin && (
                    <>
                      <TableCell><strong>Validity</strong></TableCell>
                      <TableCell><strong>Location</strong></TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record, idx) => {
                  const visibleFields = Object.entries(record)
                    .filter(([key, value]) => {
                      if (key === "_id" || key === "time" || key === "dateOf" || key === "validity" || key === "where") {
                        return false;
                      }
                      return shouldDisplay(value);
                    });

                  return (
                    <TableRow key={idx}>
                      <TableCell>{formatTimestamp(record)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {visibleFields.length > 0 ? (
                            <div>
                              {visibleFields.map(([key, value]) => (
                                <div key={key} style={{ fontSize: "0.85em", marginBottom: "4px" }}>
                                  <strong>{key}:</strong> {String(value)}
                                </div>
                              ))}
                              {record.validity && (
                                <div style={{ fontSize: "0.85em", marginBottom: "4px" }}>
                                  <strong>validity:</strong> {record.validity}
                                </div>
                              )}
                              {record.where && (
                                <div style={{ fontSize: "0.85em" }}>
                                  <strong>where:</strong> {record.where}
                                </div>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                      {!isAdmin && (
                        <>
                          <TableCell>{record.validity ? record.validity : "-"}</TableCell>
                          <TableCell>{record.where ? record.where : "-"}</TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default MemberCheckInActivity;
