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
import { AuditLogFilterChoices } from 'api/auditLogs';

// Friendlier names for some event types; anything else is shown by
// humanizing its event type (see eventTypeLabel).
export const EVENT_TYPE_OPTIONS: Record<string, string> = {
  'member_updated':          'Member Updated',
  'membership_revoked':      'Membership Revoked',
  'invoice_created':         'Invoice Created',
  'invoice_settled':         'Invoice Settled',
  'rental_created':          'Rental Created',
  'rental_cancelled':        'Rental Cancelled',
  'password_changed':        'Password Changed',
  'portal_setting_changed':  'Portal Setting Changed',
  'system_email_sent':       'Email Sent',
  'slack_message_sent':      'Slack Message Sent',
  'slack_message_failed':    'Slack Message Failed',
};

export const eventTypeLabel = (eventType: string): string =>
  EVENT_TYPE_OPTIONS[eventType] ||
  eventType.split('_').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');

// The screen opens on everything except Slack messages, so admin actions are
// not buried under routine bot posts.
export const DEFAULT_CATEGORY = 'all_except_slack';

// "All" has its own value: an empty category would be refilled with the
// default by useQueryContext.
export const ALL_CATEGORIES = 'all';

// Values that are not a single category, so they do not narrow the Event list.
const BROAD_CATEGORIES = [ALL_CATEGORIES, DEFAULT_CATEGORY];

const AuditLogFilters: React.FC<{ close: () => void; onChange: () => void; choices?: AuditLogFilterChoices }> = ({ close, onChange, choices }) => {
  const { params, setParam } = useQueryContext();
  const category = params.category || DEFAULT_CATEGORY;
  const eventTypes = (choices?.eventTypes || [])
    .filter(eventType => BROAD_CATEGORIES.includes(category) || eventType.category === category);

  // A different category can rule out the chosen event, so clear it.
  const onCategoryChange = React.useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    setParam('category', (event.target.value as string) || DEFAULT_CATEGORY);
    setParam('eventType', undefined);
    onChange();
    close();
  }, [setParam, onChange, close]);

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
          <FormLabel>Category</FormLabel>
          <Select
            value={category}
            onChange={onCategoryChange}
            displayEmpty
            inputProps={{ 'aria-label': 'Category' }}
          >
            {(choices?.categories || [{ value: DEFAULT_CATEGORY, label: 'All except Slack messages' }, { value: ALL_CATEGORIES, label: 'All' }]).map(option => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
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
            inputProps={{ 'aria-label': 'Event' }}
          >
            <MenuItem value=''>All</MenuItem>
            {eventTypes.map(eventType => (
              <MenuItem key={eventType.value} value={eventType.value}>{eventTypeLabel(eventType.value)}</MenuItem>
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
