import 'server-only';
import { alova } from '@/api/server';
import type { Errorable } from '@/shared/types/error';
import type { RewardsData } from '@/shared/types/rewards';

export const getRewards = () => alova.Get<Errorable<RewardsData>>('/rewards');
