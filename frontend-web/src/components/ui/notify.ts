import { toast } from 'sonner';

/** App-wide toast helpers. Sonner's region is aria-live, so these are announced to screen readers. */
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  /** Errors stay until dismissed so they are not missed. */
  error: (message: string, description?: string) => toast.error(message, { description, duration: Infinity }),
  info: (message: string, description?: string) => toast.info(message, { description }),
  warning: (message: string, description?: string) => toast.warning(message, { description }),
  promise: toast.promise,
};
