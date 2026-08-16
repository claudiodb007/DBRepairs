import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import LanguageDropdown from "../components/LanguageDropdown";
import { defaultOfficeSettings, getOfficeSettings, OfficeSettings, saveOfficeSettings } from "../data/settings";
import { getDatabase } from "../data/database";
import { useI18n } from "../i18n/I18nProvider";

export default function SettingsPage(){
  const {t,locale,setLocale,locales}=useI18n();
  const [form,setForm]=useState<OfficeSettings>(defaultOfficeSettings);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const [backupRunning,setBackupRunning]=useState(false);
  const [backupPath,setBackupPath]=useState("");

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

  async function createBackup(){
    if(backupRunning) return;
    setBackupRunning(true);setBackupPath("");setError("");
    try{
      const db=await getDatabase();
      await db.execute("PRAGMA wal_checkpoint(FULL)");
      const path=await invoke<string>("backup_database");
      setBackupPath(path);
    }catch(cause){
      console.error(cause);
      setError(t("settings.backupError"));
    }finally{
      setBackupRunning(false);
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
          <button type="button" className="secondary" disabled={backupRunning} onClick={()=>void createBackup()}>
            {backupRunning?t("settings.backupRunning"):t("settings.createBackup")}
          </button>
        </div>
        {backupPath&&<div className="backup-success"><strong>{t("settings.backupCreated")}</strong><code>{backupPath}</code></div>}
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
