import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

type SearchParams = {
  [key: string]: string;
}

export const useSearchQuery = (params: SearchParams): SearchParams => {
  const { search } = useLocation();

  return React.useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return Object.entries(params).reduce((values, [key, param]) => ({
      ...values,
      [key]: searchParams.get(param)
    }), {})
  }, [params, search]);
}

export const useSetSearchQuery = (pushLocationOverloads?: { pathname?: string; hash?: string }): ((params: SearchParams) => void) => {
  const navigate = useNavigate();
  const { search } = useLocation();

  return React.useCallback((params: SearchParams) => {
    const searchParams = new URLSearchParams(search);
    Object.entries(params).forEach(([key, value]) => {
      value ? searchParams.set(key, value) : searchParams.delete(key);
    })
    navigate({ search: searchParams.toString(), ...pushLocationOverloads });
  }, [navigate, search, pushLocationOverloads]);
}
