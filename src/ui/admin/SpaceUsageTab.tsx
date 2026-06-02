/**
 * SpaceUsageTab
 *
 * Drop this component into AdminAnalyticsPage as a third tab:
 *
 *   import SpaceUsageTab from 'ui/admin/SpaceUsageTab';
 *
 *   // In TABS array:
 *   { key: 'space', label: 'Space Usage' }
 *
 *   // In tab render:
 *   {tab === 'space' && <SpaceUsageTab />}
 */

import * as React from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

import { getSpaceUsage, getSpaceUsageDateRange, SpaceUsagePoint } from 'api/spaceUsage';

const formatMonthLabel = (d: string) => {
  const [year, month] = d.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const formatDayLabel = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type GranularityMode = 'month' | 'day' | 'rolling30';

const SpaceUsageTab: React.FC = () => {
  const [mode, setMode]         = React.useState<GranularityMode>('month');
  const [yearRange, setYearRange] = React.useState<{ earliest: number; latest: number } | null>(null);
  const [year, setYear]         = React.useState<number>(new Date().getFullYear());
  const [month, setMonth]       = React.useState<number | ''>('');
  const [data, setData]         = React.useState<SpaceUsagePoint[]>([]);
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);

  // Fetch date range on mount so year selector is accurate
  React.useEffect(() => {
    getSpaceUsageDateRange().then(r => {
      if (r.data) {
        setYearRange({ earliest: r.data.earliest_year, latest: r.data.latest_year });
        setYear(r.data.latest_year);
      }
    });
  }, []);

  const yearOptions = React.useMemo(() => {
    if (!yearRange) return [new Date().getFullYear()];
    return Array.from(
      { length: yearRange.latest - yearRange.earliest + 1 },
      (_, i) => yearRange.latest - i
    );
  }, [yearRange]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    let params: Parameters<typeof getSpaceUsage>[0];

    if (mode === 'rolling30') {
      params = { granularity: 'day', rolling: '30' };
    } else if (mode === 'day') {
      params = { granularity: 'day', year, month: month || undefined };
    } else {
      params = { granularity: 'month', year };
    }

    getSpaceUsage(params)
      .then(r => {
        if (r.error) { setError(r.error); return; }
        setData(r.data || []);
      })
      .finally(() => setLoading(false));
  }, [mode, year, month]);

  const isDay    = mode === 'day' || mode === 'rolling30';
  const labelFn  = isDay ? formatDayLabel : formatMonthLabel;
  const maxCount = data.length > 0 ? Math.max(...data.map(d => d.unique_members)) : 0;

  return (
    <Grid container spacing={3}>
      {/* Mode toggle */}
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid>
            <ToggleButtonGroup value={mode} exclusive size='small' onChange={(_, v) => v && setMode(v)}>
              <ToggleButton value='month'>Monthly</ToggleButton>
              <ToggleButton value='day'>Daily</ToggleButton>
              <ToggleButton value='rolling30'>Rolling 30 Days</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Year selector — hidden for rolling30 */}
          {mode !== 'rolling30' && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Year</InputLabel>
                <Select value={year} label='Year' onChange={e => { setYear(e.target.value as number); setMonth(''); }}>
                  {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Month selector — only for daily view */}
          {mode === 'day' && (
            <Grid size={{ xs: 6, sm: 2 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Month</InputLabel>
                <Select value={month} label='Month' onChange={e => setMonth(e.target.value as number | '')}>
                  <MenuItem value=''>All months</MenuItem>
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleDateString('en-US', { month: 'long' })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          {loading && <Grid><CircularProgress size={20} /></Grid>}
        </Grid>
      </Grid>

      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error'>{error}</Alert>
        </Grid>
      )}

      {/* Peak stat */}
      {!loading && data.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Typography variant='body2' color='textSecondary'>
            Peak unique members in a single {isDay ? 'day' : 'month'}: <strong>{maxCount}</strong>
          </Typography>
        </Grid>
      )}

      {/* Chart */}
      {!loading && data.length === 0 && !error && (
        <Grid size={{ xs: 12 }}>
          <Typography variant='body2' color='textSecondary'>
            No checkin data found for this range. Checkin data goes back to {yearRange?.earliest ?? '—'}.
          </Typography>
        </Grid>
      )}

      {data.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Typography variant='h6' gutterBottom>
            Unique Member Door Checkins
            {mode === 'rolling30' ? ' — Last 30 Days' : mode === 'day' ? ' — Daily' : ' — Monthly'}
          </Typography>
          <ResponsiveContainer width='100%' height={360}>
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id='usageGradient' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#1565c0' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#1565c0' stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='date'
                tickFormatter={labelFn}
                tick={{ fontSize: 11 }}
                interval={isDay && data.length > 60 ? Math.floor(data.length / 20) : 0}
              />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={d => labelFn(d as string)}
                formatter={(v: number) => [v, 'Unique Members']}
              />
              <Area
                type='monotone'
                dataKey='unique_members'
                name='Unique Members'
                stroke='#1565c0'
                fill='url(#usageGradient)'
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Typography variant='caption' color='textSecondary'>
          Counts unique members per {isDay ? 'day' : 'month'} based on door access card scans.
          One entry per member per day regardless of how many times they entered.
        </Typography>
      </Grid>
    </Grid>
  );
};

export default SpaceUsageTab;
