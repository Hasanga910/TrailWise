import { useContext } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { ThemeContext } from '../../theme/themeContext';

export function Toaster() {
  const theme = useContext(ThemeContext)?.resolved ?? 'light';
  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: 'font-sans' } }}
    />
  );
}
