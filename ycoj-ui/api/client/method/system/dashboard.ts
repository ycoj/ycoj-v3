import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type SystemRestartResponse = Errorable<{ url: string }>;

/**
 * POST /manage/dashboard with `operation: "restart"`.
 * Reloads the process through PM2; the backend rejects the request when the
 * service was not launched by PM2.
 */
export const restartSystem = () =>
  clientRequest.Post<SystemRestartResponse>('/manage/dashboard', {
    operation: 'restart',
  });

const SystemDashboard = { restartSystem };
export default SystemDashboard;
