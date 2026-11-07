import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type CoinAdjustmentResult = {
  adjustments: {
    uid: number;
    amount: number;
    balance: number;
    applied: boolean;
  }[];
};

/** Grant or deduct coins for joined members of the active domain. */
export const adjustDomainCoins = (input: {
  uids: number[];
  direction: 'grant' | 'deduct';
  amount: number;
  reason: string;
  requestId: string;
}) =>
  clientRequest.Post<Errorable<CoinAdjustmentResult>>('/domain/coins', {
    operation: 'adjust',
    ...input,
  });
