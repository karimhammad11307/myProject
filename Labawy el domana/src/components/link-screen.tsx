"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { post } from "./api";
import { uploadPhoto } from "./photo-upload";
import { Avatar, BrandName, Domino, Field, Notice, Secret } from "./ui";
import { avatars } from "@/lib/domain";
import type { State } from "@/lib/types";
export function LinkScreen({kind,state}:{kind:"access"|"join"|"view"|"recover";state:State|null}) {
  const raw=useRef<string>(""),initialized=useRef(false);
  const [info,setInfo]=useState<{name?:string;leagueName?:string;playerId?:string}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[name,setName]=useState(""),[avatar,setAvatar]=useState<typeof avatars[number]>("olive"),[confirmed,setConfirmed]=useState(false),[photo,setPhoto]=useState<File|null>(null),[result,setResult]=useState<{privateLink?:string;recoveryLink?:string;leagueId?:string}|null>(null);
  useEffect(()=>{
    if(initialized.current)return;initialized.current=true;
    raw.current=window.location.hash.slice(1);history.replaceState(null,"",window.location.pathname);
    if(!raw.current){Promise.resolve().then(()=>setError("This link is missing its private code. Open the complete link again."));return;}
    post<typeof info>("link/inspect",{kind,token:raw.current}).then(setInfo).catch(e=>setError(e.message));
  },[kind]);
  const switching=!!state?.actor && kind!=="join" && kind!=="view" && info?.playerId!==state.actor.id;
  async function redeem(e:React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);setError("");
    try {
      const next=await post<{privateLink?:string;recoveryLink?:string;leagueId?:string}>("link/redeem",{kind,token:raw.current,name:kind==="join"&&!state?.actor?name:undefined,avatar,confirmSwitch:confirmed});
      raw.current="";
      if(kind==="join"&&photo){try{await uploadPhoto(photo);}catch(e){setError(`Your profile was created. ${(e as Error).message} You can add the photo from your profile later.`);}}
      if(next.privateLink || next.recoveryLink)setResult(next);else window.location.href=new URL(`/${next.leagueId?`?league=${next.leagueId}`:""}`,window.location.origin).href;
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <main className="access-page"><Link href="/" className="brand"><Domino/><BrandName/></Link><div className="access-card"><span className="eyebrow">A SEAT AT THE TABLE</span><h1>{result?"You’re all set.":kind==="join"?"Good company.\nGreat games.":kind==="view"?"Follow the league.":kind==="recover"?"Restore your owner access.":"Welcome back."}</h1>{info&&!result&&<p className="muted">{kind==="join"?`Join ${info.leagueName}. Just a name, and you’re in.`:kind==="view"?`${info.leagueName} · Read-only scores and standings.`:kind==="recover"?`${info.leagueName} · This replaces the owner’s private link and revokes their devices.`:`Restore ${info.name}’s profile${info.leagueName?` in ${info.leagueName}`:""}.`}</p>}
    {error&&<Notice>{error}</Notice>}{!info&&!error&&<p role="status">Checking your link…</p>}
    {result?<><Secret url={result.privateLink!}/>{result.recoveryLink&&<Secret url={result.recoveryLink} title="Separate owner recovery link"/>}<button className="btn primary full" onClick={()=>{window.location.href=new URL(`/${result.leagueId?`?league=${result.leagueId}`:""}`,window.location.origin).href;}}>I’ve saved my links · enter the club <ArrowRight size={18}/></button></>:info&&<form onSubmit={redeem}>
      {kind==="join"&&!state?.actor&&<><Field label="Your display name" hint="Arabic and other Unicode names are welcome."><input name="name" autoComplete="nickname" dir="auto" required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="What should we call you?"/></Field><Field label="Choose your color"><div className="avatar-picker">{avatars.map(a=><button type="button" key={a} aria-label={`${a} avatar`} aria-pressed={avatar===a} className={avatar===a?"selected":""} onClick={()=>setAvatar(a)}><Avatar player={{name:name||"D",avatar:a}}/></button>)}</div></Field><Field label="Personal photo (optional)" hint="JPEG, PNG, or WebP · up to 3 MB. You can update it from your profile."><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></Field></>}
      {kind==="join"&&state?.actor&&<Notice kind="info">You’ll join as {state.actor.name}. Your existing profile will be kept.</Notice>}
      {switching&&<Notice kind="info"><strong>This device is signed in as {state!.actor!.name}.</strong><label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Switch this device to {info.name || "the owner"}.</label></Notice>}
      {kind==="recover"&&<Notice kind="info">Recovery is one-time. A new owner recovery link will be shown after you confirm. Save it offline.</Notice>}
      <button className="btn primary full" disabled={busy || switching&&!confirmed}>{busy?"Opening your seat…":kind==="join"?"Join the league":kind==="view"?"View scores":kind==="recover"?"Confirm owner recovery":"Restore profile"}<ArrowRight size={18}/></button>
    </form>}
    <div className="access-foot"><ShieldCheck size={16}/> No emails. No passwords. Just your private link.</div></div><p className="access-note">Every round remembered. Every rematch welcome.</p></main>;
}
