import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';
import type { RewardAction, RewardsData } from '@/shared/types/rewards';

export const getRewards = () =>
  clientRequest.Get<Errorable<RewardsData>>('/rewards', { cacheFor: 0 });
export const updateRewards = (action: RewardAction) =>
  clientRequest.Post<Errorable<RewardsData>>('/rewards', action);
