import type { Stats } from "@/app/page";

export type Level = {
  id: number;
  name: string;
  requirements: Partial<Stats>;
  completed: boolean;
};

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Meadow Start",
    requirements: { Health: 1 },
    completed: false,
  },
  {
    id: 2,
    name: "Thinking Grove",
    requirements: { Intellect: 2 },
    completed: false,
  },
  {
    id: 3,
    name: "Creative Bend",
    requirements: { Creativity: 2 },
    completed: false,
  },
  {
    id: 4,
    name: "Agile Crossing",
    requirements: { Agility: 2 },
    completed: false,
  },
  {
    id: 5,
    name: "Focused Path",
    requirements: { Accuracy: 2 },
    completed: false,
  },

  // --- Animal unlock after this ---
  {
    id: 6,
    name: "Balanced Clearing",
    requirements: {
      Health: 2,
      Intellect: 2,
    },
    completed: false,
  },
];
