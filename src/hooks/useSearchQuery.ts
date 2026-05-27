import { LocationDescriptorObject } from "history";
import { useNavigate } from 'react-router-dom';
import * as React from "react";

type SearchParams = {
  [key: string]: string;
}

export const useSearchQuery = (params: SearchParams): SearchParams => {
  const { search } = useLocation();

  return React.useMemo(() =>  {
    const searchParams = new URLSearchParams(search);

    return Object.entries(params).reduce((values, [key, param]) => ({
      ...values,
      [key]: searchParams.get(param)
    }), {})
  }, [params, search]);
}

export const useSetSearchQuery = (pushLocationOverloads?: LocationDescriptorObject<any>): ((params: SearchParams) => void) => {
  const { search } = useLocation();
  const navigate = useNavigate();

  return React.useCallback((params: SearchParams) => {
    const searchParams = new URLSearchParams(search);

    Object.entries(params).forEach(([key, value]) => {
      value ? searchParams.set(key, value) : searchParams.delete(key);
    })

    navigate({ search: searchParams.toString(), ...pushLocationOverloads });
  }, [history, search, pushLocationOverloads]);
}

