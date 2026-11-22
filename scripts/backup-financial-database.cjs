const Database=require('better-sqlite3')
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto')
async function main() {
  const [source,target]=process.argv.slice(2)
  if(!source||!target)throw new Error('Supply source database and a new backup destination')
  if(fs.existsSync(target))throw new Error('Backup destination already exists')
  const db=new Database(path.resolve(source),{readonly:true,fileMustExist:true})
  try {await db.backup(path.resolve(target))} finally {db.close()}
  const backup=new Database(path.resolve(target),{readonly:true,fileMustExist:true})
  try {
    const integrity=backup.pragma('integrity_check',{simple:true})
    if(integrity!=='ok')throw new Error('Backup integrity check failed: '+integrity)
    console.log(JSON.stringify({backup:path.resolve(target),integrity,sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')},null,2))
  }finally{backup.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
