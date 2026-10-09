import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { db, closeDb } from "../../src/db";
import { leagues, players, members, seasons, links } from "../../src/db/schema";
import { token, hash } from "../../src/lib/security";
import { defaultRules } from "../../src/lib/domain";
async function fixture(){
 const access=token(),invite=token(),view=token();
 const [alice]=await db().insert(players).values({name:"Alice",accessHash:hash(access)}).returning();
 const [league]=await db().insert(leagues).values({name:"Browser Café",ownerId:alice.id,rules:defaultRules}).returning();
 await db().insert(seasons).values({leagueId:league.id,name:"Browser season"});
 const ids=[alice.id];await db().insert(members).values({leagueId:league.id,playerId:alice.id,role:"owner"});
 for(const name of ["Bob","Carol","Dan"]){const [p]=await db().insert(players).values({name,accessHash:hash(token())}).returning();ids.push(p.id);await db().insert(members).values({leagueId:league.id,playerId:p.id});}
 await db().insert(links).values([{leagueId:league.id,kind:"invite",tokenHash:hash(invite),expiresAt:new Date(Date.now()+86400000)},{leagueId:league.id,kind:"view",tokenHash:hash(view),expiresAt:new Date(Date.now()+86400000)}]);
 return {access,invite,view,leagueId:league.id,ids};
}
async function restore(page:Page,access:string){await page.goto(`/access#${access}`);await page.getByRole("button",{name:"Restore profile",exact:true}).click();await expect(page.getByRole("heading",{name:"Hey, Alice."})).toBeVisible();expect(new URL(page.url()).hash).toBe("");}
async function create(page:Page,f:Awaited<ReturnType<typeof fixture>>,teams=false){await page.goto(`/new?league=${f.leagueId}`);if(teams){await page.getByRole("button",{name:/2 vs 2/}).click();await page.getByLabel("Team A player 1",{exact:true}).selectOption(f.ids[0]);await page.getByLabel("Team A player 2",{exact:true}).selectOption(f.ids[1]);await page.getByLabel("Team B player 1",{exact:true}).selectOption(f.ids[2]);await page.getByLabel("Team B player 2",{exact:true}).selectOption(f.ids[3]);}else{await page.getByLabel("Player 1",{exact:true}).selectOption(f.ids[0]);await page.getByLabel("Player 2",{exact:true}).selectOption(f.ids[1]);}await page.getByRole("button",{name:"Create match",exact:true}).click();await page.getByRole("button",{name:"Start match",exact:true}).click();await expect(page.getByRole("heading",{name:"Round 1",exact:true})).toBeVisible();return new URL(page.url()).pathname+new URL(page.url()).search;}
async function round(page:Page,a:string,b:string){await page.getByLabel("Score for side 1",{exact:true}).fill(a);await page.getByLabel("Score for side 2",{exact:true}).fill(b);await page.getByRole("button",{name:"Save round",exact:true}).click();await expect(page.getByLabel("Score for side 1",{exact:true})).toHaveValue("");}
async function confirm(page:Page,action:string){await page.getByRole("button",{name:action,exact:true}).click();await page.getByRole("alertdialog").getByRole("button",{name:"Confirm",exact:true}).click();await expect(page.getByRole("alertdialog")).toHaveCount(0);}
test.afterAll(closeDb);
test("two devices retain the same profile, poll scores, and complete the exact team correction scenario",async({page,browser})=>{
 const f=await fixture();await restore(page,f.access);const cookies=await page.context().cookies();expect(cookies.some(c=>c.name==="domino"&&c.httpOnly&&c.sameSite==="Lax")).toBe(true);
 const matchPath=await create(page,f,true);const context2=await browser.newContext({viewport:{width:390,height:844}});const second=await context2.newPage();await restore(second,f.access);await second.goto(matchPath);
 await round(page,"20","10");await expect(second.locator(".big-scores strong")).toHaveText(["20","10"]);
 await round(page,"15","30");await expect(page.locator(".big-scores strong")).toHaveText(["35","40"]);await confirm(page,"Finish match");await expect(page.getByText("Match locked and counted",{exact:false})).toBeVisible();
 await second.reload();await expect(second.locator(".big-scores strong")).toHaveText(["35","40"]);
 await confirm(page,"Reopen for correction");await second.goto(`/standings?league=${f.leagueId}`);await expect(second.locator(".league-table tbody tr").filter({hasText:"Carol"}).locator(".points")).toHaveText("0");
 await page.locator(".round-history tbody tr").nth(1).getByRole("button",{name:"Correct"}).click();await page.getByLabel("Score for side 1",{exact:true}).fill("30");await page.getByLabel("Score for side 2",{exact:true}).fill("15");await page.getByRole("button",{name:"Save correction",exact:true}).click();await expect(page.locator(".big-scores strong")).toHaveText(["50","25"]);await confirm(page,"Finish match");await expect(second.locator(".league-table tbody tr").filter({hasText:"Alice"}).locator(".points")).toHaveText("3");await expect(second.locator(".league-table tbody tr").filter({hasText:"Carol"}).locator(".points")).toHaveText("0");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await context2.close();
});
test("mobile score drafts survive a failed save and reload, then retry safely",async({page})=>{
 const f=await fixture();await restore(page,f.access);await create(page,f);await page.getByLabel("Score for side 1",{exact:true}).fill("0");await page.getByLabel("Score for side 2",{exact:true}).fill("20");
 await page.route("**/api/match",route=>route.abort("failed"));await page.getByRole("button",{name:"Save round",exact:true}).click();await expect(page.getByRole("button",{name:"Retry save",exact:true})).toBeVisible();await expect(page.getByLabel("Score for side 1",{exact:true})).toHaveValue("0");await expect(page.locator(".big-scores strong")).toHaveText(["0","0"]);
 await page.reload();await expect(page.getByLabel("Score for side 2",{exact:true})).toHaveValue("20");await page.unroute("**/api/match");await page.getByRole("button",{name:"Retry save",exact:true}).click();await expect(page.locator(".big-scores strong")).toHaveText(["0","20"]);await expect(page.locator(".round-history tbody tr")).toHaveCount(1);
 expect(await page.getByLabel("Score for side 1",{exact:true}).getAttribute("inputmode")).toBe("numeric");
});
test("a lost success response is deduplicated, and conflicting drafts require review",async({page,browser})=>{
 const f=await fixture();await restore(page,f.access);const path=await create(page,f);const ctx=await browser.newContext();const other=await ctx.newPage();await restore(other,f.access);await other.goto(path);
 await page.getByLabel("Score for side 1",{exact:true}).fill("10");await page.getByLabel("Score for side 2",{exact:true}).fill("5");
 await page.route("**/api/match",async route=>{await route.fetch();await route.abort("failed");});await page.getByRole("button",{name:"Save round",exact:true}).click();await expect(page.getByRole("button",{name:"Retry save",exact:true})).toBeVisible();await expect(other.locator(".big-scores strong")).toHaveText(["10","5"]);await page.unroute("**/api/match");await page.getByRole("button",{name:"Retry save",exact:true}).click();await expect(page.getByLabel("Score for side 1",{exact:true})).toHaveValue("");await expect(page.locator(".round-history tbody tr")).toHaveCount(1);
 await page.getByLabel("Score for side 1",{exact:true}).fill("2");await page.getByLabel("Score for side 2",{exact:true}).fill("1");await round(other,"3","0");await expect(page.getByRole("button",{name:"I reviewed the latest scores",exact:true})).toBeVisible();await expect(page.getByLabel("Score for side 1",{exact:true})).toHaveValue("2");await page.getByRole("button",{name:"I reviewed the latest scores",exact:true}).click();await page.getByRole("button",{name:"Save round",exact:true}).click();await expect(page.locator(".big-scores strong")).toHaveText(["15","6"]);await ctx.close();
});
test("joining preserves Unicode profiles, and spectator links have no edit controls",async({page,browser})=>{
 const f=await fixture();await page.goto(`/join#${f.invite}`);await page.getByLabel("Your display name",{exact:true}).fill("ليلى");await page.getByRole("button",{name:"Join the league",exact:true}).click();await expect(page.getByLabel("Your private profile link",{exact:true})).toBeVisible();const access=await page.getByLabel("Your private profile link",{exact:true}).inputValue();await page.getByRole("button",{name:/I’ve saved my links/}).click();await expect(page.getByRole("heading",{name:"Hey, ليلى."})).toBeVisible();await page.reload();await expect(page.getByRole("heading",{name:"Hey, ليلى."})).toBeVisible();
 const ctx=await browser.newContext();const second=await ctx.newPage();await second.goto(new URL(access).pathname+new URL(access).hash);await second.getByRole("button",{name:"Restore profile",exact:true}).click();await expect(second.getByRole("heading",{name:"Hey, ليلى."})).toBeVisible();await ctx.close();
 const spectator=await browser.newContext();const viewer=await spectator.newPage();await viewer.goto(`/view#${f.view}`);await viewer.getByRole("button",{name:"View scores",exact:true}).click();await expect(viewer.getByText("Read-only league view",{exact:false})).toBeVisible();await expect(viewer.getByRole("link",{name:"New match",exact:true})).toHaveCount(0);await spectator.close();
});

test("every player can upload a personal photo that survives reload and displays in standings",async({page})=>{
 const f=await fixture();await restore(page,f.access);await page.goto(`/players/${f.ids[0]}?league=${f.leagueId}`);
 const sharp=(await import("sharp")).default;const buffer=await sharp({create:{width:32,height:32,channels:3,background:"#9a7951"}}).png().toBuffer();
 await page.getByLabel("Choose a personal photo",{exact:true}).setInputFiles({name:"portrait.png",mimeType:"image/png",buffer});await page.getByRole("button",{name:"Save profile photo",exact:true}).click();await expect(page.locator(".profile-heading .profile-photo")).toBeVisible();await page.reload();await expect(page.locator(".profile-heading .profile-photo")).toBeVisible();await expect(page.locator(".profile-heading .profile-photo")).toHaveJSProperty("naturalWidth",512);await page.goto(`/standings?league=${f.leagueId}`);await expect(page.locator(".league-table tbody tr").filter({hasText:"Alice"}).locator(".profile-photo")).toBeVisible();
});

test("the dashboard and live score entry have accessible labels and contrast",async({page})=>{
 const f=await fixture();await restore(page,f.access);
 let audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,issue:n.failureSummary}))}))).toEqual([]);
 await create(page,f);audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,issue:n.failureSummary}))}))).toEqual([]);
 await round(page,"10","0");await confirm(page,"Finish match");
 audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,issue:n.failureSummary}))}))).toEqual([]);
 await confirm(page,"Void match");
 audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,issue:n.failureSummary}))}))).toEqual([]);
 await page.setViewportSize({width:1440,height:900});await page.goto(`/?league=${f.leagueId}`);await expect(page.getByRole("heading",{name:"Hey, Alice."})).toBeVisible();
 audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,issue:n.failureSummary}))}))).toEqual([]);

});
