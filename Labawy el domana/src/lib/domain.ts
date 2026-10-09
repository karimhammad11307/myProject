import { z } from "zod";

export const formats = ["singles", "teams", "ffa3", "ffa4"] as const;
export type Format = typeof formats[number];
export const formatNames: Record<Format, string> = {singles: "1 vs 1", teams: "2 vs 2", ffa3: "3-player free-for-all", ffa4: "4-player free-for-all"};
export const rulesSchema = z.object({
  direction: z.enum(["highest", "lowest"]),
  completion: z.enum(["manual", "rounds", "target"]),
  limit: z.number().int().min(1).max(1000000),
  ties: z.enum(["draw", "extra"]),
  points: z.object({win: z.number().int().min(0).max(1000), draw: z.number().int().min(0).max(1000), loss: z.number().int().min(0).max(1000)})
}).refine(r => r.completion !== "target" || r.direction === "highest", "Target completion requires highest-score-wins.");
export type Rules = z.infer<typeof rulesSchema>;
export const defaultRules: Rules = {direction: "highest", completion: "manual", limit: 10, ties: "draw", points: {win: 3, draw: 1, loss: 0}};
export const scoreSchema = z.number().int().min(0).max(1000000);
export const roundSchema = z.object({scores: z.array(scoreSchema).min(2).max(4), note: z.string().max(300).default("")});
export const nameSchema = z.string().trim().min(1).max(60).refine(n => !/[\u0000-\u001f\u007f]/.test(n), "Use a printable display name.");
export const avatars = ["olive", "coffee", "amber", "rose", "sky", "violet"] as const;
export const avatarSchema = z.enum(avatars);
export type Outcome = "win" | "draw" | "loss";
export type ScoringRound = {scores: number[]; voided: boolean};
export function validateLineup(format: Format, sides: string[][]) {
  const sizes = format === "teams" ? [2,2] : Array(format === "singles" ? 2 : format === "ffa3" ? 3 : 4).fill(1);
  if (sides.length !== sizes.length || sides.some((s,i) => s.length !== sizes[i])) throw new Error("Choose the exact number of players for this format.");
  const players = sides.flat();
  if (new Set(players).size !== players.length) throw new Error("A player can appear only once in a match.");
}
export function totalsFor(sides: number, rounds: ScoringRound[]) {
  const totals = Array<number>(sides).fill(0);
  for (const r of rounds.filter(r => !r.voided)) {
    if(r.scores.length !== sides) throw new Error("Every side needs a score, including zero.");
    r.scores.forEach((n,i) => {scoreSchema.parse(n); totals[i] += n;});
  }
  return totals;
}
export function leading(totals: number[], rules: Rules) {
  const best = rules.direction === "highest" ? Math.max(...totals) : Math.min(...totals);
  return totals.flatMap((n,i) => n === best ? [i] : []);
}
export function outcomes(totals: number[], rules: Rules): Outcome[] {
  const leaders = leading(totals, rules);
  return totals.map((_,i) => leaders.includes(i) ? leaders.length === 1 ? "win" : "draw" : "loss");
}
export function canFinish(totals: number[], rounds: number, rules: Rules) {
  return rounds > 0 && (rules.ties === "draw" || leading(totals,rules).length === 1);
}
export function autoFinish(totals: number[], rounds: number, rules: Rules) {
  const met = rules.completion === "rounds" ? rounds >= rules.limit : rules.completion === "target" ? Math.max(...totals) >= rules.limit : false;
  return met && canFinish(totals, rounds, rules);
}
export type Stats = {id: string; name: string; avatar: string; archived: boolean; appearances: number; wins: number; draws: number; losses: number; points: number; winPercentage: number; rank: number; singles: number; teams: number; freeForAll: number};
export type StandingMatch = {state: string; format: Format; rules: Rules; sides: {players: string[]}[]; rounds: ScoringRound[]};
export function standings(players: {id:string;name:string;avatar:string;archived:boolean}[], matches: StandingMatch[]): Stats[] {
  const rows = new Map(players.map(p => [p.id, {...p, appearances: 0, wins: 0, draws: 0, losses: 0, points: 0, winPercentage: 0, rank: 0, singles: 0, teams: 0, freeForAll: 0}]));
  for(const m of matches.filter(m => m.state === "completed")) {
    const result = outcomes(totalsFor(m.sides.length,m.rounds),m.rules);
    m.sides.forEach((s,i) => s.players.forEach(id => {
      const p = rows.get(id); if(!p) return;
      p.appearances++; p.points += m.rules.points[result[i]];
      if(result[i] === "win") p.wins++; else if(result[i] === "draw") p.draws++; else p.losses++;
      if(m.format === "teams") p.teams++; else if(m.format === "singles") p.singles++; else p.freeForAll++;
    }));
  }
  const list = [...rows.values()];
  list.forEach(p => p.winPercentage = p.appearances ? p.wins / p.appearances * 100 : 0);
  list.sort((a,b) => b.points-a.points || b.wins-a.wins || b.winPercentage-a.winPercentage || a.name.localeCompare(b.name));
  list.forEach((p,i) => p.rank = i && p.points === list[i-1].points && p.wins === list[i-1].wins && p.winPercentage === list[i-1].winPercentage ? list[i-1].rank : i+1);
  return list;
}
