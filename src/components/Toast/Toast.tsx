import * as React from "react";
import Snackbar from "@mui/material/Snackbar";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";

// Each status is a theme tone, drawn with that tone's solid color and its
// contrast text -- the same colors an Alert or a chip of that status uses.
export enum ToastStatus {
  Success = "success",
  Error = "error",
  Warning = "warning",
  Info = "info"
}

interface CreateToast {
  message: React.ReactNode;
  status?: ToastStatus
  onClose?() :void;
}

interface ToastContext {
  create(props: CreateToast): void;  
}

const ToastContext = React.createContext<ToastContext>({ create: () => {} });
export function useToastContext() {
  return React.useContext(ToastContext);
}

export const ToastContextProvider: React.FC = ({ children }) => {
  const [toastProps, setToastProps] = React.useState<CreateToast>();
  const create = React.useCallback((props: CreateToast) => {
    setToastProps(props);
  }, [setToastProps]);

  const onClose = React.useCallback(() => {
    setToastProps(undefined);
    toastProps?.onClose();
  }, [toastProps?.onClose, setToastProps])

  return (
    <ToastContext.Provider value={{ create }}>
      <Snackbar 
        open={!!toastProps?.message} 
        autoHideDuration={6000} 
        onClose={onClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ padding: "1em", backgroundColor: toastProps?.status && `${toastProps.status}.main`, color: toastProps?.status && `${toastProps.status}.contrastText` }}>
          {toastProps?.message}
          <Box textAlign="right" component="span">
            <IconButton size="small" aria-label="close" color="inherit" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Snackbar>
      {children}
    </ToastContext.Provider>
  );
};
