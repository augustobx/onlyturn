"use client";
import { Bell, Megaphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Notice={id:string;title:string;body:string;style:string};
const DISPLAY_SECONDS=12;
const DISMISS_HOURS=6;

export function AnnouncementBoard({notices,businessName}:{notices:Notice[];businessName:string}){
 const storageKey=useMemo(()=>`onlyturn-board:${notices.map(item=>item.id).join(",")}`,[notices]);
 const [visible,setVisible]=useState(false),[ready,setReady]=useState(false),[seconds,setSeconds]=useState(DISPLAY_SECONDS);
 useEffect(()=>{async function open(){await Promise.resolve();const dismissedUntil=Number(localStorage.getItem(storageKey)??0);setReady(true);if(notices.length&&dismissedUntil<Date.now()){setSeconds(DISPLAY_SECONDS);setVisible(true)}}void open()},[notices.length,storageKey]);
 useEffect(()=>{if(!visible)return;const interval=window.setInterval(()=>setSeconds(value=>Math.max(0,value-1)),1000);const timeout=window.setTimeout(()=>{localStorage.setItem(storageKey,String(Date.now()+DISMISS_HOURS*3_600_000));setVisible(false)},DISPLAY_SECONDS*1000);return()=>{clearInterval(interval);clearTimeout(timeout)}},[storageKey,visible]);
 function close(){localStorage.setItem(storageKey,String(Date.now()+DISMISS_HOURS*3_600_000));setVisible(false)}
 function reopen(){setSeconds(DISPLAY_SECONDS);setVisible(true)}
 if(!notices.length||!ready)return null;
 return <>{visible?<div className="board-backdrop" role="dialog" aria-modal="true" aria-label={`Novedades de ${businessName}`}>
  <section className="announcement-board"><button type="button" className="board-close" onClick={close} aria-label="Cerrar tablón"><X size={21}/></button><header><div className="board-icon"><Megaphone size={24}/></div><div><span className="eyebrow">Tablón de anuncios</span><h2>Novedades de {businessName}</h2></div></header><div className="board-notices">{notices.map(item=><article className={`board-note ${item.style.toLowerCase()}`} key={item.id}><Bell size={17}/><div><strong>{item.title}</strong><p>{item.body}</p></div></article>)}</div><footer><span>Se cierra en {seconds} segundos</span><button type="button" className="button" onClick={close}>Entendido, cerrar</button></footer><div className="board-progress" style={{animationDuration:`${DISPLAY_SECONDS}s`}}/></section>
 </div>:<button type="button" className="board-reopen" onClick={reopen}><Bell size={17}/> Ver novedades</button>}</>;
}
