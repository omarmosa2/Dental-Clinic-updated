const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os')
const mode=process.argv[2]
if(!mode) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-typecheck-'))
  for(const run of ['baseline','current']) {
    const result=cp.spawnSync(process.execPath,['--max-old-space-size=6144',__filename,run,path.join(dir,run+'.json')],{stdio:'inherit',windowsHide:true})
    if(result.status!==0)process.exit(result.status??1)
  }
  const baseline=JSON.parse(fs.readFileSync(path.join(dir,'baseline.json'))),current=JSON.parse(fs.readFileSync(path.join(dir,'current.json')))
  const counts=new Map()
  for(const d of baseline)counts.set(d.key,(counts.get(d.key)||0)+1)
  const added=current.filter(d=>{const n=counts.get(d.key)||0;if(n){counts.set(d.key,n-1);return false}return true})
  const result={baselineErrors:baseline.length,currentErrors:current.length,newErrors:added}
  fs.mkdirSync('docs/financial-verification',{recursive:true})
  fs.writeFileSync('docs/financial-verification/typecheck-comparison.json',JSON.stringify(result,null,2))
  console.log(JSON.stringify(result,null,2))
  process.exit(added.length?1:0)
}
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile)
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd())
const host=ts.createCompilerHost(parsed.options)
const originals=new Map()
const normalize=p=>path.resolve(p).toLowerCase()
let roots=parsed.fileNames
if(mode==='baseline') {
  const tracked=cp.execFileSync('git',['ls-files','*.ts','*.tsx'],{encoding:'utf8'}).trim().split('\n')
  const trackedSet=new Set(tracked.map(normalize))
  roots=roots.filter(f=>trackedSet.has(normalize(f)))
  const changed=cp.execFileSync('git',['diff','--name-only','--','*.ts','*.tsx'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
  for(const file of changed)originals.set(normalize(file),cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'}))
}
const readFile=host.readFile
host.readFile=file=>originals.get(normalize(file))??readFile(file)
host.getSourceFile=(file,languageVersion)=>{const text=host.readFile(file);return text===undefined?undefined:ts.createSourceFile(file,text,languageVersion,true)}
const program=ts.createProgram(roots,parsed.options,host)
const errors=ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>{
  const file=d.file?path.relative(process.cwd(),d.file.fileName).replaceAll('\\','/'):''
  const message=ts.flattenDiagnosticMessageText(d.messageText,'\n')
  return {file,code:d.code,message,key:`${file}:${d.code}:${message.replace(/does not exist on type[\s\S]*/,"does not exist on type")}`}
})
fs.writeFileSync(process.argv[3],JSON.stringify(errors))
console.log(mode,errors.length,'TypeScript errors')
