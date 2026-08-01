export type FanLevel = {
  key: "rookie" | "starter" | "veteran" | "captain" | "legend" | "hall-of-flame";
  label: string;
};

const LEVELS: Array<{ min: number; value: FanLevel }> = [
  { min: 0, value: { key: "rookie", label: "Rookie" } },
  { min: 100, value: { key: "starter", label: "Starter" } },
  { min: 300, value: { key: "veteran", label: "Veteran" } },
  { min: 700, value: { key: "captain", label: "Captain" } },
  { min: 1500, value: { key: "legend", label: "Legend" } },
  { min: 3000, value: { key: "hall-of-flame", label: "Hall of Flame" } },
];

export function getFanLevel(reputation: number): FanLevel {
  return [...LEVELS]
    .reverse()
    .find((level) => reputation >= level.min)?.value ?? LEVELS[0]!.value;
}
