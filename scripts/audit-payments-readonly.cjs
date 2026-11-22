// Never instantiate DatabaseService here: its constructor runs migrations.
const Database = require('better-sqlite3')
const path = require('node:path')
const file = process.argv[2]
if (!file) throw new Error('Supply the database path')
const db = new Database(path.resolve(file), {readonly:true, fileMustExist:true})
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t=>t.name)
const result = { integrity:db.pragma('quick_check'), tables:{}, issues:{} }
result.issues.foreignKeyViolations = db.pragma('foreign_key_check')
for (const table of ['patients','tooth_treatments','appointments','payments']) {
  if (tables.includes(table)) result.tables[table] = {count:db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, columns:db.pragma(`table_info(${table})`).map(c=>({name:c.name,type:c.type})), foreignKeys:db.pragma(`foreign_key_list(${table})`)}
}
if (tables.includes('payments')) {
  result.issues.nonRevenueNonzero = db.prepare("SELECT COUNT(*) n FROM payments WHERE status NOT IN ('completed','partial','paid') AND amount > 0").get().n
  result.issues.negativeAmounts = db.prepare('SELECT COUNT(*) n FROM payments WHERE amount < 0 OR total_amount < 0').get().n
  result.issues.orphanTreatments = db.prepare('SELECT COUNT(*) n FROM payments p LEFT JOIN tooth_treatments t ON t.id=p.tooth_treatment_id WHERE p.tooth_treatment_id IS NOT NULL AND t.id IS NULL').get().n
  result.issues.orphanPatients = db.prepare('SELECT COUNT(*) n FROM payments p LEFT JOIN patients t ON t.id=p.patient_id WHERE t.id IS NULL').get().n
  result.issues.crossPatientTreatmentLinks = db.prepare('SELECT COUNT(*) n FROM payments p JOIN tooth_treatments t ON t.id=p.tooth_treatment_id WHERE p.patient_id != t.patient_id').get().n
  result.issues.crossPatientAppointmentLinks = db.prepare('SELECT COUNT(*) n FROM payments p JOIN appointments a ON a.id=p.appointment_id WHERE p.patient_id != a.patient_id').get().n
  result.issues.overpaidTreatments = db.prepare("SELECT COUNT(*) n FROM (SELECT t.id FROM tooth_treatments t JOIN payments p ON p.tooth_treatment_id=t.id WHERE p.status IN ('completed','partial','paid') GROUP BY t.id HAVING ROUND(SUM(COALESCE(p.total_amount,p.amount)),2)>ROUND(t.cost,2))").get().n
}
db.close()
console.log(JSON.stringify(result,null,2))
