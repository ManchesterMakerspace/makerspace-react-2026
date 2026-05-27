import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import 'assets/application';

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { composeWithDevTools } from 'redux-devtools-extension';
import { applyMiddleware, createStore, Store } from 'redux';
import reduxThunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import App from 'app/App';
import { State as ReduxState, getRootReducer } from 'ui/reducer';
import { ToastContextProvider } from 'components/Toast/Toast';

const store: Store<ReduxState> = createStore(
  getRootReducer(),
  composeWithDevTools(
    applyMiddleware(reduxThunk),
  ),
);

export const getStore = () => store;

const theme = createTheme({
  palette: {
    secondary: {
      light: '#9E3321',
      main: '#791100',
      dark: '#510B00',
      contrastText: '#FFF',
    },
  },
});

const container = document.body.appendChild(document.createElement('div'));
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <ToastContextProvider>
          <App />
        </ToastContextProvider>
      </ThemeProvider>
    </BrowserRouter>
  </Provider>
);
