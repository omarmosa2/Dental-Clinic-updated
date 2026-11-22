import React from 'react'
import { createRoot } from 'react-dom/client'
import FullPaymentButton from '../src/components/payments/FullPaymentButton'
import { useFinancialRequest } from '../src/hooks/useFinancialRequest'
declare global { interface Window { harness: any } }
window.harness={calls:0,mode:'success',amount:50,resolve:null}
const root=createRoot(document.getElementById('root')!)
function Harness({amount}: {amount:number}) {
  window.harness.keyFor = useFinancialRequest()
  return <FullPaymentButton amount={amount} onConfirm={async method=>{
  window.harness.calls++
  window.harness.method=method
  if(window.harness.mode==='fail')throw new Error('فشل تجريبي')
  if(window.harness.mode==='pending')await new Promise(resolve=>window.harness.resolve=resolve)
}} />
}
window.harness.render=(amount=50)=>root.render(<Harness amount={amount} />)
window.harness.render()
