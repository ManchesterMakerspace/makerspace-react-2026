import * as React from "react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';

/**
 * Requires :resource when setting up the route
 * @param options Subpaths
 */
export default function useSubresourcePath(options: string[]) {
  const { resource } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const changeResource = React.useCallback((newActiveName: string) => {
    const newResource = options.find(opt => opt === newActiveName);
    if (newResource && resource !== newResource) {
      const hasSubpath = options.some(opt => pathname.endsWith(`/${opt}`));
      const newPath = hasSubpath ? pathname.replace(/\/[^\/]*$/, `/${newResource}`) : `${pathname}/${newResource}`;
      navigate(newPath);
    }
  }, [options, resource]);

  return changeResource;
}