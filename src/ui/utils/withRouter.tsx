import * as React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

/**
 * withRouter HOC shim for React Router v6.
 * Provides history, match and location props to legacy class components.
 */
export function withRouter<P extends object>(Component: React.ComponentType<P>) {
  const displayName = Component.displayName || Component.name || 'Component';

  const WithRouter = (props: Omit<P, 'history' | 'location' | 'match'>) => {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();

    const history = {
      push: (path: string) => navigate(path),
      replace: (path: string) => navigate(path, { replace: true }),
      goBack: () => navigate(-1),
    };

    const match = { params };

    return <Component {...(props as P)} history={history} location={location} match={match} />;
  };

  WithRouter.displayName = `withRouter(${displayName})`;
  return WithRouter;
}

export default withRouter;
