import * as React from 'react';
import { listToolGroups } from 'api/toolCheckouts';
import { ToolGroup } from 'app/entities/toolCheckout';

export default function useToolGroups(shopId?: string) {
  const [groups, setGroups] = React.useState<ToolGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const generation = React.useRef(0);
  const refresh = React.useCallback(() => {
    const current = ++generation.current;
    setGroups([]);
    setLoading(true);
    setError('');
    listToolGroups(shopId).then(result => {
      if (current !== generation.current) return;
      if (result.error) throw new Error('Unable to load tool groups.');
      setGroups(result.data || []);
    }).catch(() => {
      if (current === generation.current) setError('Unable to load tool groups. Retry to load the complete catalog.');
    }).finally(() => {
      if (current === generation.current) setLoading(false);
    });
  }, [shopId]);
  React.useEffect(() => {
    refresh();
    return () => { ++generation.current; };
  }, [refresh]);
  return { groups, loading, error, refresh };
}
