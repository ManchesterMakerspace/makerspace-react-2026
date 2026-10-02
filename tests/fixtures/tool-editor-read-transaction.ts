import * as React from "react";

// Isolated browser fixtures exercise real API adapters without the app cache.
export default function useReadTransaction(transaction: any, args: any, delay?: boolean, key?: string) {
  const [state, setState] = React.useState<any>({ data: undefined, isRequesting: false, error: "" });
  const [revision, setRevision] = React.useState(0);
  const refresh = React.useCallback(() => setRevision(value => value + 1), []);
  React.useEffect(() => {
    if (delay) return;
    let active = true;
    setState((previous: any) => ({ ...previous, isRequesting: true }));
    transaction(args).then((result: any) => {
      if (active) setState({ data: result.data, error: result.error?.message || "", isRequesting: false });
    });
    return () => { active = false; };
  }, [transaction, JSON.stringify(args), delay, key, revision]);
  return { ...state, refresh };
}
