import { FormEvent, useEffect, useMemo, useState } from "react";
import { createCustomer, listCustomers, Customer, CustomerInput } from "../data/customers";
import {
  createRepair,
  getRepair,
  listRepairs,
  listRepairStatusHistory,
  listStatuses,
  Repair,
  RepairInput,
  RepairStatus,
  RepairStatusHistory,
  RepairUpdateInput,
  updateRepair,
} from "../data/repairs";
import { useI18n } from "../i18n/I18nProvider";
import RepairPrintSheet from "../components/RepairPrintSheet";
import { defaultOfficeSettings, getOfficeSettings, OfficeSettings } from "../data/settings";

const blank: RepairInput = {customer_id:0,status_id:0,device_type:"",brand:"",model:"",serial_number:"",imei:"",reported_fault:"",accessories:"",general_condition:"",estimated_value:"",internal_notes:""};
const blankEdit: RepairUpdateInput = {...blank,diagnosis:"",work_performed:"",final_value:""};
const blankCustomer: CustomerInput = {name:"",company:"",taxNumber:"",phone:"",email:"",address:"",notes:""};

export default function RepairsPage(){
  const {t}=useI18n();
  const [repairs,setRepairs]=useState<Repair[]>([]);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [statuses,setStatuses]=useState<RepairStatus[]>([]);
  const [form,setForm]=useState<RepairInput>(blank); const [office,setOffice]=useState<OfficeSettings>(defaultOfficeSettings);
  const [open,setOpen]=useState(false);
  const [printing,setPrinting]=useState<Repair|null>(null);
  const [editing,setEditing]=useState<Repair|null>(null);
  const [editForm,setEditForm]=useState<RepairUpdateInput>(blankEdit);
  const [history,setHistory]=useState<RepairStatusHistory[]>([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState(0);
  const [scopeFilter,setScopeFilter]=useState<"all"|"open"|"closed">("all");
  const [quickCustomerOpen,setQuickCustomerOpen]=useState(false);
  const [quickCustomer,setQuickCustomer]=useState<CustomerInput>(blankCustomer);
  const [quickCustomerSaving,setQuickCustomerSaving]=useState(false);

  async function load(){
    try {
      const [r,c,s]=await Promise.all([listRepairs(),listCustomers(),listStatuses()]);
      setRepairs(r); setCustomers(c); setStatuses(s);
      if(s.length) setForm(f=>({...f,status_id:f.status_id||s[0].id}));
    } catch { setError(t("common.databaseError")); }
  }
  useEffect(()=>{load(); getOfficeSettings().then(setOffice).catch(()=>{});},[]);
  const byId=useMemo(()=>new Map(customers.map(c=>[c.id,c])),[customers]);
  const filteredRepairs=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase();
    return repairs.filter(r=>{
      if(statusFilter && r.status_id!==statusFilter) return false;
      const closed=r.status_code==="DELIVERED"||r.status_code==="CANCELLED";
      if(scopeFilter==="open" && closed) return false;
      if(scopeFilter==="closed" && !closed) return false;
      if(!q) return true;
      return [
        r.repair_number,r.customer_name,r.device_type,r.brand,r.model,
        r.serial_number,r.imei,r.reported_fault
      ].some(value=>(value||"").toLocaleLowerCase().includes(q));
    });
  },[repairs,search,statusFilter,scopeFilter]);

  async function saveNewRepair(printAfterSave=false){
    if(!form.customer_id||!form.status_id||!form.reported_fault.trim()||saving) return;
    setSaving(true); setError("");
    try{
      const id=await createRepair(form);
      const created=printAfterSave?await getRepair(id):null;
      setOpen(false);
      setQuickCustomerOpen(false);
      setQuickCustomer(blankCustomer);
      setForm({...blank,status_id:statuses[0]?.id||0});
      await load();
      if(created) setPrinting(created);
    } catch {
      setError(t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    await saveNewRepair(false);
  }

  async function saveQuickCustomer(){
    if(!quickCustomer.name.trim()||quickCustomerSaving) return;
    setQuickCustomerSaving(true); setError("");
    try {
      const id=await createCustomer(quickCustomer);
      const updated=await listCustomers();
      setCustomers(updated);
      setForm(f=>({...f,customer_id:id}));
      setQuickCustomer(blankCustomer);
      setQuickCustomerOpen(false);
    } catch {
      setError(t("common.saveError"));
    } finally {
      setQuickCustomerSaving(false);
    }
  }

  async function openRepair(id:number){
    setError("");
    try {
      const [repair,statusHistory]=await Promise.all([getRepair(id),listRepairStatusHistory(id)]);
      if(!repair) return;
      setEditing(repair);
      setHistory(statusHistory);
      setEditForm({
        customer_id:repair.customer_id,status_id:repair.status_id,device_type:repair.device_type||"",brand:repair.brand||"",model:repair.model||"",
        serial_number:repair.serial_number||"",imei:repair.imei||"",reported_fault:repair.reported_fault||"",accessories:repair.accessories||"",
        general_condition:repair.general_condition||"",estimated_value:repair.estimated_value?.toString()||"",internal_notes:repair.internal_notes||"",
        diagnosis:repair.diagnosis||"",work_performed:repair.work_performed||"",final_value:repair.final_value?.toString()||""
      });
    } catch { setError(t("common.databaseError")); }
  }

  async function saveEdit(e:FormEvent){
    e.preventDefault(); if(!editing||!editForm.customer_id||!editForm.status_id||!editForm.reported_fault.trim()) return;
    setSaving(true); setError("");
    try {
      await updateRepair(editing.id,editForm,editing.status_id);
      const [updated,statusHistory]=await Promise.all([getRepair(editing.id),listRepairStatusHistory(editing.id)]);
      if(updated) setEditing(updated);
      setHistory(statusHistory);
      await load();
    } catch { setError(t("common.saveError")); }
    finally { setSaving(false); }
  }

  const field=(k:keyof RepairInput,v:string|number)=>setForm(f=>({...f,[k]:v}));
  const editField=(k:keyof RepairUpdateInput,v:string|number)=>setEditForm(f=>({...f,[k]:v}));

  return <>
    <header className="page-header"><div><h1>{t("repairs.title")}</h1><p>{t("repairs.emptyHint")}</p></div><button className="primary" onClick={()=>{setQuickCustomerOpen(false);setQuickCustomer(blankCustomer);setOpen(true);}}>+ {t("repair.new")}</button></header>
    {error&&<div className="alert error">{error}</div>}
    <section className="panel customers-panel">
      {repairs.length===0?<div className="empty-state compact">{t("repairs.empty")}</div>:<>
        <div className="repairs-toolbar">
          <input className="repair-search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("repairs.search")}/>
          <select value={statusFilter} onChange={e=>setStatusFilter(Number(e.target.value))} aria-label={t("repairs.filterStatus")}>
            <option value={0}>{t("repairs.allStatuses")}</option>
            {statuses.map(s=><option key={s.id} value={s.id}>{t(s.label_key)}</option>)}
          </select>
          <div className="repair-scope-filter" role="group">
            <button type="button" className={scopeFilter==="all"?"active":""} onClick={()=>setScopeFilter("all")}>{t("repairs.scopeAll")}</button>
            <button type="button" className={scopeFilter==="open"?"active":""} onClick={()=>setScopeFilter("open")}>{t("repairs.scopeOpen")}</button>
            <button type="button" className={scopeFilter==="closed"?"active":""} onClick={()=>setScopeFilter("closed")}>{t("repairs.scopeClosed")}</button>
          </div>
          <span className="muted repair-results-count">{t("repairs.results").replace("{count}",String(filteredRepairs.length))}</span>
        </div>
        {filteredRepairs.length===0?<div className="empty-state compact">{t("repairs.noResults")}</div>:<div className="table-wrap"><table><thead><tr><th>{t("print.repairNumber")}</th><th>{t("customer.name")}</th><th>{t("repair.device")}</th><th>{t("repair.status")}</th><th>{t("repair.openedAt")}</th><th></th></tr></thead><tbody>{filteredRepairs.map(r=><tr key={r.id} className="clickable-row" onDoubleClick={()=>openRepair(r.id)}><td><strong>{r.repair_number}</strong></td><td>{r.customer_name}</td><td>{[r.device_type,r.brand,r.model].filter(Boolean).join(" · ")||"—"}</td><td><span className="status-pill">{t(r.status_label_key)}</span></td><td>{new Date(r.opened_at).toLocaleString()}</td><td className="actions-column"><div className="row-actions"><button className="secondary small" onClick={()=>openRepair(r.id)}>{t("repair.open")}</button><button className="secondary small" onClick={()=>setPrinting(r)}>{t("print.preview")}</button></div></td></tr>)}</tbody></table></div>}
      </>}
    </section>

    {open&&<div className="modal-backdrop"><section className="modal repair-modal"><div className="modal-head"><div><h2>{t("repair.new")}</h2><p>{t("repair.formHint")}</p></div><button className="icon-button" onClick={()=>setOpen(false)}>×</button></div><form onSubmit={submit}><div className="form-grid">
      <div className="field full">
        <span>{t("customer.name")} *</span>
        <div className="customer-select-row">
          <select value={form.customer_id} onChange={e=>field("customer_id",Number(e.target.value))}>
            <option value={0}>{t("repair.selectCustomer")}</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?` — ${c.company}`:""}</option>)}
          </select>
          <button type="button" className="secondary" onClick={()=>setQuickCustomerOpen(v=>!v)}>
            {quickCustomerOpen?t("repair.hideNewCustomer"):`+ ${t("customers.new")}`}
          </button>
        </div>
      </div>
      {quickCustomerOpen&&<div className="quick-customer-card full">
        <div className="quick-customer-head">
          <div><strong>{t("repair.quickCustomerTitle")}</strong><p>{t("repair.quickCustomerHint")}</p></div>
        </div>
        <div className="form-grid">
          <label className="field full"><span>{t("customer.name")} *</span><input autoFocus value={quickCustomer.name} onChange={e=>setQuickCustomer(c=>({...c,name:e.target.value}))}/></label>
          <label className="field"><span>{t("customer.phone")}</span><input value={quickCustomer.phone} onChange={e=>setQuickCustomer(c=>({...c,phone:e.target.value}))}/></label>
          <label className="field"><span>{t("customer.email")}</span><input type="email" value={quickCustomer.email} onChange={e=>setQuickCustomer(c=>({...c,email:e.target.value}))}/></label>
          <label className="field"><span>{t("customer.taxNumber")}</span><input value={quickCustomer.taxNumber} onChange={e=>setQuickCustomer(c=>({...c,taxNumber:e.target.value}))}/></label>
          <label className="field"><span>{t("customer.company")}</span><input value={quickCustomer.company} onChange={e=>setQuickCustomer(c=>({...c,company:e.target.value}))}/></label>
        </div>
        <div className="quick-customer-actions">
          <button type="button" className="secondary" onClick={()=>{setQuickCustomerOpen(false);setQuickCustomer(blankCustomer);}}>{t("common.cancel")}</button>
          <button type="button" className="primary" disabled={quickCustomerSaving||!quickCustomer.name.trim()} onClick={()=>void saveQuickCustomer()}>
            {quickCustomerSaving?t("common.saving"):t("repair.createAndSelectCustomer")}
          </button>
        </div>
      </div>}
      <label className="field"><span>{t("repair.deviceType")}</span><input value={form.device_type} onChange={e=>field("device_type",e.target.value)}/></label><label className="field"><span>{t("repair.brand")}</span><input value={form.brand} onChange={e=>field("brand",e.target.value)}/></label>
      <label className="field"><span>{t("repair.model")}</span><input value={form.model} onChange={e=>field("model",e.target.value)}/></label><label className="field"><span>{t("repair.serialOrImei")}</span><input value={form.serial_number} onChange={e=>field("serial_number",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.reportedFault")} *</span><textarea rows={3} value={form.reported_fault} onChange={e=>field("reported_fault",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.accessories")}</span><textarea rows={2} value={form.accessories} onChange={e=>field("accessories",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.generalCondition")}</span><textarea rows={2} value={form.general_condition} onChange={e=>field("general_condition",e.target.value)}/></label>
      <label className="field"><span>{t("repair.status")}</span><select value={form.status_id} onChange={e=>field("status_id",Number(e.target.value))}>{statuses.map(s=><option key={s.id} value={s.id}>{t(s.label_key)}</option>)}</select></label><label className="field"><span>{t("repair.estimatedValue")}</span><input type="number" step="0.01" min="0" value={form.estimated_value} onChange={e=>field("estimated_value",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.internalNotes")}</span><textarea rows={3} value={form.internal_notes} onChange={e=>field("internal_notes",e.target.value)}/></label>
    </div><div className="modal-actions repair-create-actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>{t("common.cancel")}</button><button type="submit" className="secondary" disabled={saving||!form.customer_id||!form.reported_fault.trim()}>{saving?t("common.saving"):t("common.save")}</button><button type="button" className="primary" disabled={saving||!form.customer_id||!form.reported_fault.trim()} onClick={()=>void saveNewRepair(true)}>{saving?t("common.saving"):t("repair.saveAndPrint")}</button></div></form></section></div>}

    {editing&&<div className="modal-backdrop"><section className="modal repair-detail-modal"><div className="modal-head"><div><h2>{editing.repair_number}</h2><p>{editing.customer_name} · {new Date(editing.opened_at).toLocaleString()}</p></div><button className="icon-button" onClick={()=>setEditing(null)}>×</button></div><form onSubmit={saveEdit}><div className="detail-layout"><div className="form-grid detail-form">
      <label className="field full"><span>{t("customer.name")} *</span><select value={editForm.customer_id} onChange={e=>editField("customer_id",Number(e.target.value))}>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.company?` — ${c.company}`:""}</option>)}</select></label>
      <label className="field"><span>{t("repair.status")}</span><select value={editForm.status_id} onChange={e=>editField("status_id",Number(e.target.value))}>{statuses.map(s=><option key={s.id} value={s.id}>{t(s.label_key)}</option>)}</select></label><label className="field"><span>{t("repair.estimatedValue")}</span><input type="number" step="0.01" min="0" value={editForm.estimated_value} onChange={e=>editField("estimated_value",e.target.value)}/></label>
      <label className="field"><span>{t("repair.deviceType")}</span><input value={editForm.device_type} onChange={e=>editField("device_type",e.target.value)}/></label><label className="field"><span>{t("repair.brand")}</span><input value={editForm.brand} onChange={e=>editField("brand",e.target.value)}/></label>
      <label className="field"><span>{t("repair.model")}</span><input value={editForm.model} onChange={e=>editField("model",e.target.value)}/></label><label className="field"><span>{t("repair.serialOrImei")}</span><input value={editForm.serial_number} onChange={e=>editField("serial_number",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.reportedFault")} *</span><textarea rows={3} value={editForm.reported_fault} onChange={e=>editField("reported_fault",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.diagnosis")}</span><textarea rows={3} value={editForm.diagnosis} onChange={e=>editField("diagnosis",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.workPerformed")}</span><textarea rows={3} value={editForm.work_performed} onChange={e=>editField("work_performed",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.accessories")}</span><textarea rows={2} value={editForm.accessories} onChange={e=>editField("accessories",e.target.value)}/></label>
      <label className="field full"><span>{t("repair.generalCondition")}</span><textarea rows={2} value={editForm.general_condition} onChange={e=>editField("general_condition",e.target.value)}/></label>
      <label className="field"><span>{t("repair.finalValue")}</span><input type="number" step="0.01" min="0" value={editForm.final_value} onChange={e=>editField("final_value",e.target.value)}/></label><div></div>
      <label className="field full"><span>{t("repair.internalNotes")}</span><textarea rows={3} value={editForm.internal_notes} onChange={e=>editField("internal_notes",e.target.value)}/></label>
      </div><aside className="history-panel"><h3>{t("repair.history")}</h3>{history.length===0?<p className="muted">{t("repair.historyEmpty")}</p>:<div className="history-list">{history.map(h=><div className="history-item" key={h.id}><strong>{t(h.status_label_key)}</strong><span>{new Date(h.changed_at).toLocaleString()}</span>{h.note&&<p>{h.note}</p>}</div>)}</div>}</aside></div>
      <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setPrinting(editing)}>{t("print.preview")}</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>{t("common.close")}</button><button className="primary" disabled={saving||!editForm.reported_fault.trim()}>{saving?t("common.saving"):t("common.save")}</button></div></form></section></div>}

    {printing&&(()=>{const c=byId.get(printing.customer_id);return <div className="print-preview-backdrop"><div className="print-preview-shell"><div className="print-preview-toolbar"><strong>{t("print.preview")}</strong><div><button className="secondary" onClick={()=>setPrinting(null)}>{t("common.close")}</button><button className="primary" onClick={()=>window.print()}>{t("print.print")}</button></div></div><RepairPrintSheet data={{repairNumber:printing.repair_number,openedAt:new Date(printing.opened_at).toLocaleString(),customerName:printing.customer_name,phone:c?.phone||undefined,email:c?.email||undefined,deviceType:printing.device_type||undefined,brand:printing.brand||undefined,model:printing.model||undefined,serialNumber:printing.serial_number||undefined,imei:printing.imei||undefined,reportedFault:printing.reported_fault||undefined,accessories:printing.accessories||undefined,generalCondition:printing.general_condition||undefined,internalNotes:printing.internal_notes||undefined}} office={office}/></div></div>})()}
  </>;
}
