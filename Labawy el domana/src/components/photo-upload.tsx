"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Camera, Upload } from "lucide-react";
import { useClub } from "./context";
import { Notice } from "./ui";
import { ApiError } from "./api";
export async function uploadPhoto(file:File){const form=new FormData();form.set("photo",file);let response:Response;try{response=await fetch("/api/profile/photo",{method:"POST",body:form});}catch{throw new ApiError(0,"Photo was not saved. Reconnect and retry.");}const result=await response.json();if(!response.ok)throw new ApiError(response.status,result.error);return result;}
export function PhotoUpload(){
 const {data,refresh,notify,perform}=useClub();
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);const timer=setTimeout(()=>setPreview(url),0);return()=>{clearTimeout(timer);URL.revokeObjectURL(url);};},[file]);
 const player=data.players.find(p=>p.id===data.actor?.id);
 async function save(e:React.FormEvent){e.preventDefault();if(!file||busy)return;setBusy(true);setError("");try{await uploadPhoto(file);notify("Your profile photo is saved.");setFile(null);setPreview("");await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel form-panel photo-upload"><div className="row"><Camera size={23}/><div><h2>Your personal photo</h2><p className="muted">A familiar face at the table. Your photo appears on your profile and in league standings.</p></div></div>{error&&<Notice>{error}</Notice>}<form onSubmit={save}><div className="photo-preview">{preview||player?.photoUrl?<Image unoptimized src={preview||player!.photoUrl!} width={512} height={512} alt="Your profile photo preview"/>:<Camera size={35}/>}</div><label className="field"><span>Choose a personal photo</span><input aria-label="Choose a personal photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setError("");}}/><small>JPEG, PNG, or WebP · maximum 3 MB. Photos are cropped to a square; location metadata is removed.</small></label><div className="button-wrap"><button disabled={busy||!file} className="btn primary" type="submit"><Upload size={16}/>{busy?"Uploading…":"Save profile photo"}</button>{player?.photoUrl&&<button disabled={busy} className="btn ghost" type="button" onClick={async()=>{setBusy(true);try{await perform("profile/remove-photo",{});notify("Photo removed. Your avatar color is kept.");await refresh();}catch{}finally{setBusy(false);}}}>Remove photo</button>}</div></form></section>;
}
