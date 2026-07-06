import type * as React from 'react';
import type { CSSProperties } from 'react';

declare module 'react' {
  type SFC<P = {}> = FunctionComponent<P>;

  interface FunctionComponent<P = {}> {
    (props: React.PropsWithChildren<P>, context?: any): React.ReactElement<any, any> | null;
  }

  interface Component<P = {}, S = {}, SS = any> {
    props: Readonly<React.PropsWithChildren<P>>;
  }
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '@mui/material/Grid' {
  interface GridBaseProps {
    justifyContent?: CSSProperties['justifyContent'];
    alignItems?: CSSProperties['alignItems'];
  }
}

declare module '@mui/system' {
  interface BoxOwnProps<Theme extends object = {}> {
    textAlign?: CSSProperties['textAlign'];
  }
}

declare module '@redux-devtools/extension/lib/index.js' {
  export function composeWithDevTools(...funcs: any[]): any;
}
