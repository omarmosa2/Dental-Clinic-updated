const { test }=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const esbuild=require('esbuild')
const output=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-financial-unit-'))
function bundle(file) {
  const result=path.join(output,path.basename(file)+'.cjs')
  esbuild.buildSync({entryPoints:[file],outfile:result,bundle:true,platform:'node',format:'cjs',logLevel:'silent'})
  return require(result)
}
const calc=bundle('src/utils/paymentCalculations.ts')
const {FinancialValidator}=bundle('src/utils/financialValidation.ts')
const {PendingPaymentsService}=bundle('src/services/pendingPaymentsService.ts')
const {ExportValidation}=bundle('src/utils/exportValidation.ts')
const {ComprehensiveExportService}=bundle('src/services/comprehensiveExportService.ts')
const core=bundle('src/services/paymentCore.mjs')
const payments=[
  {id:'1',patient_id:'p',tooth_treatment_id:'t',amount:35,discount_amount:10,tax_amount:5,total_amount:30,status:'partial',treatment_total_cost:50,amount_paid:30,payment_date:'2026-11-18'},
  {id:'2',patient_id:'p',tooth_treatment_id:'t',amount:20,total_amount:20,status:'completed',treatment_total_cost:50,amount_paid:50,payment_date:'2026-11-18'},
  {id:'3',patient_id:'p',tooth_treatment_id:'t',amount:20,status:'refunded',payment_date:'2026-11-18'}
]
test('frontend summary agrees with net backend revenue without cumulative double counting',()=>{
  const summary=calc.calculatePatientPaymentSummary('p',payments,[],[{id:'t',patient_id:'p',cost:50}])
  assert.equal(summary.totalPaid,50);assert.equal(summary.totalDue,50);assert.equal(summary.totalRemaining,0)
  assert.equal(calc.calculateTreatmentTotalPaid('t',payments),50)
  assert.equal(FinancialValidator.validatePayments(payments).calculations.totalRevenue,50)
})
test('appointment summary excludes rejected payments and dual-linked treatment receipts',()=>{
  const list=payments.map(p=>({...p,appointment_id:'a'}))
  list.push({id:'4',patient_id:'p',appointment_id:'a',amount:10,status:'paid'})
  const detail=calc.calculateAppointmentPaymentDetails('a',50,list)
  assert.equal(detail.totalPaid,10);assert.equal(detail.remainingBalance,40);assert.equal(detail.status,'partial')
  assert.equal(calc.calculateAppointmentPaymentStatus('a',0,[]),'pending')
})
test('unpaid treatments with no payment rows still contribute to patient debt',()=>{
  const summary=calc.calculatePatientPaymentSummary('p',[],[],[{id:'t',patient_id:'p',cost:50}])
  assert.equal(summary.totalRemaining,50)
})
test('frontend validation rejects nonfinite, zero, excessive and overprecision amounts',()=>{
  for(const amount of [NaN,Infinity,0,-1,0.001,51])assert.equal(calc.validateNewPaymentAmount('a',50,amount,[]).isValid,false)
  assert.equal(calc.validateNewPaymentAmount('a',50,35,[]).isValid,true)
})
test('fully paid pending placeholders never appear as new debt on pending invoices',async()=>{
  const list=[...payments,{id:'0',patient_id:'p',tooth_treatment_id:'t',amount:0,status:'pending',treatment_total_cost:50,treatment_remaining_balance:50,payment_date:'2026-11-18'}]
  const filter={date_range:'custom',custom_start_date:'2026-11-01',custom_end_date:'2026-11-30'}
  assert.equal((await PendingPaymentsService.getPatientPendingPayments('p',filter,list,[],[{id:'t',patient_id:'p',cost:50}])).length,0)
  const pending=await PendingPaymentsService.getPatientPendingPayments('p',filter,list.filter(p=>p.id!=='2'),[],[{id:'t',patient_id:'p',cost:50}])
  assert.equal(pending.length,1);assert.equal(pending[0].amount,20)
})
test('export totals and grouped balances agree, including settled zero placeholders',()=>{
  const list=payments.map(p=>({...p,patient_id:'p',payment_method:'cash',payment_date:'2026-11-18'}))
  list.push({id:'0',patient_id:'p',tooth_treatment_id:'t',amount:0,status:'pending',treatment_total_cost:50,payment_date:'2026-11-18'})
  const validation=ExportValidation.validatePaymentCalculations(list)
  assert.equal(validation.totalRevenue,50);assert.equal(validation.pendingAmount,0)
  const exported=ComprehensiveExportService.calculateFinancialStats(list,[],[],[],[])
  assert.equal(exported.totalRevenue,50);assert.equal(exported.remainingBalances,0);assert.equal(exported.pendingAmount,0)
  const partial=ComprehensiveExportService.calculateFinancialStats(list.filter(p=>p.id!=='2'),[],[],[],[])
  assert.equal(partial.totalRevenue,30);assert.equal(partial.remainingBalances,20);assert.equal(partial.pendingAmount,20)
})
test('both payment forms preview the same net value, excluding cancelled receipts',()=>{
  assert.deepEqual(core.previewPayment({cost:50,previousPaid:20,amount:35,discount:10,tax:5}),{totalAmount:30,totalPaid:50,remainingBalance:0,status:'completed'})
  assert.equal(core.previewPayment({cost:50,previousPaid:20,amount:35,countsAsPaid:false}).totalPaid,20)
  assert.equal(core.previewPayment({amount:Infinity}).totalAmount,0)
})
