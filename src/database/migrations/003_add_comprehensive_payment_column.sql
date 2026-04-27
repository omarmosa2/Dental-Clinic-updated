-- Migration: Add is_comprehensive column to payments table
-- This column flags payments that are comprehensive (دفعة شاملة)
-- which distribute payment across multiple treatments

ALTER TABLE payments ADD COLUMN is_comprehensive BOOLEAN DEFAULT 0;

-- Add index for comprehensive payments queries
CREATE INDEX IF NOT EXISTS idx_payments_comprehensive ON payments(is_comprehensive);
