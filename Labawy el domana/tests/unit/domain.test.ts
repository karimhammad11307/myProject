import { describe, expect, it } from "vitest";
import { defaultRules, rulesSchema, scoreSchema, roundSchema, validateLineup, totalsFor, outcomes, autoFinish, canFinish, standings, type Rules } from "../../src/lib/domain";
const players=["Alice","Bob","Carol","Dan"].map((name,i)=>({id:String(i),name,avatar:"olive",archived:false}));
describe("lineups and score inputs",()=>{
 it.each([["singles",[["a"],["b"]]],["teams",[["a","b"],["c","d"]]],["ffa3",[["a"],["b"],["c"]]],["ffa4",[["a"],["b"],["c"],["d"]]]] as const)("accepts %s",(format,lineup)=>expect(()=>validateLineup(format,lineup.map(s=>[...s]))).not.toThrow());
 it.each([[[["a"],["a"]]],[[["a"],[]]],[[["a","b"],["c"]]]])("rejects invalid lineup %j",lineup=>expect(()=>validateLineup("singles",lineup)).toThrow());
 it("requires explicit zero for every side",()=>{expect(roundSchema.parse({scores:[0,0]}).scores).toEqual([0,0]);expect(()=>roundSchema.parse({scores:[0]})).toThrow();expect(()=>roundSchema.parse({})).toThrow();});
 it.each([-1,1.5,NaN,Infinity,-Infinity,1000001,"0",null,undefined])("rejects score %s",n=>expect(()=>scoreSchema.parse(n)).toThrow());
 it("rejects target completion with lowest scores",()=>expect(()=>rulesSchema.parse({...defaultRules,direction:"lowest",completion:"target"})).toThrow());
});
describe("completion and outcomes",()=>{
 it("saves all sides before evaluating the target",()=>{const r={...defaultRules,completion:"target",limit:30} as Rules;expect(autoFinish([35,40],2,r)).toBe(true);expect(outcomes([35,40],r)).toEqual(["loss","win"]);});
 it("highest and lowest reverse outcomes",()=>{expect(outcomes([35,40],defaultRules)).toEqual(["loss","win"]);expect(outcomes([35,40],{...defaultRules,direction:"lowest"})).toEqual(["win","loss"]);});
 it("manual completion requires one round and never auto-finishes",()=>{expect(canFinish([0,0],0,defaultRules)).toBe(false);expect(canFinish([0,0],1,defaultRules)).toBe(true);expect(autoFinish([1000,0],1,defaultRules)).toBe(false);});
 it("fixed-round ties require extra rounds when configured",()=>{const r={...defaultRules,completion:"rounds",limit:2,ties:"extra"} as Rules;expect(autoFinish([20,20],2,r)).toBe(false);expect(autoFinish([21,20],3,r)).toBe(true);});
 it("target ties draw or continue under the tie policy",()=>{const r={...defaultRules,completion:"target",limit:10} as Rules;expect(autoFinish([10,10],1,r)).toBe(true);expect(outcomes([10,10],r)).toEqual(["draw","draw"]);expect(autoFinish([10,10],1,{...r,ties:"extra"})).toBe(false);});
 it("free-for-all tied leaders draw, remaining players lose",()=>expect(outcomes([20,20,10,0],defaultRules)).toEqual(["draw","draw","loss","loss"]));
 it("voided rounds do not add to totals",()=>expect(totalsFor(2,[{scores:[20,10],voided:false},{scores:[15,30],voided:true}])).toEqual([20,10]));
});
describe("standings source of truth",()=>{
 const m={state:"completed",format:"teams" as const,rules:defaultRules,sides:[{players:["0","1"]},{players:["2","3"]}],rounds:[{scores:[20,10],voided:false},{scores:[15,30],voided:false}]};
 it("matches the team acceptance scenario",()=>{expect(totalsFor(2,m.rounds)).toEqual([35,40]);const table=standings(players,[m]);expect(table.find(p=>p.id==="2")).toMatchObject({wins:1,points:3,appearances:1,teams:1});expect(table.find(p=>p.id==="0")).toMatchObject({losses:1,points:0,appearances:1});});
 it("reopening removes all contributions; correcting reverses exactly once",()=>{expect(standings(players,[{...m,state:"active"}]).every(p=>p.points===0&&p.appearances===0)).toBe(true);const updated={...m,rounds:[m.rounds[0],{scores:[30,15],voided:false}]};expect(totalsFor(2,updated.rounds)).toEqual([50,25]);expect(standings(players,[updated]).find(p=>p.id==="0")).toMatchObject({wins:1,points:3,appearances:1});expect(standings(players,[updated]).find(p=>p.id==="2")).toMatchObject({losses:1,points:0,appearances:1});});
 it("voided matches and zero appearances are sensible",()=>{const table=standings(players,[{...m,state:"voided"}]);expect(table.every(p=>p.points===0&&p.winPercentage===0&&p.rank===1)).toBe(true);});
 it("ranks equal players equally without domino-total tiebreakers",()=>{const table=standings(players,[m]);expect(table.find(p=>p.id==="2")!.rank).toBe(table.find(p=>p.id==="3")!.rank);expect(table.find(p=>p.id==="0")!.rank).toBe(table.find(p=>p.id==="1")!.rank);});
 it("uses each match’s league policy snapshot",()=>{const custom={...m,rules:{...defaultRules,points:{win:7,draw:2,loss:1}}};expect(standings(players,[custom]).find(p=>p.id==="2")!.points).toBe(7);});
});
