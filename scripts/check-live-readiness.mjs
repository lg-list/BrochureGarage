import { readFile, writeFile } from "node:fs/promises";
const site="https://carbrochurearchive.com";
const records=JSON.parse(await readFile("data/brochures.json","utf8"));
const policy=JSON.parse(await readFile("data/adsense-policy.json","utf8"));
const pdfBase="https://pub-b4d0d3d7cb284abc8a79724880c09cb7.r2.dev/pdfs/";
const checks=[];
const publicPages=["/","/brands/honda/","/models/bmw/bmw-m6/","/history/bmw/","/archive-methodology.html","/brochure-finder.html","/research/honda-crv-2016-vs-2018/","/ads.txt","/sitemap.xml"];
async function pageCheck(path) {
  const url=site+path;
  try {
    const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(20000)});
    const text=await res.text();
    const ad=text.includes("pagead/js/adsbygoogle.js");
    const shouldHaveAds=policy.allowedPages.includes(path.slice(1));
    const version=path === "/" ? text.includes("2016 vs 2018 Honda CR-V") : path === "/history/bmw/" ? text.includes("Historical Brochure Sources") : path === "/models/bmw/bmw-m6/" ? text.includes("Collection coverage") : true;
    const passed=res.status===200 && (path.endsWith(".txt") || path.endsWith(".xml") || (ad===shouldHaveAds && version));
    return {type:"page",url,status:res.status,ads:ad,expectedAds:shouldHaveAds,newContent:version,passed};
  } catch(error) {return {type:"page",url,passed:false,error:error.message};}
}
async function pdfCheck(brand,entry) {
  const url=pdfBase+encodeURI(`${brand}/${entry.file}`);
  try {
    const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0",Range:"bytes=0-1023"},signal:AbortSignal.timeout(20000)});
    const reader=res.body.getReader();const first=await reader.read();await reader.cancel();
    const isPdf=first.value && Buffer.from(first.value).subarray(0,1024).toString("latin1").includes("%PDF-");
    return {type:"pdf",url,status:res.status,contentType:res.headers.get("content-type"),pdfHeader:Boolean(isPdf),passed:[200,206].includes(res.status)&&Boolean(isPdf)};
  }catch(error){return {type:"pdf",url,passed:false,error:error.message};}
}
const work=process.argv.includes("--pdf-samples")
  ? Object.entries(records).filter(([,entries])=>entries.length).map(([brand,entries])=>()=>pdfCheck(brand,entries[0]))
  : publicPages.map(p=>()=>pageCheck(p));
let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<work.length){const index=next++;checks[index]=await work[index]();}}));
const report={checkedOn:"2026-10-13",scope:process.argv.includes("--pdf-samples")?"One PDF per populated brand; not a full audit of all 3344 files":"Representative public HTML and infrastructure pages",passed:checks.every(c=>c.passed),checks};
await writeFile(process.argv.includes("--pdf-samples")?"seo/pdf-sample-check.json":"seo/live-readiness.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({scope:report.scope,passed:report.passed,checked:checks.length,failures:checks.filter(c=>!c.passed)},null,2));
if (!report.passed) process.exitCode=1;
