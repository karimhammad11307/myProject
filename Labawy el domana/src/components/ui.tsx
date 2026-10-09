"use client";
import Image from "next/image";
import { Check, Copy, X } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import type { PlayerView } from "@/lib/types";
export function Domino({small=false}:{small?:boolean}) {return <span className={`domino-mark ${small?"small":""}`} aria-hidden="true"><span><i/><i/><i/></span><span><i/><i/><i/><i/><i/></span></span>;}
export function BrandName(){return <span className="brand-name">Labawy El-Domana<small dir="rtl" lang="ar">لباوي الضومنة</small></span>;}
export function Avatar({player,small=false}:{player:{name:string;avatar:string;photoUrl?:string|null},small?:boolean}) {return <span className={`avatar ${player.avatar} ${small?"small":""}`} aria-hidden="true">{player.photoUrl?<Image unoptimized src={player.photoUrl} width={512} height={512} alt="" className="profile-photo"/>:Array.from(player.name.trim())[0]?.toLocaleUpperCase() || "?"}</span>;}
export const playerLabel=(p:Pick<PlayerView,"name"|"id">)=>`${p.name} · ${p.id.slice(0,4)}`;
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}) {
  const generated=useId();
  const control=isValidElement(children)&&typeof children.type==="string"&&["input","select","textarea"].includes(children.type);
  const child=children as ReactElement<{id?:string;"aria-describedby"?:string}>;
  const id=control?(child.props.id||generated):generated;
  return <div className="field">{control?<label htmlFor={id}>{label}</label>:<span id={id}>{label}</span>}{control?cloneElement(child,{id,"aria-describedby":hint?`${id}-hint`:child.props["aria-describedby"]}):children}{hint&&<small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Notice({children,kind="error"}:{children:React.ReactNode;kind?:"error"|"info"|"success"}) {return <div className={`notice ${kind}`} role={kind==="error"?"alert":"status"}>{children}</div>;}
export function Empty({title,children}:{title:string;children:React.ReactNode}) {return <div className="empty"><Domino/><h3>{title}</h3><p>{children}</p></div>;}
export function Secret({url,title="Your private profile link",onClose}:{url:string;title?:string;onClose?:()=>void}) {
  const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
  const warning=title.includes("invitation")?"Anyone with this invitation can join the league. It never opens an existing player’s profile.":title.includes("Read-only")?"Anyone with this link can view league scores. It provides no editing permission.":title.includes("owner recovery")?"Anyone with this separate recovery link can restore owner access. Save it offline, away from invitations.":"Anyone with this private link can access your profile. Save it somewhere private.";
  return <div className="secret"><div className="row between"><h3>{title}</h3>{onClose&&<button className="icon-button" aria-label="Dismiss link" onClick={onClose}><X size={18}/></button>}</div><p>{warning} It is shown only here.</p><input aria-label={title} value={url} readOnly onFocus={e=>e.target.select()}/><button className="btn secondary" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setFailed(true);}}}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy link"}</button>{failed&&<small>Select and copy the link from the field above.</small>}</div>;
}
export function Confirm({title,children,onConfirm,onCancel,busy=false}:{title:string;children:React.ReactNode;onConfirm:()=>void;onCancel:()=>void;busy?:boolean}) {
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"&&!busy){event.preventDefault();onCancel();}
   if(event.key!=="Tab")return;
   const buttons=container.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
   if(!buttons?.length){event.preventDefault();return;}
   const first=buttons[0],last=buttons[buttons.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",keydown);return()=>{document.removeEventListener("keydown",keydown);previous?.focus();};
 },[busy,onCancel]);
 return <div className="modal-backdrop"><div ref={container} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title"><h2 id="confirmation-title">{title}</h2><p>{children}</p><div className="row end"><button autoFocus className="btn secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="btn primary" disabled={busy} onClick={onConfirm}>{busy?"Saving…":"Confirm"}</button></div></div></div>;
}
export function when(value:string,timeZone:string) {return new Intl.DateTimeFormat(undefined,{timeZone,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value));}
