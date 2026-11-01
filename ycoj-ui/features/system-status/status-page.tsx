import type {
  JudgeStatusNode,
  JudgeStatusResponse,
} from '@/api/server/method/status';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { formatRecordTime } from '@/shared/lib/format-time';
import { formatMemory } from '@/shared/lib/format-units';
import { Cpu, Server, Terminal } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

type Props = { data: JudgeStatusResponse };

function osLabel(node: JudgeStatusNode) {
  const os = node.osinfo;
  if (!os) return '-';
  return (
    [os.distro, os.release, os.codename, os.arch]
      .filter(Boolean)
      .join(' ')
      .trim() || '-'
  );
}

function cpuLabel(node: JudgeStatusNode) {
  const cpu = node.cpu;
  if (!cpu) return '-';
  const name = [cpu.manufacturer, cpu.brand].filter(Boolean).join(' ').trim();
  const speed = typeof cpu.speed === 'number' ? `${cpu.speed}GHz` : '';
  return [name, speed].filter(Boolean).join(' @ ') || '-';
}

function memoryLabel(node: JudgeStatusNode) {
  const memory = node.memory;
  if (!memory) return '-';
  return `${formatMemory(memory.used ?? 0)} / ${formatMemory(memory.total ?? 0)}`;
}

export default async function StatusPage({ data }: Props) {
  const t = await getTranslations('system');
  const nodeRows = data.stats ?? [];
  const compilers = data.compilers ?? [];
  const commands = Object.entries(data.languages ?? {});

  return (
    <section className="space-y-5" data-llm-visible="true">
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          data-llm-text={t('statusTitle')}
        >
          <Server className="size-5" aria-hidden="true" />
          {t('statusTitle')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('statusDescription')}
        </p>
      </header>

      {nodeRows.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{t('statusEmpty')}</EmptyTitle>
            <EmptyDescription>{t('statusDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="min-w-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('statusId')}</TableHead>
                  <TableHead>{t('statusState')}</TableHead>
                  <TableHead>{t('statusOs')}</TableHead>
                  <TableHead>{t('statusCpu')}</TableHead>
                  <TableHead>{t('statusMemory')}</TableHead>
                  <TableHead className="text-right">
                    {t('statusRequests')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodeRows.map((node) => (
                  <TableRow key={node._id}>
                    <TableCell className="font-mono text-xs">
                      {node._id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className={
                            node.isOnline
                              ? 'border-emerald-500/60 text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {node.isOnline
                            ? t('statusOnline')
                            : t('statusOffline')}
                        </Badge>
                        {!node.isOnline && node.updateAt && (
                          <div className="text-xs text-muted-foreground">
                            {t('statusUpdated')}:{' '}
                            {formatRecordTime(node.updateAt)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {osLabel(node)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {cpuLabel(node)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {memoryLabel(node)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {node.reqCount ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="compilers">
        <TabsList>
          <TabsTrigger value="compilers">{t('statusCompilers')}</TabsTrigger>
          <TabsTrigger value="commands">{t('statusCommands')}</TabsTrigger>
        </TabsList>
        <TabsContent value="compilers" className="pt-2">
          <Card className="min-w-0">
            <CardContent className="space-y-4 pt-0">
              {compilers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('statusNoCompilers')}
                </p>
              ) : (
                compilers.map((entry) => (
                  <div key={entry.message} className="min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Cpu className="size-3.5" aria-hidden="true" />
                      {entry.key.join(', ')}
                    </p>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-2 font-mono text-xs">
                      <code data-llm-text={entry.message}>{entry.message}</code>
                    </pre>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="commands" className="pt-2">
          <Card className="min-w-0">
            <CardHeader className="border-b">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Terminal className="size-4" aria-hidden="true" />
                {t('statusCommands')}
              </h2>
            </CardHeader>
            <CardContent>
              {commands.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('statusNoCommands')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {commands.map(([language, command]) => (
                    <li key={language} className="min-w-0 space-y-1 text-sm">
                      <span className="font-medium">{language}</span>
                      <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-2 font-mono text-xs">
                        <code data-llm-text={command}>{command}</code>
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
