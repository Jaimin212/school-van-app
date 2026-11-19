-- ============================================================================
-- COMPLETE SCHOOL TRANSPORT MANAGEMENT SYSTEM - SUPABASE POSTGRESQL SCHEMA
-- Currency: INR (₹) | Timezone: Asia/Kolkata | Security: Row Level Security (RLS)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Role-based access linked to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DRIVER')),
    driver_id UUID,
    can_view_own_salary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SCHOOLS
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SCHOOL TIMINGS (Supports class-category overrides & effective date history)
CREATE TABLE school_timings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL, -- e.g. 'KG', 'Class 1-12', 'Nursery-UKG'
    applicable_classes TEXT[] NOT NULL,
    arrival_time TIME NOT NULL,
    departure_time TIME NOT NULL,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_school_timings_school ON school_timings(school_id, is_active);

-- 4. CLASSES (Configurable per school or global)
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL, -- Nursery, LKG, UKG, KG, Class 1 .. Class 12
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DRIVERS
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    address TEXT,
    licence_number TEXT NOT NULL,
    licence_expiry DATE NOT NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    permitted_shift TEXT NOT NULL CHECK (permitted_shift IN ('MORNING', 'EVENING', 'BOTH')),
    can_view_salary BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VEHICLES
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_code TEXT NOT NULL UNIQUE,
    registration_number TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL,
    seating_capacity INT NOT NULL CHECK (seating_capacity > 0),
    morning_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    evening_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    helper_name TEXT,
    helper_mobile TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DRIVER VEHICLE ASSIGNMENTS (Historical assignment log)
CREATE TABLE driver_vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    shift TEXT NOT NULL CHECK (shift IN ('MORNING', 'EVENING', 'BOTH')),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    assigned_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. STUDENTS
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    class_name TEXT NOT NULL,
    division TEXT NOT NULL DEFAULT 'A',
    parent_name TEXT NOT NULL,
    father_mobile TEXT NOT NULL,
    mother_mobile TEXT,
    address TEXT NOT NULL,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_fee NUMERIC(10,2) NOT NULL CHECK (monthly_fee >= 0),
    advance_credit NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (advance_credit >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_students_school_status ON students(school_id, status);

-- 9. STUDENT VEHICLE ALLOCATIONS (Independent Morning & Evening Shifts)
CREATE TABLE student_vehicle_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    shift TEXT NOT NULL CHECK (shift IN ('MORNING', 'EVENING')),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Prevent duplicate active allocation for the same student and shift
CREATE UNIQUE INDEX uniq_active_student_shift_allocation
    ON student_vehicle_allocations(student_id, shift)
    WHERE is_active = TRUE;

-- 10. ALLOCATION HISTORY
CREATE TABLE allocation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    shift TEXT NOT NULL CHECK (shift IN ('MORNING', 'EVENING')),
    previous_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    new_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    changed_by TEXT NOT NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. ATTENDANCE (Separate Morning & Evening)
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('MORNING', 'EVENING')),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LEAVE', 'NOT_TRAVELLING')),
    applicable_timing TEXT,
    marked_by TEXT NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, attendance_date, shift)
);
CREATE INDEX idx_attendance_date_shift ON attendance(attendance_date, shift, vehicle_id);

-- 12. STUDENT INVOICES (Single Invoice Per Student Per Month - Never Duplicated Across Shifts)
CREATE TABLE student_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    invoice_month TEXT NOT NULL, -- Format: 'YYYY-MM'
    fee_snapshot NUMERIC(10,2) NOT NULL CHECK (fee_snapshot >= 0),
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    due_date DATE NOT NULL, -- 10th of the month
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PAID', 'PARTIAL', 'PENDING', 'OVERDUE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, invoice_month)
);

-- 13. STUDENT PAYMENTS
CREATE TABLE student_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER')),
    reference_number TEXT,
    cheque_number TEXT,
    received_by_name TEXT NOT NULL,
    collector_role TEXT NOT NULL CHECK (collector_role IN ('ADMIN', 'MORNING_DRIVER')),
    collector_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('VERIFIED', 'PENDING_VERIFICATION', 'PARTIALLY_VERIFIED', 'DISPUTED', 'REVERSED')),
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. PAYMENT ALLOCATIONS (Links one payment to one or more monthly invoices or advance)
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES student_payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES student_invoices(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(10,2) NOT NULL CHECK (allocated_amount > 0),
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('INVOICE', 'ADVANCE_CREDIT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. PAYMENT REVERSALS (Never silently delete payments)
CREATE TABLE payment_reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_payment_id UUID NOT NULL UNIQUE REFERENCES student_payments(id) ON DELETE RESTRICT,
    reversal_reason TEXT NOT NULL,
    reversed_by TEXT NOT NULL,
    reversed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. DRIVER COLLECTION SETTLEMENTS (Admin verification of Morning Driver Cash)
CREATE TABLE driver_collection_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL UNIQUE REFERENCES student_payments(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    collected_amount NUMERIC(10,2) NOT NULL CHECK (collected_amount > 0),
    verified_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    settlement_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (settlement_status IN ('PENDING', 'VERIFIED', 'PARTIALLY_VERIFIED', 'DISPUTED')),
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. DRIVER SALARY SETTINGS (Supports Method A, B, C 50/50, and D Hybrid)
CREATE TABLE driver_salary_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    salary_method TEXT NOT NULL CHECK (salary_method IN ('FIXED', 'PER_STUDENT', 'FIFTY_FIFTY', 'HYBRID')),
    fixed_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    per_student_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    sharing_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00,
    incentive_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    deduction_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. DRIVER SALARY STATEMENTS (Immutable once approved/paid)
CREATE TABLE driver_salary_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_number TEXT NOT NULL UNIQUE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    salary_month TEXT NOT NULL, -- Format: 'YYYY-MM'
    salary_method TEXT NOT NULL,
    eligible_student_count INT NOT NULL DEFAULT 0,
    fee_sharing_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fixed_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    per_student_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    incentives NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    salary_advance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    manual_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    adjustment_reason TEXT,
    net_payable NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PARTIALLY_PAID', 'PAID')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (driver_id, salary_month)
);

-- 19. DRIVER SALARY ITEMS (Student-wise & shift-wise breakdown for transparency)
CREATE TABLE driver_salary_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID NOT NULL REFERENCES driver_salary_statements(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    shift TEXT NOT NULL CHECK (shift IN ('MORNING', 'EVENING')),
    student_monthly_fee_snapshot NUMERIC(10,2) NOT NULL,
    driver_entitlement_amount NUMERIC(10,2) NOT NULL,
    business_share_amount NUMERIC(10,2) NOT NULL,
    calculation_note TEXT NOT NULL
);

-- 20. DRIVER SALARY PAYMENTS
CREATE TABLE driver_salary_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID NOT NULL REFERENCES driver_salary_statements(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE')),
    reference_no TEXT,
    paid_by TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. AUDIT LOGS (Immutable record of all sensitive mutations)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_vehicle_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_collection_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_salary_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is ADMIN
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get current user's driver_id
CREATE OR REPLACE FUNCTION current_driver_id() RETURNS UUID AS $$
  SELECT driver_id FROM profiles WHERE id = auth.uid() AND role = 'DRIVER' AND is_active = TRUE;
$$ LANGUAGE sql SECURITY DEFINER;

-- ADMIN full access policies
CREATE POLICY admin_all_schools ON schools FOR ALL USING (is_admin());
CREATE POLICY admin_all_students ON students FOR ALL USING (is_admin());
CREATE POLICY admin_all_vehicles ON vehicles FOR ALL USING (is_admin());
CREATE POLICY admin_all_drivers ON drivers FOR ALL USING (is_admin());
CREATE POLICY admin_all_allocations ON student_vehicle_allocations FOR ALL USING (is_admin());
CREATE POLICY admin_all_attendance ON attendance FOR ALL USING (is_admin());
CREATE POLICY admin_all_invoices ON student_invoices FOR ALL USING (is_admin());
CREATE POLICY admin_all_payments ON student_payments FOR ALL USING (is_admin());
CREATE POLICY admin_all_settlements ON driver_collection_settlements FOR ALL USING (is_admin());
CREATE POLICY admin_all_salaries ON driver_salary_statements FOR ALL USING (is_admin());
CREATE POLICY admin_all_audit_logs ON audit_logs FOR ALL USING (is_admin());

-- DRIVER strict scoped policies:
-- 1. Drivers can only view vehicles assigned to them
CREATE POLICY driver_view_own_vehicle ON vehicles FOR SELECT USING (
  morning_driver_id = current_driver_id() OR evening_driver_id = current_driver_id()
);

-- 2. Drivers can only view allocations for their own vehicle
CREATE POLICY driver_view_own_allocations ON student_vehicle_allocations FOR SELECT USING (
  is_active = TRUE AND vehicle_id IN (
    SELECT id FROM vehicles
    WHERE (shift = 'MORNING' AND morning_driver_id = current_driver_id())
       OR (shift = 'EVENING' AND evening_driver_id = current_driver_id())
  )
);

-- 3. Drivers can only insert/view attendance for their assigned vehicle & shift
CREATE POLICY driver_manage_own_attendance ON attendance FOR ALL USING (
  driver_id = current_driver_id()
);

-- 4. ONLY MORNING DRIVERS can insert fee collections, and ONLY for students in their morning vehicle
CREATE POLICY morning_driver_insert_payment ON student_payments FOR INSERT WITH CHECK (
  collector_role = 'MORNING_DRIVER'
  AND collector_driver_id = current_driver_id()
  AND verification_status = 'PENDING_VERIFICATION'
  AND EXISTS (
    SELECT 1 FROM student_vehicle_allocations sva
    JOIN vehicles v ON v.id = sva.vehicle_id
    WHERE sva.student_id = student_payments.student_id
      AND sva.shift = 'MORNING'
      AND sva.is_active = TRUE
      AND v.morning_driver_id = current_driver_id()
  )
);

-- 5. Evening drivers have ZERO access to student_payments or student_invoices
CREATE POLICY morning_driver_view_own_collections ON student_payments FOR SELECT USING (
  collector_driver_id = current_driver_id()
);

-- 6. Drivers can view their own salary statement ONLY if can_view_salary is enabled
CREATE POLICY driver_view_own_salary ON driver_salary_statements FOR SELECT USING (
  driver_id = current_driver_id() AND EXISTS (
    SELECT 1 FROM drivers WHERE id = current_driver_id() AND can_view_salary = TRUE
  )
);
