import { ToothTreatment } from '@/types'

export function getTreatmentToothNumbers(treatment: Pick<ToothTreatment, 'tooth_number' | 'tooth_numbers'>): number[] {
  const rawToothNumbers = treatment.tooth_numbers

  if (Array.isArray(rawToothNumbers)) {
    const numbers = rawToothNumbers
      .map(Number)
      .filter(Number.isFinite)

    return numbers.length > 0 ? Array.from(new Set(numbers)) : [treatment.tooth_number]
  }

  if (typeof rawToothNumbers === 'string' && rawToothNumbers.trim()) {
    const numbers = rawToothNumbers
      .split(',')
      .map(value => Number(value.trim()))
      .filter(Number.isFinite)

    return numbers.length > 0 ? Array.from(new Set(numbers)) : [treatment.tooth_number]
  }

  return [treatment.tooth_number]
}

export function treatmentIncludesTooth(treatment: Pick<ToothTreatment, 'tooth_number' | 'tooth_numbers'>, toothNumber: number): boolean {
  return getTreatmentToothNumbers(treatment).includes(toothNumber)
}

export function formatTreatmentTeeth(treatment: Pick<ToothTreatment, 'tooth_number' | 'tooth_numbers'>): string {
  return getTreatmentToothNumbers(treatment)
    .sort((a, b) => a - b)
    .join(', ')
}
