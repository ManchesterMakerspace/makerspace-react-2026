/**
 * Main injection point for application. Webpacker compiles everything in this folder by default.
 */
import 'assets/application';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { applyMiddleware, compose, createStore, Store } from 'redux';
import { thunk as reduxThunk } from 'redux-thunk';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Theme, ThemeProvider, createTheme } from '@mui/material/styles';

import App from 'app/App';
import { State as ReduxState, getRootReducer } from 'ui/reducer';
import { ToastContextProvider } from 'components/Toast/Toast';

const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store: Store<ReduxState> = createStore(
  getRootReducer(),
  composeEnhancers(
    applyMiddleware(reduxThunk),
  ),
);

export const getStore = () => store;

const theme: Theme = createTheme({
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
