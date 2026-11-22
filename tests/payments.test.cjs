const { test } = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const { readFileSync } = require('node:fs')
const { DatabaseService } = require('../src/services/databaseService.js')

function fixture(cost = 50) {
  const service = Object.create(DatabaseService.prototype)
  service.db = new Database(':memory:')
  service.db.exec(readFileSync(require.resolve('../src/database/schema.sql'), 'utf8'))
  service.ensureToothTreatmentsTableExists()
  service.ensurePaymentsColumns()
  service.db.prepare("INSERT INTO patients (id,serial_number,full_name,gender,age) VALUES ('p','1','Test','male',30)").run()
  service.db.prepare("INSERT INTO tooth_treatments (id,patient_id,tooth_number,tooth_name,treatment_type,treatment_category,treatment_color,cost,priority) VALUES ('t','p',11,'11','test','test','#22c55e',?,1)").run(cost)
  service.db.pragma('foreign_keys = ON')
  return service
}
const payment = (amount, extra = {}) => ({patient_id:'p',tooth_treatment_id:'t',amount,payment_method:'cash',payment_date:'2026-11-18',status:'completed',...extra})

test('baseline: separate inserts keep 30 and 20 for a 50 treatment', async () => {
  const s = fixture()
  try {
    const first = await s.createPayment(payment(30))
    const second = await s.createPayment(payment(20))
    assert.notEqual(first.id, second.id)
    assert.deepEqual(s.db.prepare('SELECT amount FROM payments ORDER BY amount DESC').all().map(p=>p.amount), [30,20])
    const summary = await s.getToothTreatmentPaymentSummary('t')
    assert.equal(summary.totalPaid,50)
    assert.equal(summary.remainingBalance,0)
  } finally {s.db.close()}
})
test('baseline: editing 30 to 35 excludes the existing payment', async () => {
  const s = fixture()
  try {
    const first=await s.createPayment(payment(30))
    assert.equal((await s.updatePayment(first.id,{amount:35})).amount,35)
    await assert.rejects(s.createPayment(payment(16)), /exceeds/)
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get().n,1)
  } finally {s.db.close()}
})
module.exports = {fixture,payment}

test('30 + 20 never changes the first receipt or its historical fields', async () => {
  const s=fixture()
  try {
    const p=await s.createPayment(payment(30,{notes:'original',payment_date:'2026-11-01'}))
    const before=s.db.prepare('SELECT * FROM payments WHERE id=?').get(p.id)
    await s.createPayment(payment(20))
    assert.deepEqual(s.db.prepare('SELECT * FROM payments WHERE id=?').get(p.id),before)
    assert.equal((await s.getPaymentsByPatient('p')).find(r=>r.id===p.id).treatment_remaining_balance,0)
  } finally {s.db.close()}
})

test('edits use the other receipts only; deleting a receipt releases its balance', async()=>{
  const s=fixture()
  try {
    const a=await s.createPayment(payment(30)),b=await s.createPayment(payment(20))
    await assert.rejects(s.updatePayment(a.id,{amount:35}),/exceeds/)
    await s.updatePayment(b.id,{amount:15})
    await s.updatePayment(a.id,{amount:35})
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).totalPaid,50)
    await s.deletePayment(b.id)
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).remainingBalance,15)
  }finally{s.db.close()}
})

for(const status of ['cancelled','refunded','failed','pending','overdue']) test(`${status} stays excluded after new receipts`,async()=>{
  const s=fixture()
  try {
    const a=await s.createPayment(payment(30))
    await s.updatePayment(a.id,{status})
    await s.createPayment(payment(20))
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).totalPaid,20)
    assert.equal(s.db.prepare('SELECT status FROM payments WHERE id=?').get(a.id).status,status)
  }finally{s.db.close()}
})

test('discount and tax use the same net receipt in validation and every summary',async()=>{
  const s=fixture()
  try {
    await s.createPayment(payment(35,{discount_amount:10,tax_amount:5}))
    await s.createPayment(payment(20))
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).totalPaid,50)
    const {ReportsService}=require('../src/services/reportsService.js')
    const report=await new ReportsService().generateFinancialReport(await s.getAllPayments(),[],{dateRange:{start:'2026-11-01',end:'2026-11-30'}})
    assert.equal(report.totalRevenue,50)
    assert.equal(report.revenueByPaymentMethod[0].amount,50)
    assert.equal(report.revenueTrend[0].amount,50)
  }finally{s.db.close()}
})

test('minor-unit arithmetic: 0.10 and 0.20 settle 0.30',async()=>{
  const s=fixture(0.3)
  try {
    await s.createPayment(payment(0.1));await s.createPayment(payment(0.2))
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).totalPaid,0.3)
    const {ReportsService}=require('../src/services/reportsService.js')
    const report=await new ReportsService().generateFinancialReport(await s.getAllPayments(),[],{dateRange:{start:'2026-11-01',end:'2026-11-30'}})
    assert.equal(report.totalRevenue,0.3);assert.equal(report.revenueTrend[0].amount,0.3)
    await assert.rejects(s.createPayment(payment(0.01)),/exceeds/)
  }finally{s.db.close()}
})

for(const amount of [-1,NaN,Infinity,0.001,'30',null,undefined]) test(`reject malformed amount ${String(amount)}`,async()=>{
  const s=fixture()
  try{await assert.rejects(s.createPayment(payment(amount)));assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get().n,0)}finally{s.db.close()}
})

test('zero is allowed only as a pending compatibility placeholder',async()=>{
  const s=fixture()
  try{
    await assert.rejects(s.createPayment(payment(0)))
    const pending=await s.createPayment(payment(0,{status:'pending'}))
    await s.createPayment(payment(50))
    assert.equal(s.db.prepare('SELECT status FROM payments WHERE id=?').get(pending.id).status,'pending')
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).remainingBalance,0)
  }finally{s.db.close()}
})

test('record validation checks ownership, method, date and adjustments',async()=>{
  const s=fixture()
  try{
    for(const extra of [{patient_id:'missing'},{tooth_treatment_id:'missing'},{payment_method:'card'},{payment_date:'bad'},{discount_amount:40},{tax_amount:-1},{discount_amount:NaN}]) await assert.rejects(s.createPayment(payment(30,extra)))
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get().n,0)
  }finally{s.db.close()}
})

test('request keys make retries idempotent and reject changed payloads',async()=>{
  const s=fixture()
  try{
    const data=payment(20,{request_id:'retry-1'})
    const [a,b]=await Promise.all([s.createPayment(data),s.createPayment(data)])
    assert.equal(a.id,b.id)
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get().n,1)
    await assert.rejects(s.createPayment({...data,amount:21}),/different data/)
  }finally{s.db.close()}
})

test('two competing overpayments cannot both commit',async()=>{
  const s=fixture()
  try{
    const result=await Promise.allSettled([s.createPayment(payment(30)),s.createPayment(payment(30))])
    assert.equal(result.filter(r=>r.status==='fulfilled').length,1)
    assert.equal((await s.getToothTreatmentPaymentSummary('t')).totalPaid,30)
  }finally{s.db.close()}
})

const treatment=(extra={})=>({patient_id:'p',tooth_number:12,tooth_name:'12',treatment_type:'filling',treatment_category:'restorative',treatment_status:'planned',treatment_color:'#22c55e',cost:50,priority:0,...extra})
test('immediate payment creates a real linked receipt atomically and retries once',async()=>{
  const s=fixture()
  try{
    const data=treatment({tooth_numbers:[12,13],request_id:'full-1',immediate_payment:{payment_method:'bank_transfer',payment_date:'2026-11-18'}})
    const a=await s.createToothTreatment(data),b=await s.createToothTreatment(data)
    assert.equal(a.id,b.id)
    const p=s.db.prepare('SELECT * FROM payments WHERE id=?').get(a.immediate_payment_id)
    assert.equal(p.tooth_treatment_id,a.id);assert.equal(p.amount,50);assert.equal(p.payment_method,'bank_transfer')
    assert.equal(p.payment_date,'2026-11-18');assert.equal(a.tooth_numbers,'12,13')
    assert.equal((await s.getToothTreatmentPaymentSummary(a.id)).remainingBalance,0)
    assert.equal((await s.getPaymentsByPatient('p')).length,1)
    await assert.rejects(s.createToothTreatment({...data,immediate_payment:{payment_method:'cash'}}),/different data/)
  }finally{s.db.close()}
})
test('failure inserting immediate receipt rolls back the treatment and request journal',async()=>{
  const s=fixture()
  try{
    s.db.exec("CREATE TRIGGER reject_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT,'simulated failure'); END")
    await assert.rejects(s.createToothTreatment(treatment({request_id:'failed-full',immediate_payment:{payment_method:'cash'}})),/simulated failure/)
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tooth_treatments').get().n,1)
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get().n,0)
    s.db.exec('DROP TRIGGER reject_payment')
    const created=await s.createToothTreatment(treatment({request_id:'failed-full',immediate_payment:{payment_method:'cash'}}))
    assert.ok(created.immediate_payment_id)
  }finally{s.db.close()}
})
test('ordinary treatment creation produces no immediate receipt',async()=>{
  const s=fixture()
  try{const created=await s.createToothTreatment(treatment());assert.ok(created.id);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments').get().n,0)}finally{s.db.close()}
})
test('invalid immediate costs never create a treatment',async()=>{
  const s=fixture()
  try{
    for(const cost of [0,-5,NaN,Infinity,1.001]) await assert.rejects(s.createToothTreatment(treatment({cost,immediate_payment:{payment_method:'cash'}})))
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tooth_treatments').get().n,1)
  }finally{s.db.close()}
})
test('comprehensive receipt preserves placeholders, distributes net adjustments once, and retries',async()=>{
  const s=fixture()
  try{
    const pending=await s.createPayment(payment(0,{status:'pending'}))
    await s.createToothTreatment(treatment({cost:25}))
    const data={request_id:'comprehensive-1',payment_method:'cash',payment_date:'2026-11-18',discount_amount:10,tax_amount:5}
    const a=await s.createComprehensivePayment('p',80,data),b=await s.createComprehensivePayment('p',80,data)
    assert.equal(a.batchId,b.batchId);assert.equal(a.totalAmount,75)
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM payments WHERE id=?').get(pending.id).n,1)
    const sums=s.db.prepare('SELECT SUM(amount) amount,SUM(total_amount) total,SUM(discount_amount) discount,SUM(tax_amount) tax FROM payments').get()
    assert.deepEqual(sums,{amount:80,total:75,discount:10,tax:5})
    await assert.rejects(s.createComprehensivePayment('p',1,{...data,request_id:'comp-over'}))
  }finally{s.db.close()}
})

test('editing a payment failure rolls back the current receipt',async()=>{
  const s=fixture()
  try{
    const a=await s.createPayment(payment(20))
    s.db.exec("CREATE TRIGGER reject_update BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'simulated update failure'); END")
    await assert.rejects(s.updatePayment(a.id,{amount:25}),/simulated update failure/)
    assert.equal(s.db.prepare('SELECT amount FROM payments WHERE id=?').get(a.id).amount,20)
  }finally{s.db.close()}
})

test('reordering treatments preserves every linked receipt and identifier',async()=>{
  const s=fixture()
  try{
    const receipt=await s.createPayment(payment(20))
    const other=await s.createToothTreatment(treatment({tooth_number:11}))
    await s.reorderToothTreatments('p',11,[other.id,'t'])
    assert.equal(s.db.prepare('SELECT tooth_treatment_id FROM payments WHERE id=?').get(receipt.id).tooth_treatment_id,'t')
    assert.equal(s.db.prepare('SELECT priority FROM tooth_treatments WHERE id=?').get('t').priority,2)
    await assert.rejects(s.reorderToothTreatments('p',11,['t','missing']))
    assert.equal(s.db.prepare('SELECT priority FROM tooth_treatments WHERE id=?').get('t').priority,2)
  }finally{s.db.close()}
})
test('cost edits update live balances without rewriting receipts, and reject costs below collected amounts',async()=>{
  const s=fixture()
  try{
    const p=await s.createPayment(payment(30,{notes:'keep'}))
    const before=s.db.prepare('SELECT * FROM payments WHERE id=?').get(p.id)
    await s.updateToothTreatment('t',{cost:60,notes:'new treatment note'})
    assert.deepEqual(s.db.prepare('SELECT * FROM payments WHERE id=?').get(p.id),before)
    assert.equal((await s.getPaymentsByPatient('p'))[0].remaining_balance,30)
    await assert.rejects(s.updateToothTreatment('t',{cost:29}))
    assert.equal(s.db.prepare('SELECT cost FROM tooth_treatments WHERE id=?').get('t').cost,60)
  }finally{s.db.close()}
})
test('remaining-balance cards group all receipts once and remove fully settled debt',async()=>{
  const s=fixture()
  try{
    await s.createPayment(payment(0,{status:'pending'}))
    await s.createPayment(payment(30))
    const partial=await s.getRemainingBalancePatients()
    assert.equal(partial.length,1);assert.equal(partial[0].amount_paid,30);assert.equal(partial[0].remaining_balance,20)
    assert.equal((await s.getUnpaidToothTreatmentsByPatient('p'))[0].remaining_balance,20)
    await s.createPayment(payment(20))
    assert.equal((await s.getRemainingBalancePatients()).length,0)
    assert.equal((await s.getUnpaidToothTreatmentsByPatient('p')).length,0)
  }finally{s.db.close()}
})
test('real independent SQLite connections serialize competing payments and repeated request keys',async()=>{
  const {Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
  const s=fixture(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-payment-race-')),file=path.join(directory,'race.db')
  const race=async(requestIds)=>{
    const barrier=new SharedArrayBuffer(4),arr=new Int32Array(barrier)
    let ready=0
    return Promise.all(requestIds.map(requestId=>new Promise((resolve,reject)=>{
      const worker=new Worker(path.join(__dirname,'payment-concurrency-worker.cjs'),{workerData:{file,barrier,requestId}})
      worker.on('error',reject)
      worker.on('message',message=>{if(message.ready){if(++ready===2){Atomics.store(arr,0,1);Atomics.notify(arr,0)}}else resolve(message)})
    })))
  }
  try{
    await s.db.backup(file)
    const results=await race(['race-a','race-b'])
    assert.equal(results.filter(r=>r.ok).length,1)
    assert.match(results.find(r=>!r.ok).error,/exceeds/)
    const disk=new Database(file)
    disk.exec('DELETE FROM payments; DELETE FROM financial_requests')
    disk.close()
    const retries=await race(['same-request','same-request'])
    assert.ok(retries.every(r=>r.ok));assert.equal(retries[0].id,retries[1].id)
    const check=new Database(file,{readonly:true})
    assert.equal(check.prepare('SELECT COUNT(*) n FROM payments').get().n,1)
    assert.equal(check.pragma('integrity_check',{simple:true}),'ok')
    check.close()
  }finally{s.db.close()}
})

test('patients, appointments, dashboard, settings and backup still work around financial changes',async()=>{
  const s=fixture()
  try{
    await s.updatePatient('p',{full_name:'Updated Test'})
    assert.equal((await s.getPatientById('p')).full_name,'Updated Test')
    const a=await s.createAppointment({patient_id:'p',title:'Test visit',start_time:'2026-11-18T10:00:00',end_time:'2026-11-18T10:30:00',status:'scheduled',cost:50})
    await s.createPayment(payment(30,{tooth_treatment_id:null,appointment_id:a.id}))
    const summary=await require('../src/services/paymentRepository.cjs').PaymentRepository.prototype.getAppointmentPaymentSummary.call(s,a.id)
    assert.equal(summary.remainingBalance,20)
    await s.updateAppointment(a.id,{title:'Updated visit'})
    assert.equal((await s.getAppointmentsByPatient('p')).find(r=>r.id===a.id).title,'Updated visit')
    await s.createPayment(payment(20))
    assert.equal((await s.getDashboardStats()).total_revenue,50)
    const settings=await s.getSettings()
    await s.updateSettings({...settings,clinic_name:'Regression clinic'})
    assert.equal((await s.getSettings()).clinic_name,'Regression clinic')
  }finally{s.db.close()}
})

