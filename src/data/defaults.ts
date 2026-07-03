import { AppState, Project, Label, Task, DEFAULT_SETTINGS } from "@/types";
import { newId } from "@/utils/id";
import { addDays, todayYMD } from "@/utils/dates";

interface SeedProject extends Omit<Project, "id" | "createdAt"> {}
interface SeedLabel extends Omit<Label, "id"> {}

interface SeedTask
  extends Partial<
    Omit<
      Task,
      "id" | "createdAt" | "completedAt" | "labelIds" | "subtasks" | "recurrence" | "order" | "parentRecurrenceId"
    >
  > {
  title: string;
  labels?: string[];
}

function makeProject(p: SeedProject): Project {
  return {
    id: newId("p"),
    createdAt: new Date().toISOString(),
    ...p,
  };
}

function makeLabel(l: SeedLabel): Label {
  return { id: newId("l"), ...l };
}

function makeTask(t: SeedTask & { labels?: string[] }, index: number): Task {
  return {
    id: newId("t"),
    title: t.title,
    description: t.description ?? "",
    completed: t.completed ?? false,
    completedAt: null,
    dueDate: t.dueDate ?? null,
    priority: t.priority ?? 4,
    projectId: t.projectId ?? null,
    labelIds: t.labels ?? [],
    subtasks: [],
    recurrence: null,
    parentRecurrenceId: null,
    order: 1000 * (10 - index),
    createdAt: new Date().toISOString(),
  };
}

export function makeInitialState(): AppState {
  const projects = [
    makeProject({ name: "Personal", color: "slate", order: 1000, archived: false }),
    makeProject({ name: "Work", color: "indigo", order: 2000, archived: false }),
    makeProject({ name: "Side projects", color: "violet", order: 3000, archived: false }),
  ];
  const [personal, work, side] = projects;

  const labels = [
    makeLabel({ name: "Urgent", color: "rose", order: 1000 }),
    makeLabel({ name: "Reading", color: "sky", order: 2000 }),
    makeLabel({ name: "Errand", color: "amber", order: 3000 }),
    makeLabel({ name: "Someday", color: "slate", order: 4000 }),
  ];
  const [urgent, reading, errand] = labels;
  const labelIds: Record<string, string> = {
    Urgent: urgent.id,
    Reading: reading.id,
    Errand: errand.id,
    Someday: labels[3].id,
  };

  const today = todayYMD();
  const tomorrow = addDays(today, 1);
  const inThreeDays = addDays(today, 3);
  const inAWeek = addDays(today, 7);
  const inTwoWeeks = addDays(today, 14);

  const seedTasks: Array<SeedTask & { labels?: string[] }> = [
    {
      title: "Welcome to Stride",
      description:
        "Try Ctrl+K to open the command palette, Ctrl+N to capture a quick task, drag rows to reorder. Delete me whenever you're ready.",
      dueDate: null,
      priority: 3,
      projectId: personal.id,
    },
    {
      title: "Pick your three priorities for the week",
      description: "What would make the next 7 days feel like progress?",
      dueDate: today,
      priority: 2,
      projectId: personal.id,
      labels: ["Urgent"],
    },
    {
      title: "Review Q3 OKRs",
      dueDate: tomorrow,
      priority: 2,
      projectId: work.id,
    },
    {
      title: "Draft proposal for the new initiative",
      dueDate: inThreeDays,
      priority: 3,
      projectId: work.id,
    },
    {
      title: "Pick up dry cleaning",
      dueDate: today,
      priority: 4,
      projectId: null,
      labels: ["Errand"],
    },
    {
      title: "Read: Designing Data-Intensive Applications (ch. 5)",
      dueDate: inAWeek,
      priority: 4,
      projectId: side.id,
      labels: ["Reading"],
    },
    {
      title: "Sketch onboarding flow",
      dueDate: inTwoWeeks,
      priority: 3,
      projectId: side.id,
    },
    {
      title: "Plan autumn trip",
      description: "Where, when, who's coming?",
      dueDate: null,
      priority: 4,
      projectId: personal.id,
      labels: ["Someday"],
    },
  ];

  const tasks: Task[] = seedTasks.map((t, i) => {
    const task = makeTask(t, i);
    if (t.labels) {
      task.labelIds = t.labels.map((n) => labelIds[n]).filter(Boolean);
    }
    return task;
  });

  return {
    projects,
    labels,
    tasks,
    view: { kind: "today" },
    theme: "dark",
    sidebarCollapsed: false,
    selectedTaskId: null,
    detailOpen: false,
    settings: { ...DEFAULT_SETTINGS },
    modal: null,
  };
}
