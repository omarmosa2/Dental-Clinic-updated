export function cents(value: unknown): number
export function money(value: unknown): number
export function balance(cost: unknown, paid: unknown): number
export function paymentStatus(cost: unknown, paid: unknown): 'pending' | 'partial' | 'completed'
export function isRevenuePaymentStatus(status?: string | null): boolean
export function getTransactionAmount(payment: {amount?: number; total_amount?: number | null}): number
export function getRevenueTransactionAmount(payment: {amount?: number; total_amount?: number | null; status?: string | null}): number
export function sumPayments(payments: {amount?: number; total_amount?: number | null; status?: string | null}[]): number
export function validatePaymentAmounts(amount: number, discount?: number, tax?: number): void
export function finalAmount(amount: number, discount?: number, tax?: number): number
export function summarizePaymentBalances(payments: any[]): {totalDue:number;totalPaid:number;remainingBalance:number;pendingBalance:number}
export function previewPayment(input: {cost?: number | string;previousPaid?:number;amount?:number|string;discount?:number|string;tax?:number|string;countsAsPaid?:boolean}): {totalAmount:number;totalPaid:number;remainingBalance:number;status:'completed'|'partial'|'pending'}
