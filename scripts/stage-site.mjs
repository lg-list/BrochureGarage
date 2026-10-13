import { readdir, mkdir, copyFile, cp, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const destination = path.resolve(root,".site-build");
if (destination !== path.join(root,".site-build")) throw new Error("Unexpected staging path");
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
const directories=new Set(["assets","brands","models","history","research"]);
for (const entry of await readdir(root,{withFileTypes:true})) {
  if (entry.isDirectory() && directories.has(entry.name)) await cp(path.join(root,entry.name),path.join(destination,entry.name),{recursive:true});
  else if (entry.isFile() && (/\.(html|css|js|xml)$/.test(entry.name) || ["favicon.ico","CNAME","_redirects","ads.txt","robots.txt","llms.txt","llms-full.txt","ai-index.json"].includes(entry.name) || /^[a-f0-9]{32}\.txt$/.test(entry.name))) {
    await copyFile(path.join(root,entry.name),path.join(destination,entry.name));
  }
}
await mkdir(path.join(destination,"data"));
for (const filename of ["verified-brochures.json","logo-sources.json"]) await copyFile(path.join(root,"data",filename),path.join(destination,"data",filename));
console.log("Public pages staged in .site-build; internal audits, scripts and PDF files excluded.");
