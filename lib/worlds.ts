import { Stats } from "@/app/page";

export type Biome = {
  id: number;
  name: string;
  theme: "forest" | "desert" | "ice" | "void";
  background: string;
  levels: {
    id: number;
    name: string;
    requirements: Partial<Stats>;
  }[];
};

export const WORLD: Biome[] = [
  {
    id: 1,
    name: "Emerald Grove",
    theme: "forest",
    background: "/maps/forest.png",
    levels: [
      { id: 1, name: "Sprout Trial", requirements: { Health: 1 } },
      { id: 2, name: "Wind Path", requirements: { Agility: 1 } },
      { id: 3, name: "Stone Push", requirements: { Strength: 1 } },
      { id: 4, name: "Mind Root", requirements: { Intellect: 1 } },
      { id: 5, name: "Ink Bloom", requirements: { Creativity: 1 } },
      { id: 6, name: "True Aim", requirements: { Accuracy: 1 } },
      { id: 7, name: "Heart of Grove", requirements: { Health: 2 } },
    ],
  },

  {
    id: 2,
    name: "Suncrack Expanse",
    theme: "desert",
    background: "/maps/desert.png",
    levels: [
      { id: 8, name: "Heat March", requirements: { Health: 3 } },
      { id: 9, name: "Dune Sprint", requirements: { Agility: 3 } },
      { id: 10, name: "Sandlift", requirements: { Strength: 3 } },
      { id: 11, name: "Mirage Logic", requirements: { Intellect: 3 } },
      { id: 12, name: "Sun Script", requirements: { Creativity: 3 } },
      { id: 13, name: "Scorpion Eye", requirements: { Accuracy: 3 } },
      { id: 14, name: "Desert King", requirements: { Health: 4 } },
    ],
  },
];
