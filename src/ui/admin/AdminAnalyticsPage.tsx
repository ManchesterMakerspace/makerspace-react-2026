import * as React from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

import {
  getAnalyticsSummary,
  getMemberGrowth,
  getActiveMembers,
  getVolunteerSummaryAnalytics,
  AnalyticsSummary,
  MemberGrowthPoint,
  ActiveMemberPoint,
  VolunteerSummaryAnalytics,
} from 'api/analytics';

// ── Helpers ───────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2015 }, (_, i) => currentYear - i);

const formatMonth = (m: string) => {
  const [year, month] = m.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

// ── Summary Cards ─────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color = '#e85d04' }) => (
  <Card variant='outlined' style={{ height: '100%' }}>
    <CardContent>
      <Typography variant='h4' style={{ color, fontWeight: 700 }}>{value}</Typography>
      <Typography variant='body2' color='textSecondary'>{label}</Typography>
    </CardContent>
  </Card>
);

// ── Member Growth Tab ─────────────────────────────────────────────────────────

const MemberGrowthTab: React.FC = () => {
  const [year, setYear]         = React.useState<number | ''>('');
  const [growth, setGrowth]     = React.useState<MemberGrowthPoint[]>([]);
  const [active, setActive]     = React.useState<ActiveMemberPoint[]>([]);
  const [gran, setGran]         = React.useState<'month' | 'day'>('month');
  const [loading, setLoading]   = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getMemberGrowth(year ? { year: year as number } : {}),
      getActiveMembers(year ? { year: year as number, granularity: gran } : { granularity: gran }),
    ]).then(([g, a]) => {
      if (g.data) setGrowth(g.data);
      if (a.data) setActive(a.data);
    }).finally(() => setLoading(false));
  }, [year, gran]);

  return (
    <Grid container spacing={3}>
      {/* Filters */}
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth size='small'>
              <InputLabel>Year</InputLabel>
              <Select value={year} label='Year' onChange={e => setYear(e.target.value as number | '')}>
                <MenuItem value=''>All time</MenuItem>
                {YEAR_OPTIONS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ToggleButtonGroup
              value={gran}
              exclusive
              size='small'
              onChange={(_, v) => v && setGran(v)}
            >
              <ToggleButton value='month'>Monthly</ToggleButton>
              <ToggleButton value='day'>Daily</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          {loading && <Grid><CircularProgress size={20} /></Grid>}
        </Grid>
      </Grid>

      {/* New members per month */}
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6' gutterBottom>New Members per Month</Typography>
        <ResponsiveContainer width='100%' height={300}>
          <BarChart data={growth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='month' tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip labelFormatter={formatMonth} />
            <Bar dataKey='count' name='New Members' fill='#e85d04' radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Grid>

      {/* Active member count over time */}
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6' gutterBottom>Active Member Count Over Time</Typography>
        {active.length === 0 && !loading && (
          <Typography variant='body2' color='textSecondary'>
            No snapshot data available for this range. The daily snapshot job must have run to populate this chart.
          </Typography>
        )}
        {active.length > 0 && (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={active} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='date'
                tickFormatter={d => gran === 'month' ? formatMonth(d) : d}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip labelFormatter={d => gran === 'month' ? formatMonth(d as string) : d} />
              <Line
                type='monotone'
                dataKey='count'
                name='Active Members'
                stroke='#1565c0'
                dot={gran === 'day' ? false : { r: 3 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Grid>
    </Grid>
  );
};

// ── Volunteer Analytics Tab ───────────────────────────────────────────────────

const VolunteerAnalyticsTab: React.FC = () => {
  const [year, setYear]       = React.useState<number | ''>(currentYear);
  const [data, setData]       = React.useState<VolunteerSummaryAnalytics | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    getVolunteerSummaryAnalytics(year ? { year: year as number } : {})
      .then(r => { if (r.data) setData(r.data); })
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <Grid container spacing={3}>
      {/* Year filter */}
      <Grid size={{ xs: 12, sm: 3 }}>
        <FormControl fullWidth size='small'>
          <InputLabel>Year</InputLabel>
          <Select value={year} label='Year' onChange={e => setYear(e.target.value as number | '')}>
            <MenuItem value=''>All time</MenuItem>
            {YEAR_OPTIONS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      {loading && <Grid><CircularProgress size={20} /></Grid>}

      {/* Summary stats */}
      {data && (
        <>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label='Credits Issued' value={data.total_credits} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label='Total Credit Value' value={data.total_credit_value.toFixed(1)} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label='Pending Credits' value={data.pending_credits} color='#f57c00' />
          </Grid>

          {/* Credits per month */}
          <Grid size={{ xs: 12 }}>
            <Typography variant='h6' gutterBottom>Credits Issued per Month</Typography>
            <ResponsiveContainer width='100%' height={280}>
              <BarChart data={data.credits_by_month} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='month' tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={formatMonth} />
                <Legend />
                <Bar dataKey='count' name='Credits' fill='#2e7d32' radius={[3, 3, 0, 0]} />
                <Bar dataKey='total_value' name='Credit Value' fill='#66bb6a' radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Grid>

          {/* Tasks completed per month */}
          <Grid size={{ xs: 12 }}>
            <Typography variant='h6' gutterBottom>Tasks Completed per Month</Typography>
            <ResponsiveContainer width='100%' height={240}>
              <BarChart data={data.tasks_by_month} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='month' tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={formatMonth} />
                <Bar dataKey='count' name='Tasks Completed' fill='#1565c0' radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Grid>

          {/* Top volunteers */}
          {data.top_volunteers.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' gutterBottom>Top Volunteers</Typography>
              <ResponsiveContainer width='100%' height={280}>
                <BarChart
                  layout='vertical'
                  data={data.top_volunteers}
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis type='number' allowDecimals={false} />
                  <YAxis type='category' dataKey='name' tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey='value' name='Credit Value' fill='#e85d04' radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Grid>
          )}
        </>
      )}
    </Grid>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'members' | 'volunteer';

const AdminAnalyticsPage: React.FC = () => {
  const [tab, setTab]           = React.useState<TabKey>('members');
  const [summary, setSummary]   = React.useState<AnalyticsSummary | null>(null);

  React.useEffect(() => {
    getAnalyticsSummary().then(r => { if (r.data) setSummary(r.data); });
  }, []);

  return (
    <Grid container spacing={3} justifyContent='center'>
      <Grid size={{ xs: 12, md: 10 }}>
        <Typography variant='h5' gutterBottom>Analytics</Typography>
        <Typography variant='body2' color='textSecondary' style={{ marginBottom: 16 }}>
          Membership and volunteer activity over time.
        </Typography>

        {/* Summary stat cards */}
        {summary && (
          <Grid container spacing={2} style={{ marginBottom: 24 }}>
            <Grid size={{ xs: 6, sm: 2 }}>
              <StatCard label='Active Members' value={summary.totalMembers} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <StatCard label='New This Month' value={summary.newMembers} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <StatCard label='Subscribed' value={summary.subscribedMembers} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <StatCard label='Past Due' value={summary.pastDueInvoices} color={summary.pastDueInvoices > 0 ? '#c62828' : '#2e7d32'} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <StatCard label='Refunds Pending' value={summary.refundsPending} color={summary.refundsPending > 0 ? '#f57c00' : '#2e7d32'} />
            </Grid>
          </Grid>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as TabKey)}
          indicatorColor='primary'
          textColor='primary'
          style={{ marginBottom: 24 }}
        >
          <Tab value='members'   label='Membership' />
          <Tab value='volunteer' label='Volunteer' />
        </Tabs>

        {tab === 'members'   && <MemberGrowthTab />}
        {tab === 'volunteer' && <VolunteerAnalyticsTab />}
      </Grid>
    </Grid>
  );
};

export default AdminAnalyticsPage;
