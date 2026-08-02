const path = require('path')
const Database = require('better-sqlite3')

const dbPath = process.argv[2]

if (!dbPath) {
  console.error('Usage: node src/scripts/verify-financial-consistency.js <path-to-sqlite-db>')
  process.exit(1)
}

const db = new Database(path.resolve(dbPath), { readonly: true })
const money = (value) => Math.round((Number(value) || 0) * 100) / 100
const differs = (a, b) => Math.abs(money(a) - money(b)) > 0.01

const issues = []

function checkTreatmentPayments() {
  const rows = db.prepare(`
    SELECT
      p.id,
      p.tooth_treatment_id,
      p.treatment_total_cost,
      p.treatment_total_paid,
      p.treatment_remaining_balance,
      p.total_amount_due,
      p.amount_paid,
      p.remaining_balance,
      tt.cost as direct_cost,
      (
        SELECT COALESCE(SUM(p2.amount), 0)
        FROM payments p2
        WHERE p2.tooth_treatment_id = p.tooth_treatment_id
          AND COALESCE(p2.status, 'completed') IN ('completed', 'partial')
          AND (
            p2.payment_date < p.payment_date
            OR (p2.payment_date = p.payment_date AND p2.created_at <= p.created_at)
          )
      ) as direct_paid
    FROM payments p
    JOIN tooth_treatments tt ON tt.id = p.tooth_treatment_id
    WHERE p.tooth_treatment_id IS NOT NULL
      AND COALESCE(p.status, 'completed') IN ('completed', 'partial')
  `).all()

  rows.forEach((row) => {
    const directRemaining = Math.max(0, money(row.direct_cost) - money(row.direct_paid))
    if (
      differs(row.treatment_total_cost, row.direct_cost) ||
      differs(row.treatment_total_paid, row.direct_paid) ||
      differs(row.treatment_remaining_balance, directRemaining) ||
      differs(row.total_amount_due, row.direct_cost) ||
      differs(row.amount_paid, row.direct_paid) ||
      differs(row.remaining_balance, directRemaining)
    ) {
      issues.push({
        type: 'tooth_treatment_payment',
        payment_id: row.id,
        reference_id: row.tooth_treatment_id,
        stored: {
          cost: row.treatment_total_cost,
          paid: row.treatment_total_paid,
          remaining: row.treatment_remaining_balance
        },
        direct: {
          cost: money(row.direct_cost),
          paid: money(row.direct_paid),
          remaining: directRemaining
        }
      })
    }
  })
}

function checkAppointmentPayments() {
  const rows = db.prepare(`
    SELECT
      p.id,
      p.appointment_id,
      p.appointment_total_cost,
      p.appointment_total_paid,
      p.appointment_remaining_balance,
      p.total_amount_due,
      p.amount_paid,
      p.remaining_balance,
      a.cost as direct_cost,
      (
        SELECT COALESCE(SUM(p2.amount), 0)
        FROM payments p2
        WHERE p2.appointment_id = p.appointment_id
          AND p2.tooth_treatment_id IS NULL
          AND COALESCE(p2.status, 'completed') IN ('completed', 'partial')
          AND (
            p2.payment_date < p.payment_date
            OR (p2.payment_date = p.payment_date AND p2.created_at <= p.created_at)
          )
      ) as direct_paid
    FROM payments p
    JOIN appointments a ON a.id = p.appointment_id
    WHERE p.appointment_id IS NOT NULL
      AND p.tooth_treatment_id IS NULL
      AND COALESCE(p.status, 'completed') IN ('completed', 'partial')
  `).all()

  rows.forEach((row) => {
    const directRemaining = Math.max(0, money(row.direct_cost) - money(row.direct_paid))
    if (
      differs(row.appointment_total_cost, row.direct_cost) ||
      differs(row.appointment_total_paid, row.direct_paid) ||
      differs(row.appointment_remaining_balance, directRemaining) ||
      differs(row.total_amount_due, row.direct_cost) ||
      differs(row.amount_paid, row.direct_paid) ||
      differs(row.remaining_balance, directRemaining)
    ) {
      issues.push({
        type: 'appointment_payment',
        payment_id: row.id,
        reference_id: row.appointment_id,
        stored: {
          cost: row.appointment_total_cost,
          paid: row.appointment_total_paid,
          remaining: row.appointment_remaining_balance
        },
        direct: {
          cost: money(row.direct_cost),
          paid: money(row.direct_paid),
          remaining: directRemaining
        }
      })
    }
  })
}

function checkLabMonthlyBalances() {
  const rows = db.prepare(`
    SELECT
      lmb.id,
      lmb.lab_id,
      lmb.year,
      lmb.month,
      lmb.total_cost,
      lmb.total_paid,
      lmb.remaining_balance,
      COALESCE(SUM(lo.cost), 0) as direct_cost,
      COALESCE(SUM(lo.paid_amount), 0) as direct_paid
    FROM lab_monthly_balances lmb
    LEFT JOIN lab_orders lo
      ON lo.lab_id = lmb.lab_id
      AND CAST(strftime('%Y', lo.order_date) AS INTEGER) = lmb.year
      AND CAST(strftime('%m', lo.order_date) AS INTEGER) = lmb.month
    GROUP BY lmb.id
  `).all()

  rows.forEach((row) => {
    const directRemaining = Math.max(0, money(row.direct_cost) - money(row.direct_paid))
    if (
      differs(row.total_cost, row.direct_cost) ||
      differs(row.total_paid, row.direct_paid) ||
      differs(row.remaining_balance, directRemaining)
    ) {
      issues.push({
        type: 'lab_monthly_balance',
        balance_id: row.id,
        reference_id: `${row.lab_id}:${row.year}-${row.month}`,
        stored: {
          cost: row.total_cost,
          paid: row.total_paid,
          remaining: row.remaining_balance
        },
        direct: {
          cost: money(row.direct_cost),
          paid: money(row.direct_paid),
          remaining: directRemaining
        }
      })
    }
  })
}

checkTreatmentPayments()
checkAppointmentPayments()
checkLabMonthlyBalances()

if (issues.length === 0) {
  console.log('Financial consistency check passed.')
} else {
  console.log(JSON.stringify({ issues_count: issues.length, issues }, null, 2))
  process.exitCode = 1
}

db.close()
