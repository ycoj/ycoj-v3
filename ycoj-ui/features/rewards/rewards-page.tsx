'use client';

import RewardThemePreview from './reward-theme-preview';
import RewardTitle from './reward-title';
import ClientApis from '@/api/client/method';
import { getRewards, updateRewards } from '@/api/client/method/rewards';
import UserAvatar from '@/features/user/user-avatar';
import Username from '@/features/user/username';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { cn } from '@/shared/lib/utils';
import type {
  RewardAction,
  RewardEquipment,
  RewardItem,
  RewardsData,
  RewardSlot,
} from '@/shared/types/rewards';
import type { BaseUser } from '@/shared/types/user';
import {
  Check,
  CircleCheck,
  Coins,
  LoaderCircle,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const SLOT_ORDER: RewardSlot[] = ['frame', 'background', 'title', 'accent'];
const RETIRED_ITEM_IDS = new Set([
  'frame-sprout',
  'frame-starlight',
  'background-sky',
  'background-peach',
  'title-explorer',
  'title-persistent',
]);

type Props = { initialData: RewardsData; user: BaseUser };

/**
 * Maintains tentative cosmetic combinations separately from the server wallet.
 * Selecting previews never spends coins or equips items; confirmed actions update
 * the wallet, and unequipping clears only the affected preview slot.
 */
export default function RewardsPage({ initialData, user }: Props) {
  const t = useTranslations('rewards');
  const format = useFormatter();
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialData.catalog[0]?.id
  );
  const [previewEquipment, setPreviewEquipment] = useState<RewardEquipment>(
    () => {
      const firstItem = initialData.catalog[0];
      return {
        ...initialData.wallet.equipped,
        ...(firstItem ? { [firstItem.slot]: firstItem.id } : {}),
      };
    }
  );
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [category, setCategory] = useState<'all' | RewardSlot>('all');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const selected = data.catalog.find((item) => item.id === selectedId);
  const previewUser = { ...user, rewardEquipment: previewEquipment };
  const selectItem = (item: RewardItem) => {
    setSelectedId(item.id);
    setPreviewEquipment((previous) => ({ ...previous, [item.slot]: item.id }));
  };
  const checkedIn = Boolean(
    data.tasks.find((task) => task.id === 'checkin')?.progress
  );
  const ready = data.tasks.filter(
    (task) => !task.claimed && task.progress >= task.target
  ).length;

  const activeSlots = SLOT_ORDER.filter((slot) =>
    data.catalog.some((item) => item.slot === slot)
  );
  const wearingSlots = SLOT_ORDER.filter(
    (slot) => activeSlots.includes(slot) || Boolean(data.wallet.equipped[slot])
  );
  const shopGroups = activeSlots
    .map((slot) => ({
      slot,
      items: data.catalog.filter(
        (item) =>
          item.slot === slot &&
          (category === 'all' || category === slot) &&
          (!ownedOnly || data.wallet.owned.includes(item.id))
      ),
    }))
    .filter((group) => group.items.length > 0);

  /**
   * Serializes wallet requests and applies server-confirmed results.
   * Check-in also refreshes the wallet; equipment changes refresh user data.
   */
  const run = async (key: string, action?: RewardAction) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(key);
    setError(null);
    setNotice('');
    try {
      if (key === 'checkin') {
        const result = await ClientApis.Checkin.checkin().send();
        if ('error' in result) throw new Error('request-failed');
      }
      const result = await (
        action ? updateRewards(action) : getRewards()
      ).send();
      if ('error' in result) {
        const code = result.error.message;
        setError(
          code &&
            [
              'insufficient-coins',
              'task-incomplete',
              'item-not-owned',
              'busy',
            ].includes(code)
            ? code
            : 'request-failed'
        );
        return;
      }
      setData(result);
      if (action?.action === 'unequip') {
        setPreviewEquipment((previous) => {
          const next = { ...previous };
          delete next[action.id as RewardSlot];
          return next;
        });
      }
      setNotice(
        t(
          action
            ? `${action.action}Success`
            : key === 'checkin'
              ? 'checkinSuccess'
              : 'refreshSuccess'
        )
      );
      if (action?.action === 'equip' || action?.action === 'unequip')
        router.refresh();
    } catch {
      setError('request-failed');
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const itemName = (id: string) => t(`items.${id}.name`);
  const reasonLabel = (entry: RewardsData['wallet']['ledger'][number]) => {
    if (entry.reason === 'admin-adjust') {
      return t('adminAdjust', {
        name: entry.byName || t('administrator'),
        note: entry.note ?? '',
      });
    }
    if (entry.reason === 'cosmetics-refund') {
      return t('cosmeticsRefund', {
        item: entry.note ? itemName(entry.note) : t('retiredCosmetic'),
      });
    }
    const reason = entry.reason;
    if (reason === 'welcome') return t('welcome');
    if (
      data.catalog.some((item) => item.id === reason) ||
      RETIRED_ITEM_IDS.has(reason)
    ) {
      return t('purchaseReason', { item: itemName(reason) });
    }
    if (data.tasks.some((task) => task.id === reason))
      return t(`tasks.${reason}.name`);
    return reason;
  };

  const itemActions = (item: RewardItem) => {
    const owned = data.wallet.owned.includes(item.id);
    const equipped = data.wallet.equipped[item.slot] === item.id;
    const shortfall = item.price - data.wallet.balance;
    return (
      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={Boolean(pending) || (!owned && shortfall > 0)}
          onClick={() =>
            run(item.id, {
              action: owned ? (equipped ? 'unequip' : 'equip') : 'buy',
              id: owned && equipped ? item.slot : item.id,
            })
          }
        >
          {pending === item.id && (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          )}
          {owned
            ? t(equipped ? 'unequip' : 'equip')
            : t('buyFor', { coins: item.price })}
        </Button>
        <p className="text-xs text-muted-foreground">
          {!owned && shortfall > 0
            ? t('shortfall', { coins: shortfall })
            : t(owned ? 'ownedForever' : 'purchaseHint')}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-5" data-llm-visible="true">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 max-w-2xl space-y-1">
          <h1 className="text-xl leading-tight font-semibold md:text-2xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
        <div className="bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Coins className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs">{t('balance')}</p>
            <p className="text-xl leading-tight font-semibold tabular-nums">
              {format.number(data.wallet.balance)}{' '}
              <span className="text-muted-foreground text-sm font-normal">
                {t('coins')}
              </span>
            </p>
          </div>
        </div>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-primary empty:hidden"
      >
        {notice}
      </p>
      <Tabs defaultValue="tasks">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="tasks">
              {t('taskTab')}
              {ready > 0 && <Badge variant="secondary">{ready}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="shop">{t('shopTab')}</TabsTrigger>
            <TabsTrigger value="history">{t('historyTab')}</TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            disabled={Boolean(pending)}
            onClick={() => run('refresh')}
          >
            <RefreshCw
              className={cn(pending === 'refresh' && 'animate-spin')}
              aria-hidden="true"
            />
            {t('refresh')}
          </Button>
        </div>
        <TabsContent value="tasks" className="mt-5 space-y-6">
          <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="space-y-1">
              <h2 className="font-medium">{t('gentleGoal')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('resetHint', { date: data.date, week: data.week })}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/problem">{t('practice')}</Link>
            </Button>
          </div>
          {(['daily', 'weekly'] as const).map((period) => (
            <section key={period} aria-label={t(period)}>
              <h2 className="mb-3 text-lg font-semibold">{t(period)}</h2>
              <div className="bg-card divide-y rounded-xl border px-4">
                {data.tasks
                  .filter((task) => task.period === period)
                  .map((task) => (
                    <div
                      key={task.key}
                      className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4"
                    >
                      <CircleCheck
                        className={cn(
                          'size-5 shrink-0',
                          task.claimed
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1 basis-48">
                        <h3 className="font-medium">
                          {t(`tasks.${task.id}.name`)}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t(`tasks.${task.id}.description`)}
                        </p>
                      </div>
                      <div className="flex min-w-24 items-center gap-2">
                        <progress
                          aria-label={t(`tasks.${task.id}.name`)}
                          value={task.progress}
                          max={task.target}
                          className="h-1.5 w-16 accent-primary"
                        />
                        <span className="text-xs tabular-nums">
                          {task.progress}/{task.target}
                        </span>
                      </div>
                      <span className="min-w-14 text-sm font-medium tabular-nums text-amber-800 dark:text-amber-300">
                        +{task.coins} {t('coins')}
                      </span>
                      {task.id === 'checkin' && !checkedIn ? (
                        <Button
                          variant="outline"
                          disabled={Boolean(pending)}
                          onClick={() => run('checkin')}
                        >
                          {pending === 'checkin' && (
                            <LoaderCircle
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          )}
                          {t('checkin')}
                        </Button>
                      ) : (
                        <Button
                          variant={task.claimed ? 'ghost' : 'outline'}
                          disabled={
                            Boolean(pending) ||
                            task.claimed ||
                            task.progress < task.target
                          }
                          onClick={() =>
                            run(task.id, { action: 'claim', id: task.id })
                          }
                          aria-label={t(
                            task.claimed ? 'claimedTask' : 'claimTask',
                            { task: t(`tasks.${task.id}.name`) }
                          )}
                        >
                          {pending === task.id ? (
                            <LoaderCircle
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : task.claimed ? (
                            <Check aria-hidden="true" />
                          ) : null}
                          {t(
                            task.claimed
                              ? 'claimed'
                              : task.progress >= task.target
                                ? 'claim'
                                : 'inProgress'
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
          <section className="space-y-2 text-sm text-muted-foreground">
            <h2 className="font-medium text-foreground">{t('rulesTitle')}</h2>
            <p className="max-w-3xl leading-relaxed">{t('rules')}</p>
            <p className="max-w-3xl leading-relaxed">{t('contestHint')}</p>
          </section>
        </TabsContent>
        <TabsContent value="shop" className="mt-5 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{t('shopTitle')}</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('shopHint')}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ownedOnly}
                onChange={(event) => {
                  setOwnedOnly(event.target.checked);
                  if (
                    event.target.checked &&
                    !data.wallet.owned.includes(selectedId ?? '')
                  ) {
                    const replacement = data.catalog.find(
                      (item) =>
                        data.wallet.owned.includes(item.id) &&
                        (category === 'all' || item.slot === category)
                    );
                    if (replacement) selectItem(replacement);
                    else setSelectedId(undefined);
                  }
                }}
                className="accent-primary"
              />
              {t('ownedOnly')}
            </label>
          </div>
          <div
            role="group"
            aria-label={t('categoriesLabel')}
            className="flex flex-wrap gap-2"
          >
            {(['all', ...activeSlots] as const).map((slot) => (
              <button
                type="button"
                key={slot}
                aria-pressed={category === slot}
                onClick={() => setCategory(slot)}
                className={cn(
                  'hover:bg-muted rounded-full border px-3 py-1 text-sm transition-colors',
                  category === slot
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border text-muted-foreground'
                )}
              >
                {slot === 'all' ? t('allCategories') : t(`slots.${slot}`)}
              </button>
            ))}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_19rem]">
            <div className="space-y-8">
              {shopGroups.map(({ slot, items }) => {
                const slotItems = data.catalog.filter(
                  (item) => item.slot === slot
                );
                const slotOwned = slotItems.filter((item) =>
                  data.wallet.owned.includes(item.id)
                ).length;
                return (
                  <section key={slot} aria-label={t(`slots.${slot}`)}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <h3 className="font-semibold">{t(`slots.${slot}`)}</h3>
                        <p className="text-muted-foreground text-xs">
                          {t(`slotHints.${slot}`)}
                        </p>
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t('categoryOwned', {
                          owned: slotOwned,
                          total: slotItems.length,
                        })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'grid gap-3',
                        slot === 'frame'
                          ? 'grid-cols-2 xl:grid-cols-3'
                          : 'sm:grid-cols-2'
                      )}
                    >
                      {items.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => selectItem(item)}
                          aria-pressed={selectedId === item.id}
                          aria-label={t('previewItem', {
                            item: itemName(item.id),
                          })}
                          className={cn(
                            'reward-shop-item bg-card hover:border-primary/50 focus-visible:outline-ring relative space-y-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                            selectedId === item.id &&
                              'border-primary bg-primary/5'
                          )}
                        >
                          {selectedId === item.id && (
                            <span className="bg-primary text-primary-foreground absolute top-5 right-5 z-20 flex size-5 items-center justify-center rounded-full">
                              <Check className="size-3" aria-hidden="true" />
                            </span>
                          )}
                          {item.slot === 'accent' ? (
                            <RewardThemePreview id={item.id} />
                          ) : (
                            <div
                              className="reward-frame-stage flex h-36 items-center justify-center gap-3 rounded-lg"
                              data-frame-stage={
                                item.slot === 'frame' ? item.id : undefined
                              }
                            >
                              {item.slot === 'title' ? (
                                <RewardTitle id={item.id} />
                              ) : (
                                <>
                                  <UserAvatar
                                    user={{
                                      ...user,
                                      rewardEquipment: { [item.slot]: item.id },
                                    }}
                                    className={
                                      item.slot === 'frame'
                                        ? 'size-18'
                                        : 'size-9'
                                    }
                                  />
                                  {item.slot === 'background' && (
                                    <Username
                                      user={{
                                        ...user,
                                        rewardEquipment: {
                                          background: item.id,
                                        },
                                      }}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          <div className="space-y-1 px-1 pb-1">
                            <h4 className="text-sm font-medium">
                              {itemName(item.id)}
                            </h4>
                            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
                              {!data.wallet.owned.includes(item.id) && (
                                <Coins
                                  className="size-3 text-amber-700 dark:text-amber-300"
                                  aria-hidden="true"
                                />
                              )}
                              {data.wallet.owned.includes(item.id)
                                ? t(
                                    data.wallet.equipped[item.slot] === item.id
                                      ? 'equipped'
                                      : 'owned'
                                  )
                                : t('price', { coins: item.price })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
              {shopGroups.length === 0 && (
                <p className="text-muted-foreground col-span-full py-12 text-center text-sm">
                  {t('emptyInventory')}
                </p>
              )}
            </div>
            <aside
              className="bg-card order-first space-y-5 rounded-xl border p-5 lg:sticky lg:top-6 lg:order-last"
              aria-label={t('preview')}
              data-reward-accent={previewUser.rewardEquipment.accent}
            >
              <h2 className="font-semibold">{t('preview')}</h2>
              <div className="reward-theme-canvas flex min-h-56 flex-col items-center justify-center gap-5 rounded-lg border px-5 py-7 text-center">
                <UserAvatar user={previewUser} className="size-20" />
                <div className="min-w-0 max-w-full space-y-2">
                  <Username
                    user={previewUser}
                    className="break-all font-medium"
                  />
                  {previewUser.rewardEquipment.title && (
                    <div>
                      <RewardTitle id={previewUser.rewardEquipment.title} />
                    </div>
                  )}
                  {previewEquipment.accent && (
                    <p className="text-xs text-muted-foreground">
                      {itemName(previewEquipment.accent)}
                    </p>
                  )}
                </div>
              </div>
              {previewEquipment.accent && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {t('themePreviewHint')}
                  </p>
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <span className="size-5 rounded-full border bg-background" />
                    <span className="size-5 rounded-full border bg-sidebar" />
                    <span className="size-5 rounded-full bg-primary" />
                    <span className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                      {t('practice')}
                    </span>
                  </div>
                </div>
              )}
              {selected && (
                <>
                  <div>
                    <p className="font-medium">{itemName(selected.id)}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t(`items.${selected.id}.description`)}
                    </p>
                  </div>
                  {itemActions(selected)}
                </>
              )}
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">{t('wearing')}</h3>
                {wearingSlots.map((slot) => (
                  <div
                    key={slot}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {t(`slots.${slot}`)}
                    </span>
                    <span>
                      {data.wallet.equipped[slot]
                        ? itemName(data.wallet.equipped[slot])
                        : t('defaultAppearance')}
                    </span>
                    {data.wallet.equipped[slot] && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={Boolean(pending)}
                        onClick={() =>
                          run(slot, { action: 'unequip', id: slot })
                        }
                        aria-label={t('removeSlot', {
                          slot: t(`slots.${slot}`),
                        })}
                      >
                        {t('unequip')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('historyTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('totals', {
                earned: format.number(data.wallet.earned),
                spent: format.number(data.wallet.spent),
              })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{t('historyHint')}</p>
          <ul className="bg-card divide-y rounded-xl border px-4">
            {data.wallet.ledger.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-4">
                {entry.amount > 0 ? (
                  <Coins
                    className="size-4 text-amber-700 dark:text-amber-300"
                    aria-hidden="true"
                  />
                ) : (
                  <ShoppingBag
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{reasonLabel(entry)}</p>
                  <time
                    dateTime={entry.at}
                    className="text-xs text-muted-foreground"
                  >
                    {format.dateTime(new Date(entry.at), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {entry.amount > 0 ? '+' : ''}
                  {format.number(entry.amount)} {t('coins')}
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
