// @ts-nocheck
import * as React from 'react';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useQueryContext } from 'ui/common/Filters/QueryContext';
import { withFilterButton } from 'ui/common/FilterButton';
import { toDatePicker, dateToMidnight } from 'ui/utils/timeToDate';
import MemberSearchInput from 'ui/common/MemberSearchInput';
import { SelectOption } from 'ui/common/AsyncSelect';

export const LOG_TYPE_OPTIONS: Record<string, string> = {
  '':       'All',
  'member': 'Member',
  'portal': 'Portal / Settings',
};

export const EVENT_TYPE_OPTIONS: Record<string, string> = {
  '':                        'All',
  'member_updated':          'Member Updated',
  'membership_revoked':      'Membership Revoked',
  'invoice_created':         'Invoice Created',
  'invoice_settled':         'Invoice Settled',
  'rental_created':          'Rental Created',
  'rental_cancelled':        'Rental Cancelled',
  'password_changed':        'Password Changed',
  'portal_setting_changed':  'Portal Setting Changed',
};

const AuditLogFilters: React.FC<{ close: () => void; onChange: () => void }> = ({ close, onChange }) => {
  const { params, setParam } = useQueryContext();

  const onSelectChange = React.useCallback((param: string) => (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    setParam(param, value || undefined);
    onChange();
    close();
  }, [setParam, onChange, close]);

  const onDateChange = React.useCallback((param: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setParam(param, value ? dateToMidnight(value) : undefined);
    onChange();
    close();
  }, [setParam, onChange, close]);

  const onActorChange = React.useCallback((selection: SelectOption) => {
    setParam('actorId', selection ? selection.value : undefined);
    onChange();
    close();
  }, [setParam, onChange, close]);

  const onSubjectChange = React.useCallback((selection: SelectOption) => {
    setParam('subjectId', selection ? selection.value : undefined);
    onChange();
    close();
  }, [setParam, onChange, close]);

  return (
    <>
      <Typography variant='subtitle1' gutterBottom>
        Audit Log Filters
      </Typography>

      <Grid size={{ xs: 12 }} style={{ marginBottom: '1em' }}>
        <FormControl fullWidth>
          <FormLabel>Type</FormLabel>
          <Select
            value={params.logType || ''}
            onChange={onSelectChange('logType')}
            displayEmpty
          >
            {Object.entries(LOG_TYPE_OPTIONS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }} style={{ marginBottom: '1em' }}>
        <FormControl fullWidth>
          <FormLabel>Event</FormLabel>
          <Select
            value={params.eventType || ''}
            onChange={onSelectChange('eventType')}
            displayEmpty
          >
            {Object.entries(EVENT_TYPE_OPTIONS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }} style={{ marginBottom: '1em' }}>
        <FormControl fullWidth>
          <FormLabel>Changed By</FormLabel>
          <MemberSearchInput
            name='actorId'
            placeholder='Search by name...'
            onChange={onActorChange}
          />
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }} style={{ marginBottom: '1em' }}>
        <FormControl fullWidth>
          <FormLabel>Member Affected</FormLabel>
          <MemberSearchInput
            name='subjectId'
            placeholder='Search by name...'
            onChange={onSubjectChange}
          />
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }} style={{ marginBottom: '1em' }}>
        <FormControl fullWidth>
          <FormLabel>From Date</FormLabel>
          <TextField
            id='audit-from-date'
            type='date'
            value={toDatePicker(params.fromDate) || ''}
            onChange={onDateChange('fromDate')}
          />
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }} style={{ marginBottom: '1em' }}>
        <FormControl fullWidth>
          <FormLabel>To Date</FormLabel>
          <TextField
            id='audit-to-date'
            type='date'
            value={toDatePicker(params.toDate) || ''}
            onChange={onDateChange('toDate')}
          />
        </FormControl>
      </Grid>
    </>
  );
};

export default withFilterButton(AuditLogFilters);
