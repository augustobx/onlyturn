"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleBookingAction, updateBookingStatusAction } from "@/app/actions/bookings";

type Event={id:string;date:string;time:string;startsAt:string;status:string;customer:string;phone:string;service:string;color:string;assignee:string;location:string};
const labels:Record<string,string>={CONFIRMED:"Confirmado",PENDING:"Pendiente",COMPLETED:"Completado",CANCELLED:"Cancelado",NO_SHOW:"Ausente",CHECKED_IN:"Llegó",IN_PROGRESS:"En atención"};
const statuses=[["PENDING","Pendiente"],["CONFIRMED","Confirmado"],["CHECKED_IN","Llegó"],["IN_PROGRESS","En atención"],["COMPLETED","Completado"],["NO_SHOW","Ausente"],["CANCELLED","Cancelar"]];
const addDays=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const caption=(date:string,detail:"short"|"long"="short")=>new Intl.DateTimeFormat("es-AR",detail==="short"?{weekday:"short",day:"numeric",timeZone:"UTC"}:{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
const slotFor=(time:string)=>`${time.slice(0,2)}:${Number(time.slice(3,5))<30?"00":"30"}`;

export function InteractiveCalendar({events,view,startDate}:{events:Event[];view:string;startDate:string}){
 const router=useRouter();const [selected,setSelected]=useState<Event|null>(null);const [moving,startMove]=useTransition();
 const dates=useMemo(()=>Array.from({length:view==="day"?1:7},(_,i)=>addDays(startDate,i)),[startDate,view]);
 const slots=useMemo(()=>Array.from({length:30},(_,i)=>`${String(7+Math.floor(i/2)).padStart(2,"0")}:${i%2?"30":"00"}`),[]);
 const monthDays=useMemo(()=>{const d=new Date(`${startDate.slice(0,7)}-01T12:00:00Z`);const count=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();return Array.from({length:count},(_,i)=>`${startDate.slice(0,7)}-${String(i+1).padStart(2,"0")}`)},[startDate]);
 function drop(event:React.DragEvent,date:string,time:string){event.preventDefault();const id=event.dataTransfer.getData("text/booking-id");if(!id)return;const fd=new FormData();fd.set("bookingId",id);fd.set("startsAt",`${date}T${time}`);startMove(async()=>{await rescheduleBookingAction(fd);setSelected(null);router.refresh()})}
 const card=(event:Event)=><button type="button" draggable={!['COMPLETED','CANCELLED'].includes(event.status)} onDragStart={e=>e.dataTransfer.setData("text/booking-id",event.id)} onClick={()=>setSelected(event)} className={`calendar-event ${event.status}`} style={{"--event-color":event.color} as React.CSSProperties} key={event.id}><strong>{event.time} · {event.customer}</strong><span>{event.service}</span></button>;

 return <div className={`calendar-shell ${moving?"is-moving":""}`}>
  {view==="month"?<div className="month-calendar">{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(x=><div className="month-weekday" key={x}>{x}</div>)}{Array.from({length:(new Date(`${monthDays[0]}T12:00:00Z`).getUTCDay()+6)%7},(_,i)=><div className="month-day outside" key={`empty-${i}`}/>)}{monthDays.map(date=><div className="month-day" key={date}><strong>{Number(date.slice(-2))}</strong><div>{events.filter(e=>e.date===date).map(card)}</div></div>)}</div>:
  <div className="timeline-calendar" style={{"--calendar-days":dates.length} as React.CSSProperties}><div className="calendar-corner"/>{dates.map(date=><div className="calendar-day-head" key={date}>{caption(date)}</div>)}{slots.map(time=><div className="calendar-row" key={time}><div className="calendar-time-label">{time.endsWith("00")?time:""}</div>{dates.map(date=><div className="calendar-slot" key={`${date}-${time}`} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,date,time)}>{events.filter(item=>item.date===date&&slotFor(item.time)===time).map(card)}</div>)}</div>)}</div>}
  {!events.length&&<div className="empty">No hay turnos para este período y filtros.</div>}
  {selected&&<aside className="event-drawer"><button className="drawer-close" onClick={()=>setSelected(null)}>×</button><span className={`status ${selected.status}`}>{labels[selected.status]}</span><h2>{selected.customer}</h2><p><strong>{caption(selected.date,"long")} · {selected.time}</strong></p><div className="event-facts"><span>Servicio<strong>{selected.service}</strong></span><span>Asignación<strong>{selected.assignee}</strong></span><span>Sede<strong>{selected.location}</strong></span><span>Teléfono<strong>{selected.phone}</strong></span></div>{!["COMPLETED","CANCELLED"].includes(selected.status)&&<><form action={updateBookingStatusAction} className="drawer-form"><input type="hidden" name="bookingId" value={selected.id}/><select className="select" name="status" defaultValue={selected.status}>{statuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><input className="input" name="reason" placeholder="Motivo si cancelás"/><button className="button">Actualizar estado</button></form><form action={rescheduleBookingAction} className="drawer-form"><input type="hidden" name="bookingId" value={selected.id}/><input className="input" name="startsAt" type="datetime-local" defaultValue={`${selected.date}T${selected.time}`} required/><button className="button secondary">Reprogramar</button></form></>}</aside>}
 </div>
}
