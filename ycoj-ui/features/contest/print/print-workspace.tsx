'use client';

import type { PrintAssetProvider } from './assets';
import type { CreatePrintCompiler, PrintSupport } from './compiler';
import type { PrintableContest, PrintProblemOverrides } from './model';
import PrintContestSettings from './print-contest-settings';
import { nextExtraSectionId } from './print-draft';
import PrintPreviewPanel from './print-preview-panel';
import PrintProblemList from './print-problem-list';
import type { PrintDraftActions } from './use-print-draft';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import { Button } from '@/shared/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { FileText, Plus, Settings2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Group,
  Panel,
  Separator as ResizeHandle,
} from 'react-resizable-panels';

type Props = {
  tid: string;
  data: ContestManagementResponse;
  document: PrintableContest;
  order: number[];
  problemOverrides: Record<number, PrintProblemOverrides>;
  isDirty: boolean;
  actions: PrintDraftActions;
  support: PrintSupport | null;
  assetProvider: PrintAssetProvider;
  createCompiler?: CreatePrintCompiler;
};

function panelValueForProblem(problemId: number) {
  return `problem-${problemId}`;
}

function panelValueForExtra(sectionId: string) {
  return `extra-${sectionId}`;
}

function ResizeSeparator() {
  return (
    <ResizeHandle className="group relative flex w-1.5 items-center justify-center bg-border outline-none focus-visible:bg-primary">
      <span className="h-8 w-0.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
    </ResizeHandle>
  );
}

export default function PrintWorkspace({
  tid,
  data,
  document,
  order,
  problemOverrides,
  isDirty,
  actions,
  support,
  assetProvider,
  createCompiler,
}: Props) {
  const t = useTranslations('contestPrint');
  const isMobile = useIsMobile();
  const [panel, setPanel] = useState('basic');

  const panelExists =
    panel === 'basic' ||
    panel === 'notice' ||
    document.problems.some(
      (problem) => panel === panelValueForProblem(problem.problemId)
    ) ||
    document.extraSections.some(
      (section) => panel === panelValueForExtra(section.id)
    );
  const activePanel = panelExists ? panel : 'basic';

  const addExtraSection = () => {
    const id = nextExtraSectionId(document.extraSections);
    actions.updateContest({
      extraSections: [...document.extraSections, { id, markdown: '' }],
    });
    setPanel(panelValueForExtra(id));
  };

  const removeExtraSection = (sectionId: string) => {
    actions.updateContest({
      extraSections: document.extraSections.filter(
        (section) => section.id !== sectionId
      ),
    });
    setPanel('basic');
  };

  const editor = (
    <Tabs
      value={activePanel}
      onValueChange={setPanel}
      className="h-full min-h-0 gap-0 overflow-hidden border bg-background"
    >
      <div className="flex items-center gap-1 border-b bg-card px-1 py-1">
        <TabsList
          variant="line"
          className="h-9 min-w-0 flex-1 justify-start overflow-x-auto"
          aria-label={t('editorPanels')}
        >
          <TabsTrigger value="basic">
            <Settings2 />
            {t('basicPanel')}
          </TabsTrigger>
          <TabsTrigger value="notice">
            <FileText />
            {t('noticePanel')}
          </TabsTrigger>
          {document.extraSections.map((section, index) => (
            <TabsTrigger
              key={section.id}
              value={panelValueForExtra(section.id)}
            >
              {t('extraSection', { index: index + 1 })}
            </TabsTrigger>
          ))}
          {document.problems.map((problem, index) => (
            <TabsTrigger
              key={problem.problemId}
              value={panelValueForProblem(problem.problemId)}
            >
              {problem.title} · T{index + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={addExtraSection}
          aria-label={t('addExtraSection')}
          title={t('addExtraSection')}
        >
          <Plus />
        </Button>
      </div>

      <TabsContent value="basic" className="min-h-0 overflow-auto p-3">
        <div className="space-y-4">
          <PrintContestSettings
            document={document}
            onPatch={actions.updateContest}
            onProblemPatch={actions.updateProblem}
          />
          <PrintProblemList
            data={data}
            document={document}
            order={order}
            problemOverrides={problemOverrides}
            isDirty={isDirty}
            actions={actions}
          />
        </div>
      </TabsContent>

      <TabsContent value="notice" className="min-h-0 p-0">
        <Textarea
          aria-label={t('fieldNotice')}
          className="size-full min-h-80 resize-none rounded-none border-0 p-4 font-mono text-sm shadow-none focus-visible:ring-0"
          value={document.notice}
          onChange={(event) =>
            actions.updateContest({ notice: event.target.value })
          }
        />
      </TabsContent>

      {document.extraSections.map((section, index) => (
        <TabsContent
          key={section.id}
          value={panelValueForExtra(section.id)}
          className="relative min-h-0 p-0"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 z-10"
            onClick={() => removeExtraSection(section.id)}
            aria-label={t('removeExtraSection', { index: index + 1 })}
          >
            <Trash2 />
          </Button>
          <Textarea
            aria-label={t('extraSection', { index: index + 1 })}
            className="size-full min-h-80 resize-none rounded-none border-0 p-4 pr-12 font-mono text-sm shadow-none focus-visible:ring-0"
            value={section.markdown}
            onChange={(event) =>
              actions.updateContest({
                extraSections: document.extraSections.map((candidate) =>
                  candidate.id === section.id
                    ? { ...candidate, markdown: event.target.value }
                    : candidate
                ),
              })
            }
          />
        </TabsContent>
      ))}

      {document.problems.map((problem) => (
        <TabsContent
          key={problem.problemId}
          value={panelValueForProblem(problem.problemId)}
          className="min-h-0 p-0"
        >
          <Textarea
            aria-label={t('statementFor', { title: problem.title })}
            className="size-full min-h-80 resize-none rounded-none border-0 p-4 font-mono text-sm shadow-none focus-visible:ring-0"
            value={problem.statement}
            onChange={(event) =>
              actions.updateProblem(problem.problemId, {
                statement: event.target.value,
              })
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );

  const preview = (
    <PrintPreviewPanel
      tid={tid}
      document={document}
      support={support}
      assetProvider={assetProvider}
      createCompiler={createCompiler}
    />
  );

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="min-h-[36rem]">{editor}</div>
        <div className="h-[70vh] min-h-[32rem]">{preview}</div>
      </div>
    );
  }

  return (
    <div className="h-[clamp(42rem,82vh,72rem)] min-h-0 overflow-hidden rounded-md border">
      <Group orientation="horizontal" className="h-full">
        <Panel id="contest-print-editor" defaultSize="50" minSize={250}>
          <div className="h-full min-w-0">{editor}</div>
        </Panel>
        <ResizeSeparator />
        <Panel
          id="contest-print-preview"
          defaultSize="50"
          minSize={250}
          collapsible
        >
          <div className="h-full min-w-0">{preview}</div>
        </Panel>
      </Group>
    </div>
  );
}
