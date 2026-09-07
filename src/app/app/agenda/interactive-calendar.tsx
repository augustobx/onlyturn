"use client";

import { CalendarPlus2, CircleDollarSign, Clock3, MapPin, Sparkles, UserRound, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleBookingAction, updateBookingStatusAction } from "@/app/actions/bookings";
import { FeedbackForm } from "@/components/feedback-form";

type Event={
  id:string;date:string;time:string;endTime:string;startsAt:string;status:string;customer:string;phone:string;service:string;color:string;assignee:string;location:string;
  paymentStatus:string;paymentAmountCents:number;priceCents:number|null;
};
type FreeSlot={date:string;time:string;endTime:string;startsAt:string;href:string};
const labels:Record<string,string>={CONFIRMED:"Confirmado",PENDING:"Pendiente",COMPLETED:"Completado",CANCELLED:"Cancelado",NO_SHOW:"Ausente",CHECKED_IN:"Llegó",IN_PROGRESS:"En atención"};
const statuses=[["PENDING","Pendiente"],["CONFIRMED","Confirmado"],["CHECKED_IN","Llegó"],["IN_PROGRESS","En atención"],["COMPLETED","Completado"],["NO_SHOW","Ausente"],["CANCELLED","Cancelar"]];
const addDays=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const caption=(date:string,detail:"short"|"long"="short")=>new Intl.DateTimeFormat("es-AR",detail==="short"?{weekday:"short",day:"numeric",timeZone:"UTC"}:{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
const slotFor=(time:string)=>`${time.slice(0,2)}:${Number(time.slice(3,5))<30?"00":"30"}`;
const hourOf=(time:string)=>Number(time.slice(0,2));

export function InteractiveCalendar({events,freeSlots,view,startDate,availabilityLabel}:{events:Event[];freeSlots:FreeSlot[];view:string;startDate:string;availabilityLabel:string}){
  const router=useRouter();
  const [selected,setSelected]=useState<Event|null>(null);
  const [selectedFree,setSelectedFree]=useState<FreeSlot|null>(null);
  const [moveError,setMoveError]=useState("");
  const [moving,startMove]=useTransition();
  const dates=useMemo(()=>Array.from({length:view==="day"?1:7},(_,i)=>addDays(startDate,i)),[startDate,view]);
  const monthDays=useMemo(()=>{const d=new Date(`${startDate.slice(0,7)}-01T12:00:00Z`);const count=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();return Array.from({length:count},(_,i)=>`${startDate.slice(0,7)}-${String(i+1).padStart(2,"0")}`)},[startDate]);
  const slots=useMemo(()=>{
    const hours=[...events.flatMap((event)=>[hourOf(event.time),hourOf(event.endTime)]),...freeSlots.flatMap((slot)=>[hourOf(slot.time),hourOf(slot.endTime)])];
    const min=Math.max(5,Math.min(8,...hours)-1);
    const max=Math.min(24,Math.max(20,...hours)+1);
    return Array.from({length:(max-min)*2},(_,i)=>`${String(min+Math.floor(i/2)).padStart(2,"0")}:${i%2?"30":"00"}`);
  },[events,freeSlots]);

  function drop(event:React.DragEvent,date:string,time:string){
    event.preventDefault();
    const id=event.dataTransfer.getData("text/booking-id");
    if(!id)return;
    const fd=new FormData();fd.set("bookingId",id);fd.set("startsAt",`${date}T${time}`);
    setMoveError("");
    startMove(async()=>{try{await rescheduleBookingAction(fd);setSelected(null);router.refresh()}catch(error){setMoveError(error instanceof Error?error.message:"No se pudo reprogramar el turno")}})
  }

  const card=(event:Event)=><button type="button" draggable={!['COMPLETED','CANCELLED'].includes(event.status)} onDragStart={e=>e.dataTransfer.setData("text/booking-id",event.id)} onClick={()=>{setSelectedFree(null);setSelected(event)}} className={`calendar-event ${event.status}`} style={{"--event-color":event.color} as React.CSSProperties} key={event.id}>
    <span className="calendar-event-time">{event.time}–{event.endTime}</span>
    <strong>{event.customer}</strong>
    <span>{event.service}</span>
    <small>{event.assignee}</small>
  </button>;
  const freeCard=(slot:FreeSlot)=><button type="button" className="calendar-free-slot" onClick={()=>{setSelected(null);setSelectedFree(slot)}} key={`${slot.date}-${slot.time}`}><Sparkles size={12}/><strong>{slot.time}</strong><span>Libre</span></button>;

  return <div className={`calendar-shell calendar-shell-v2 ${moving?"is-moving":""}`}>
    {moveError&&<div className="calendar-error">{moveError}</div>}
    {view==="month"?<div className="month-calendar">{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(x=><div className="month-weekday" key={x}>{x}</div>)}{Array.from({length:(new Date(`${monthDays[0]}T12:00:00Z`).getUTCDay()+6)%7},(_,i)=><div className="month-day outside" key={`empty-${i}`}/>)}{monthDays.map(date=>{const dayEvents=events.filter(e=>e.date===date);return <div className="month-day" key={date}><div className="month-day-head"><strong>{Number(date.slice(-2))}</strong>{dayEvents.length>0&&<span>{dayEvents.length} turno{dayEvents.length===1?"":"s"}</span>}</div><div>{dayEvents.map(card)}</div></div>})}</div>:
    <div className="timeline-calendar" style={{"--calendar-days":dates.length} as React.CSSProperties}>
      <div className="calendar-corner"><Clock3 size={15}/></div>
      {dates.map(date=>{const dayEvents=events.filter(item=>item.date===date);const dayFree=freeSlots.filter(item=>item.date===date);return <div className="calendar-day-head" key={date}><strong>{caption(date)}</strong><span>{dayEvents.length} ocupados · {dayFree.length} libres</span></div>})}
      {slots.map(time=><div className="calendar-row" key={time}><div className="calendar-time-label">{time}</div>{dates.map(date=><div className="calendar-slot" key={`${date}-${time}`} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,date,time)}>{freeSlots.filter(item=>item.date===date&&slotFor(item.time)===time).map(freeCard)}{events.filter(item=>item.date===date&&slotFor(item.time)===time).map(card)}</div>)}</div>)}
    </div>}
    {!events.length&&!freeSlots.length&&<div className="empty calendar-empty">No hay turnos ni disponibilidad calculada para este período.</div>}

    {selected&&<aside className="event-drawer calendar-drawer-v2"><button className="drawer-close" onClick={()=>setSelected(null)}><X size={18}/></button><span className={`status ${selected.status}`}>{labels[selected.status]}</span><h2>{selected.customer}</h2><p className="drawer-date"><strong>{caption(selected.date,"long")}</strong><span>{selected.time}–{selected.endTime}</span></p><div className="event-facts"><span><MapPin size={14}/>Sede<strong>{selected.location}</strong></span><span><UserRound size={14}/>Asignación<strong>{selected.assignee}</strong></span><span><Clock3 size={14}/>Servicio<strong>{selected.service}</strong></span><span><CircleDollarSign size={14}/>Cobro<strong>{selected.paymentStatus==="PAID"?"Pagado":selected.paymentStatus==="NOT_REQUIRED"?"Sin cobro online":"Pendiente / parcial"}</strong></span></div><a className="button secondary drawer-cash-link" href={`/caja?bookingId=${selected.id}`}>Ir a Caja / Cobros</a>{!["COMPLETED","CANCELLED"].includes(selected.status)&&<><FeedbackForm action={updateBookingStatusAction} className="drawer-form" savedMessage="Estado actualizado"><input type="hidden" name="bookingId" value={selected.id}/><select className="select" name="status" defaultValue={selected.status}>{statuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><input className="input" name="reason" placeholder="Motivo si cancelás"/><button className="button">Actualizar estado</button></FeedbackForm><FeedbackForm action={rescheduleBookingAction} className="drawer-form" savedMessage="Turno reprogramado"><input type="hidden" name="bookingId" value={selected.id}/><input className="input" name="startsAt" type="datetime-local" defaultValue={`${selected.date}T${selected.time}`} required/><button className="button secondary">Reprogramar</button></FeedbackForm></>}</aside>}

    {selectedFree&&<aside className="event-drawer calendar-drawer-v2 free-drawer"><button className="drawer-close" onClick={()=>setSelectedFree(null)}><X size={18}/></button><span className="free-drawer-icon"><CalendarPlus2 size={20}/></span><span className="eyebrow">Hueco disponible</span><h2>{selectedFree.time}–{selectedFree.endTime}</h2><p><strong>{caption(selectedFree.date,"long")}</strong></p><p className="muted">{availabilityLabel||"Disponibilidad calculada"}. Este hueco ya contempla horarios, bloqueos y reservas existentes.</p><a className="button" href={selectedFree.href}>Crear turno acá</a></aside>}
  </div>
}
