import { jsPDF } from "jspdf";
import type { RepairPrintData } from "../components/RepairPrintSheet";
import type { OfficeSettings } from "../data/settings";

type Translate = (key:string)=>string;

const pageWidth=210;
const marginX=9;
const contentWidth=pageWidth-(marginX*2);
const copyHeight=137;

function clean(value?:string){ return value?.trim()||"—"; }

function imageFormat(dataUrl:string){
  if(dataUrl.startsWith("data:image/png")) return "PNG";
  if(dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function defaultLogoDataUrl(){
  try {
    const response=await fetch("/dbrepairs-icon.png");
    if(!response.ok) return undefined;
    const blob=await response.blob();
    return await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch { return undefined; }
}

function limitedLines(doc:jsPDF,value:string,width:number,maxLines:number){
  return (doc.splitTextToSize(clean(value),width) as string[]).slice(0,maxLines);
}

function drawLabel(doc:jsPDF,label:string,x:number,y:number){
  doc.setFont("helvetica","normal");
  doc.setFontSize(6.7);
  doc.setTextColor(90);
  doc.text(label.toUpperCase(),x,y);
}

function drawValue(doc:jsPDF,value:string,x:number,y:number,width:number,maxLines=2){
  doc.setFont("helvetica","bold");
  doc.setFontSize(8.4);
  doc.setTextColor(17);
  doc.text(limitedLines(doc,value,width,maxLines),x,y,{lineHeightFactor:1.1});
}

function drawField(doc:jsPDF,label:string,value:string,x:number,y:number,width:number,height:number){
  doc.setDrawColor(195);
  doc.setLineWidth(.25);
  doc.rect(x,y,width,height);
  drawLabel(doc,label,x+2.5,y+3.8);
  drawValue(doc,value,x+2.5,y+7.6,width-5,2);
}

function drawTextRow(doc:jsPDF,label:string,value:string,x:number,y:number,width:number,height:number,maxLines=2,shade=false){
  if(shade){ doc.setFillColor(249,249,249); doc.rect(x,y,width,height,"F"); }
  doc.setDrawColor(185);
  doc.setLineWidth(.25);
  doc.rect(x,y,width,height);
  drawLabel(doc,label,x+2.5,y+3.8);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8.1);
  doc.setTextColor(17);
  doc.text(limitedLines(doc,value,width-5,maxLines),x+2.5,y+7.4,{lineHeightFactor:1.12});
}

function drawCopy(doc:jsPDF,data:RepairPrintData,office:OfficeSettings|undefined,t:Translate,y:number,title:string,shopCopy:boolean,logo?:string){
  const company=office?.companyName?.trim()||"DBRepairs";
  const contact=[office?.address,office?.phone,office?.email,office?.taxNumber?`${t("settings.taxNumber")}: ${office.taxNumber}`:""].filter(Boolean).join(" · ");
  const device=[data.deviceType,data.brand,data.model].filter(Boolean).join(" · ")||"—";
  const serial=data.imei||data.serialNumber||"—";
  const right=marginX+contentWidth;

  if(logo){
    try { doc.addImage(logo,imageFormat(logo),marginX,y,11,11,undefined,"FAST"); } catch { /* The PDF remains usable without a logo. */ }
  }
  const brandX=marginX+(logo?14:0);
  doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor(17);
  doc.text(company,brandX,y+4.8);
  doc.setFont("helvetica","normal"); doc.setFontSize(6.6); doc.setTextColor(75);
  if(contact) doc.text(limitedLines(doc,contact,125,2),brandX,y+8,{lineHeightFactor:1.1});
  doc.setFontSize(7); doc.setTextColor(70); doc.text(title,brandX,y+12.8);

  drawLabel(doc,t("print.repairNumber"),right-38,y+3.4);
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(17);
  doc.text(data.repairNumber,right,y+8.2,{align:"right"});
  doc.setDrawColor(25); doc.setLineWidth(.45); doc.line(marginX,y+16,right,y+16);

  const fieldY=y+19;
  const col=contentWidth/2;
  const rowH=10.5;
  drawField(doc,t("customer.name"),data.customerName,marginX,fieldY,col,rowH);
  drawField(doc,t("repair.openedAt"),data.openedAt,marginX+col,fieldY,col,rowH);
  drawField(doc,t("customer.phone"),clean(data.phone),marginX,fieldY+rowH,col,rowH);
  drawField(doc,t("repair.device"),device,marginX+col,fieldY+rowH,col,rowH);
  drawField(doc,t("customer.email"),clean(data.email),marginX,fieldY+(rowH*2),col,rowH);
  drawField(doc,t("repair.serialOrImei"),serial,marginX+col,fieldY+(rowH*2),col,rowH);

  let rowY=fieldY+(rowH*3)+3;
  drawTextRow(doc,t("repair.reportedFault"),clean(data.reportedFault),marginX,rowY,contentWidth,13,2);
  rowY+=15;
  drawTextRow(doc,t("repair.accessories"),clean(data.accessories),marginX,rowY,contentWidth,11,2);
  rowY+=13;
  drawTextRow(doc,t("repair.generalCondition"),clean(data.generalCondition),marginX,rowY,contentWidth,11,2);
  rowY+=13;
  if(shopCopy) drawTextRow(doc,t("repair.internalNotes"),clean(data.internalNotes),marginX,rowY,contentWidth,11,2,true);

  const signatureY=y+copyHeight-10;
  const signatureWidth=(contentWidth-14)/2;
  doc.setDrawColor(115); doc.setLineWidth(.25);
  doc.line(marginX,signatureY,marginX+signatureWidth,signatureY);
  doc.line(right-signatureWidth,signatureY,right,signatureY);
  doc.setFont("helvetica","normal"); doc.setFontSize(6.7); doc.setTextColor(90);
  doc.text(t("print.customerSignature").toUpperCase(),marginX+(signatureWidth/2),signatureY+3.3,{align:"center"});
  doc.text(t("print.shopSignature").toUpperCase(),right-(signatureWidth/2),signatureY+3.3,{align:"center"});
}

export async function buildRepairPdf(data:RepairPrintData,office:OfficeSettings|undefined,t:Translate){
  const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  doc.setProperties({title:`${t("print.repairNumber")} ${data.repairNumber}`,creator:"DBRepairs"});
  const logo=office?.logoDataUrl||await defaultLogoDataUrl();
  drawCopy(doc,data,office,t,7,t("print.shopCopy"),true,logo);

  doc.setDrawColor(130); doc.setLineWidth(.25); doc.setLineDashPattern([2,1.5],0);
  doc.line(marginX,146.5,marginX+contentWidth,146.5);
  doc.setLineDashPattern([],0);
  doc.setFont("helvetica","normal"); doc.setFontSize(6.8); doc.setTextColor(100);
  doc.text(t("print.cutHere"),pageWidth/2,149.2,{align:"center"});
  doc.setLineDashPattern([2,1.5],0); doc.line(marginX,151.5,marginX+contentWidth,151.5); doc.setLineDashPattern([],0);

  drawCopy(doc,data,office,t,153,t("print.customerCopy"),false,logo);
  return doc;
}

export async function downloadRepairPdf(data:RepairPrintData,office:OfficeSettings|undefined,t:Translate){
  const doc=await buildRepairPdf(data,office,t);
  const safeNumber=data.repairNumber.replace(/[^a-zA-Z0-9_-]+/g,"-");
  doc.save(`DBRepairs-${safeNumber}.pdf`);
}
