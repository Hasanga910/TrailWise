import { useEffect } from 'react';
import { hasActiveRuns, useWorkflowStore, WORKFLOW_POLL_INTERVAL_MS } from '../stores/workflowStore';

/**
 * Keeps the workflow monitor live: refreshes every few seconds, but only while some run is still
 * moving and the browser tab is visible. Stops on unmount.
 */
export function useWorkflowPolling(intervalMs: number = WORKFLOW_POLL_INTERVAL_MS): void {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      if (hasActiveRuns(useWorkflowStore.getState())) {
        void useWorkflowStore.getState().fetchRuns({ silent: true });
      }
    };

    const timer = window.setInterval(tick, intervalMs);
    // Catch up immediately when the user comes back to the tab.
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
}
