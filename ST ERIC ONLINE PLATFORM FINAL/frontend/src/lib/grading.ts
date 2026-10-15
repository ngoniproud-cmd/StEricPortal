// Mirror of backend/app/grading.py. Used ONLY for instant preview while typing;
// the API's grade is the source of truth.
export type Level = "O" | "A";
export const BANDS: Record<Level, [string, number, number][]> = {
  O: [["A",70,100],["B",60,69],["C",50,59],["D",40,49],["E",30,39],["U",0,29]],
  A: [["A",70,100],["B",60,69],["C",50,59],["D",45,49],["E",40,44],["O",26,39],["F",0,25]],
};
export const levelForForm = (form: number): Level => (form >= 5 ? "A" : "O");
export function gradeFor(obtained: number, max: number, level: Level): string {
  const whole = Math.floor((obtained / max) * 100 + 0.5);
  const match = BANDS[level].find(([, lo, hi]) => whole >= lo && whole <= hi);
  return match ? match[0] : (level === "A" ? "F" : "U");
}
