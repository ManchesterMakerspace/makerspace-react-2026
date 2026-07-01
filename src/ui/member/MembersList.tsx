import * as React from 'react';
import { Link, useNavigate} from 'react-router-dom';
import Grid from "@mui/material/Grid";
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Typography from '@mui/material/Typography';

import { displayMemberExpiration, buildProfileRouting } from 'ui/member/utils';
import { SortDirection } from 'ui/common/table/constants';
import { Column } from 'ui/common/table/Table';
import MemberStatusLabel from 'ui/member/MemberStatusLabel';
import { EmailStatusIcon, SlackStatusIcon, TotpStatusIcon, RoleBadge } from 'ui/common/ContactStatusIcons';

import { listMembers, MemberSummary } from 'makerspace-ts-api-client';
import CreateMember from 'ui/member/CreateMember';
import RenewMember from 'ui/member/RenewMember';
import extractTotalItems from '../utils/extractTotalItems';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import StatefulTable from '../common/table/StatefulTable';
import { useQueryContext, withQueryContext } from '../common/Filters/QueryContext';
import { useAuthState } from 'ui/reducer/hooks';
import { useCapabilities } from 'app/permissions';

// Columns defined individually so getFields can weave them into the correct order.

const nameColumn: Column<MemberSummary> = {
  id: 'lastname',
  label: 'Name',
  cell: (row: MemberSummary) => (
    <Link to={`/members/${row.id}`}>{row.firstname} {row.lastname}</Link>
  ),
  defaultSortDirection: SortDirection.Desc,
};

const roleColumn: Column<MemberSummary> = {
  id: 'role',
  label: 'Portal Role',
  cell: (row: MemberSummary) => <RoleBadge role={(row as any).role} />,
};

const expirationColumn: Column<MemberSummary> = {
  id: 'expirationTime',
  label: 'Expiration',
  cell: displayMemberExpiration,
  defaultSortDirection: SortDirection.Desc,
};

const statusColumn: Column<MemberSummary> = {
  id: 'status',
  label: 'Status',
  cell: (row: MemberSummary) => <MemberStatusLabel member={row} />,
};

const totpColumn: Column<MemberSummary> = {
  id: 'totp_status',
  label: '2FA',
  cell: (row: MemberSummary) => <TotpStatusIcon enabled={!!(row as any).totpEnabled} />,
};

const emailStatusColumn: Column<MemberSummary> = {
  id: 'emailStatus',
  label: 'Email Status',
  cell: (row: MemberSummary) => <EmailStatusIcon mailtrap={(row as any).mailtrap} />,
};

const slackStatusColumn: Column<MemberSummary> = {
  id: 'slackStatus',
  label: 'Slack',
  cell: (row: MemberSummary) => {
    const slack = (row as any).slack;
    const content = (
      <>
        <SlackStatusIcon slack={slack} />
        {slack && <span style={{ fontSize: '0.8rem', color: '#555' }}>{slack.name}</span>}
      </>
    );

    if (slack?.url) {
      return (
        <a href={slack.url} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
          {content}
        </a>
      );
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {content}
      </span>
    );
  },
};

const notesColumn: Column<MemberSummary> = {
  id: 'notes',
  label: 'Notes',
  cell: (row: MemberSummary) => row.notes ? (
    <Tooltip title={row.notes} classes={{ tooltip: 'preformatted' }}>
      <IconButton aria-label={row.notes} size='small'>
        <InfoOutlined fontSize='small' />
      </IconButton>
    </Tooltip>
  ) : null,
};

// Column order: Name | [Portal Role] | Expiration | Status | [2FA | Email Status | Slack | Notes]
// Privileged columns visible to anyone with canViewAll (admin, RM, board).
const getFields = (showPrivileged: boolean): Column<MemberSummary>[] => [
  nameColumn,
  ...(showPrivileged ? [roleColumn] : []),
  expirationColumn,
  statusColumn,
  ...(showPrivileged ? [totpColumn, emailStatusColumn, slackStatusColumn, notesColumn] : []),
];

const rowId = (member: MemberSummary) => member.id;

const MembersList: React.FC = () => {
  const [selectedId, setSelectedId] = React.useState<string>();
  const navigate = useNavigate();
  const { params, setParam } = useQueryContext({ currentMembers: true });
  useAuthState(); // required for auth context
  const caps = useCapabilities();
  const canViewAll = caps.canViewAllMembers;
  const updateFilter = React.useCallback(
    () => setParam('currentMembers', !params.currentMembers),
    [params, setParam]
  );

  const { isRequesting, data: members = [], response, refresh, error } = useReadTransaction(
    listMembers,
    { ...params }
  );

  const onRenew = React.useCallback(() => { refresh(); }, [refresh]);
  const onCreate = React.useCallback((id: string) => { navigate(buildProfileRouting(id)); }, [navigate]);

  const selectedMember = members.find(member => member.id === selectedId);

  return (
    <Grid container spacing={3} justifyContent='center'>
      <Grid size={{ xs: 12, md: 10 }}>
        {caps.canCreateMembers && (
          <Grid>
            <CreateMember onCreate={onCreate} />
            <RenewMember member={selectedMember} onRenew={onRenew} />
            <FormControlLabel
              control={<Checkbox color='primary' value='true' checked={!!params.currentMembers} onChange={updateFilter} />}
              label='View only current members'
            />
          </Grid>
        )}
        {canViewAll && !caps.canCreateMembers && (
          <Grid>
            <Typography variant='body2' color='textSecondary' style={{ marginBottom: 8 }} data-testid='rm-notice'>
              You are viewing members in read-only mode.
            </Typography>
          </Grid>
        )}
        <StatefulTable
          id='members-table'
          title='Members'
          loading={isRequesting}
          data={Object.values(members)}
          error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId}
          setSelectedIds={canViewAll ? setSelectedId : undefined}
          columns={getFields(canViewAll)}
          rowId={rowId}
          renderSearch={canViewAll}
        />
      </Grid>
    </Grid>
  );
};

export default withQueryContext(MembersList);
