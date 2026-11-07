export type RewardSlot = 'frame' | 'background' | 'title' | 'accent';
export type RewardEquipment = Partial<Record<RewardSlot, string>>;
export type RewardTaskId =
  | 'checkin'
  | 'first-solve'
  | 'three-solves'
  | 'comeback'
  | 'practice-days'
  | 'eight-solves';
export type RewardItem = { id: string; slot: RewardSlot; price: number };
export type RewardTask = {
  id: RewardTaskId;
  period: 'daily' | 'weekly';
  target: number;
  coins: number;
  key: string;
  progress: number;
  claimed: boolean;
};
export type RewardsData = {
  date: string;
  week: string;
  timezone: string;
  wallet: {
    balance: number;
    earned: number;
    spent: number;
    owned: string[];
    equipped: RewardEquipment;
    ledger: {
      id: string;
      reason: string;
      amount: number;
      at: string;
      by?: number;
      byName?: string;
      note?: string;
    }[];
  };
  tasks: RewardTask[];
  catalog: RewardItem[];
};
export type RewardAction = {
  action: 'claim' | 'buy' | 'equip' | 'unequip';
  id: string;
};
