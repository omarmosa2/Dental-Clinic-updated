const Database=require('better-sqlite3'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const [source,backup]=process.argv.slice(2)
if(!source||!backup)throw new Error('Supply source and backup paths')
const restored=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'clinic-backup-restore-')),'restored.db')
fs.copyFileSync(backup,restored)
const live=new Database(source,{readonly:true,fileMustExist:true}),copy=new Database(restored)
const hash=(db,table)=>crypto.createHash('sha256').update(JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all())).digest('hex')
try {
  const matches=Object.fromEntries(['patients','tooth_treatments','appointments','payments'].map(t=>[t,hash(live,t)===hash(copy,t)]))
  const integrity=copy.pragma('integrity_check',{simple:true})
  if(integrity!=='ok'||Object.values(matches).some(v=>!v))throw new Error('Restored backup does not match the source')
  console.log(JSON.stringify({integrity,unchangedTables:matches,restoredCopyOpened:true},null,2))
}finally{live.close();copy.close();fs.unlinkSync(restored)}
