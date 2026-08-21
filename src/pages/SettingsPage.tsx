import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import LanguageDropdown from "../components/LanguageDropdown";
import { defaultOfficeSettings, getOfficeSettings, OfficeSettings, saveOfficeSettings } from "../data/settings";
import { getDatabase } from "../data/database";
import { listCustomers } from "../data/customers";
import { listRepairs } from "../data/repairs";
import { useI18n } from "../i18n/I18nProvider";
import { downloadApiFile, downloadTextFile, restoreApiBackup } from "../data/api";
import { isServerMode } from "../data/runtime";
import { exportPortableBackup, importPortableBackup, parsePortableBackup } from "../data/portable";

export default function SettingsPage(){
  const {t,locale,setLocale,locales}=useI18n();
  const [form,setForm]=useState<OfficeSettings>(defaultOfficeSettings);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const [backupRunning,setBackupRunning]=useState(false);
  const [backupPath,setBackupPath]=useState("");
  const [restoreRunning,setRestoreRunning]=useState(false);
  const [portableRunning,setPortableRunning]=useState<"export"|"restore"|"">("");
  const [portablePath,setPortablePath]=useState("");
  const [exportRunning,setExportRunning]=useState<"customers"|"repairs"|"">("");
  const [exportPath,setExportPath]=useState("");

  useEffect(()=>{getOfficeSettings().then(setForm).catch(()=>setError(t("common.databaseError")));},[]);
  const set=(key:keyof OfficeSettings,value:string)=>{setSaved(false);setForm(f=>({...f,[key]:value}));};

  function chooseLogo(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file) return;
    if(!file.type.startsWith("image/")){setError(t("settings.logoInvalid"));return;}
    if(file.size>2*1024*1024){setError(t("settings.logoTooLarge"));return;}
    const reader=new FileReader();
    reader.onload=()=>{set("logoDataUrl",String(reader.result||""));setError("");};
    reader.readAsDataURL(file);
    e.target.value="";
  }

  async function submit(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{await saveOfficeSettings(form);setSaved(true);}catch{setError(t("common.saveError"));}
    finally{setSaving(false);}
  }

  async function createNativeBackup(){
    if(isServerMode) return downloadApiFile("/backups/database");
      const db=await getDatabase();
      await db.execute("PRAGMA wal_checkpoint(FULL)");
    return invoke<string>("backup_database");
  }

  async function createBackup(){
    if(backupRunning) return;
    setBackupRunning(true);setBackupPath("");setError("");
    try{
      setBackupPath(await createNativeBackup());
    }catch(cause){
      console.error(cause);
      setError(t("settings.backupError"));
    }finally{
      setBackupRunning(false);
    }
  }

  async function createPortable(){
    if(portableRunning) return;
    setPortableRunning("export");setPortablePath("");setError("");
    try{setPortablePath(await exportPortableBackup());}
    catch(cause){console.error(cause);setError(t("settings.portableError"));}
    finally{setPortableRunning("");}
  }

  async function restorePortable(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value="";
    if(!file||portableRunning) return;
    if(!file.name.toLowerCase().endsWith(".dbrepairs")){setError(t("settings.portableInvalid"));return;}
    let archive;
    try{archive=parsePortableBackup(await file.text());}
    catch(cause){console.error(cause);setError(t("settings.portableInvalid"));return;}
    if(!window.confirm(t("settings.portableConfirm"))) return;
    setPortableRunning("restore");setError("");setPortablePath("");
    try{
      setBackupPath(await createNativeBackup());
      await importPortableBackup(archive);
      window.location.reload();
    }catch(cause){console.error(cause);setError(t("settings.portableRestoreError"));}
    finally{setPortableRunning("");}
  }

  async function restoreBackup(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    e.target.value="";
    if(!file||restoreRunning) return;
    const expectedExtension=isServerMode?".dump":".db";
    if(!file.name.toLowerCase().endsWith(expectedExtension)){setError(t(isServerMode?"settings.restoreServerInvalid":"settings.restoreInvalid"));return;}
    if(!window.confirm(t(isServerMode?"settings.restoreServerConfirm":"settings.restoreConfirm"))) return;
    setRestoreRunning(true);setError("");
    try{
      const buffer=await file.arrayBuffer();
      const bytes=new Uint8Array(buffer);
      if(isServerMode){
        const header=new TextDecoder("ascii").decode(bytes.slice(0,5));
        if(header!=="PGDMP"){setError(t("settings.restoreServerInvalid"));return;}
        await downloadApiFile("/backups/database");
        await restoreApiBackup(buffer);
        window.location.reload();
        return;
      }
      const header=new TextDecoder("utf-8").decode(bytes.slice(0,16));
      if(header!=="SQLite format 3\0"){setError(t("settings.restoreInvalid"));return;}
      const db=await getDatabase();
      await db.execute("PRAGMA wal_checkpoint(FULL)");
      await invoke("restore_database",{data:Array.from(bytes)});
    }catch(cause){console.error(cause);setError(t("settings.restoreError"));}
    finally{setRestoreRunning(false);}
  }

  const csvCell=(value:unknown)=>{
    const text=String(value??"");
    return `"${text.replace(/"/g,'""')}"`;
  };

  async function exportCustomers(){
    if(exportRunning) return;
    setExportRunning("customers");setExportPath("");setError("");
    try{
      const rows=await listCustomers();
      const header=["ID","Nome","Empresa","NIF","Telefone","Email","Morada","Notas","Criado","Atualizado"];
      const body=rows.map(c=>[
        c.id,c.name,c.company,c.tax_number,c.phone,c.email,c.address,c.notes,c.created_at,c.updated_at
      ].map(csvCell).join(";"));
      const csv="\ufeff"+header.map(csvCell).join(";")+"\n"+body.join("\n");
      if(isServerMode){downloadTextFile(csv,"DBRepairs-clientes.csv");setExportPath("DBRepairs-clientes.csv");return;}
      const path=await invoke<string>("export_text_file",{filename:"DBRepairs-clientes.csv",content:csv});
      setExportPath(path);
    }catch(cause){
      console.error(cause);
      setError(t("settings.exportError"));
    }finally{
      setExportRunning("");
    }
  }

  async function exportRepairs(){
    if(exportRunning) return;
    setExportRunning("repairs");setExportPath("");setError("");
    try{
      const rows=await listRepairs();
      const header=["ID","Reparação","Cliente","Estado","Tipo","Marca","Modelo","Serial","IMEI","Problema","Acessórios","Estado geral","Diagnóstico","Trabalho realizado","Valor previsto","Valor final","Notas internas","Entrada","Fecho"];
      const body=rows.map(r=>[
        r.id,r.repair_number,r.customer_name,t(r.status_label_key),r.device_type,r.brand,r.model,r.serial_number,r.imei,
        r.reported_fault,r.accessories,r.general_condition,r.diagnosis,r.work_performed,r.estimated_value,r.final_value,
        r.internal_notes,r.opened_at,r.closed_at
      ].map(csvCell).join(";"));
      const csv="\ufeff"+header.map(csvCell).join(";")+"\n"+body.join("\n");
      if(isServerMode){downloadTextFile(csv,"DBRepairs-reparacoes.csv");setExportPath("DBRepairs-reparacoes.csv");return;}
      const path=await invoke<string>("export_text_file",{filename:"DBRepairs-reparacoes.csv",content:csv});
      setExportPath(path);
    }catch(cause){
      console.error(cause);
      setError(t("settings.exportError"));
    }finally{
      setExportRunning("");
    }
  }

  return <>
    <header className="page-header"><div><h1>{t("settings.title")}</h1><p>{t("settings.subtitle")}</p></div></header>
    {error&&<div className="alert error settings-alert">{error}</div>}
    {saved&&<div className="alert success settings-alert">{t("settings.saved")}</div>}
    <form className="settings-stack" onSubmit={submit}>
      <section className="panel settings-panel">
        <h2>{t("settings.language")}</h2>
        <p>{t("settings.languageHint")}</p>
        <div className="settings-field"><LanguageDropdown locale={locale} setLocale={setLocale} locales={locales} label={t("settings.language")} searchLabel={t("settings.searchLanguage")}/></div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-head">
          <div><h2>{t("settings.backup")}</h2><p>{t("settings.backupHint")}</p></div>
          <div className="export-actions">
            <button type="button" className="secondary" disabled={backupRunning||restoreRunning} onClick={()=>void createBackup()}>
              {backupRunning?t("settings.backupRunning"):t("settings.createBackup")}
            </button>
            <label className={`secondary file-button ${restoreRunning?"disabled":""}`}>
              {restoreRunning?t("settings.restoreRunning"):t("settings.restoreBackup")}
              <input type="file" accept={isServerMode?".dump,application/octet-stream":".db,application/x-sqlite3,application/vnd.sqlite3"} disabled={backupRunning||restoreRunning} onChange={restoreBackup}/>
            </label>
          </div>
        </div>
        {backupPath&&<div className="backup-success"><strong>{t("settings.backupCreated")}</strong><code>{backupPath}</code></div>}
      </section>
      <section className="panel settings-panel portable-panel">
        <div className="panel-head">
          <div><h2>{t("settings.portableTitle")}</h2><p>{t("settings.portableHint")}</p></div>
          <div className="export-actions">
            <button type="button" className="secondary" disabled={Boolean(portableRunning)||backupRunning||restoreRunning} onClick={()=>void createPortable()}>
              {portableRunning==="export"?t("settings.portableExporting"):t("settings.portableCreate")}
            </button>
            <label className={`secondary file-button ${portableRunning?"disabled":""}`}>
              {portableRunning==="restore"?t("settings.portableRestoring"):t("settings.portableRestore")}
              <input type="file" accept=".dbrepairs,application/json" disabled={Boolean(portableRunning)||backupRunning||restoreRunning} onChange={restorePortable}/>
            </label>
          </div>
        </div>
        {portablePath&&<div className="backup-success"><strong>{t("settings.portableCreated")}</strong><code>{portablePath}</code></div>}
      </section>
      <section className="panel settings-panel">
        <div className="panel-head">
          <div><h2>{t("settings.export")}</h2><p>{t("settings.exportHint")}</p></div>
          <div className="export-actions">
            <button type="button" className="secondary" disabled={Boolean(exportRunning)} onClick={()=>void exportCustomers()}>
              {exportRunning==="customers"?t("settings.exportRunning"):t("settings.exportCustomers")}
            </button>
            <button type="button" className="secondary" disabled={Boolean(exportRunning)} onClick={()=>void exportRepairs()}>
              {exportRunning==="repairs"?t("settings.exportRunning"):t("settings.exportRepairs")}
            </button>
          </div>
        </div>
        {exportPath&&<div className="backup-success"><strong>{t("settings.exportCreated")}</strong><code>{exportPath}</code></div>}
      </section>
      <section className="panel settings-panel">
        <div className="panel-head"><div><h2>{t("settings.office")}</h2><p>{t("settings.officeHint")}</p></div></div>
        <div className="office-settings-grid">
          <div className="logo-setting">
            <div className="logo-preview">{form.logoDataUrl?<img src={form.logoDataUrl} alt=""/>:<img src="/dbrepairs-icon.png" alt=""/>}</div>
            <div className="logo-actions"><label className="secondary file-button">{t("settings.chooseLogo")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo}/></label>{form.logoDataUrl&&<button type="button" className="danger-link" onClick={()=>set("logoDataUrl","")}>{t("settings.removeLogo")}</button>}<small>{t("settings.logoHint")}</small></div>
          </div>
          <div className="form-grid">
            <label className="field full"><span>{t("settings.companyName")}</span><input value={form.companyName} onChange={e=>set("companyName",e.target.value)}/></label>
            <label className="field"><span>{t("settings.taxNumber")}</span><input value={form.taxNumber} onChange={e=>set("taxNumber",e.target.value)}/></label>
            <label className="field"><span>{t("settings.phone")}</span><input value={form.phone} onChange={e=>set("phone",e.target.value)}/></label>
            <label className="field full"><span>{t("settings.address")}</span><input value={form.address} onChange={e=>set("address",e.target.value)}/></label>
            <label className="field full"><span>{t("settings.email")}</span><input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></label>
          </div>
        </div>
        <div className="settings-actions"><button className="primary" disabled={saving}>{saving?t("common.saving"):t("common.save")}</button></div>
      </section>
    </form>
  </>;
}
