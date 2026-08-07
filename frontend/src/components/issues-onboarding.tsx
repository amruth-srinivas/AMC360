import {
  Bookmark,
  Bug,
  CalendarDays,
  CheckSquare,
  Columns3,
  HelpCircle,
  LayoutList,
  ListOrdered,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { EVENTS, Joyride, STATUS, type EventData, type Step } from "react-joyride";

import { Button } from "./ui/button";
import { api } from "../lib/api";
import { useAuth, type CurrentUser } from "../store/auth";
import { cn } from "../lib/utils";

export type IssueTypeDemo = "epic" | "story" | "task" | "bug";
export type IssuePriorityDemo = "P0" | "P1" | "P2" | "P3";

export type IssuesTourApi = {
  goBacklog: () => void;
  openCreateEpic: () => void | Promise<void>;
  openCreateStory: () => void | Promise<void>;
  closeCreate: () => void;
  selectType?: (type: IssueTypeDemo) => Promise<void>;
  typeTitle?: (text: string) => Promise<void>;
  typeDescription?: (text: string) => Promise<void>;
  setEpicColor?: (color: string) => Promise<void>;
  setPriority?: (priority: IssuePriorityDemo) => Promise<void>;
  setAssigneeIndex?: (index: number) => Promise<void>;
  setLabels?: (labels: string[]) => Promise<void>;
  setStartDate?: (iso: string) => Promise<void>;
  setDueDate?: (iso: string) => Promise<void>;
  setStoryPoints?: (value: string) => Promise<void>;
  simulateCreate?: () => Promise<void>;
  isCreateReady?: () => boolean;
};

export type CreateIssueTourDemo = {
  selectType: (type: IssueTypeDemo) => Promise<void>;
  typeTitle: (text: string) => Promise<void>;
  typeDescription: (text: string) => Promise<void>;
  setEpicColor: (color: string) => Promise<void>;
  setPriority: (priority: IssuePriorityDemo) => Promise<void>;
  setAssigneeIndex: (index: number) => Promise<void>;
  setLabels: (labels: string[]) => Promise<void>;
  setStartDate: (iso: string) => Promise<void>;
  setDueDate: (iso: string) => Promise<void>;
  setStoryPoints: (value: string) => Promise<void>;
  simulateCreate: () => Promise<void>;
};

function waitForSelector(selector: string, timeoutMs = 5000): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        window.clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 40);
  });
}

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function waitUntil(pred: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (pred()) return true;
    await sleep(40);
  }
  return pred();
}

async function pulse(selector: string, ms = 420) {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  el.classList.add("tour-demo-click");
  await sleep(ms);
  el.classList.remove("tour-demo-click");
}

/** Type text into a controlled React field one character at a time. */
export async function typeTextLive(
  write: (value: string) => void,
  text: string,
  opts?: { clearFirst?: boolean; baseMs?: number },
) {
  const clearFirst = opts?.clearFirst ?? true;
  const baseMs = opts?.baseMs ?? 34;
  if (clearFirst) {
    write("");
    await sleep(100);
  }
  for (let i = 0; i < text.length; i++) {
    write(text.slice(0, i + 1));
    const ch = text[i];
    const pause = baseMs + Math.random() * 36 + (ch === " " ? 70 : 0) + (ch === "-" ? 36 : 0);
    await sleep(pause);
  }
  await sleep(160);
}

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const JOYRIDE_OPTIONS = {
  primaryColor: "#3758F9",
  backgroundColor: "#ffffff",
  textColor: "#111827",
  arrowColor: "#ffffff",
  overlayColor: "rgba(23, 37, 84, 0.55)",
  skipBeacon: true,
  showProgress: true,
  buttons: ["back", "skip", "primary"] as ("back" | "skip" | "primary")[],
  spotlightPadding: 8,
  spotlightRadius: 10,
  overlayClickAction: false as const,
  closeButtonAction: "skip" as const,
  targetWaitTimeout: 4000,
  beforeTimeout: 20000,
  loaderDelay: 500,
  zIndex: 12000,
  disableFocusTrap: true,
  blockTargetInteraction: false,
};

const JOYRIDE_STYLES = {
  tooltip: {
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 12px 40px rgba(55, 88, 249, 0.18)",
    zIndex: 12001,
  },
  tooltipTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
  },
  tooltipContent: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#4b5563",
    padding: "8px 0 4px",
  },
  tooltipFooter: {
    marginTop: 12,
  },
  buttonPrimary: {
    backgroundColor: "#3758F9",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
  },
  buttonBack: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 500,
  },
  buttonSkip: {
    color: "#9ca3af",
    fontSize: 13,
  },
  spotlight: {
    stroke: "#3758F9",
    strokeWidth: 2,
  },
  overlay: {
    mixBlendMode: "normal" as const,
  },
};

const GLOSSARY: {
  icon: ReactNode;
  title: string;
  body: string;
  borderClass: string;
  bgClass: string;
}[] = [
  {
    icon: <Zap className="h-4 w-4 text-violet-600" />,
    title: "Epic",
    body: 'A big chunk of work or feature area. Doesn\'t get "done" by itself — it\'s done when all its Stories/Tasks are done. Example: "Auto-Ballooning Module".',
    borderClass: "border-violet-200",
    bgClass: "bg-violet-50/60",
  },
  {
    icon: <Bookmark className="h-4 w-4 text-emerald-600" />,
    title: "Story",
    body: 'A specific piece of user-facing functionality within an Epic. Example: "Upload drawing and detect features".',
    borderClass: "border-emerald-200",
    bgClass: "bg-emerald-50/60",
  },
  {
    icon: <CheckSquare className="h-4 w-4 text-sky-600" />,
    title: "Task",
    body: 'A concrete unit of work, often technical, within a Story or standalone. Example: "Write PDF parsing function".',
    borderClass: "border-sky-200",
    bgClass: "bg-sky-50/60",
  },
  {
    icon: <Bug className="h-4 w-4 text-rose-600" />,
    title: "Bug",
    body: "Something broken that needs fixing.",
    borderClass: "border-rose-200",
    bgClass: "bg-rose-50/60",
  },
  {
    icon: <LayoutList className="h-4 w-4 text-gray-600" />,
    title: "Backlog",
    body: "Everything not yet scheduled into a sprint. This is your to-do pile.",
    borderClass: "border-gray-200",
    bgClass: "bg-gray-50",
  },
  {
    icon: <ListOrdered className="h-4 w-4 text-indigo-600" />,
    title: "Sprint",
    body: "A time-boxed chunk of work (e.g. 2 weeks) you commit to. Drag issues from Backlog into a Sprint when you're ready to work on them.",
    borderClass: "border-indigo-200",
    bgClass: "bg-indigo-50/50",
  },
  {
    icon: <Columns3 className="h-4 w-4 text-primary" />,
    title: "Board",
    body: "Once a sprint is started, this shows its issues as cards you drag across To Do → In Progress → In Review → Done.",
    borderClass: "border-primary/20",
    bgClass: "bg-primary/5",
  },
  {
    icon: <CalendarDays className="h-4 w-4 text-violet-600" />,
    title: "Timeline",
    body: "A calendar view showing when Epics/Stories are scheduled, useful for planning ahead.",
    borderClass: "border-violet-200",
    bgClass: "bg-violet-50/40",
  },
];

const SETUP_STEPS = [
  "Create an Epic for each major feature or workstream.",
  "Break each Epic into Stories or Tasks — these are the actual work items people pick up.",
  "Leave new items in Backlog until you're ready to schedule them.",
  'Drag items into a Sprint, then click "Start sprint" when the team begins working on it.',
  "Use the Board to track daily progress; use Timeline to see the bigger picture.",
];

export function IssuesHelpSheet({
  open,
  onClose,
  onReplayTour,
}: {
  open: boolean;
  onClose: () => void;
  onReplayTour: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close help"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-none flex-col border-l border-gray-200 bg-white shadow-2xl sm:w-1/2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issues-help-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HelpCircle className="h-5 w-5" />
            </span>
            <h2 id="issues-help-title" className="text-base font-semibold text-gray-900">
              How Issues work
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Concepts
            </h3>
            <div className="space-y-2.5">
              {GLOSSARY.map((item) => (
                <div
                  key={item.title}
                  className={cn("rounded-xl border px-3.5 py-3", item.borderClass, item.bgClass)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {item.icon}
                    <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-gray-600">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              How to set this up
            </h3>
            <ol className="space-y-2.5">
              {SETUP_STEPS.map((text, index) => (
                <li key={text} className="flex gap-3 text-[13px] leading-relaxed text-gray-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              onClose();
              onReplayTour();
            }}
          >
            Replay walkthrough
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function IssuesHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="How Issues work"
      aria-label="How Issues work"
      data-tour="issues-help-button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}

function buildSteps(apiRef: MutableRefObject<IssuesTourApi | null>): Step[] {
  const api = () => apiRef.current;

  const ensureBacklog = async () => {
    api()?.goBacklog();
    await sleep(80);
  };

  const ensureEpicForm = async () => {
    await ensureBacklog();
    if (!document.querySelector('[data-tour-dialog="create-issue"]')) {
      await Promise.resolve(api()?.openCreateEpic());
    }
    await waitUntil(() => Boolean(api()?.isCreateReady?.()), 5000);
    await waitForSelector('[data-tour="issues-create-type"]', 5000);
  };

  const fieldStep = (
    partial: Step & { id: string; target: string },
  ): Step => ({
    placement: "left",
    disableFocusTrap: true,
    before: async () => {
      await ensureEpicForm();
      await sleep(60);
    },
    ...partial,
  });

  return [
    {
      target: "body",
      placement: "center",
      title: "Welcome to Issues",
      content:
        "We'll fill out Create issue field-by-field with example data, then simulate saving it. Takes about a minute.",
      disableFocusTrap: true,
    },
    {
      target: '[data-tour="issues-view-backlog"]',
      title: "Backlog",
      content: "This is where all unscheduled work lives.",
      placement: "bottom",
      disableFocusTrap: true,
      before: async () => {
        await ensureBacklog();
        api()?.closeCreate();
        await sleep(60);
      },
    },
    {
      target: '[data-tour="issues-epics-create"]',
      title: "Open Create",
      content: 'Click "Create epic…" anytime to start a new feature area.',
      placement: "top",
      disableFocusTrap: true,
      before: async () => {
        await ensureBacklog();
        api()?.closeCreate();
        await sleep(80);
        await waitForSelector('[data-tour="issues-epics-create"]');
      },
    },
    fieldStep({
      id: "field-type",
      target: '[data-tour="issues-create-type"]',
      title: "Type",
      content:
        "Pick Epic / Story / Task / Bug. Example: we'll choose Epic for a major workstream.",
      before: async () => {
        await ensureBacklog();
        await Promise.resolve(api()?.openCreateEpic());
        await waitUntil(() => Boolean(api()?.isCreateReady?.()), 5000);
        await waitForSelector('[data-tour="issues-create-type"]', 5000);
      },
    }),
    fieldStep({
      id: "field-title",
      target: '[data-tour="issues-create-title"]',
      title: "Title",
      content: 'Example title: "Auto-Ballooning Module" — short and specific.',
    }),
    fieldStep({
      id: "field-color",
      target: '[data-tour="issues-create-color"]',
      title: "Epic color",
      content: "Pick a color so this Epic is easy to spot on the board and backlog.",
    }),
    fieldStep({
      id: "field-assignee",
      target: '[data-tour="issues-create-assignee"]',
      title: "Assignee",
      content: "Who owns this work? Leave Unassigned or pick a teammate (example).",
    }),
    fieldStep({
      id: "field-priority",
      target: '[data-tour="issues-create-priority"]',
      title: "Priority",
      content: "P0 is critical; P3 is later. Example: set P1 for important work.",
    }),
    fieldStep({
      id: "field-labels",
      target: '[data-tour="issues-create-labels"]',
      title: "Labels",
      content: "Tags for filtering — e.g. product, roadmap. Example labels go on next.",
    }),
    fieldStep({
      id: "field-start",
      target: '[data-tour="issues-create-start"]',
      title: "Start date",
      content: "Optional planning start. Example: today.",
    }),
    fieldStep({
      id: "field-due",
      target: '[data-tour="issues-create-due"]',
      title: "Due date",
      content: "Optional target finish. Example: two weeks from today.",
    }),
    fieldStep({
      id: "field-description",
      target: '[data-tour="issues-create-description"]',
      title: "Description",
      content: "Extra context for the team. Watch a short example get typed in.",
    }),
    fieldStep({
      id: "field-create",
      target: '[data-tour="issues-create-submit"]',
      title: "Create",
      content:
        "When every required field looks good, hit Create. We'll simulate saving this Epic now.",
    }),
    {
      target: '[data-tour="issues-sprint-section"]',
      title: "Sprints",
      content:
        "Drag issues here when you're ready to work on them, or create issues directly inside a sprint.",
      placement: "top",
      disableFocusTrap: true,
      before: async () => {
        await ensureBacklog();
        api()?.closeCreate();
        await sleep(120);
        const el = await waitForSelector('[data-tour="issues-sprint-section"]', 2500);
        if (!el) await waitForSelector('[data-tour="issues-new-sprint"]');
      },
    },
    {
      target: () =>
        (document.querySelector('[data-tour="issues-start-sprint"]') as HTMLElement) ||
        (document.querySelector('[data-tour="issues-new-sprint"]') as HTMLElement) ||
        (document.querySelector('[data-tour="issues-sprint-section"]') as HTMLElement),
      title: "Start a sprint",
      content:
        "Once a sprint has issues and dates, start it to track work on the Board.",
      placement: "left",
      disableFocusTrap: true,
      before: async () => {
        await ensureBacklog();
        api()?.closeCreate();
        await sleep(80);
      },
    },
    {
      target: '[data-tour="issues-view-board"]',
      title: "Board",
      content:
        "After a sprint starts, drag cards across To Do → In Progress → In Review → Done.",
      placement: "bottom",
      disableFocusTrap: true,
      before: async () => {
        api()?.closeCreate();
      },
    },
    {
      target: "body",
      placement: "center",
      title: "You're ready",
      content:
        "You just walked through every create field. Use Help (?) anytime for definitions or to replay.",
      disableFocusTrap: true,
      locale: { last: "Done" },
    },
  ];
}

export function IssuesWalkthrough({
  run,
  onRunChange,
  tourApiRef,
}: {
  run: boolean;
  onRunChange: (run: boolean) => void;
  tourApiRef: MutableRefObject<IssuesTourApi | null>;
}) {
  const { user, setUser } = useAuth();
  const [ready, setReady] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  const demoDoneRef = useRef(new Set<string>());
  const demoRunningRef = useRef(false);

  useEffect(() => {
    if (!run) {
      setReady(false);
      demoDoneRef.current.clear();
      demoRunningRef.current = false;
      return;
    }
    setTourKey((k) => k + 1);
    demoDoneRef.current.clear();
    demoRunningRef.current = false;
    const t = window.setTimeout(() => setReady(true), 180);
    return () => window.clearTimeout(t);
  }, [run]);

  const markSeen = useCallback(async () => {
    if (!user || user.has_seen_issues_tour) return;
    try {
      const updated = await api.post<CurrentUser>("/auth/me/issues-tour-seen");
      setUser({ ...user, ...updated, has_seen_issues_tour: true });
    } catch {
      /* non-blocking */
    }
  }, [setUser, user]);

  const endTour = useCallback(() => {
    onRunChange(false);
    tourApiRef.current?.closeCreate();
    void markSeen();
  }, [markSeen, onRunChange, tourApiRef]);

  const steps = useMemo(() => buildSteps(tourApiRef), [tourApiRef]);

  const runLiveDemo = useCallback(
    async (stepId: string | undefined) => {
      if (!stepId || demoDoneRef.current.has(stepId) || demoRunningRef.current) return;
      const a = tourApiRef.current;
      if (!a?.isCreateReady?.()) return;

      demoDoneRef.current.add(stepId);
      demoRunningRef.current = true;
      try {
        switch (stepId) {
          case "field-type": {
            await a.selectType?.("story");
            await sleep(280);
            await a.selectType?.("task");
            await sleep(280);
            await a.selectType?.("bug");
            await sleep(280);
            await a.selectType?.("epic");
            break;
          }
          case "field-title": {
            await a.selectType?.("epic");
            await a.typeTitle?.("Auto-Ballooning Module");
            break;
          }
          case "field-color": {
            await a.setEpicColor?.("#8B5CF6");
            await pulse('[data-tour="issues-create-color"]');
            break;
          }
          case "field-assignee": {
            await a.setAssigneeIndex?.(0);
            await pulse('[data-tour="issues-create-assignee"]');
            break;
          }
          case "field-priority": {
            await a.setPriority?.("P1");
            await pulse('[data-tour="issues-create-priority"]');
            break;
          }
          case "field-labels": {
            await a.setLabels?.(["product", "roadmap"]);
            await pulse('[data-tour="issues-create-labels"]');
            break;
          }
          case "field-start": {
            await a.setStartDate?.(isoDaysFromNow(0));
            await pulse('[data-tour="issues-create-start"]');
            break;
          }
          case "field-due": {
            await a.setDueDate?.(isoDaysFromNow(14));
            await pulse('[data-tour="issues-create-due"]');
            break;
          }
          case "field-description": {
            await a.typeDescription?.(
              "End-to-end feature for automatic ballooning of drawing annotations.",
            );
            break;
          }
          case "field-create": {
            await pulse('[data-tour="issues-create-submit"]', 500);
            await a.simulateCreate?.();
            break;
          }
          default:
            break;
        }
      } finally {
        demoRunningRef.current = false;
      }
    },
    [tourApiRef],
  );

  const handleEvent = useCallback(
    (data: EventData) => {
      if (data.type === EVENTS.TOOLTIP) {
        void runLiveDemo(data.step?.id);
      }
      if (data.type === EVENTS.TOUR_END) {
        endTour();
        return;
      }
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        endTour();
      }
    },
    [endTour, runLiveDemo],
  );

  if (!run || !ready) return null;

  return (
    <Joyride
      key={tourKey}
      run
      continuous
      scrollToFirstStep
      steps={steps}
      onEvent={handleEvent}
      options={JOYRIDE_OPTIONS}
      styles={JOYRIDE_STYLES}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        nextWithProgress: "Next ({current} of {total})",
        skip: "Skip tour",
      }}
    />
  );
}
