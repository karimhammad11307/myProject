"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChartNoAxesColumnIncreasing, Coffee, History, LayoutDashboard, Plus, Settings, Users, Wifi, WifiOff } from "lucide-react";
import type { State } from "@/lib/types";
import { ApiError, post } from "./api";
import { Avatar, BrandName, Domino, Notice } from "./ui";
import { ClubContext } from "./context";
import { LinkScreen } from "./link-screen";
import { Dashboard, StandingsScreen, PlayersScreen, ProfileScreen, HistoryScreen } from "./screens";
import { NewMatch, Scorecard } from "./scorecard";
import { SettingsScreen } from "./settings";
const nav=[{path:"/",label:"Overview",icon:LayoutDashboard},{path:"/standings",label:"Standings",icon:ChartNoAxesColumnIncreasing},{path:"/players",label:"Players",icon:Users},{path:"/history",label:"History",icon:History}];
export function ClubApp() {
  const pathname=usePathname(),search=useSearchParams(),router=useRouter(),selected=search.get("league");
  const [data,setData]=useState<State|null>(null),[error,setError]=useState(""),[connected,setConnected]=useState(true),[updated,setUpdated]=useState(""),[toast,setToast]=useState<{message:string;kind:"success"|"error"}|null>(null);
  const request=useRef(0), mounted=useRef(true);
  const refresh=useCallback(async()=>{
    const seq=++request.current;
    try {
      const response=await fetch(`/api/state${selected?`?league=${encodeURIComponent(selected)}`:""}`,{cache:"no-store"});
      const next=await response.json();if(seq!==request.current || !mounted.current)return;
      if(!response.ok)throw new ApiError(response.status,next.error);
      setData(next);setConnected(true);setError("");setUpdated(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
    } catch(e) {if(seq!==request.current || !mounted.current)return;setConnected(false);setError(e instanceof Error?e.message:"Connection unavailable.");}
  },[selected]);
  useEffect(()=>{
    mounted.current=true;const initial=setTimeout(()=>void refresh(),0);
    const interval=setInterval(()=>{if(document.visibilityState==="visible")void refresh();},3000);
    const reconnect=()=>void refresh();
    window.addEventListener("focus",reconnect);window.addEventListener("online",reconnect);
    const offline=()=>setConnected(false);window.addEventListener("offline",offline);
    return ()=>{mounted.current=false;clearTimeout(initial);clearInterval(interval);window.removeEventListener("focus",reconnect);window.removeEventListener("online",reconnect);window.removeEventListener("offline",offline);};
  },[refresh]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),toast.kind==="error"?12000:5000);return()=>clearTimeout(timer);},[toast]);
  const notify=useCallback((message:string,kind:"success"|"error"="success")=>setToast({message,kind}),[]);
  const perform=useCallback(async<T,>(path:string,body:unknown):Promise<T>=>{
    try{return await post<T>(path,body);}catch(e){notify((e as Error).message,"error");if(e instanceof ApiError && (e.status===409 || e.status===401 || e.status===403))await refresh();throw e;}
  },[notify,refresh]);
  const href=(path:string)=>`${path}${data?.league?`?league=${data.league.id}`:""}`;
  const linkKind=pathname.slice(1);
  if(["access","join","view","recover"].includes(linkKind))return <LinkScreen kind={linkKind as "access"|"join"|"view"|"recover"} state={data}/>;
  if(!data)return <main className="access-page"><Link href="/" className="brand"><Domino/><BrandName/></Link><div className="access-card"><h1>{error?"The table is temporarily offline.":"Setting the table…"}</h1>{error?<><Notice>{error}</Notice><button className="btn primary" onClick={()=>void refresh()}>Retry connection</button><p className="muted">For a new installation, follow README.md to connect PostgreSQL and provision the first owner.</p></>:<p role="status">Opening your league and saved scores.</p>}</div></main>;
  if(!data.league)return <Welcome actor={data.actor}/>;
  const active=pathname==="/"?"/":`/${pathname.split("/")[1]}`;
  let screen:React.ReactNode;
  if(pathname==="/")screen=<Dashboard/>;
  else if(pathname==="/standings")screen=<StandingsScreen/>;
  else if(pathname==="/players")screen=<PlayersScreen/>;
  else if(pathname.startsWith("/players/"))screen=<ProfileScreen playerId={pathname.split("/")[2]}/>;
  else if(pathname==="/new")screen=<NewMatch/>;
  else if(pathname.startsWith("/matches/"))screen=<Scorecard matchId={pathname.split("/")[2]}/>;
  else if(pathname==="/history")screen=<HistoryScreen/>;
  else if(pathname==="/settings")screen=<SettingsScreen/>;
  else screen=<div className="panel"><h1>That page isn’t here.</h1><Link href={href("/")} className="btn primary">Back to the club</Link></div>;
  return <ClubContext.Provider value={{data,href,refresh,notify,perform}}><div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><aside className="sidebar"><Link href={href("/")} className="brand"><Domino/><BrandName/></Link><div className="league-badge"><span className="eyebrow">YOUR LEAGUE</span>{data.leagues.length>1?<select aria-label="League" value={data.league.id} onChange={e=>router.push(`/?league=${e.target.value}`)}>{data.leagues.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>:<strong>{data.league.name}</strong>}<small>{data.readOnly?"Spectator view":"A little competition. A lot of company."}</small></div><nav aria-label="Main navigation">{nav.map(n=><Link key={n.path} href={href(n.path)} className={`nav-item ${active===n.path?"active":""}`} aria-current={active===n.path?"page":undefined}><n.icon size={19}/>{n.label}</Link>)}{!data.readOnly&&<Link href={href("/settings")} className={`nav-item ${active==="/settings"?"active":""}`}><Settings size={19}/>Settings & access</Link>}</nav><div className="sidebar-bottom"><div className="cafe-note"><Coffee size={22}/><p>Pull up a chair.<br/><strong>We’ll keep the score.</strong></p></div>{data.actor&&<Link href={href(`/players/${data.actor.id}`)} className="identity"><Avatar player={data.actor} small/><span><strong dir="auto">{data.actor.name}</strong><small>{data.role || "Player"} · your profile</small></span><ArrowRight size={16}/></Link>}</div></aside><div className="workspace"><header className="topbar"><span className="breadcrumb">Labawy El-Domana <span>/</span> {pathname.startsWith("/matches/")?"Scorecard":pathname.startsWith("/players/")?"Player profile":pathname==="/new"?"New match":active==="/"?"Overview":active.slice(1)}</span><div className="row"><span className={`connection ${connected?"":"offline"}`} role="status">{connected?<Wifi size={14}/>:<WifiOff size={14}/>}<span>{connected?`Synced${updated?` ${updated}`:""}`:"Offline · draft kept"}</span></span>{!data.readOnly&&<Link className="btn primary compact" href={href("/new")}><Plus size={16}/>New match</Link>}</div></header><main id="main-content" className="main-content">{error&&<Notice>{error} <button className="text-button" onClick={()=>void refresh()}>Retry</button></Notice>}{data.readOnly&&<Notice kind="info">Read-only league view. Open your private profile link to keep score.</Notice>}{screen}</main><footer className="page-footer"><span>Good games, remembered.</span><Domino small/><span>{data.league.timezone}</span></footer></div><nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(n=><Link key={n.path} href={href(n.path)} className={active===n.path?"active":""}><n.icon size={20}/><span>{n.label}</span></Link>)}{!data.readOnly&&<Link href={href("/settings")}><Settings size={20}/><span>Settings</span></Link>}</nav>{toast&&<div className={`toast ${toast.kind}`} role={toast.kind==="error"?"alert":"status"}>{toast.message}<button aria-label="Dismiss message" onClick={()=>setToast(null)}>×</button></div>}</div></ClubContext.Provider>;
}
function Welcome({actor}:{actor:State["actor"]}) {
  const [link,setLink]=useState(""),[error,setError]=useState("");
  return <main className="welcome-page"><header><Link href="/" className="brand"><Domino/><BrandName/></Link><span className="welcome-tag"><Coffee size={16}/>Made for the café table</span></header><div className="welcome-grid"><div><span className="eyebrow">LESS REMEMBERING. MORE PLAYING.</span><h1>One more round.<br/><em>We’ve got the score.</em></h1><p className="welcome-intro">Your games, your people, your friendly rivalries. A little home for everything that happens around the domino table.</p><form className="welcome-form" onSubmit={e=>{e.preventDefault();try{const url=new URL(link,window.location.origin);if(url.origin!==location.origin || !["/join","/access","/view","/recover"].includes(url.pathname))throw new Error();location.assign(url.pathname+url.hash);}catch{setError("Paste a complete invitation or private link for this website.");}}}><FieldInline/><input id="welcome-link" aria-label="Invitation or private link" value={link} onChange={e=>setLink(e.target.value)} placeholder="Paste your invitation or private link" required/><button className="btn primary" type="submit">Pull up a chair <ArrowRight size={18}/></button></form>{error&&<Notice>{error}</Notice>}{actor&&<p>You’re signed in as <strong>{actor.name}</strong>. Open a league invitation to join with this profile.</p>}<p className="muted small-text">No email or password. Ask your league owner for an invitation.<br/>Starting a league? The deployment owner runs the first-owner setup in the README.</p></div><div className="welcome-art" aria-hidden="true"><span className="circle-line"/><div className="large-tile tile-one"><Domino/></div><div className="large-tile tile-two"><Domino/></div><span className="art-caption">THE NEXT GAME IS ALWAYS THE BEST ONE.</span></div></div><div className="welcome-features"><div><strong>Every hand counts.</strong><span>Fast score entry, saved for the next visit.</span></div><div><strong>Your table. Your rules.</strong><span>Singles, teams, or free-for-all.</span></div><div><strong>The league lives on.</strong><span>Profiles, standings, and a little bragging rights.</span></div></div></main>;
}
function FieldInline(){return <label className="eyebrow" htmlFor="welcome-link">YOUR LINK TO THE CLUB</label>;}
