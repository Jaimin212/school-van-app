import React, { useState, useMemo, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  Bus, Users, School as SchoolIcon, CalendarCheck, IndianRupee, ShieldCheck,
  FileSpreadsheet, Plus, Search, ArrowRightLeft, AlertTriangle, CheckCircle2,
  Clock, UserCheck, Wallet, FileText, History, Settings, Download, Printer,
  Eye, RotateCcw, Check, X, Phone, Building2, TrendingUp, Lock, Smartphone,
  Database, HelpCircle, ChevronRight, Filter, Trash2, Edit3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
type RoleMode = 'ADMIN' | 'MORNING_DRIVER' | 'EVENING_DRIVER';
type ShiftType = 'MORNING' | 'EVENING';
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'NOT_TRAVELLING';
type SalaryMethod = 'FIXED' | 'PER_STUDENT' | 'FIFTY_FIFTY' | 'HYBRID';

interface School {
  id: string;
  code: string;
  name: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  status: 'ACTIVE' | 'INACTIVE';
  kgArrival: string;
  kgDeparture: string;
  stdArrival: string;
  stdDeparture: string;
  timingEffectiveDate: string;
  classTimings?: Record<string, { arrival: string; departure: string }>;
}

interface Driver {
  id: string;
  code: string;
  name: string;
  mobile: string;
  licenceNo: string;
  licenceExpiry: string;
  permittedShift: 'MORNING' | 'EVENING' | 'BOTH';
  salaryMethod: SalaryMethod;
  fixedAmount: number;
  perStudentAmount: number;
  incentiveAmount: number;
  deductionAmount: number;
  canViewSalary: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Vehicle {
  id: string;
  code: string;
  regNumber: string;
  model: string;
  capacity: number;
  morningDriverId: string;
  eveningDriverId: string;
  helperName: string;
  helperMobile?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  notes?: string;
}

interface DriverVehicleHistory {
  id: string;
  vehicleCode: string;
  regNumber: string;
  shift: 'MORNING' | 'EVENING';
  previousDriver: string;
  newDriver: string;
  changedBy: string;
  timestamp: string;
}

interface Student {
  id: string;
  code: string;
  name: string;
  schoolId: string;
  className: string;
  division: string;
  parentName: string;
  fatherMobile: string;
  motherMobile: string;
  address: string;
  admissionDate: string;
  monthlyFee: number;
  morningVehicleId: string | null;
  eveningVehicleId: string | null;
  advanceCredit: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  month: string; // '2026-11'
  feeSnapshot: number;
  paidAmount: number;
  dueDate: string;
}

interface Payment {
  id: string;
  receiptNo: string;
  studentId: string;
  invoiceId: string | null;
  date: string;
  amount: number;
  invoiceAllocated: number;
  advanceAdded: number;
  method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  reference: string;
  receivedBy: string;
  collectorRole: 'ADMIN' | 'MORNING_DRIVER';
  driverId: string | null;
  vehicleId: string | null;
  verificationStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'PARTIALLY_VERIFIED' | 'DISPUTED' | 'REVERSED';
  reversalReason?: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  shift: ShiftType;
  vehicleId: string;
  driverId: string;
  status: AttendanceStatus;
  applicableTiming: string;
  markedBy: string;
}

interface AllocationLog {
  id: string;
  studentId: string;
  studentName: string;
  shift: ShiftType;
  prevVehicle: string;
  newVehicle: string;
  changedBy: string;
  timestamp: string;
}

interface AuditLog {
  id: string;
  actor: string;
  role: string;
  action: string;
  module: string;
  details: string;
  timestamp: string;
}

interface SalaryApproval {
  driverId: string;
  month: string;
  manualAdjustment: number;
  adjustmentReason: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paidAmount: number;
  paymentMode?: string;
}

// ============================================================================
// INITIAL REALISTIC SEED DATA (Ahmedabad / Gujarat School Transport Context)
// ============================================================================
const INITIAL_SCHOOLS: School[] = [
  {
    id: 'sch-1',
    code: 'SCH-001',
    name: 'Nirma Vidyavihar School',
    address: 'S.G. Highway, Bodakdev, Ahmedabad',
    contactPerson: 'Prakashbhai Mehta',
    contactNumber: '9825011223',
    status: 'ACTIVE',
    kgArrival: '08:30 AM',
    kgDeparture: '12:30 PM',
    stdArrival: '07:30 AM',
    stdDeparture: '01:45 PM',
    timingEffectiveDate: '2026-06-15',
  },
  {
    id: 'sch-2',
    code: 'SCH-002',
    name: 'Udgam School for Children',
    address: 'Thaltej, Ahmedabad',
    contactPerson: 'Meenaben Patel',
    contactNumber: '9825044556',
    status: 'ACTIVE',
    kgArrival: '08:45 AM',
    kgDeparture: '12:45 PM',
    stdArrival: '07:40 AM',
    stdDeparture: '02:00 PM',
    timingEffectiveDate: '2026-06-15',
  },
  {
    id: 'sch-3',
    code: 'SCH-003',
    name: 'Zydus School for Excellence',
    address: 'Vejalpur, Ahmedabad',
    contactPerson: 'Kiranbhai Shah',
    contactNumber: '9898077889',
    status: 'ACTIVE',
    kgArrival: '08:15 AM',
    kgDeparture: '12:15 PM',
    stdArrival: '07:20 AM',
    stdDeparture: '01:30 PM',
    timingEffectiveDate: '2026-06-15',
  }
];

const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'drv-1',
    code: 'DRV-101',
    name: 'Rameshbhai Thakor',
    mobile: '9824110011',
    licenceNo: 'GJ01-2016004512',
    licenceExpiry: '2029-05-19',
    permittedShift: 'MORNING',
    salaryMethod: 'FIFTY_FIFTY',
    fixedAmount: 0,
    perStudentAmount: 0,
    incentiveAmount: 500,
    deductionAmount: 0,
    canViewSalary: true,
    status: 'ACTIVE'
  },
  {
    id: 'drv-2',
    code: 'DRV-102',
    name: 'Kamleshbhai Rabari',
    mobile: '9824110022',
    licenceNo: 'GJ01-2018008911',
    licenceExpiry: '2030-11-10',
    permittedShift: 'EVENING',
    salaryMethod: 'FIFTY_FIFTY',
    fixedAmount: 0,
    perStudentAmount: 0,
    incentiveAmount: 0,
    deductionAmount: 0,
    canViewSalary: true,
    status: 'ACTIVE'
  },
  {
    id: 'drv-3',
    code: 'DRV-103',
    name: 'Sureshbhai Parmar',
    mobile: '9824110033',
    licenceNo: 'GJ01-2015003390',
    licenceExpiry: '2028-08-25',
    permittedShift: 'BOTH',
    salaryMethod: 'FIXED',
    fixedAmount: 14500,
    perStudentAmount: 0,
    incentiveAmount: 0,
    deductionAmount: 500,
    canViewSalary: true,
    status: 'ACTIVE'
  },
  {
    id: 'drv-4',
    code: 'DRV-104',
    name: 'Maheshbhai Solanki',
    mobile: '9824110044',
    licenceNo: 'GJ01-2019001144',
    licenceExpiry: '2031-02-14',
    permittedShift: 'BOTH',
    salaryMethod: 'HYBRID',
    fixedAmount: 8000,
    perStudentAmount: 300,
    incentiveAmount: 400,
    deductionAmount: 0,
    canViewSalary: true,
    status: 'ACTIVE'
  }
];

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh-1',
    code: 'VAN-01',
    regNumber: 'GJ-01-XX-1101',
    model: 'Maruti Eeco 12-Seater',
    capacity: 6, // Kept compact so user can immediately test capacity warnings too!
    morningDriverId: 'drv-1',
    eveningDriverId: 'drv-2',
    helperName: 'Geetaben (9824900111)',
    status: 'ACTIVE'
  },
  {
    id: 'veh-2',
    code: 'VAN-02',
    regNumber: 'GJ-01-XX-2202',
    model: 'Force Traveller 17-Seater',
    capacity: 8,
    morningDriverId: 'drv-3',
    eveningDriverId: 'drv-3',
    helperName: 'kantaben (9824900222)',
    status: 'ACTIVE'
  },
  {
    id: 'veh-3',
    code: 'VAN-03',
    regNumber: 'GJ-01-XX-3303',
    model: 'Tata Winger School Van',
    capacity: 8,
    morningDriverId: 'drv-4',
    eveningDriverId: 'drv-2',
    helperName: 'Rekhaben (9824900333)',
    status: 'ACTIVE'
  }
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stu-1',
    code: 'STU-1001',
    name: 'Aarav Kalal',
    schoolId: 'sch-1',
    className: 'Class 5',
    division: 'A',
    parentName: 'Dineshbhai Kalal',
    fatherMobile: '9409553743',
    motherMobile: '9409553744',
    address: 'Ghatlodia, Ahmedabad',
    admissionDate: '2026-06-10',
    monthlyFee: 1500,
    morningVehicleId: 'veh-1',
    eveningVehicleId: 'veh-3', // Uses Van-01 in Morning & Van-03 in Evening -> GREEN (Both shifts, different vans!)
    advanceCredit: 0,
    status: 'ACTIVE'
  },
  {
    id: 'stu-2',
    code: 'STU-1002',
    name: 'Diya Patel',
    schoolId: 'sch-1',
    className: 'KG',
    division: 'B',
    parentName: 'Jigneshbhai Patel',
    fatherMobile: '9825112233',
    motherMobile: '9825112234',
    address: 'Naranpura, Ahmedabad',
    admissionDate: '2026-06-12',
    monthlyFee: 1500,
    morningVehicleId: 'veh-1',
    eveningVehicleId: null, // Morning ONLY -> ORANGE (50% Morning Driver, 50% Business Share)
    advanceCredit: 1500,
    status: 'ACTIVE'
  },
  {
    id: 'stu-3',
    code: 'STU-1003',
    name: 'Kushal Shah',
    schoolId: 'sch-2',
    className: 'Class 8',
    division: 'A',
    parentName: 'Bhaveshbhai Shah',
    fatherMobile: '9825223344',
    motherMobile: '9825223345',
    address: 'Thaltej, Ahmedabad',
    admissionDate: '2026-06-14',
    monthlyFee: 1600,
    morningVehicleId: null,
    eveningVehicleId: 'veh-1', // Evening ONLY -> BLUE (50% Evening Driver, 50% Business Share)
    advanceCredit: 0,
    status: 'ACTIVE'
  },
  {
    id: 'stu-4',
    code: 'STU-1004',
    name: 'Riya Desai',
    schoolId: 'sch-2',
    className: 'Class 3',
    division: 'C',
    parentName: 'Mehulbhai Desai',
    fatherMobile: '9825334455',
    motherMobile: '9825334456',
    address: 'Sola Road, Ahmedabad',
    admissionDate: '2026-06-15',
    monthlyFee: 1500,
    morningVehicleId: null,
    eveningVehicleId: null, // NEITHER shift -> RED (100% Business Share)
    advanceCredit: 0,
    status: 'ACTIVE'
  },
  {
    id: 'stu-5',
    code: 'STU-1005',
    name: 'Vivaan Joshi',
    schoolId: 'sch-1',
    className: 'Class 6',
    division: 'A',
    parentName: 'ashwinbhai Joshi',
    fatherMobile: '9825445566',
    motherMobile: '9825445567',
    address: 'Gurukul, Ahmedabad',
    admissionDate: '2026-06-18',
    monthlyFee: 1800,
    morningVehicleId: 'veh-2',
    eveningVehicleId: 'veh-2', // Same Van both shifts -> GREEN
    advanceCredit: 0,
    status: 'ACTIVE'
  },
  {
    id: 'stu-6',
    code: 'STU-1006',
    name: 'Ananya Trivedi',
    schoolId: 'sch-3',
    className: 'LKG',
    division: 'A',
    parentName: 'Hardikbhai Trivedi',
    fatherMobile: '9825556677',
    motherMobile: '9825556678',
    address: 'Satellite, Ahmedabad',
    admissionDate: '2026-06-20',
    monthlyFee: 1400,
    morningVehicleId: 'veh-3',
    eveningVehicleId: 'veh-3', // GREEN
    advanceCredit: 0,
    status: 'ACTIVE'
  },
  {
    id: 'stu-7',
    code: 'STU-1007',
    name: 'Devansh Panchal',
    schoolId: 'sch-1',
    className: 'Class 10',
    division: 'B',
    parentName: 'Ankitbhai Panchal',
    fatherMobile: '9825667788',
    motherMobile: '9825667789',
    address: 'Memnagar, Ahmedabad',
    admissionDate: '2026-06-22',
    monthlyFee: 1500,
    morningVehicleId: 'veh-1',
    eveningVehicleId: 'veh-1', // GREEN
    advanceCredit: 0,
    status: 'ACTIVE'
  },
  {
    id: 'stu-8',
    code: 'STU-1008',
    name: 'Hetvi प्रजापति (Prajapati)',
    schoolId: 'sch-3',
    className: 'Class 2',
    division: 'A',
    parentName: 'Rakeshbhai Prajapati',
    fatherMobile: '9825778899',
    motherMobile: '9825778800',
    address: 'Vastrapur, Ahmedabad',
    admissionDate: '2026-06-25',
    monthlyFee: 1500,
    morningVehicleId: null,
    eveningVehicleId: null, // RED (Ready for user to drag & drop!)
    advanceCredit: 0,
    status: 'ACTIVE'
  }
];

const INITIAL_INVOICES: Invoice[] = [
  { id: 'inv-1', invoiceNo: 'INV-202611-01', studentId: 'stu-1', month: '2026-11', feeSnapshot: 1500, paidAmount: 1500, dueDate: '2026-11-10' },
  { id: 'inv-2', invoiceNo: 'INV-202611-02', studentId: 'stu-2', month: '2026-11', feeSnapshot: 1500, paidAmount: 1500, dueDate: '2026-11-10' },
  { id: 'inv-3', invoiceNo: 'INV-202611-03', studentId: 'stu-3', month: '2026-11', feeSnapshot: 1600, paidAmount: 600, dueDate: '2026-11-10' },
  { id: 'inv-4', invoiceNo: 'INV-202611-04', studentId: 'stu-4', month: '2026-11', feeSnapshot: 1500, paidAmount: 0, dueDate: '2026-11-10' },
  { id: 'inv-5', invoiceNo: 'INV-202611-05', studentId: 'stu-5', month: '2026-11', feeSnapshot: 1800, paidAmount: 1800, dueDate: '2026-11-10' },
  { id: 'inv-6', invoiceNo: 'INV-202611-06', studentId: 'stu-6', month: '2026-11', feeSnapshot: 1400, paidAmount: 0, dueDate: '2026-11-10' },
  { id: 'inv-7', invoiceNo: 'INV-202611-07', studentId: 'stu-7', month: '2026-11', feeSnapshot: 1500, paidAmount: 1500, dueDate: '2026-11-10' },
  { id: 'inv-8', invoiceNo: 'INV-202611-08', studentId: 'stu-8', month: '2026-11', feeSnapshot: 1500, paidAmount: 0, dueDate: '2026-11-10' }
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    receiptNo: 'RCP-2026-501',
    studentId: 'stu-1',
    invoiceId: 'inv-1',
    date: '2026-11-05',
    amount: 1500,
    invoiceAllocated: 1500,
    advanceAdded: 0,
    method: 'UPI',
    reference: 'UPI-4309112299',
    receivedBy: 'Admin (Jaimin Kalal)',
    collectorRole: 'ADMIN',
    driverId: null,
    vehicleId: 'veh-1',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'pay-2',
    receiptNo: 'RCP-2026-502',
    studentId: 'stu-2',
    invoiceId: 'inv-2',
    date: '2026-11-06',
    amount: 3000, // ₹1500 for Nov Invoice + ₹1500 Advance Credit
    invoiceAllocated: 1500,
    advanceAdded: 1500,
    method: 'CASH',
    reference: 'Advance 2 Months',
    receivedBy: 'Admin (Jaimin Kalal)',
    collectorRole: 'ADMIN',
    driverId: null,
    vehicleId: 'veh-1',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'pay-3',
    receiptNo: 'RCP-2026-503',
    studentId: 'stu-7',
    invoiceId: 'inv-7',
    date: '2026-11-12',
    amount: 1500,
    invoiceAllocated: 1500,
    advanceAdded: 0,
    method: 'CASH',
    reference: 'Collected at morning pickup',
    receivedBy: 'Rameshbhai Thakor (DRV-101)',
    collectorRole: 'MORNING_DRIVER',
    driverId: 'drv-1',
    vehicleId: 'veh-1',
    verificationStatus: 'PENDING_VERIFICATION'
  },
  {
    id: 'pay-4',
    receiptNo: 'RCP-2026-504',
    studentId: 'stu-3',
    invoiceId: 'inv-3',
    date: '2026-11-08',
    amount: 600,
    invoiceAllocated: 600,
    advanceAdded: 0,
    method: 'UPI',
    reference: 'UPI-99881122',
    receivedBy: 'Admin (Jaimin Kalal)',
    collectorRole: 'ADMIN',
    driverId: null,
    vehicleId: 'veh-1',
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'pay-5',
    receiptNo: 'RCP-2026-505',
    studentId: 'stu-5',
    invoiceId: 'inv-5',
    date: '2026-11-04',
    amount: 1800,
    invoiceAllocated: 1800,
    advanceAdded: 0,
    method: 'BANK_TRANSFER',
    reference: 'NEFT-88210',
    receivedBy: 'Admin (Jaimin Kalal)',
    collectorRole: 'ADMIN',
    driverId: null,
    vehicleId: 'veh-2',
    verificationStatus: 'VERIFIED'
  }
];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  { id: 'att-1', studentId: 'stu-1', date: '2026-11-13', shift: 'MORNING', vehicleId: 'veh-1', driverId: 'drv-1', status: 'PRESENT', applicableTiming: '07:30 AM - 01:45 PM', markedBy: 'Rameshbhai Thakor' },
  { id: 'att-2', studentId: 'stu-2', date: '2026-11-13', shift: 'MORNING', vehicleId: 'veh-1', driverId: 'drv-1', status: 'PRESENT', applicableTiming: '08:30 AM - 12:30 PM', markedBy: 'Rameshbhai Thakor' },
  { id: 'att-3', studentId: 'stu-7', date: '2026-11-13', shift: 'MORNING', vehicleId: 'veh-1', driverId: 'drv-1', status: 'ABSENT', applicableTiming: '07:30 AM - 01:45 PM', markedBy: 'Rameshbhai Thakor' },
  { id: 'att-4', studentId: 'stu-1', date: '2026-11-13', shift: 'EVENING', vehicleId: 'veh-3', driverId: 'drv-2', status: 'PRESENT', applicableTiming: '07:30 AM - 01:45 PM', markedBy: 'Kamleshbhai Rabari' },
  { id: 'att-5', studentId: 'stu-3', date: '2026-11-13', shift: 'EVENING', vehicleId: 'veh-1', driverId: 'drv-2', status: 'PRESENT', applicableTiming: '07:40 AM - 02:00 PM', markedBy: 'Kamleshbhai Rabari' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

const getStudentColorStatus = (s: Student) => {
  if (s.morningVehicleId && s.eveningVehicleId) {
    return {
      code: 'GREEN',
      label: 'Both Shifts (Morning + Evening)',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dot: 'bg-emerald-500',
      cardBorder: 'border-l-4 border-l-emerald-500'
    };
  }
  if (s.morningVehicleId && !s.eveningVehicleId) {
    return {
      code: 'ORANGE',
      label: 'Morning Only',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      dot: 'bg-amber-500',
      cardBorder: 'border-l-4 border-l-amber-500'
    };
  }
  if (!s.morningVehicleId && s.eveningVehicleId) {
    return {
      code: 'BLUE',
      label: 'Evening Only',
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
      dot: 'bg-sky-500',
      cardBorder: 'border-l-4 border-l-sky-500'
    };
  }
  return {
    code: 'RED',
    label: 'Unassigned (Neither)',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    dot: 'bg-rose-500',
    cardBorder: 'border-l-4 border-l-rose-500'
  };
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // Authentication State (Login Screen + Role Control)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loggedUserEmail, setLoggedUserEmail] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Navigation & Role Simulation State
  const [roleMode, setRoleMode] = useState<RoleMode>('ADMIN');
  const [activeTab, setActiveTab] = useState<string>('central_db');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Safe storage helper (persists across page refresh in browser while respecting sandbox rules)
  const loadSaved = <T,>(key: string, fallback: T): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  // Firm Branding State (Editable & Persisted)
  const [firmName, setFirmName] = useState<string>(() => loadSaved('stms_firm_name_v1', 'PEARL SCHOOL VAN SERVICE'));
  const [firmContact, setFirmContact] = useState<string>(() => loadSaved('stms_firm_contact_v1', 'Dinesh Kalal: 9898253729 | Jaimin Kalal: 9033893743'));
  const [firmCity, setFirmCity] = useState<string>(() => loadSaved('stms_firm_city_v1', 'Ahmedabad, Gujarat'));

  // Core Database State (with persistent storage across page refreshes)
  const [schools, setSchools] = useState<School[]>(() => loadSaved('stms_schools_v1', INITIAL_SCHOOLS));
  const [drivers, setDrivers] = useState<Driver[]>(() => loadSaved('stms_drivers_v1', INITIAL_DRIVERS));
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => loadSaved('stms_vehicles_v1', INITIAL_VEHICLES));
  const [students, setStudents] = useState<Student[]>(() => loadSaved('stms_students_v1', INITIAL_STUDENTS));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadSaved('stms_invoices_v1', INITIAL_INVOICES));
  const [payments, setPayments] = useState<Payment[]>(() => loadSaved('stms_payments_v1', INITIAL_PAYMENTS));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => loadSaved('stms_attendance_v1', INITIAL_ATTENDANCE));

  // Bulk selection on Allocation Board & Vehicles/Drivers Management states
  const [selectedBulkStudents, setSelectedBulkStudents] = useState<string[]>([]);
  const [bulkTargetShift, setBulkTargetShift] = useState<ShiftType>('MORNING');
  const [bulkTargetVan, setBulkTargetVan] = useState<string>('veh-1');
  // Central Van Database States & Filters
  const [vanSearch, setVanSearch] = useState<string>('');
  const [vanStatusFilter, setVanStatusFilter] = useState<string>('ALL');
  const [vanCapacityFilter, setVanCapacityFilter] = useState<string>('ALL');
  const [showAddVanModal, setShowAddVanModal] = useState<boolean>(false);
  const [editingVan, setEditingVan] = useState<Vehicle | null>(null);
  const [newVanReg, setNewVanReg] = useState<string>('');
  const [newVanModel, setNewVanModel] = useState<string>('');
  const [newVanCap, setNewVanCap] = useState<string>('8');
  const [newVanMorningDrv, setNewVanMorningDrv] = useState<string>('drv-1');
  const [newVanEveningDrv, setNewVanEveningDrv] = useState<string>('drv-2');
  const [newVanHelperName, setNewVanHelperName] = useState<string>('');
  const [newVanHelperMobile, setNewVanHelperMobile] = useState<string>('');
  const [newVanStatus, setNewVanStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ACTIVE');
  const [newVanNotes, setNewVanNotes] = useState<string>('');
  const [driverVanHistory, setDriverVanHistory] = useState<DriverVehicleHistory[]>([
    {
      id: 'dvh-1',
      vehicleCode: 'VAN-01',
      regNumber: 'GJ-01-XX-1101',
      shift: 'MORNING',
      previousDriver: 'Initial Setup',
      newDriver: 'Rameshbhai Thakor (9824110011)',
      changedBy: 'Admin (Jaimin Kalal)',
      timestamp: '13/11/2026, 09:00 AM'
    }
  ]);
  const [inactiveOverrideConfirm, setInactiveOverrideConfirm] = useState<{
    studentId: string;
    shift: ShiftType;
    vehicleId: string;
  } | null>(null);
  const [newDrvName, setNewDrvName] = useState<string>('');
  const [newDrvMobile, setNewDrvMobile] = useState<string>('');
  const [newDrvLicence, setNewDrvLicence] = useState<string>('');
  const [newDrvMethod, setNewDrvMethod] = useState<SalaryMethod>('FIFTY_FIFTY');

  useEffect(() => {
    try {
      window.localStorage.setItem('stms_schools_v1', JSON.stringify(schools));
      window.localStorage.setItem('stms_drivers_v1', JSON.stringify(drivers));
      window.localStorage.setItem('stms_vehicles_v1', JSON.stringify(vehicles));
      window.localStorage.setItem('stms_students_v1', JSON.stringify(students));
      window.localStorage.setItem('stms_invoices_v1', JSON.stringify(invoices));
      window.localStorage.setItem('stms_payments_v1', JSON.stringify(payments));
      window.localStorage.setItem('stms_attendance_v1', JSON.stringify(attendance));
      window.localStorage.setItem('stms_firm_name_v1', JSON.stringify(firmName));
      window.localStorage.setItem('stms_firm_contact_v1', JSON.stringify(firmContact));
      window.localStorage.setItem('stms_firm_city_v1', JSON.stringify(firmCity));
    } catch {
      // Ignore storage quota or sandbox errors
    }
  }, [schools, drivers, vehicles, students, invoices, payments, attendance]);
const [allocationHistory, setAllocationHistory] = useState<AllocationLog[]>([
    {
      id: 'al-1',
      studentId: 'stu-1',
      studentName: 'Aarav Kalal',
      shift: 'EVENING',
      prevVehicle: 'None',
      newVehicle: 'GJ-01-XX-3303 (VAN-03)',
      changedBy: 'Admin',
      timestamp: '13/11/2026, 09:15 AM'
    }
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'aud-1',
      actor: 'Admin (Jaimin Kalal)',
      role: 'ADMIN',
      action: 'INITIALIZE_SYSTEM',
      module: 'System',
      details: 'Initialized November 2026 transport ledger and shift allocations.',
      timestamp: '13/11/2026, 09:00 AM'
    }
  ]);
  const [salaryApprovals, setSalaryApprovals] = useState<Record<string, SalaryApproval>>({
    'drv-1': { driverId: 'drv-1', month: '2026-11', manualAdjustment: 0, adjustmentReason: '', status: 'DRAFT', paidAmount: 0 },
    'drv-2': { driverId: 'drv-2', month: '2026-11', manualAdjustment: 0, adjustmentReason: '', status: 'DRAFT', paidAmount: 0 },
    'drv-3': { driverId: 'drv-3', month: '2026-11', manualAdjustment: 0, adjustmentReason: '', status: 'APPROVED', paidAmount: 14000, paymentMode: 'BANK_TRANSFER' },
    'drv-4': { driverId: 'drv-4', month: '2026-11', manualAdjustment: 0, adjustmentReason: '', status: 'DRAFT', paidAmount: 0 }
  });

  // UI Selection & Filter States
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedVanId, setSelectedVanId] = useState<string>('veh-1');
  const [allocSearch, setAllocSearch] = useState<string>('');
  const [allocSchoolFilter, setAllocSchoolFilter] = useState<string>('ALL');
  const [allocColorFilter, setAllocColorFilter] = useState<string>('ALL');
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [quickAssignModal, setQuickAssignModal] = useState<{ studentId: string; shift: ShiftType } | null>(null);

  // Attendance Filter States
  const [attDate, setAttDate] = useState<string>('2026-11-13');
  const [attShift, setAttShift] = useState<ShiftType>('MORNING');
  const [attVehicleId, setAttVehicleId] = useState<string>('veh-1');

  // Fee Collection Modal State
  const [paymentModalStudentId, setPaymentModalStudentId] = useState<string>('stu-3');

  useEffect(() => {
    const eligible = students.filter((s) =>
      roleMode === 'MORNING_DRIVER' ? s.morningVehicleId === 'veh-1' : true
    );
    if (eligible.length > 0 && !eligible.some((s) => s.id === paymentModalStudentId)) {
      setPaymentModalStudentId(eligible[0].id);
    }
  }, [students, roleMode, paymentModalStudentId]);
  
  const [paymentAmount, setPaymentAmount] = useState<string>('1000');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [reversalModalPayment, setReversalModalPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Add New Student & Student Master Database States
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [newStuName, setNewStuName] = useState('');
  const [newStuSchool, setNewStuSchool] = useState('sch-1');
  const [newStuClass, setNewStuClass] = useState('');
  const [newStuDivision, setNewStuDivision] = useState('A');
  const [newStuParent, setNewStuParent] = useState('');
  const [newStuMobile, setNewStuMobile] = useState('');
  const [newStuMotherMobile, setNewStuMotherMobile] = useState('');
  const [newStuAddress, setNewStuAddress] = useState('');
  const [newStuFee, setNewStuFee] = useState('1500');

  // Master Student Database Table Filters & Bulk Import
  const [dbSearch, setDbSearch] = useState<string>('');
  const [dbSchoolFilter, setDbSchoolFilter] = useState<string>('ALL');
  const [dbClassFilter, setDbClassFilter] = useState<string>('ALL');
  const [dbDivisionFilter, setDbDivisionFilter] = useState<string>('ALL');
  const [dbMorningVanFilter, setDbMorningVanFilter] = useState<string>('ALL');
  const [dbEveningVanFilter, setDbEveningVanFilter] = useState<string>('ALL');
  const [dbColorFilter, setDbColorFilter] = useState<string>('ALL');
  const [dbStatusFilter, setDbStatusFilter] = useState<string>('ALL');
  const [newStuAdmissionDate, setNewStuAdmissionDate] = useState<string>('2026-06-15');
  const [newStuMorningVan, setNewStuMorningVan] = useState<string>('');
  const [newStuEveningVan, setNewStuEveningVan] = useState<string>('');
  const [newStuNotes, setNewStuNotes] = useState<string>('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState<boolean>(false);
  const [bulkCsvText, setBulkCsvText] = useState<string>(
    'Rohan Mehta,SCH-001,Class 6,A,ureshbhai Mehta,9825900111,Bopal Ahmedabad,1600\nKavya Joshi,SCH-002,KG,B,Nileshbhai Joshi,9825900222,Satellite Ahmedabad,1500'
  );

  // Reset to 0 (Clear Demo Data) & Add School States
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [newSchName, setNewSchName] = useState<string>('');
  const [newSchAddress, setNewSchAddress] = useState<string>('');
  const [newSchContact, setNewSchContact] = useState<string>('');
  const [newSchPhone, setNewSchPhone] = useState<string>('');
  const [newSchKgArr, setNewSchKgArr] = useState<string>('08:30 AM');
  const [newSchKgDep, setNewSchKgDep] = useState<string>('12:30 PM');
  const [newSchStdArr, setNewSchStdArr] = useState<string>('07:30 AM');
  const [newSchStdDep, setNewSchStdDep] = useState<string>('01:45 PM');
  const [timingSchoolId, setTimingSchoolId] = useState<string | null>(null);
  const [customClassName, setCustomClassName] = useState<string>('');

  // Supabase Setup Modal
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);
  const [sbUrl, setSbUrl] = useState<string>('');
  const [sbAnonKey, setSbAnonKey] = useState<string>('');

  // Show Toast helper
  const notify = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Add Audit Log helper
  const logAudit = (action: string, module: string, details: string) => {
    const actor =
      roleMode === 'ADMIN'
        ? 'Admin (Jaimin Kalal)'
        : roleMode === 'MORNING_DRIVER'
        ? 'Rameshbhai Thakor (DRV-101)'
        : 'Kamleshbhai Rabari (DRV-102)';
    const entry: AuditLog = {
      id: `aud-${Date.now()}`,
      actor,
      role: roleMode,
      action,
      module,
      details,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  // Switch Role Handler (enforces strict access control)
  const handleRoleChange = (newRole: RoleMode) => {
    setRoleMode(newRole);
    if (newRole === 'MORNING_DRIVER') {
      setAttShift('MORNING');
      setAttVehicleId('veh-1');
      if (!['attendance', 'fees', 'driver_portal'].includes(activeTab)) {
        setActiveTab('driver_portal');
      }
      notify('Switched to Morning Driver View (Rameshbhai - GJ-01-XX-1101). Can mark morning attendance & collect assigned morning student fees.', 'success');
    } else if (newRole === 'EVENING_DRIVER') {
      setAttShift('EVENING');
      setAttVehicleId('veh-1');
      setActiveTab('driver_portal');
      notify('Switched to Evening Driver View (Kamleshbhai - GJ-01-XX-1101). Financial modules are strictly locked via RLS.', 'warning');
    } else {
      notify('Switched to Full Admin Control Mode.', 'success');
    }
  };

  // Get applicable school timing for a student automatically (Class-specific override first!)
  const getStudentTiming = (student: Student) => {
    const sch = schools.find((s) => s.id === student.schoolId);
    if (!sch) return { arrival: '07:30 AM', departure: '01:45 PM', category: 'Standard' };
    const exactClass = sch.classTimings?.[student.className];
    if (exactClass) {
      return {
        arrival: exactClass.arrival,
        departure: exactClass.departure,
        category: student.className
      };
    }
    const isKG = ['Nursery', 'LKG', 'UKG', 'KG', 'KG1', 'KG2'].includes(student.className);
    return {
      arrival: isKG ? sch.kgArrival : sch.stdArrival,
      departure: isKG ? sch.kgDeparture : sch.stdDeparture,
      category: isKG ? 'KG Section' : 'Class 1–12'
    };
  };

  // ============================================================================
  // CORE ALLOCATION ENGINE (Independent Morning & Evening Shifts)
  // ============================================================================
  const assignStudentToVehicle = (studentId: string, shift: ShiftType, vehicleId: string | null) => {
    if (roleMode !== 'ADMIN') {
      notify('Only Admin can change vehicle allocations.', 'error');
      return;
    }
    const stu = students.find((s) => s.id === studentId);
    if (!stu) return;

    if (vehicleId) {
      const targetVeh = vehicles.find((v) => v.id === vehicleId);
      if (!targetVeh) return;
      if (targetVeh.status !== 'ACTIVE' && !inactiveOverrideConfirm) {
        setInactiveOverrideConfirm({ studentId, shift, vehicleId });
        notify(`Warning: ${targetVeh.regNumber} is ${targetVeh.status}. Confirm override dialog to assign.`, 'warning');
        return;
      }
      // Check shift-specific occupancy
      const currentOccupancy = students.filter((s) =>
        s.status === 'ACTIVE' &&
        s.id !== studentId &&
        (shift === 'MORNING' ? s.morningVehicleId === vehicleId : s.eveningVehicleId === vehicleId)
      ).length;

      if (currentOccupancy >= targetVeh.capacity) {
        notify(`Capacity Warning: ${targetVeh.regNumber} (${shift}) now has ${currentOccupancy + 1}/${targetVeh.capacity} seats occupied!`, 'warning');
      }
    }

    const prevVehId = shift === 'MORNING' ? stu.morningVehicleId : stu.eveningVehicleId;
    if (prevVehId === vehicleId) return;

    const prevVehObj = vehicles.find((v) => v.id === prevVehId);
    const newVehObj = vehicles.find((v) => v.id === vehicleId);

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return shift === 'MORNING'
          ? { ...s, morningVehicleId: vehicleId }
          : { ...s, eveningVehicleId: vehicleId };
      })
    );

    const logItem: AllocationLog = {
      id: `al-${Date.now()}`,
      studentId: stu.id,
      studentName: stu.name,
      shift,
      prevVehicle: prevVehObj ? `${prevVehObj.regNumber} (${prevVehObj.code})` : 'Unassigned',
      newVehicle: newVehObj ? `${newVehObj.regNumber} (${newVehObj.code})` : 'Unassigned',
      changedBy: 'Admin (Jaimin Kalal)',
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
    setAllocationHistory((prev) => [logItem, ...prev]);
    logAudit(
      'ALLOCATION_CHANGED',
      'Allocation Board',
      `${stu.name} (${shift}) moved from ${logItem.prevVehicle} to ${logItem.newVehicle}`
    );

    if (!vehicleId) {
      notify(`Removed ${stu.name} from ${shift} shift. Other shift remained untouched.`, 'success');
    } else {
      notify(`Assigned ${stu.name} to ${newVehObj?.regNumber} for ${shift} shift!`, 'success');
    }
  };

  // ============================================================================
  // 50/50 & MULTI-METHOD DRIVER SALARY CALCULATION ENGINE
  // ============================================================================
  const salaryCalculations = useMemo(() => {
    // 1. Student-wise 50/50 fee split ledger
    const studentSplitRows = students
      .filter((s) => s.status === 'ACTIVE')
      .map((s) => {
        const mVeh = vehicles.find((v) => v.id === s.morningVehicleId);
        const eVeh = vehicles.find((v) => v.id === s.eveningVehicleId);
        const mDriver = drivers.find((d) => d.id === mVeh?.morningDriverId);
        const eDriver = drivers.find((d) => d.id === eVeh?.eveningDriverId);

        const halfFee = Math.round(s.monthlyFee * 0.5);
        const morningShare = s.morningVehicleId ? halfFee : 0;
        const eveningShare = s.eveningVehicleId ? halfFee : 0;
        // Business keeps any unallocated 50% shift share (or 100% if neither assigned)
        const businessShare = s.monthlyFee - morningShare - eveningShare;

        return {
          student: s,
          mVeh,
          eVeh,
          mDriver,
          eDriver,
          morningShare,
          eveningShare,
          businessShare
        };
      });

    // 2. Driver-wise monthly statements
    const driverStatements = drivers.map((drv) => {
      // Find all students where this driver is the morning or evening driver
      let eligibleShiftsCount = 0;
      let fiftyFiftyAmount = 0;
      const studentBreakdown: Array<{
        studentName: string;
        shift: ShiftType;
        vehicleReg: string;
        monthlyFee: number;
        driverEarned: number;
        businessRetained: number;
      }> = [];

      studentSplitRows.forEach((row) => {
        if (row.mDriver?.id === drv.id && row.mVeh) {
          eligibleShiftsCount += 1;
          fiftyFiftyAmount += row.morningShare;
          studentBreakdown.push({
            studentName: row.student.name,
            shift: 'MORNING',
            vehicleReg: row.mVeh.regNumber,
            monthlyFee: row.student.monthlyFee,
            driverEarned: row.morningShare,
            businessRetained: row.eDriver ? 0 : row.student.monthlyFee - row.morningShare
          });
        }
        if (row.eDriver?.id === drv.id && row.eVeh) {
          eligibleShiftsCount += 1;
          fiftyFiftyAmount += row.eveningShare;
          studentBreakdown.push({
            studentName: row.student.name,
            shift: 'EVENING',
            vehicleReg: row.eVeh.regNumber,
            monthlyFee: row.student.monthlyFee,
            driverEarned: row.eveningShare,
            businessRetained: row.mDriver ? 0 : row.student.monthlyFee - row.eveningShare
          });
        }
      });

      let baseEarnings = 0;
      let fixedPart = 0;
      let perStudentPart = 0;
      let sharingPart = 0;

      if (drv.salaryMethod === 'FIXED') {
        fixedPart = drv.fixedAmount;
        baseEarnings = fixedPart;
      } else if (drv.salaryMethod === 'PER_STUDENT') {
        perStudentPart = eligibleShiftsCount * drv.perStudentAmount;
        baseEarnings = perStudentPart;
      } else if (drv.salaryMethod === 'FIFTY_FIFTY') {
        sharingPart = fiftyFiftyAmount;
        baseEarnings = sharingPart;
      } else if (drv.salaryMethod === 'HYBRID') {
        fixedPart = drv.fixedAmount;
        perStudentPart = eligibleShiftsCount * drv.perStudentAmount;
        baseEarnings = fixedPart + perStudentPart;
      }

      const approval = salaryApprovals[drv.id] || {
        driverId: drv.id,
        month: '2026-11',
        manualAdjustment: 0,
        adjustmentReason: '',
        status: 'DRAFT',
        paidAmount: 0
      };

      const netPayable =
        baseEarnings + drv.incentiveAmount - drv.deductionAmount + approval.manualAdjustment;
      const remainingPayable = Math.max(0, netPayable - approval.paidAmount);

      return {
        driver: drv,
        eligibleShiftsCount,
        fixedPart,
        perStudentPart,
        sharingPart,
        incentive: drv.incentiveAmount,
        deduction: drv.deductionAmount,
        manualAdjustment: approval.manualAdjustment,
        adjustmentReason: approval.adjustmentReason,
        netPayable,
        paidAmount: approval.paidAmount,
        remainingPayable,
        status: approval.status,
        studentBreakdown
      };
    });

    return { studentSplitRows, driverStatements };
  }, [students, vehicles, drivers, salaryApprovals]);

  // ============================================================================
  // COMPANY-WIDE FINANCIAL KPI SUMMARY (Zero Double Counting!)
  // ============================================================================
  const companyMetrics = useMemo(() => {
    const activeStudents = students.filter((s) => s.status === 'ACTIVE');
    // Each student's invoice is counted ONCE regardless of whether they use 1 or 2 vans
    const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.feeSnapshot, 0);
    const totalCollected = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
    const totalOutstanding = invoices.reduce((acc, inv) => acc + Math.max(0, inv.feeSnapshot - inv.paidAmount), 0);
    // Since current date is Nov 13 (past the 10th due window), all unpaid balances for 2026-11 are overdue
    const totalOverdue = totalOutstanding;
    const totalAdvanceCredit = students.reduce((acc, s) => acc + s.advanceCredit, 0);
    const pendingDriverCash = payments
      .filter((p) => p.verificationStatus === 'PENDING_VERIFICATION')
      .reduce((acc, p) => acc + p.amount, 0);
    const totalDriverSalaryPayable = salaryCalculations.driverStatements.reduce(
      (acc, d) => acc + d.remainingPayable,
      0
    );

    const greenCount = activeStudents.filter((s) => s.morningVehicleId && s.eveningVehicleId).length;
    const orangeCount = activeStudents.filter((s) => s.morningVehicleId && !s.eveningVehicleId).length;
    const blueCount = activeStudents.filter((s) => !s.morningVehicleId && s.eveningVehicleId).length;
    const redCount = activeStudents.filter((s) => !s.morningVehicleId && !s.eveningVehicleId).length;

    return {
      activeStudentsCount: activeStudents.length,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      totalAdvanceCredit,
      pendingDriverCash,
      totalDriverSalaryPayable,
      greenCount,
      orangeCount,
      blueCount,
      redCount
    };
  }, [students, invoices, payments, salaryCalculations]);

  // ============================================================================
  // FEE RECORDING & ADVANCE CREDIT ALLOCATION HANDLER
  // ============================================================================
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (roleMode === 'EVENING_DRIVER') {
      notify('Evening drivers are strictly prohibited from recording or viewing fees.', 'error');
      return;
    }

    const eligibleStudents = students.filter((s) =>
      roleMode === 'MORNING_DRIVER' ? s.morningVehicleId === 'veh-1' : true
    );
    const stu =
      eligibleStudents.find((s) => s.id === paymentModalStudentId) ||
      eligibleStudents[0];
    if (!stu) {
      notify('No student available to collect fee from. Please add a student first.', 'error');
      return;
    }

    // Morning Driver check: Can ONLY collect for students assigned to their morning vehicle (veh-1)
    if (roleMode === 'MORNING_DRIVER' && stu.morningVehicleId !== 'veh-1') {
      notify('Access Denied: Morning Driver can only collect fees for students allocated to their Morning Van (GJ-01-XX-1101).', 'error');
      return;
    }

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      notify('Please enter a valid amount greater than ₹0.', 'error');
      return;
    }

    let inv = invoices.find((i) => i.studentId === stu.id && i.month === '2026-11');
    let createdNewInv = false;
    if (!inv) {
      inv = {
        id: `inv-${Date.now()}`,
        invoiceNo: `INV-202611-${invoices.length + 1}`,
        studentId: stu.id,
        month: '2026-11',
        feeSnapshot: stu.monthlyFee,
        paidAmount: 0,
        dueDate: '2026-11-10'
      };
      createdNewInv = true;
    }
    const unpaidOnInvoice = Math.max(0, inv.feeSnapshot - inv.paidAmount);

    // Allocate to current invoice first, excess goes to Advance Credit (never double-counted!)
    const allocatedToInvoice = Math.min(amt, unpaidOnInvoice);
    const excessAdvance = Math.max(0, amt - allocatedToInvoice);

    if (createdNewInv) {
      const updatedInv = { ...inv, paidAmount: allocatedToInvoice };
      setInvoices((prev) => [updatedInv, ...prev]);
    } else if (allocatedToInvoice > 0) {
      const targetInvId = inv.id;
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === targetInvId ? { ...i, paidAmount: i.paidAmount + allocatedToInvoice } : i
        )
      );
    }

    if (excessAdvance > 0) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === stu.id ? { ...s, advanceCredit: s.advanceCredit + excessAdvance } : s
        )
      );
    }

    const isDriverCollector = roleMode === 'MORNING_DRIVER';
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      receiptNo: `RCP-2026-${500 + payments.length + 1}`,
      studentId: stu.id,
      invoiceId: inv?.id || null,
      date: '2026-11-13',
      amount: amt,
      invoiceAllocated: allocatedToInvoice,
      advanceAdded: excessAdvance,
      method: paymentMethod,
      reference: paymentRef || (isDriverCollector ? 'Collected on Morning Route' : 'Counter Collection'),
      receivedBy: isDriverCollector ? 'Rameshbhai Thakor (DRV-101)' : 'Admin (Jaimin Kalal)',
      collectorRole: isDriverCollector ? 'MORNING_DRIVER' : 'ADMIN',
      driverId: isDriverCollector ? 'drv-1' : null,
      vehicleId: stu.morningVehicleId || stu.eveningVehicleId,
      verificationStatus: isDriverCollector ? 'PENDING_VERIFICATION' : 'VERIFIED'
    };

    setPayments((prev) => [newPayment, ...prev]);
    setSelectedReceipt(newPayment);
    setPaymentRef('');
    logAudit(
      'PAYMENT_RECORDED',
      'Fees & Ledger',
      `Receipt ${newPayment.receiptNo} for ${stu.name}: ${formatINR(amt)} (Invoice: ${formatINR(allocatedToInvoice)}, Advance Credit: ${formatINR(excessAdvance)}) Status: ${newPayment.verificationStatus}`
    );

    notify(
      isDriverCollector
        ? `Recorded ${formatINR(amt)} from ${stu.name}. Marked PENDING ADMIN VERIFICATION.`
        : `Recorded ${formatINR(amt)} for ${stu.name} (${excessAdvance > 0 ? `${formatINR(excessAdvance)} added to Advance Credit` : 'Allocated to Nov Invoice'}).`,
      'success'
    );
  };

  // Payment Reversal Handler (No silent deletions!)
  const handleReversePayment = () => {
    if (!reversalModalPayment || !reversalReason.trim()) {
      notify('Please enter a mandatory reason for payment reversal.', 'error');
      return;
    }
    const target = reversalModalPayment;
    if (target.verificationStatus === 'REVERSED') return;

    // Roll back invoice paid amount and student advance credit safely
    if (target.invoiceId && target.invoiceAllocated > 0) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === target.invoiceId
            ? { ...inv, paidAmount: Math.max(0, inv.paidAmount - target.invoiceAllocated) }
            : inv
        )
      );
    }
    if (target.advanceAdded > 0) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === target.studentId
            ? { ...s, advanceCredit: Math.max(0, s.advanceCredit - target.advanceAdded) }
            : s
        )
      );
    }

    setPayments((prev) =>
      prev.map((p) =>
        p.id === target.id
          ? { ...p, verificationStatus: 'REVERSED', reversalReason: reversalReason.trim() }
          : p
      )
    );

    logAudit(
      'PAYMENT_REVERSED',
      'Fees & Ledger',
      `Reversed ${target.receiptNo} (${formatINR(target.amount)}) - Reason: ${reversalReason.trim()}`
    );
    setReversalModalPayment(null);
    setReversalReason('');
    notify(`Payment ${target.receiptNo} reversed with full audit trail. Invoice balance restored.`, 'warning');
  };

  // Driver Cash Settlement Verification Handler
  const handleVerifyDriverCash = (paymentId: string, newStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'DISPUTED') => {
    if (roleMode !== 'ADMIN') {
      notify('Only Admin can verify driver-collected cash.', 'error');
      return;
    }
    const pay = payments.find((p) => p.id === paymentId);
    if (!pay) return;

    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, verificationStatus: newStatus } : p))
    );
    logAudit(
      'DRIVER_CASH_SETTLEMENT',
      'Driver Collections',
      `Admin marked ${pay.receiptNo} (${formatINR(pay.amount)} collected by ${pay.receivedBy}) as ${newStatus}`
    );
    notify(`Driver cash receipt ${pay.receiptNo} marked as ${newStatus}.`, 'success');
  };

  // Attendance Marking Handler
  const handleMarkAttendance = (studentId: string, status: AttendanceStatus) => {
    const stu = students.find((s) => s.id === studentId);
    if (!stu) return;
    const timing = getStudentTiming(stu);
    const actor =
      roleMode === 'ADMIN'
        ? 'Admin (Correction)'
        : roleMode === 'MORNING_DRIVER'
        ? 'Rameshbhai Thakor'
        : 'Kamleshbhai Rabari';

    setAttendance((prev) => {
      const existingIdx = prev.findIndex(
        (a) => a.studentId === studentId && a.date === attDate && a.shift === attShift
      );
      const record: AttendanceRecord = {
        id: existingIdx >= 0 ? prev[existingIdx].id : `att-${Date.now()}-${Math.random()}`,
        studentId,
        date: attDate,
        shift: attShift,
        vehicleId: attVehicleId,
        driverId: roleMode === 'EVENING_DRIVER' ? 'drv-2' : 'drv-1',
        status,
        applicableTiming: `${timing.arrival} - ${timing.departure}`,
        markedBy: actor
      };
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = record;
        return copy;
      }
      return [...prev, record];
    });

    logAudit(
      'ATTENDANCE_MARKED',
      'Attendance',
      `${stu.name} marked ${status} for ${attDate} (${attShift}) by ${actor}`
    );
    notify(`Marked ${stu.name} as ${status} (${attShift}).`, 'success');
  };

  // Export CSV Helper
  const handleExportCSV = (reportType: string) => {
    let csv = '';
    if (reportType === 'CENTRAL_VANS') {
      csv = 'Van Code,Registration No,Model,Capacity,Morning Driver,Morning Occupied,Morning Free,Evening Driver,Evening Occupied,Evening Free,Helper,Status,Notes\n';
      vehicles.forEach((v) => {
        const mDrv = drivers.find((d) => d.id === v.morningDriverId);
        const eDrv = drivers.find((d) => d.id === v.eveningDriverId);
        const mOcc = students.filter((s) => s.status === 'ACTIVE' && s.morningVehicleId === v.id).length;
        const eOcc = students.filter((s) => s.status === 'ACTIVE' && s.eveningVehicleId === v.id).length;
        csv += `${v.code},${v.regNumber},"${v.model}",${v.capacity},"${mDrv?.name || 'None'} (${mDrv?.mobile || ''})",${mOcc},${v.capacity - mOcc},"${eDrv?.name || 'None'} (${eDrv?.mobile || ''})",${eOcc},${v.capacity - eOcc},"${v.helperName || ''}",${v.status},"${v.notes || ''}"\n`;
      });
    } else if (reportType === 'PENDING_OVERDUE') {
      csv = 'Student Code,Student Name,Parent Name,Mobile,School,Class,Monthly Fee,Paid,Outstanding,Due Date,Days Overdue,Status\n';
      students.forEach((s) => {
        const inv = invoices.find((i) => i.studentId === s.id);
        const sch = schools.find((sc) => sc.id === s.schoolId);
        const paid = inv?.paidAmount || 0;
        const out = (inv?.feeSnapshot || s.monthlyFee) - paid;
        if (out > 0) {
          csv += `${s.code},"${s.name}","${s.parentName}",${s.fatherMobile},"${sch?.name}",${s.className},${s.monthlyFee},${paid},${out},2026-11-10,3,OVERDUE\n`;
        }
      });
    } else {
      csv = 'Student Code,Student Name,School,Class,Monthly Fee,Morning Van,Evening Van,Color Status,Advance Credit\n';
      students.forEach((s) => {
        const sch = schools.find((sc) => sc.id === s.schoolId);
        const mVan = vehicles.find((v) => v.id === s.morningVehicleId)?.regNumber || 'Unassigned';
        const eVan = vehicles.find((v) => v.id === s.eveningVehicleId)?.regNumber || 'Unassigned';
        const col = getStudentColorStatus(s).code;
        csv += `${s.code},"${s.name}","${sch?.name}",${s.className},${s.monthlyFee},${mVan},${eVan},${col},${s.advanceCredit}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `school_transport_${reportType.toLowerCase()}_2026_11.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${reportType} report to CSV (Excel-compatible).`, 'success');
  };

  // Add Student Handler
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStuName.trim() || !newStuMobile.trim()) {
      notify('Please enter Student Name and Parent Mobile.', 'error');
      return;
    }
    const feeNum = Number(newStuFee) || 1500;
    const newId = `stu-${Date.now()}`;
    const code = `STU-${1000 + students.length + 1}`;
    const created: Student = {
      id: newId,
      code,
      name: newStuName.trim(),
      schoolId: newStuSchool,
      className: newStuClass,
      division: newStuDivision || 'A',
      parentName: newStuParent.trim() || 'Parent',
      fatherMobile: newStuMobile.trim(),
      motherMobile: newStuMotherMobile.trim(),
      address: newStuAddress.trim() || 'Ahmedabad',
      admissionDate: newStuAdmissionDate || '2026-11-13',
      monthlyFee: feeNum,
      morningVehicleId: newStuMorningVan || null,
      eveningVehicleId: newStuEveningVan || null,
      advanceCredit: 0,
      status: 'ACTIVE',
      notes: newStuNotes.trim()
    };
    const createdInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNo: `INV-202611-0${invoices.length + 1}`,
      studentId: newId,
      month: '2026-11',
      feeSnapshot: feeNum,
      paidAmount: 0,
      dueDate: '2026-11-10'
    };

    setStudents((prev) => [created, ...prev]);
    setInvoices((prev) => [createdInvoice, ...prev]);
    setShowAddStudentModal(false);
    setNewStuName('');
    setNewStuParent('');
    setNewStuMobile('');
    logAudit('STUDENT_CREATED', 'Students', `Added student ${created.name} (${created.code}) with fee ${formatINR(feeNum)}`);
    notify(`Added ${created.name} (${created.code})! Initially RED (Unassigned) — ready on the Allocation Board.`, 'success');
  };

  // Update Existing Student (Fee changes do NOT overwrite historical invoice snapshots!)
  const handleSaveStudentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === editingStudent.id ? editingStudent : s))
    );
    logAudit(
      'STUDENT_UPDATED',
      'Students Database',
      `Updated ${editingStudent.name} (${editingStudent.code}): Fee=${formatINR(editingStudent.monthlyFee)}, Status=${editingStudent.status}`
    );
    notify(
      `Updated ${editingStudent.name} in Student Database! (Historical invoices preserve their original fee snapshot).`,
      'success'
    );
    setEditingStudent(null);
  };

  // Bulk CSV / Excel Paste Import with Duplicate Detection
  const handleBulkImportStudents = () => {
    const lines = bulkCsvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      notify('Please paste at least one student row.', 'error');
      return;
    }
    let addedCount = 0;
    let skippedDuplicates = 0;
    const newStuList: Student[] = [];
    const newInvList: Invoice[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 6) return;
      const [name, schCode, cls, div, parent, mobile, addr, feeStr] = parts;
      const isDuplicate = students.some(
        (s) => s.name.toLowerCase() === name.toLowerCase() && s.fatherMobile === mobile
      );
      if (isDuplicate) {
        skippedDuplicates += 1;
        return;
      }
      const matchedSch = schools.find((sc) => sc.code === schCode) || schools[0];
      const feeVal = Number(feeStr) || 1500;
      const id = `stu-bulk-${Date.now()}-${idx}`;
      const code = `STU-${1000 + students.length + addedCount + 1}`;
      newStuList.push({
        id,
        code,
        name,
        schoolId: matchedSch.id,
        className: cls || 'Class 5',
        division: div || 'A',
        parentName: parent || 'Parent',
        fatherMobile: mobile || '9800000000',
        motherMobile: '',
        address: addr || 'Ahmedabad',
        admissionDate: '2026-11-13',
        monthlyFee: feeVal,
        morningVehicleId: null,
        eveningVehicleId: null,
        advanceCredit: 0,
        status: 'ACTIVE'
      });
      newInvList.push({
        id: `inv-bulk-${Date.now()}-${idx}`,
        invoiceNo: `INV-202611-${invoices.length + addedCount + 1}`,
        studentId: id,
        month: '2026-11',
        feeSnapshot: feeVal,
        paidAmount: 0,
        dueDate: '2026-11-10'
      });
      addedCount += 1;
    });

    if (addedCount > 0) {
      setStudents((prev) => [...newStuList, ...prev]);
      setInvoices((prev) => [...newInvList, ...prev]);
      logAudit(
        'BULK_STUDENT_IMPORT',
        'Students Database',
        `Imported ${addedCount} students (${skippedDuplicates} duplicates skipped)`
      );
      notify(`Imported ${addedCount} students into Database (${skippedDuplicates} duplicate rows skipped).`, 'success');
      setShowBulkImportModal(false);
    } else {
      notify(`No new students imported (${skippedDuplicates} duplicates detected).`, 'warning');
    }
  };

  // Filtered central students for Allocation Board
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== 'ACTIVE') return false;
      const matchesSearch =
        s.name.toLowerCase().includes(allocSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(allocSearch.toLowerCase()) ||
        s.fatherMobile.includes(allocSearch);
      const matchesSchool = allocSchoolFilter === 'ALL' || s.schoolId === allocSchoolFilter;
      const colorCode = getStudentColorStatus(s).code;
      const matchesColor = allocColorFilter === 'ALL' || colorCode === allocColorFilter;
      return matchesSearch && matchesSchool && matchesColor;
    });
  }, [students, allocSearch, allocSchoolFilter, allocColorFilter]);

  // Selected Student 360° Profile Object
  const profileStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  // Navigation items filtered by Role
  const navItems = [
    ...(roleMode === 'ADMIN'
      ? [
          { id: 'central_db', label: '1. Central Student Database', icon: Users, badge: 'All Students' },
          { id: 'vehicles_drivers', label: '2. Central Van Database', icon: Bus, badge: 'All Vans' },
          { id: 'allocation', label: '3. Drag & Drop Allocation', icon: ArrowRightLeft, badge: 'Shift Board' },
          { id: 'van_dashboard', label: '4. Van-Wise Dashboard', icon: TrendingUp },
          { id: 'salaries', label: '5. 50/50 Driver Salary', icon: Wallet, badge: '50/50 Rule' },
          { id: 'fees', label: '6. Fees, Ledger & Cash', icon: IndianRupee },
          { id: 'schools_students', label: '7. Schools & Timings', icon: SchoolIcon },
          { id: 'attendance', label: '8. Shift Attendance', icon: CalendarCheck },
          { id: 'dashboard', label: '9. Reports & Exports', icon: FileSpreadsheet },
          { id: 'audit', label: '10. Audit Logs', icon: ShieldCheck }
        ]
      : [
          { id: 'driver_portal', label: 'My Driver Mobile Portal', icon: Smartphone },
          { id: 'attendance', label: 'Mark Shift Attendance', icon: CalendarCheck },
          ...(roleMode === 'MORNING_DRIVER'
            ? [{ id: 'fees', label: 'Morning Fee Collection', icon: IndianRupee }]
            : [])
        ])
  ];

  useEffect(() => {
    const sbClient = supabase;
    if (!isSupabaseConfigured || !sbClient) return;
    sbClient.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (user) {
        setLoggedUserEmail(user.email || '');
        const { data: prof } = await sbClient
          .from('profiles')
          .select('role, driver_id')
          .eq('id', user.id)
          .single();
        if (prof?.role === 'DRIVER') {
          handleRoleChange('MORNING_DRIVER');
        } else {
          setRoleMode('ADMIN');
          setActiveTab('central_db');
        }
        setIsAuthenticated(true);
      }
    });
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both Email and Password.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setLoginError('Supabase environment variables are missing in Vercel. Use Quick Preview below or add VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setLoginLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    if (error || !data.user) {
      setLoginLoading(false);
      setLoginError(error?.message || 'Invalid login credentials.');
      return;
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, driver_id')
      .eq('id', data.user.id)
      .single();
    setLoginLoading(false);
    setLoggedUserEmail(data.user.email || loginEmail.trim());
    if (prof?.role === 'DRIVER') {
      handleRoleChange('MORNING_DRIVER');
    } else {
      setRoleMode('ADMIN');
      setActiveTab('central_db');
    }
    setIsAuthenticated(true);
    notify('Logged in via Supabase Auth!', 'success');
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setLoggedUserEmail('');
    setLoginPassword('');
    notify('Logged out safely.', 'success');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-3 rounded-2xl shadow">
              <Bus className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{firmName}</h1>
              <p className="text-xs text-slate-500">{firmContact}</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                {loginError}
              </div>
            )}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@schooltransport.in"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow transition"
            >
              {loginLoading ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 text-center">
              Quick Preview Access (Without Supabase Credentials)
            </p>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setRoleMode('ADMIN');
                  setActiveTab('central_db');
                  setLoggedUserEmail('Preview Admin');
                  setIsAuthenticated(true);
                }}
                className="py-2 px-2 rounded-xl bg-amber-100 text-amber-950 font-bold hover:bg-amber-200"
              >
                Admin Demo
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRoleChange('MORNING_DRIVER');
                  setLoggedUserEmail('Morning Driver');
                  setIsAuthenticated(true);
                }}
                className="py-2 px-2 rounded-xl bg-emerald-100 text-emerald-950 font-bold hover:bg-emerald-200"
              >
                Morning Driver
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRoleChange('EVENING_DRIVER');
                  setLoggedUserEmail('Evening Driver');
                  setIsAuthenticated(true);
                }}
                className="py-2 px-2 rounded-xl bg-sky-100 text-sky-950 font-bold hover:bg-sky-200"
              >
                Evening Driver
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* TOP BAR: BRANDING + ROLE SIMULATOR + SUPABASE SQL CONNECT */}
      <header className="bg-slate-900 text-white px-4 py-3 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-xl font-bold flex items-center justify-center shadow">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight">
                  {firmName}
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Asia/Kolkata • ₹ INR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {firmContact} • {firmCity}
              </p>
            </div>
          </div>

          {/* Role Switcher & Database Connection Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-lg flex items-center gap-1 border border-slate-700">
              <span className="text-[11px] text-slate-400 px-2 hidden sm:inline">Test Role (RLS):</span>
              <button
                onClick={() => handleRoleChange('ADMIN')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  roleMode === 'ADMIN'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Admin (Full)
              </button>
              <button
                onClick={() => handleRoleChange('MORNING_DRIVER')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  roleMode === 'MORNING_DRIVER'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Morning Driver
              </button>
              <button
                onClick={() => handleRoleChange('EVENING_DRIVER')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  roleMode === 'EVENING_DRIVER'
                    ? 'bg-sky-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Evening Driver (No Fees)
              </button>
            </div>

            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition"
              title="Clear demo data and start from 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Fresh (0)</span>
            </button>

            <button
              onClick={() => setShowSupabaseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Supabase SQL & Setup</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title={loggedUserEmail || 'Logout'}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-bounce">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-emerald-50 border-emerald-700'
                : toast.type === 'warning'
                ? 'bg-amber-900 text-amber-50 border-amber-700'
                : 'bg-rose-900 text-rose-50 border-rose-700'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
            {toast.type === 'error' && <X className="w-5 h-5 text-rose-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* HORIZONTAL MODULE NAVIGATION BAR */}
      <nav className="bg-white border-b border-slate-200 px-4 sticky top-[60px] z-20 shadow-sm overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-1 py-2">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <IconComponent className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                      isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ====================================================================
            TAB 1: VISUAL DRAG-AND-DROP ALLOCATION BOARD
        ==================================================================== */}
        {activeTab === 'allocation' && roleMode === 'ADMIN' && (
          <div className="space-y-5">
            {/* Top Banner & Color Legend */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                  Central Student Database & Independent Shift Allocation Board
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Drag any student card into a Morning or Evening Van (or use the quick <span className="font-semibold">+M / +E</span> buttons on mobile). Changing Morning never overwrites Evening!
                </p>
              </div>

              {/* Mandatory 4-Color Legend */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => setAllocColorFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg border font-medium ${
                    allocColorFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  All ({companyMetrics.activeStudentsCount})
                </button>
                <button
                  onClick={() => setAllocColorFilter('GREEN')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                    allocColorFilter === 'GREEN' ? 'ring-2 ring-emerald-500' : ''
                  } bg-emerald-50 text-emerald-800 border-emerald-300`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  GREEN: Both ({companyMetrics.greenCount})
                </button>
                <button
                  onClick={() => setAllocColorFilter('ORANGE')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                    allocColorFilter === 'ORANGE' ? 'ring-2 ring-amber-500' : ''
                  } bg-amber-50 text-amber-800 border-amber-300`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  ORANGE: Morning Only ({companyMetrics.orangeCount})
                </button>
                <button
                  onClick={() => setAllocColorFilter('BLUE')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                    allocColorFilter === 'BLUE' ? 'ring-2 ring-sky-500' : ''
                  } bg-sky-50 text-sky-800 border-sky-300`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  BLUE: Evening Only ({companyMetrics.blueCount})
                </button>
                <button
                  onClick={() => setAllocColorFilter('RED')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                    allocColorFilter === 'RED' ? 'ring-2 ring-rose-500' : ''
                  } bg-rose-50 text-rose-800 border-rose-300`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  RED: Unassigned ({companyMetrics.redCount})
                </button>
              </div>
            </div>

            {/* Bulk Student Selection & Assignment Toolbar */}
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-950">
                  Bulk Allocation ({selectedBulkStudents.length} selected):
                </span>
                <button
                  onClick={() =>
                    setSelectedBulkStudents(
                      selectedBulkStudents.length === filteredStudents.length
                        ? []
                        : filteredStudents.map((s) => s.id)
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-semibold hover:bg-indigo-100"
                >
                  {selectedBulkStudents.length === filteredStudents.length ? 'Clear Selection' : 'Select All Shown'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkTargetShift}
                  onChange={(e) => setBulkTargetShift(e.target.value as ShiftType)}
                  className="px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white font-semibold"
                >
                  <option value="MORNING">☀️ Morning Shift</option>
                  <option value="EVENING">🌙 Evening Shift</option>
                </select>
                <select
                  value={bulkTargetVan}
                  onChange={(e) => setBulkTargetVan(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white font-semibold"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} ({v.regNumber})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedBulkStudents.length === 0) {
                      notify('Select at least one student checkbox for bulk assignment.', 'warning');
                      return;
                    }
                    selectedBulkStudents.forEach((id) =>
                      assignStudentToVehicle(id, bulkTargetShift, bulkTargetVan)
                    );
                    setSelectedBulkStudents([]);
                    notify(`Bulk assigned ${selectedBulkStudents.length} students to ${bulkTargetShift} shift!`, 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm"
                >
                  Apply Bulk Assignment
                </button>
              </div>
            </div>

            {/* 3-Column Interactive Board: Central Database | Morning Board | Evening Board */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* COLUMN A: CENTRAL STUDENT DATABASE PANEL (4 cols) */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col max-h-[760px]">
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-700" />
                      Central Student List ({filteredStudents.length})
                    </h3>
                    <button
                      onClick={() => setShowAddStudentModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Student
                    </button>
                  </div>

                  {/* Search & School Filter */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={allocSearch}
                        onChange={(e) => setAllocSearch(e.target.value)}
                        placeholder="Search name, ID, mobile..."
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <select
                      value={allocSchoolFilter}
                      onChange={(e) => setAllocSchoolFilter(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ALL">All Schools</option>
                      {schools.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Draggable Student Cards */}
                <div className="p-3 space-y-2.5 overflow-y-auto flex-1">
                  {filteredStudents.map((stu) => {
                    const col = getStudentColorStatus(stu);
                    const sch = schools.find((s) => s.id === stu.schoolId);
                    const mVeh = vehicles.find((v) => v.id === stu.morningVehicleId);
                    const eVeh = vehicles.find((v) => v.id === stu.eveningVehicleId);
                    const timing = getStudentTiming(stu);

                    return (
                      <div
                        key={stu.id}
                        draggable
                        onDragStart={() => setDraggedStudentId(stu.id)}
                        className={`p-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing ${col.cardBorder}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={selectedBulkStudents.includes(stu.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBulkStudents((prev) => [...prev, stu.id]);
                                  } else {
                                    setSelectedBulkStudents((prev) => prev.filter((id) => id !== stu.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600"
                              />
                              <button
                                onClick={() => setSelectedStudentId(stu.id)}
                                className="font-bold text-sm text-slate-900 hover:text-indigo-600 underline decoration-dotted text-left"
                              >
                                {stu.name}
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {stu.code} • {stu.className}-{stu.division} • {sch?.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{timing.arrival} / {timing.departure}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${col.badgeBg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                              {col.code}
                            </span>
                            <div className="text-xs font-bold text-slate-800 mt-1">
                              {formatINR(stu.monthlyFee)}/mo
                            </div>
                          </div>
                        </div>

                        {/* Current Shift Badges & Quick Assign Selectors */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[11px]">
                          <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 rounded-lg px-2 py-1">
                            <span className="font-medium text-amber-900 truncate">
                              ☀️ M: {mVeh ? mVeh.code : 'None'}
                            </span>
                            <button
                              onClick={() => setQuickAssignModal({ studentId: stu.id, shift: 'MORNING' })}
                              className="text-indigo-600 hover:text-indigo-800 font-bold ml-1"
                              title="Assign Morning Van"
                            >
                              Edit
                            </button>
                          </div>

                          <div className="flex items-center justify-between bg-sky-50/70 border border-sky-200/80 rounded-lg px-2 py-1">
                            <span className="font-medium text-sky-900 truncate">
                              🌙 E: {eVeh ? eVeh.code : 'None'}
                            </span>
                            <button
                              onClick={() => setQuickAssignModal({ studentId: stu.id, shift: 'EVENING' })}
                              className="text-indigo-600 hover:text-indigo-800 font-bold ml-1"
                              title="Assign Evening Van"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUMN B: MORNING ALLOCATION BOARD (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                        ☀️ MORNING SHIFT ALLOCATION BOARD
                      </h3>
                      <p className="text-[11px] text-amber-800">
                        Drop student card on any Morning Van below
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 text-xs font-bold">
                      Independent Shift
                    </span>
                  </div>

                  <div className="space-y-3">
                    {vehicles.map((veh) => {
                      const mDrv = drivers.find((d) => d.id === veh.morningDriverId);
                      const allocated = students.filter(
                        (s) => s.status === 'ACTIVE' && s.morningVehicleId === veh.id
                      );
                      const availableSeats = veh.capacity - allocated.length;
                      const isOverCapacity = allocated.length > veh.capacity;

                      return (
                        <div
                          key={veh.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedStudentId) {
                              assignStudentToVehicle(draggedStudentId, 'MORNING', veh.id);
                              setDraggedStudentId(null);
                            }
                          }}
                          className={`rounded-xl bg-white p-3.5 border-2 transition shadow-sm ${
                            isOverCapacity
                              ? 'border-rose-400 bg-rose-50/20'
                              : 'border-amber-200 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {veh.regNumber}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                  {veh.code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Driver: <span className="font-semibold">{mDrv?.name || 'Unassigned'}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  availableSeats <= 0
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {allocated.length}/{veh.capacity} Seats
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {availableSeats >= 0 ? `${availableSeats} free` : `${Math.abs(availableSeats)} over capacity!`}
                              </div>
                            </div>
                          </div>

                          {/* Allocated Morning Students List */}
                          <div className="mt-3 space-y-1.5">
                            {allocated.length === 0 ? (
                              <div className="text-xs text-slate-400 italic py-3 text-center border border-dashed border-slate-200 rounded-lg">
                                Drag & drop student here for Morning Shift
                              </div>
                            ) : (
                              allocated.map((stu) => {
                                const col = getStudentColorStatus(stu);
                                return (
                                  <div
                                    key={stu.id}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                                      <button
                                        onClick={() => setSelectedStudentId(stu.id)}
                                        className="font-semibold text-slate-800 hover:text-indigo-600 truncate"
                                      >
                                        {stu.name}
                                      </button>
                                      <span className="text-[11px] text-slate-500">({stu.className})</span>
                                    </div>
                                    <button
                                      onClick={() => assignStudentToVehicle(stu.id, 'MORNING', null)}
                                      className="text-rose-600 hover:bg-rose-100 p-1 rounded transition"
                                      title="Remove from Morning Van"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* COLUMN C: EVENING ALLOCATION BOARD (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-sky-500/10 border border-sky-300 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-sky-950 flex items-center gap-1.5">
                        🌙 EVENING SHIFT ALLOCATION BOARD
                      </h3>
                      <p className="text-[11px] text-sky-800">
                        Drop student card on any Evening Van below
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-sky-200 text-sky-950 text-xs font-bold">
                      Independent Shift
                    </span>
                  </div>

                  <div className="space-y-3">
                    {vehicles.map((veh) => {
                      const eDrv = drivers.find((d) => d.id === veh.eveningDriverId);
                      const allocated = students.filter(
                        (s) => s.status === 'ACTIVE' && s.eveningVehicleId === veh.id
                      );
                      const availableSeats = veh.capacity - allocated.length;
                      const isOverCapacity = allocated.length > veh.capacity;

                      return (
                        <div
                          key={veh.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedStudentId) {
                              assignStudentToVehicle(draggedStudentId, 'EVENING', veh.id);
                              setDraggedStudentId(null);
                            }
                          }}
                          className={`rounded-xl bg-white p-3.5 border-2 transition shadow-sm ${
                            isOverCapacity
                              ? 'border-rose-400 bg-rose-50/20'
                              : 'border-sky-200 hover:border-sky-400'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {veh.regNumber}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                  {veh.code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Driver: <span className="font-semibold">{eDrv?.name || 'Unassigned'}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  availableSeats <= 0
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {allocated.length}/{veh.capacity} Seats
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {availableSeats >= 0 ? `${availableSeats} free` : `${Math.abs(availableSeats)} over capacity!`}
                              </div>
                            </div>
                          </div>

                          {/* Allocated Evening Students List */}
                          <div className="mt-3 space-y-1.5">
                            {allocated.length === 0 ? (
                              <div className="text-xs text-slate-400 italic py-3 text-center border border-dashed border-slate-200 rounded-lg">
                                Drag & drop student here for Evening Shift
                              </div>
                            ) : (
                              allocated.map((stu) => {
                                const col = getStudentColorStatus(stu);
                                return (
                                  <div
                                    key={stu.id}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                                      <button
                                        onClick={() => setSelectedStudentId(stu.id)}
                                        className="font-semibold text-slate-800 hover:text-indigo-600 truncate"
                                      >
                                        {stu.name}
                                      </button>
                                      <span className="text-[11px] text-slate-500">({stu.className})</span>
                                    </div>
                                    <button
                                      onClick={() => assignStudentToVehicle(stu.id, 'EVENING', null)}
                                      className="text-rose-600 hover:bg-rose-100 p-1 rounded transition"
                                      title="Remove from Evening Van"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation History Log */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                Live Shift Allocation Audit History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-2">Student</th>
                      <th className="py-2 px-2">Shift</th>
                      <th className="py-2 px-2">Previous Vehicle</th>
                      <th className="py-2 px-2">New Vehicle</th>
                      <th className="py-2 px-2">Changed By</th>
                      <th className="py-2 px-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allocationHistory.slice(0, 6).map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-2 font-semibold">{item.studentName}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              item.shift === 'MORNING'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-sky-100 text-sky-900'
                            }`}
                          >
                            {item.shift}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-600">{item.prevVehicle}</td>
                        <td className="py-2 px-2 font-semibold text-slate-900">{item.newVehicle}</td>
                        <td className="py-2 px-2 text-slate-600">{item.changedBy}</td>
                        <td className="py-2 px-2 text-slate-500">{item.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: VAN-WISE COMPLETE DASHBOARD (With Single-Invoice Rule)
        ==================================================================== */}
        {activeTab === 'van_dashboard' && roleMode === 'ADMIN' && (
          <div className="space-y-5">
            {/* Vehicle Selector Header */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Bus className="w-5 h-5 text-indigo-600" />
                  Van-Wise Complete Financial & Shift Dashboard
                </h2>
                <p className="text-xs text-slate-600">
                  Shows separate Morning/Evening occupancy and splits student monthly fee vs. vehicle allocation share so a dual-van student is never double-counted.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVanId(v.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      selectedVanId === v.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {v.code} • {v.regNumber}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const van = vehicles.find((v) => v.id === selectedVanId) || vehicles[0];
              const mDriver = drivers.find((d) => d.id === van.morningDriverId);
              const eDriver = drivers.find((d) => d.id === van.eveningDriverId);

              const mStudents = students.filter((s) => s.status === 'ACTIVE' && s.morningVehicleId === van.id);
              const eStudents = students.filter((s) => s.status === 'ACTIVE' && s.eveningVehicleId === van.id);

              // Unique students associated with this van (in Morning, Evening, or Both)
              const uniqueVanStudents = students.filter(
                (s) =>
                  s.status === 'ACTIVE' &&
                  (s.morningVehicleId === van.id || s.eveningVehicleId === van.id)
              );

              // Financial breakdowns for this Van
              let fullStudentFeeSum = 0;
              let vanShiftAttributedValue = 0;
              let vanDriverEntitlementSum = 0;
              let vanBusinessShareSum = 0;
              let totalPaidOnSingleInvoices = 0;
              let totalOutstandingOnSingleInvoices = 0;

              const studentRows = uniqueVanStudents.map((stu) => {
                const inMorning = stu.morningVehicleId === van.id;
                const inEvening = stu.eveningVehicleId === van.id;
                const shiftLabel =
                  inMorning && inEvening ? 'BOTH (Morning + Evening)' : inMorning ? 'MORNING ONLY' : 'EVENING ONLY';

                const half = Math.round(stu.monthlyFee * 0.5);
                const thisVanShare = (inMorning ? half : 0) + (inEvening ? half : 0);

                // Driver salary entitlement on this van
                let driverEntitlement = 0;
                if (inMorning && mDriver) {
                  driverEntitlement += mDriver.salaryMethod === 'FIFTY_FIFTY' ? half : mDriver.perStudentAmount;
                }
                if (inEvening && eDriver) {
                  driverEntitlement += eDriver.salaryMethod === 'FIFTY_FIFTY' ? half : eDriver.perStudentAmount;
                }

                const businessShare = Math.max(0, thisVanShare - driverEntitlement);
                const inv = invoices.find((i) => i.studentId === stu.id && i.month === '2026-11');
                const paid = inv?.paidAmount || 0;
                const outstanding = Math.max(0, (inv?.feeSnapshot || stu.monthlyFee) - paid);

                fullStudentFeeSum += stu.monthlyFee;
                vanShiftAttributedValue += thisVanShare;
                vanDriverEntitlementSum += driverEntitlement;
                vanBusinessShareSum += businessShare;
                totalPaidOnSingleInvoices += paid;
                totalOutstandingOnSingleInvoices += outstanding;

                return {
                  stu,
                  shiftLabel,
                  thisVanShare,
                  driverEntitlement,
                  businessShare,
                  paid,
                  outstanding
                };
              });

              return (
                <>
                  {/* Vehicle Summary & Shift Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold uppercase text-indigo-600">{van.code} Details</span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{van.regNumber}</h3>
                      <p className="text-xs text-slate-600">{van.model} • Capacity: {van.capacity} Seats</p>
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
                        <div>☀️ Morning Driver: <span className="font-semibold">{mDriver?.name} ({mDriver?.mobile})</span></div>
                        <div>🌙 Evening Driver: <span className="font-semibold">{eDriver?.name} ({eDriver?.mobile})</span></div>
                        <div>Helper: <span className="text-slate-600">{van.helperName}</span></div>
                      </div>
                    </div>

                    <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900">☀️ MORNING SHIFT SUMMARY</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-950">
                          {mStudents.length}/{van.capacity} Occupied
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div className="bg-white p-2 rounded-xl border border-amber-100">
                          <div className="text-base font-bold text-slate-900">{mStudents.length}</div>
                          <div className="text-[11px] text-slate-500">Allocated</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-amber-100">
                          <div className="text-base font-bold text-emerald-700">
                            {attendance.filter((a) => a.vehicleId === van.id && a.shift === 'MORNING' && a.date === attDate && a.status === 'PRESENT').length}
                          </div>
                          <div className="text-[11px] text-slate-500">Present Today</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-amber-100">
                          <div className="text-base font-bold text-indigo-700">
                            {Math.max(0, van.capacity - mStudents.length)}
                          </div>
                          <div className="text-[11px] text-slate-500">Free Seats</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-900">🌙 EVENING SHIFT SUMMARY</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-200 text-sky-950">
                          {eStudents.length}/{van.capacity} Occupied
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div className="bg-white p-2 rounded-xl border border-sky-100">
                          <div className="text-base font-bold text-slate-900">{eStudents.length}</div>
                          <div className="text-[11px] text-slate-500">Allocated</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-sky-100">
                          <div className="text-base font-bold text-emerald-700">
                            {attendance.filter((a) => a.vehicleId === van.id && a.shift === 'EVENING' && a.date === attDate && a.status === 'PRESENT').length}
                          </div>
                          <div className="text-[11px] text-slate-500">Present Today</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-sky-100">
                          <div className="text-base font-bold text-indigo-700">
                            {Math.max(0, van.capacity - eStudents.length)}
                          </div>
                          <div className="text-[11px] text-slate-500">Free Seats</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary Cards with Single-Invoice Rule Explanation */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="text-[11px] text-slate-500">Full Monthly Fee of Students</div>
                      <div className="text-lg font-bold text-slate-900 mt-1">{formatINR(fullStudentFeeSum)}</div>
                      <div className="text-[10px] text-slate-400">Across {uniqueVanStudents.length} unique students</div>
                    </div>
                    <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
                      <div className="text-[11px] text-indigo-800 font-semibold">This Van's Shift Share Value</div>
                      <div className="text-lg font-bold text-indigo-950 mt-1">{formatINR(vanShiftAttributedValue)}</div>
                      <div className="text-[10px] text-indigo-700">50% per active shift on this van</div>
                    </div>
                    <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                      <div className="text-[11px] text-emerald-800 font-semibold">Invoices Collected</div>
                      <div className="text-lg font-bold text-emerald-950 mt-1">{formatINR(totalPaidOnSingleInvoices)}</div>
                      <div className="text-[10px] text-emerald-700">Single student invoice ledger</div>
                    </div>
                    <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200">
                      <div className="text-[11px] text-rose-800 font-semibold">Student Invoice Outstanding</div>
                      <div className="text-lg font-bold text-rose-950 mt-1">{formatINR(totalOutstandingOnSingleInvoices)}</div>
                      <div className="text-[10px] text-rose-700">Never duplicated across vans</div>
                    </div>
                    <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
                      <div className="text-[11px] text-amber-900 font-semibold">Van Driver Share / Business</div>
                      <div className="text-sm font-bold text-amber-950 mt-1">
                        Drv: {formatINR(vanDriverEntitlementSum)} | Biz: {formatINR(vanBusinessShareSum)}
                      </div>
                      <div className="text-[10px] text-amber-800">Based on shift rules</div>
                    </div>
                  </div>

                  {/* Detailed Van Student Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-900">
                        Students Allocated to {van.regNumber} ({van.code})
                      </h3>
                      <span className="text-xs text-slate-500">
                        Click any student name for full 360° profile & ledger
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Student</th>
                            <th className="py-2.5 px-3">Class & School</th>
                            <th className="py-2.5 px-3">Shift in This Van</th>
                            <th className="py-2.5 px-3">Full Monthly Fee</th>
                            <th className="py-2.5 px-3">This Van Share</th>
                            <th className="py-2.5 px-3">Invoice Paid</th>
                            <th className="py-2.5 px-3">Invoice Outstanding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentRows.map((r) => {
                            const sch = schools.find((s) => s.id === r.stu.schoolId);
                            return (
                              <tr key={r.stu.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3">
                                  <button
                                    onClick={() => setSelectedStudentId(r.stu.id)}
                                    className="font-bold text-indigo-600 hover:underline"
                                  >
                                    {r.stu.name}
                                  </button>
                                  <div className="text-[11px] text-slate-500">{r.stu.fatherMobile}</div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-medium">{r.stu.className}</div>
                                  <div className="text-[11px] text-slate-500">{sch?.name}</div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800">
                                    {r.shiftLabel}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold">{formatINR(r.stu.monthlyFee)}</td>
                                <td className="py-2.5 px-3 font-bold text-indigo-700">{formatINR(r.thisVanShare)}</td>
                                <td className="py-2.5 px-3 font-semibold text-emerald-700">{formatINR(r.paid)}</td>
                                <td className="py-2.5 px-3 font-bold text-rose-700">{formatINR(r.outstanding)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ====================================================================
            TAB 3: DRIVER SALARY MANAGEMENT & 50/50 FEE-SHARING ENGINE
        ==================================================================== */}
        {activeTab === 'salaries' && roleMode === 'ADMIN' && (
          <div className="space-y-6">
            {/* Mandatory 50/50 Rule Verification Matrix */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    50/50 Student Fee-Sharing Live Calculation Table (Method C)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Calculated strictly on each student's configured monthly transport fee and active shift allocation—never on who collected the cash, and never transferring an unassigned shift's 50% to the other driver.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Live Recalculation Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Allocation Status</th>
                      <th className="py-2.5 px-3">Monthly Fee</th>
                      <th className="py-2.5 px-3">Morning Driver (50%)</th>
                      <th className="py-2.5 px-3">Evening Driver (50%)</th>
                      <th className="py-2.5 px-3">Business Retained Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {salaryCalculations.studentSplitRows.map((row) => {
                      const col = getStudentColorStatus(row.student);
                      return (
                        <tr key={row.student.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {row.student.name} ({row.student.code})
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${col.badgeBg}`}>
                              {col.code}: {col.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold">{formatINR(row.student.monthlyFee)}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-emerald-700">{formatINR(row.morningShare)}</span>
                            <span className="text-[11px] text-slate-500 block">
                              {row.mDriver ? `${row.mDriver.name} (${row.mVeh?.code})` : 'No Morning Van'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-sky-700">{formatINR(row.eveningShare)}</span>
                            <span className="text-[11px] text-slate-500 block">
                              {row.eDriver ? `${row.eDriver.name} (${row.eVeh?.code})` : 'No Evening Van'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-indigo-700">{formatINR(row.businessShare)}</span>
                            <span className="text-[11px] text-slate-500 block">
                              {row.businessShare === row.student.monthlyFee
                                ? '100% Business (Unassigned)'
                                : row.businessShare > 0
                                ? '50% Business (Single Shift)'
                                : '₹0 (Both Shifts Assigned)'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Driver Salary Statements & Method Configurator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {salaryCalculations.driverStatements.map((stmt) => (
                <div
                  key={stmt.driver.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-indigo-600">{stmt.driver.code}</span>
                        <h3 className="text-base font-bold text-slate-900">{stmt.driver.name}</h3>
                        <p className="text-xs text-slate-500">
                          Shift: {stmt.driver.permittedShift} • Eligible Student-Shifts: {stmt.eligibleShiftsCount}
                        </p>
                      </div>

                      {/* Configurable Salary Method Selector */}
                      <div className="text-right">
                        <label className="text-[10px] font-bold text-slate-500 block">Salary Method</label>
                        <select
                          value={stmt.driver.salaryMethod}
                          onChange={(e) => {
                            const newMethod = e.target.value as SalaryMethod;
                            setDrivers((prev) =>
                              prev.map((d) =>
                                d.id === stmt.driver.id
                                  ? {
                                      ...d,
                                      salaryMethod: newMethod,
                                      fixedAmount: newMethod === 'FIXED' ? 14500 : newMethod === 'HYBRID' ? 8000 : 0,
                                      perStudentAmount: newMethod === 'PER_STUDENT' ? 400 : newMethod === 'HYBRID' ? 300 : 0
                                    }
                                  : d
                              )
                            );
                            logAudit(
                              'SALARY_METHOD_UPDATED',
                              'Driver Salaries',
                              `Changed ${stmt.driver.name} salary method to ${newMethod}`
                            );
                            notify(`Updated ${stmt.driver.name} to ${newMethod} method.`, 'success');
                          }}
                          className="mt-0.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-slate-50"
                        >
                          <option value="FIFTY_FIFTY">Method C: 50/50 Fee Share</option>
                          <option value="FIXED">Method A: Fixed Monthly</option>
                          <option value="PER_STUDENT">Method B: Per-Student</option>
                          <option value="HYBRID">Method D: Hybrid</option>
                        </select>
                      </div>
                    </div>

                    {/* Statement Breakdown */}
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      {stmt.driver.salaryMethod === 'FIFTY_FIFTY' && (
                        <div className="flex justify-between">
                          <span>50/50 Student Fee Share ({stmt.eligibleShiftsCount} shifts):</span>
                          <span className="font-bold text-emerald-700">{formatINR(stmt.sharingPart)}</span>
                        </div>
                      )}
                      {(stmt.driver.salaryMethod === 'FIXED' || stmt.driver.salaryMethod === 'HYBRID') && (
                        <div className="flex justify-between">
                          <span>Fixed Monthly Component:</span>
                          <span className="font-bold">{formatINR(stmt.fixedPart)}</span>
                        </div>
                      )}
                      {(stmt.driver.salaryMethod === 'PER_STUDENT' || stmt.driver.salaryMethod === 'HYBRID') && (
                        <div className="flex justify-between">
                          <span>Per-Student Component ({stmt.eligibleShiftsCount} × {formatINR(stmt.driver.perStudentAmount)}):</span>
                          <span className="font-bold">{formatINR(stmt.perStudentPart)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>Incentives / Deductions:</span>
                        <span>+{formatINR(stmt.incentive)} / -{formatINR(stmt.deduction)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                        <span>Net Salary Payable (Nov 2026):</span>
                        <span>{formatINR(stmt.netPayable)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-700 font-semibold">Paid: {formatINR(stmt.paidAmount)}</span>
                        <span className="text-rose-700 font-bold">Balance Due: {formatINR(stmt.remainingPayable)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Approve & Pay Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        stmt.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : stmt.status === 'APPROVED'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Status: {stmt.status}
                    </span>

                    <div className="flex items-center gap-2">
                      {stmt.status === 'DRAFT' && (
                        <button
                          onClick={() => {
                            setSalaryApprovals((prev) => ({
                              ...prev,
                              [stmt.driver.id]: {
                                ...(prev[stmt.driver.id] || {
                                  driverId: stmt.driver.id,
                                  month: '2026-11',
                                  manualAdjustment: 0,
                                  adjustmentReason: '',
                                  paidAmount: 0
                                }),
                                status: 'APPROVED'
                              }
                            }));
                            logAudit('SALARY_APPROVED', 'Driver Salaries', `Approved Nov 2026 statement for ${stmt.driver.name}`);
                            notify(`Approved salary statement for ${stmt.driver.name}.`, 'success');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                        >
                          Approve Statement
                        </button>
                      )}
                      {stmt.remainingPayable > 0 && (
                        <button
                          onClick={() => {
                            setSalaryApprovals((prev) => ({
                              ...prev,
                              [stmt.driver.id]: {
                                ...(prev[stmt.driver.id] || {
                                  driverId: stmt.driver.id,
                                  month: '2026-11',
                                  manualAdjustment: 0,
                                  adjustmentReason: ''
                                }),
                                status: 'PAID',
                                paidAmount: stmt.netPayable
                              }
                            }));
                            logAudit(
                              'SALARY_PAID',
                              'Driver Salaries',
                              `Recorded full salary payout of ${formatINR(stmt.netPayable)} to ${stmt.driver.name}`
                            );
                            notify(`Paid ${formatINR(stmt.netPayable)} to ${stmt.driver.name}!`, 'success');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          Record Payment ({formatINR(stmt.remainingPayable)})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: FEES, INVOICES, ADVANCE CREDIT & DRIVER CASH VERIFICATION
        ==================================================================== */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Fee Collection Form (Admin or Morning Driver Only) */}
              <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-600" />
                  {roleMode === 'MORNING_DRIVER'
                    ? 'Morning Driver Fee Collection (Van-01 Students Only)'
                    : 'Collect Student Transport Fee / Advance'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {roleMode === 'MORNING_DRIVER'
                    ? 'Entries recorded by a Morning Driver are automatically marked PENDING ADMIN VERIFICATION.'
                    : 'Supports partial payments, full payments, and multi-month advance credit without double counting.'}
                </p>

                <form onSubmit={handleRecordPayment} className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Select Student</label>
                    <select
                      value={paymentModalStudentId}
                      onChange={(e) => setPaymentModalStudentId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-medium"
                    >
                      {students
                        .filter((s) =>
                          roleMode === 'MORNING_DRIVER' ? s.morningVehicleId === 'veh-1' : true
                        )
                        .map((s) => {
                          const inv = invoices.find((i) => i.studentId === s.id);
                          const due = Math.max(0, (inv?.feeSnapshot || s.monthlyFee) - (inv?.paidAmount || 0));
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code}) — Fee: {formatINR(s.monthlyFee)} | Nov Due: {formatINR(due)}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Amount Received (₹)</label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                        placeholder="e.g. 1500 or 4500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-medium"
                      >
                        <option value="CASH">Cash (रोकड़)</option>
                        <option value="UPI">UPI / GPay / PhonePe</option>
                        <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                        <option value="CHEQUE">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Reference / Remarks</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                      placeholder="UPI Ref / Cheque No / Advance Note"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow transition"
                  >
                    Record Payment & Generate Receipt
                  </button>
                </form>

                {/* Printable Receipt Preview Card */}
                {selectedReceipt && (
                  <div className="mt-5 p-4 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
                          {firmName}
                        </span>
                        <span className="text-[10px] text-slate-300 block">{firmContact}</span>
                        <h4 className="font-bold text-sm mt-0.5">Receipt: {selectedReceipt.receiptNo}</h4>
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print / PDF
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-slate-300">
                      <div>Student: <span className="text-white font-semibold">{students.find((s) => s.id === selectedReceipt.studentId)?.name}</span></div>
                      <div>Date: <span className="text-white">{selectedReceipt.date}</span></div>
                      <div>Total Paid: <span className="text-emerald-400 font-bold">{formatINR(selectedReceipt.amount)}</span></div>
                      <div>Mode: <span className="text-white">{selectedReceipt.method}</span></div>
                      <div>Nov Invoice Adjusted: <span className="text-white">{formatINR(selectedReceipt.invoiceAllocated)}</span></div>
                      <div>Advance Credit Added: <span className="text-amber-300 font-semibold">{formatINR(selectedReceipt.advanceAdded)}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Driver Cash Verification & Payment Ledger Table */}
              <div className="lg:col-span-7 space-y-5">
                {roleMode === 'ADMIN' && (
                  <div className="bg-amber-50/80 rounded-2xl border border-amber-300 p-4 shadow-sm">
                    <h3 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      Morning Driver Cash Settlement Queue (Requires Admin Confirmation)
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Cash collected by Morning Drivers remains pending until Admin verifies physical cash handover.
                    </p>
                    <div className="mt-3 space-y-2">
                      {payments.filter((p) => p.collectorRole === 'MORNING_DRIVER').map((p) => {
                        const stu = students.find((s) => s.id === p.studentId);
                        return (
                          <div
                            key={p.id}
                            className="bg-white p-3 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900">{p.receiptNo}</span> •{' '}
                              <span className="font-semibold text-indigo-700">{stu?.name}</span> •{' '}
                              <span className="font-bold text-emerald-700">{formatINR(p.amount)}</span> ({p.method})
                              <div className="text-[11px] text-slate-500">
                                Collected by: {p.receivedBy} on {p.date} • Current Status:{' '}
                                <span className="font-bold text-amber-900">{p.verificationStatus}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleVerifyDriverCash(p.id, 'VERIFIED')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                              >
                                Verify Cash
                              </button>
                              <button
                                onClick={() => handleVerifyDriverCash(p.id, 'PARTIALLY_VERIFIED')}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500"
                              >
                                Partial
                              </button>
                              <button
                                onClick={() => handleVerifyDriverCash(p.id, 'DISPUTED')}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500"
                              >
                                Dispute
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Payments & Audited Reversal Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">
                      Receipts & Audited Payment Ledger (No Silent Deletions)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Receipt</th>
                          <th className="py-2.5 px-3">Student</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Allocation</th>
                          <th className="py-2.5 px-3">Collector</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p) => {
                          const stu = students.find((s) => s.id === p.studentId);
                          return (
                            <tr key={p.id} className={p.verificationStatus === 'REVERSED' ? 'bg-rose-50/40 line-through text-slate-400' : ''}>
                              <td className="py-2.5 px-3 font-bold">{p.receiptNo}</td>
                              <td className="py-2.5 px-3 font-semibold">{stu?.name}</td>
                              <td className="py-2.5 px-3 font-bold text-emerald-700">{formatINR(p.amount)}</td>
                              <td className="py-2.5 px-3 text-[11px]">
                                Inv: {formatINR(p.invoiceAllocated)} | Adv: {formatINR(p.advanceAdded)}
                              </td>
                              <td className="py-2.5 px-3 text-[11px]">{p.receivedBy}</td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.verificationStatus === 'VERIFIED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : p.verificationStatus === 'PENDING_VERIFICATION'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {p.verificationStatus}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedReceipt(p)}
                                    className="text-indigo-600 hover:underline font-semibold"
                                  >
                                    Receipt
                                  </button>
                                  {roleMode === 'ADMIN' && p.verificationStatus !== 'REVERSED' && (
                                    <button
                                      onClick={() => setReversalModalPayment(p)}
                                      className="text-rose-600 hover:underline font-semibold"
                                    >
                                      Reverse
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: MORNING & EVENING ATTENDANCE MANAGEMENT
        ==================================================================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-indigo-600" />
                  Shift-Wise Student Attendance (Separate Morning & Evening)
                </h2>
                <p className="text-xs text-slate-600">
                  Stores exact school timing snapshot on the attendance record and prevents duplicate entries per student/date/shift.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="date"
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  disabled={roleMode !== 'ADMIN'}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold"
                />
                <button
                  onClick={() => roleMode === 'ADMIN' && setAttShift('MORNING')}
                  className={`px-3 py-1.5 rounded-xl font-bold ${
                    attShift === 'MORNING' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  ☀️ Morning Shift
                </button>
                <button
                  onClick={() => roleMode === 'ADMIN' && setAttShift('EVENING')}
                  className={`px-3 py-1.5 rounded-xl font-bold ${
                    attShift === 'EVENING' ? 'bg-sky-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  🌙 Evening Shift
                </button>
                {roleMode === 'ADMIN' && (
                  <select
                    value={attVehicleId}
                    onChange={(e) => setAttVehicleId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl font-semibold"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} ({v.regNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-sm">
                  Students Assigned to {vehicles.find((v) => v.id === attVehicleId)?.regNumber} ({attShift})
                </span>
                <button
                  onClick={() => {
                    const list = students.filter((s) =>
                      attShift === 'MORNING' ? s.morningVehicleId === attVehicleId : s.eveningVehicleId === attVehicleId
                    );
                    list.forEach((s) => handleMarkAttendance(s.id, 'PRESENT'));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Mark All Present
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {students
                  .filter((s) =>
                    attShift === 'MORNING' ? s.morningVehicleId === attVehicleId : s.eveningVehicleId === attVehicleId
                  )
                  .map((stu) => {
                    const rec = attendance.find(
                      (a) => a.studentId === stu.id && a.date === attDate && a.shift === attShift
                    );
                    const timing = getStudentTiming(stu);
                    return (
                      <div key={stu.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-sm text-slate-900">{stu.name}</div>
                          <div className="text-xs text-slate-500">
                            {stu.className} • Parent: {stu.parentName} ({stu.fatherMobile}) • Timing: {timing.arrival} - {timing.departure}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {(['PRESENT', 'ABSENT', 'LEAVE', 'NOT_TRAVELLING'] as AttendanceStatus[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => handleMarkAttendance(stu.id, st)}
                              className={`px-2.5 py-1.5 rounded-xl font-bold border transition ${
                                rec?.status === st
                                  ? st === 'PRESENT'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : st === 'ABSENT'
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-amber-500 text-slate-950 border-amber-500'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {st.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 1: CENTRAL STUDENT DATABASE (PURE MASTER REGISTER OF ALL STUDENTS)
        ==================================================================== */}
        {activeTab === 'central_db' && roleMode === 'ADMIN' && (
          <div className="space-y-5">
            {/* Top Summary & Action Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Master Student Register
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Total: {students.length} Students ({students.filter((s) => s.status === 'ACTIVE').length} Active)
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Central Student Database (सारे स्टूडेंट्स का पूरा रिकॉर्ड)
                  </h2>
                  <p className="text-xs text-slate-600">
                    यह आपका मुख्य स्टूडेंट रजिस्टर है—यहाँ हर बच्चे का Student ID, नाम, स्कूल, क्लास, डिवीज़न, माता-पिता के दोनों मोबाइल नंबर, घर का पता, एडमिशन तारीख, मासिक फीस और सुबह/शाम की वैन का पूरा डेटा एक जगह सेव रहता है।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> + Add New Student
                  </button>
                  <button
                    onClick={() => setShowBulkImportModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Bulk Excel/CSV Import
                  </button>
                  <button
                    onClick={() => handleExportCSV('COMPLETE_STUDENTS')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Download className="w-4 h-4" /> Export Excel/CSV
                  </button>
                  <button
                    onClick={() => setActiveTab('allocation')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition"
                  >
                    <ArrowRightLeft className="w-4 h-4" /> Open Drag & Drop Board →
                  </button>
                </div>
              </div>

              {/* Quick Color Status Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
                <button
                  onClick={() => setDbColorFilter('ALL')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    dbColorFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="text-[11px] opacity-80">All Database Records</div>
                  <div className="text-base font-bold">{students.length} Students</div>
                </button>
                <button
                  onClick={() => setDbColorFilter('GREEN')}
                  className={`p-2.5 rounded-xl border text-left transition bg-emerald-50 text-emerald-900 border-emerald-300 ${
                    dbColorFilter === 'GREEN' ? 'ring-2 ring-emerald-600' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> GREEN (Both Shifts)
                  </div>
                  <div className="text-base font-bold">{companyMetrics.greenCount} Students</div>
                </button>
                <button
                  onClick={() => setDbColorFilter('ORANGE')}
                  className={`p-2.5 rounded-xl border text-left transition bg-amber-50 text-amber-900 border-amber-300 ${
                    dbColorFilter === 'ORANGE' ? 'ring-2 ring-amber-600' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> ORANGE (Morning Only)
                  </div>
                  <div className="text-base font-bold">{companyMetrics.orangeCount} Students</div>
                </button>
                <button
                  onClick={() => setDbColorFilter('BLUE')}
                  className={`p-2.5 rounded-xl border text-left transition bg-sky-50 text-sky-900 border-sky-300 ${
                    dbColorFilter === 'BLUE' ? 'ring-2 ring-sky-600' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" /> BLUE (Evening Only)
                  </div>
                  <div className="text-base font-bold">{companyMetrics.blueCount} Students</div>
                </button>
                <button
                  onClick={() => setDbColorFilter('RED')}
                  className={`p-2.5 rounded-xl border text-left transition bg-rose-50 text-rose-900 border-rose-300 ${
                    dbColorFilter === 'RED' ? 'ring-2 ring-rose-600' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> RED (No Vehicle)
                  </div>
                  <div className="text-base font-bold">{companyMetrics.redCount} Students</div>
                </button>
              </div>

              {/* Comprehensive Search & 6 Filters (School, Class, Division, Morning Van, Evening Van, Status) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                    placeholder="Name, ID, Mobile, Address..."
                    className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <select
                  value={dbSchoolFilter}
                  onChange={(e) => setDbSchoolFilter(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Schools</option>
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
                <select
                  value={dbClassFilter}
                  onChange={(e) => setDbClassFilter(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Classes</option>
                  {['Nursery', 'LKG', 'UKG', 'KG', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={dbDivisionFilter}
                  onChange={(e) => setDbDivisionFilter(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Divisions (A/B/C)</option>
                  <option value="A">Division A</option>
                  <option value="B">Division B</option>
                  <option value="C">Division C</option>
                </select>
                <select
                  value={dbMorningVanFilter}
                  onChange={(e) => setDbMorningVanFilter(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Morning Vans</option>
                  <option value="NONE">Unassigned Morning</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>☀️ {v.code} ({v.regNumber})</option>
                  ))}
                </select>
                <select
                  value={dbEveningVanFilter}
                  onChange={(e) => setDbEveningVanFilter(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Evening Vans</option>
                  <option value="NONE">Unassigned Evening</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>🌙 {v.code} ({v.regNumber})</option>
                  ))}
                </select>
              </div>

              {/* Master Register Table with ALL 15 Student Database Fields */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-3 px-3">Student ID</th>
                      <th className="py-3 px-3">Full Name & Admission</th>
                      <th className="py-3 px-3">School, Class & Div</th>
                      <th className="py-3 px-3">Parent & Both Mobiles</th>
                      <th className="py-3 px-3">Residential Address</th>
                      <th className="py-3 px-3">Monthly Fee</th>
                      <th className="py-3 px-3">☀️ Morning Van</th>
                      <th className="py-3 px-3">🌙 Evening Van</th>
                      <th className="py-3 px-3">Status & Colour</th>
                      <th className="py-3 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {students
                      .filter((s) => {
                        const q = dbSearch.toLowerCase();
                        const matchSearch =
                          s.name.toLowerCase().includes(q) ||
                          s.code.toLowerCase().includes(q) ||
                          s.fatherMobile.includes(q) ||
                          s.motherMobile.includes(q) ||
                          s.parentName.toLowerCase().includes(q) ||
                          s.address.toLowerCase().includes(q);
                        const matchSch = dbSchoolFilter === 'ALL' || s.schoolId === dbSchoolFilter;
                        const matchCls = dbClassFilter === 'ALL' || s.className === dbClassFilter;
                        const matchDiv = dbDivisionFilter === 'ALL' || s.division === dbDivisionFilter;
                        const matchMVan =
                          dbMorningVanFilter === 'ALL'
                            ? true
                            : dbMorningVanFilter === 'NONE'
                            ? !s.morningVehicleId
                            : s.morningVehicleId === dbMorningVanFilter;
                        const matchEVan =
                          dbEveningVanFilter === 'ALL'
                            ? true
                            : dbEveningVanFilter === 'NONE'
                            ? !s.eveningVehicleId
                            : s.eveningVehicleId === dbEveningVanFilter;
                        const colCode = getStudentColorStatus(s).code;
                        const matchColor = dbColorFilter === 'ALL' || colCode === dbColorFilter;
                        const matchSt = dbStatusFilter === 'ALL' || s.status === dbStatusFilter;
                        return (
                          matchSearch &&
                          matchSch &&
                          matchCls &&
                          matchDiv &&
                          matchMVan &&
                          matchEVan &&
                          matchColor &&
                          matchSt
                        );
                      })
                      .map((stu) => {
                        const sch = schools.find((s) => s.id === stu.schoolId);
                        const mVeh = vehicles.find((v) => v.id === stu.morningVehicleId);
                        const eVeh = vehicles.find((v) => v.id === stu.eveningVehicleId);
                        const mDrv = drivers.find((d) => d.id === mVeh?.morningDriverId);
                        const eDrv = drivers.find((d) => d.id === eVeh?.eveningDriverId);
                        const stuInv = invoices.find((i) => i.studentId === stu.id && i.month === '2026-11');
                        const stuPaid = stuInv?.paidAmount || 0;
                        const stuDue = Math.max(0, (stuInv?.feeSnapshot ?? stu.monthlyFee) - stuPaid);
                        const col = getStudentColorStatus(stu);
                        return (
                          <tr key={stu.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              {stu.code}
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => setSelectedStudentId(stu.id)}
                                className="font-bold text-sm text-indigo-600 hover:underline text-left block"
                              >
                                {stu.name}
                              </button>
                              <span className="text-[11px] text-slate-500">
                                Adm: {stu.admissionDate}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">
                                {stu.className} • Div {stu.division}
                              </div>
                              <div className="text-[11px] text-slate-600">{sch?.name}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{stu.parentName}</div>
                              <div className="text-[11px] text-slate-600">
                                Father: <span className="font-semibold">{stu.fatherMobile}</span>
                              </div>
                              {stu.motherMobile && (
                                <div className="text-[11px] text-slate-500">
                                  Mother: {stu.motherMobile}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 max-w-[160px]">
                              <div>{stu.address}</div>
                              {stu.notes && (
                                <div className="text-[10px] text-amber-700 italic mt-0.5">
                                  Note: {stu.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-sm text-slate-900">
                                Fee: {formatINR(stu.monthlyFee)}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                Paid: {formatINR(stuPaid)}
                              </div>
                              <div className={`text-[10px] font-bold ${stuDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                Due: {formatINR(stuDue)}
                              </div>
                              {stu.advanceCredit > 0 && (
                                <div className="text-[10px] text-indigo-700 font-semibold">
                                  Adv: {formatINR(stu.advanceCredit)}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={stu.morningVehicleId || ''}
                                onChange={(e) =>
                                  assignStudentToVehicle(
                                    stu.id,
                                    'MORNING',
                                    e.target.value ? e.target.value : null
                                  )
                                }
                                className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50/60 text-xs font-semibold text-amber-950"
                              >
                                <option value="">None (Unassigned)</option>
                                {vehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.code} ({v.regNumber})
                                  </option>
                                ))}
                              </select>
                              <div className="text-[10px] text-slate-600 mt-1 font-medium">
                                {mDrv ? `☀️ Drv: ${mDrv.name} (${mDrv.mobile})` : 'No Morning Driver'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={stu.eveningVehicleId || ''}
                                onChange={(e) =>
                                  assignStudentToVehicle(
                                    stu.id,
                                    'EVENING',
                                    e.target.value ? e.target.value : null
                                  )
                                }
                                className="px-2 py-1 rounded-lg border border-sky-300 bg-sky-50/60 text-xs font-semibold text-sky-950"
                              >
                                <option value="">None (Unassigned)</option>
                                {vehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.code} ({v.regNumber})
                                  </option>
                                ))}
                              </select>
                              <div className="text-[10px] text-slate-600 mt-1 font-medium">
                                {eDrv ? `🌙 Drv: ${eDrv.name} (${eDrv.mobile})` : 'No Evening Driver'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${col.badgeBg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                                {col.code}
                              </span>
                              <div className="text-[10px] font-semibold text-slate-500 mt-1">
                                {stu.status}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setSelectedStudentId(stu.id)}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
                                >
                                  Profile
                                </button>
                                <button
                                  onClick={() => setEditingStudent(stu)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: CENTRAL VAN (VEHICLE) MASTER DATABASE & DRIVER REGISTRY
        ==================================================================== */}
        {activeTab === 'vehicles_drivers' && roleMode === 'ADMIN' && (
          <div className="space-y-6">
            {/* MASTER CENTRAL VAN DATABASE CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Master Vehicle Register
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Total Fleet: {vehicles.length} Vans ({vehicles.filter((v) => v.status === 'ACTIVE').length} Active)
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Bus className="w-5 h-5 text-indigo-600" />
                    Central Van Database (सारी वैन और सीट कैपेसिटी का मास्टर रजिस्टर)
                  </h2>
                  <p className="text-xs text-slate-600">
                    स्टूडेंट डेटाबेस की तरह यहाँ आपकी हर वैन का पूरा रिकॉर्ड है—Van ID, रजिस्ट्रेशन नंबर, मॉडल, कुल सीट क्षमता, सुबह व शाम के ड्राइवर (मोबाइल नंबर सहित), दोनों शिफ्ट की भरी और खाली सीटें, हेल्पर और स्टेटस (Active / Inactive / Maintenance)।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowAddVanModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> + Add New Van
                  </button>
                  <button
                    onClick={() => handleExportCSV('CENTRAL_VANS')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Download className="w-4 h-4" /> Export Van Database (CSV/Excel)
                  </button>
                  <button
                    onClick={() => setActiveTab('allocation')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition"
                  >
                    <ArrowRightLeft className="w-4 h-4" /> Open Drag & Drop Board →
                  </button>
                </div>
              </div>

              {/* Fleet Summary KPI Strip */}
              {(() => {
                const totalCap = vehicles.reduce((acc, v) => acc + v.capacity, 0);
                const totalMorningOcc = students.filter((s) => s.status === 'ACTIVE' && s.morningVehicleId).length;
                const totalEveningOcc = students.filter((s) => s.status === 'ACTIVE' && s.eveningVehicleId).length;
                const overCapVans = vehicles.filter((v) => {
                  const m = students.filter((s) => s.status === 'ACTIVE' && s.morningVehicleId === v.id).length;
                  const e = students.filter((s) => s.status === 'ACTIVE' && s.eveningVehicleId === v.id).length;
                  return m > v.capacity || e > v.capacity;
                }).length;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500">Total Fleet Capacity (Per Shift)</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {totalCap} Seats across {vehicles.length} Vans
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                      <div className="text-[11px] font-semibold text-amber-900">☀️ Morning Shift Occupancy</div>
                      <div className="text-base font-bold text-amber-950 mt-0.5">
                        {totalMorningOcc} Occupied / {Math.max(0, totalCap - totalMorningOcc)} Free
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200">
                      <div className="text-[11px] font-semibold text-sky-900">🌙 Evening Shift Occupancy</div>
                      <div className="text-base font-bold text-sky-950 mt-0.5">
                        {totalEveningOcc} Occupied / {Math.max(0, totalCap - totalEveningOcc)} Free
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                      <div className="text-[11px] font-semibold text-rose-900">Capacity Warnings</div>
                      <div className="text-base font-bold text-rose-950 mt-0.5">
                        {overCapVans} Vans Exceeding Capacity
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Inline Add Van Bar (kept for fast 1-click entry + Modal button above) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newVanReg.trim()) {
                    notify('Enter Vehicle Registration Number (e.g. GJ-01-XX-4404).', 'error');
                    return;
                  }
                  const createdVan: Vehicle = {
                    id: `veh-${Date.now()}`,
                    code: `VAN-0${vehicles.length + 1}`,
                    regNumber: newVanReg.trim().toUpperCase(),
                    model: newVanModel,
                    capacity: Number(newVanCap) || 8,
                    morningDriverId: drivers[0]?.id || 'drv-1',
                    eveningDriverId: drivers[1]?.id || 'drv-2',
                    helperName: newVanHelperName.trim() || 'Helper Assigned',
                    status: 'ACTIVE',
                    notes: newVanNotes.trim()
                  };
                  setVehicles((prev) => [...prev, createdVan]);
                  setNewVanReg('');
                  logAudit('VEHICLE_ADDED', 'Central Van Database', `Added vehicle ${createdVan.regNumber} (${createdVan.code})`);
                  notify(`Added ${createdVan.regNumber} (${createdVan.code}) to Central Van Database!`, 'success');
                }}
                className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs"
              >
                <div className="relative sm:col-span-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={vanSearch}
                    onChange={(e) => setVanSearch(e.target.value)}
                    placeholder="Search Van ID, Reg No, Model, Driver..."
                    className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                  />
                </div>
                <select
                  value={vanStatusFilter}
                  onChange={(e) => setVanStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Status (Active / Maintenance / Inactive)</option>
                  <option value="ACTIVE">ACTIVE Only</option>
                  <option value="MAINTENANCE">MAINTENANCE Only</option>
                  <option value="INACTIVE">INACTIVE Only</option>
                </select>
                <select
                  value={vanCapacityFilter}
                  onChange={(e) => setVanCapacityFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Seat Availability</option>
                  <option value="AVAILABLE">Has Available Seats</option>
                  <option value="FULL_OR_OVER">Full or Over Capacity</option>
                </select>
                <input
                  type="text"
                  value={newVanReg}
                  onChange={(e) => setNewVanReg(e.target.value)}
                  placeholder="Quick Add: GJ-01-XX-4404"
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500"
                >
                  + Add Van
                </button>
              </form>

              {/* Master Central Van Database Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-3 px-3">Van ID & Reg No</th>
                      <th className="py-3 px-3">Model & Capacity</th>
                      <th className="py-3 px-3">☀️ Morning Driver & Contact</th>
                      <th className="py-3 px-3">☀️ Morning Occupancy</th>
                      <th className="py-3 px-3">🌙 Evening Driver & Contact</th>
                      <th className="py-3 px-3">🌙 Evening Occupancy</th>
                      <th className="py-3 px-3">Helper & Notes</th>
                      <th className="py-3 px-3">Vehicle Status</th>
                      <th className="py-3 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vehicles
                      .filter((v) => {
                        const mDrv = drivers.find((d) => d.id === v.morningDriverId);
                        const eDrv = drivers.find((d) => d.id === v.eveningDriverId);
                        const mOcc = students.filter((s) => s.status === 'ACTIVE' && s.morningVehicleId === v.id).length;
                        const eOcc = students.filter((s) => s.status === 'ACTIVE' && s.eveningVehicleId === v.id).length;
                        const q = vanSearch.toLowerCase();
                        const matchSearch =
                          v.code.toLowerCase().includes(q) ||
                          v.regNumber.toLowerCase().includes(q) ||
                          v.model.toLowerCase().includes(q) ||
                          (mDrv?.name || '').toLowerCase().includes(q) ||
                          (eDrv?.name || '').toLowerCase().includes(q) ||
                          (v.helperName || '').toLowerCase().includes(q);
                        const matchStatus = vanStatusFilter === 'ALL' || v.status === vanStatusFilter;
                        const matchCap =
                          vanCapacityFilter === 'ALL'
                            ? true
                            : vanCapacityFilter === 'AVAILABLE'
                            ? mOcc < v.capacity || eOcc < v.capacity
                            : mOcc >= v.capacity || eOcc >= v.capacity;
                        return matchSearch && matchStatus && matchCap;
                      })
                      .map((v) => {
                        const mDrv = drivers.find((d) => d.id === v.morningDriverId);
                        const eDrv = drivers.find((d) => d.id === v.eveningDriverId);
                        const mOcc = students.filter((s) => s.status === 'ACTIVE' && s.morningVehicleId === v.id).length;
                        const eOcc = students.filter((s) => s.status === 'ACTIVE' && s.eveningVehicleId === v.id).length;
                        const mFree = v.capacity - mOcc;
                        const eFree = v.capacity - eOcc;

                        return (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-indigo-600 block">{v.code}</span>
                              <span className="font-bold text-sm text-slate-900">{v.regNumber}</span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">{v.model}</div>
                              <div className="text-[11px] font-bold text-slate-600">
                                Capacity: {v.capacity} Seats
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={v.morningDriverId}
                                onChange={(e) => {
                                  const dId = e.target.value;
                                  const prevD = drivers.find((d) => d.id === v.morningDriverId);
                                  const nextD = drivers.find((d) => d.id === dId);
                                  setVehicles((prev) =>
                                    prev.map((vh) => (vh.id === v.id ? { ...vh, morningDriverId: dId } : vh))
                                  );
                                  setDriverVanHistory((prev) => [
                                    {
                                      id: `dvh-${Date.now()}`,
                                      vehicleCode: v.code,
                                      regNumber: v.regNumber,
                                      shift: 'MORNING',
                                      previousDriver: prevD ? `${prevD.name} (${prevD.mobile})` : 'None',
                                      newDriver: nextD ? `${nextD.name} (${nextD.mobile})` : 'None',
                                      changedBy: 'Admin (Jaimin Kalal)',
                                      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                                    },
                                    ...prev
                                  ]);
                                  logAudit('DRIVER_REASSIGNED', 'Central Van Database', `Changed Morning Driver of ${v.regNumber} to ${nextD?.name}`);
                                  notify(`Updated Morning Driver for ${v.code} to ${nextD?.name}.`, 'success');
                                }}
                                className="px-2 py-1 border border-amber-300 rounded-lg bg-amber-50 text-amber-950 font-semibold w-full"
                              >
                                {drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    ☀️ {d.name}
                                  </option>
                                ))}
                              </select>
                              <div className="text-[11px] text-slate-500 mt-1">
                                📞 {mDrv?.mobile || 'N/A'}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  mOcc > v.capacity
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : mOcc === v.capacity
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {mOcc} / {v.capacity} Occupied
                              </span>
                              <div className="text-[11px] font-medium text-slate-600 mt-1">
                                {mFree >= 0 ? `${mFree} Seats Available` : `⚠️ ${Math.abs(mFree)} Over Capacity!`}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={v.eveningDriverId}
                                onChange={(e) => {
                                  const dId = e.target.value;
                                  const prevD = drivers.find((d) => d.id === v.eveningDriverId);
                                  const nextD = drivers.find((d) => d.id === dId);
                                  setVehicles((prev) =>
                                    prev.map((vh) => (vh.id === v.id ? { ...vh, eveningDriverId: dId } : vh))
                                  );
                                  setDriverVanHistory((prev) => [
                                    {
                                      id: `dvh-${Date.now()}`,
                                      vehicleCode: v.code,
                                      regNumber: v.regNumber,
                                      shift: 'EVENING',
                                      previousDriver: prevD ? `${prevD.name} (${prevD.mobile})` : 'None',
                                      newDriver: nextD ? `${nextD.name} (${nextD.mobile})` : 'None',
                                      changedBy: 'Admin (Jaimin Kalal)',
                                      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                                    },
                                    ...prev
                                  ]);
                                  logAudit('DRIVER_REASSIGNED', 'Central Van Database', `Changed Evening Driver of ${v.regNumber} to ${nextD?.name}`);
                                  notify(`Updated Evening Driver for ${v.code} to ${nextD?.name}.`, 'success');
                                }}
                                className="px-2 py-1 border border-sky-300 rounded-lg bg-sky-50 text-sky-950 font-semibold w-full"
                              >
                                {drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    🌙 {d.name}
                                  </option>
                                ))}
                              </select>
                              <div className="text-[11px] text-slate-500 mt-1">
                                📞 {eDrv?.mobile || 'N/A'}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  eOcc > v.capacity
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : eOcc === v.capacity
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {eOcc} / {v.capacity} Occupied
                              </span>
                              <div className="text-[11px] font-medium text-slate-600 mt-1">
                                {eFree >= 0 ? `${eFree} Seats Available` : `⚠️ ${Math.abs(eFree)} Over Capacity!`}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              <div className="font-medium">{v.helperName || 'No Helper'}</div>
                              {v.notes && (
                                <div className="text-[10px] text-amber-700 italic mt-0.5">{v.notes}</div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={v.status}
                                onChange={(e) => {
                                  const newSt = e.target.value as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
                                  setVehicles((prev) =>
                                    prev.map((vh) => (vh.id === v.id ? { ...vh, status: newSt } : vh))
                                  );
                                  logAudit('VEHICLE_STATUS_CHANGED', 'Central Van Database', `Changed ${v.regNumber} status to ${newSt}`);
                                  notify(`Changed ${v.regNumber} status to ${newSt}.`, 'warning');
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                                  v.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : v.status === 'MAINTENANCE'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}
                              >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="MAINTENANCE">MAINTENANCE</option>
                                <option value="INACTIVE">INACTIVE</option>
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedVanId(v.id);
                                    setActiveTab('van_dashboard');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
                                >
                                  Van Dashboard
                                </button>
                                <button
                                  onClick={() => setEditingVan(v)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historical Driver-to-Vehicle Assignment Log + Registered Drivers Directory */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  Historical Vehicle & Driver Assignment Log
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                      <tr>
                        <th className="py-2 px-2">Van</th>
                        <th className="py-2 px-2">Shift</th>
                        <th className="py-2 px-2">Previous Driver</th>
                        <th className="py-2 px-2">New Driver</th>
                        <th className="py-2 px-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {driverVanHistory.map((h) => (
                        <tr key={h.id}>
                          <td className="py-2 px-2 font-bold">{h.vehicleCode} ({h.regNumber})</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.shift === 'MORNING' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>
                              {h.shift}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-slate-500">{h.previousDriver}</td>
                          <td className="py-2 px-2 font-semibold text-slate-900">{h.newDriver}</td>
                          <td className="py-2 px-2 text-slate-500">{h.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  Registered Drivers ({drivers.length})
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newDrvName.trim() || !newDrvMobile.trim()) {
                      notify('Enter Driver Name and Mobile Number.', 'error');
                      return;
                    }
                    const createdDrv: Driver = {
                      id: `drv-${Date.now()}`,
                      code: `DRV-10${drivers.length + 1}`,
                      name: newDrvName.trim(),
                      mobile: newDrvMobile.trim(),
                      licenceNo: newDrvLicence.trim() || 'GJ01-2020001122',
                      licenceExpiry: '2030-12-31',
                      permittedShift: 'BOTH',
                      salaryMethod: newDrvMethod,
                      fixedAmount: newDrvMethod === 'FIXED' ? 14000 : newDrvMethod === 'HYBRID' ? 8000 : 0,
                      perStudentAmount: newDrvMethod === 'PER_STUDENT' ? 400 : newDrvMethod === 'HYBRID' ? 300 : 0,
                      incentiveAmount: 0,
                      deductionAmount: 0,
                      canViewSalary: true,
                      status: 'ACTIVE'
                    };
                    setDrivers((prev) => [...prev, createdDrv]);
                    setNewDrvName('');
                    setNewDrvMobile('');
                    setNewDrvLicence('');
                    logAudit('DRIVER_ADDED', 'Drivers', `Added driver ${createdDrv.name} (${createdDrv.code})`);
                    notify(`Added driver ${createdDrv.name} (${createdDrv.code})!`, 'success');
                  }}
                  className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newDrvName}
                      onChange={(e) => setNewDrvName(e.target.value)}
                      placeholder="Driver Full Name"
                      className="px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                    />
                    <input
                      type="text"
                      value={newDrvMobile}
                      onChange={(e) => setNewDrvMobile(e.target.value)}
                      placeholder="Mobile Number"
                      className="px-2.5 py-1.5 border rounded-lg bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newDrvLicence}
                      onChange={(e) => setNewDrvLicence(e.target.value)}
                      placeholder="Licence No (GJ01-...)"
                      className="px-2.5 py-1.5 border rounded-lg bg-white"
                    />
                    <select
                      value={newDrvMethod}
                      onChange={(e) => setNewDrvMethod(e.target.value as SalaryMethod)}
                      className="px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                    >
                      <option value="FIFTY_FIFTY">50/50 Fee Share</option>
                      <option value="FIXED">Fixed Salary</option>
                      <option value="PER_STUDENT">Per-Student</option>
                      <option value="HYBRID">Hybrid Salary</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500"
                  >
                    + Register Driver
                  </button>
                </form>

                <div className="space-y-2">
                  {drivers.map((d) => (
                    <div key={d.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{d.name} ({d.code})</div>
                        <div className="text-slate-500">
                          Mobile: {d.mobile} • Lic: {d.licenceNo}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[10px] border border-indigo-200">
                        {d.salaryMethod}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 7: SCHOOLS & DYNAMIC TIMINGS MANAGEMENT
        ==================================================================== */}
        {activeTab === 'schools_students' && roleMode === 'ADMIN' && (
          <div className="space-y-6">
            {/* Firm / Business Profile Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                Firm & Receipt Header Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Firm / Business Name</label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Contact Persons & Mobiles</label>
                  <input
                    type="text"
                    value={firmContact}
                    onChange={(e) => setFirmContact(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">City / Address</label>
                  <input
                    type="text"
                    value={firmCity}
                    onChange={(e) => setFirmCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>
            <div className="hidden">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Central Student Master Database ({students.length} Total Records)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Complete student records with auto-generated ID, school/class, parent numbers, monthly fee, Morning/Evening van status, Excel/CSV export & bulk import.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add New Student
                  </button>
                  <button
                    onClick={() => setShowBulkImportModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Bulk Import (Excel/CSV)
                  </button>
                  <button
                    onClick={() => handleExportCSV('COMPLETE_STUDENTS')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Export Excel/CSV
                  </button>
                </div>
              </div>

              {/* Search & Multi-Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                    placeholder="Search Name, ID, Parent Mobile..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <select
                  value={dbSchoolFilter}
                  onChange={(e) => setDbSchoolFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Schools</option>
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
                <select
                  value={dbClassFilter}
                  onChange={(e) => setDbClassFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Classes (Nursery – Class 12)</option>
                  {['Nursery', 'LKG', 'UKG', 'KG', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={dbStatusFilter}
                  onChange={(e) => setDbStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ALL">All Status (Active & Inactive)</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              {/* Full Student Master Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-2.5 px-3">ID & Name</th>
                      <th className="py-2.5 px-3">School & Class</th>
                      <th className="py-2.5 px-3">Parent & Mobile</th>
                      <th className="py-2.5 px-3">Monthly Fee</th>
                      <th className="py-2.5 px-3">Morning Van</th>
                      <th className="py-2.5 px-3">Evening Van</th>
                      <th className="py-2.5 px-3">Color Status</th>
                      <th className="py-2.5 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {students
                      .filter((s) => {
                        const q = dbSearch.toLowerCase();
                        const matchSearch =
                          s.name.toLowerCase().includes(q) ||
                          s.code.toLowerCase().includes(q) ||
                          s.fatherMobile.includes(q) ||
                          s.parentName.toLowerCase().includes(q);
                        const matchSch = dbSchoolFilter === 'ALL' || s.schoolId === dbSchoolFilter;
                        const matchCls = dbClassFilter === 'ALL' || s.className === dbClassFilter;
                        const matchSt = dbStatusFilter === 'ALL' || s.status === dbStatusFilter;
                        return matchSearch && matchSch && matchCls && matchSt;
                      })
                      .map((stu) => {
                        const sch = schools.find((s) => s.id === stu.schoolId);
                        const mVeh = vehicles.find((v) => v.id === stu.morningVehicleId);
                        const eVeh = vehicles.find((v) => v.id === stu.eveningVehicleId);
                        const col = getStudentColorStatus(stu);
                        const timing = getStudentTiming(stu);
                        return (
                          <tr key={stu.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-mono text-[10px] text-slate-500">{stu.code}</div>
                              <button
                                onClick={() => setSelectedStudentId(stu.id)}
                                className="font-bold text-indigo-600 hover:underline text-left"
                              >
                                {stu.name}
                              </button>
                              <div className="text-[10px] text-slate-400">{stu.address}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{stu.className}-{stu.division}</div>
                              <div className="text-[11px] text-slate-500">{sch?.name}</div>
                              <div className="text-[10px] text-indigo-600">{timing.arrival} - {timing.departure}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-800">{stu.parentName}</div>
                              <div className="text-[11px] text-slate-600">F: {stu.fatherMobile}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{formatINR(stu.monthlyFee)}</div>
                              {stu.advanceCredit > 0 && (
                                <div className="text-[10px] text-emerald-700 font-semibold">
                                  Adv: {formatINR(stu.advanceCredit)}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {mVeh ? `${mVeh.code} (${mVeh.regNumber})` : <span className="text-slate-400">None</span>}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {eVeh ? `${eVeh.code} (${eVeh.regNumber})` : <span className="text-slate-400">None</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${col.badgeBg}`}>
                                {col.code}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedStudentId(stu.id)}
                                  className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100"
                                >
                                  360° Profile
                                </button>
                                <button
                                  onClick={() => setEditingStudent(stu)}
                                  className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
            {/* School & Dynamic Class Timing Manager */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SchoolIcon className="w-5 h-5 text-indigo-600" />
                Schools & Central Class Timing Overrides
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Add your real schools below and edit KG or Class 1–12 timings—all students in that school automatically inherit the updated schedule!
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSchName.trim()) {
                    notify('Please enter School Name.', 'error');
                    return;
                  }
                  const createdSch: School = {
                    id: `sch-${Date.now()}`,
                    code: `SCH-00${schools.length + 1}`,
                    name: newSchName.trim(),
                    address: newSchAddress.trim() || 'Ahmedabad',
                    contactPerson: newSchContact.trim() || 'Principal / Admin',
                    contactNumber: newSchPhone.trim() || '9800000000',
                    status: 'ACTIVE',
                    kgArrival: newSchKgArr.trim() || '08:30 AM',
                    kgDeparture: newSchKgDep.trim() || '12:30 PM',
                    stdArrival: newSchStdArr.trim() || '07:30 AM',
                    stdDeparture: newSchStdDep.trim() || '01:45 PM',
                    timingEffectiveDate: '2026-11-13'
                  };
                  setSchools((prev) => [...prev, createdSch]);
                  setNewSchName('');
                  setNewSchAddress('');
                  setNewSchContact('');
                  setNewSchPhone('');
                  logAudit('SCHOOL_ADDED', 'Schools', `Added school ${createdSch.name} (${createdSch.code})`);
                  notify(`Added school ${createdSch.name} (${createdSch.code})!`, 'success');
                }}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs"
              >
                <input
                  type="text"
                  value={newSchName}
                  onChange={(e) => setNewSchName(e.target.value)}
                  placeholder="New School Name"
                  className="px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                />
                <input
                  type="text"
                  value={newSchAddress}
                  onChange={(e) => setNewSchAddress(e.target.value)}
                  placeholder="Area / Address"
                  className="px-2.5 py-1.5 border rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={newSchContact}
                  onChange={(e) => setNewSchContact(e.target.value)}
                  placeholder="Contact Person"
                  className="px-2.5 py-1.5 border rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={newSchPhone}
                  onChange={(e) => setNewSchPhone(e.target.value)}
                  placeholder="Contact Mobile"
                  className="px-2.5 py-1.5 border rounded-lg bg-white"
                />
                <div className="sm:col-span-5 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block">KG Arrival Time</label>
                    <input
                      type="text"
                      value={newSchKgArr}
                      onChange={(e) => setNewSchKgArr(e.target.value)}
                      placeholder="08:30 AM"
                      className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block">KG Departure Time</label>
                    <input
                      type="text"
                      value={newSchKgDep}
                      onChange={(e) => setNewSchKgDep(e.target.value)}
                      placeholder="12:30 PM"
                      className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block">Class 1–12 Arrival</label>
                    <input
                      type="text"
                      value={newSchStdArr}
                      onChange={(e) => setNewSchStdArr(e.target.value)}
                      placeholder="07:30 AM"
                      className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block">Class 1–12 Departure</label>
                    <input
                      type="text"
                      value={newSchStdDep}
                      onChange={(e) => setNewSchStdDep(e.target.value)}
                      placeholder="01:45 PM"
                      className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500"
                    >
                      + Add School
                    </button>
                  </div>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {schools.map((sch) => (
                  <div key={sch.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600">{sch.code}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {sch.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{sch.name}</h3>
                    <p className="text-slate-500">{sch.address}</p>
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div>
                        <label className="font-semibold text-slate-700 block">KG Section (Arrival / Departure)</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <input
                            type="text"
                            value={sch.kgArrival}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSchools((prev) => prev.map((s) => (s.id === sch.id ? { ...s, kgArrival: val } : s)));
                            }}
                            className="px-2 py-1 border rounded bg-white font-semibold"
                          />
                          <input
                            type="text"
                            value={sch.kgDeparture}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSchools((prev) => prev.map((s) => (s.id === sch.id ? { ...s, kgDeparture: val } : s)));
                            }}
                            className="px-2 py-1 border rounded bg-white font-semibold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block">Class 1–12 (Arrival / Departure)</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <input
                            type="text"
                            value={sch.stdArrival}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSchools((prev) => prev.map((s) => (s.id === sch.id ? { ...s, stdArrival: val } : s)));
                            }}
                            className="px-2 py-1 border rounded bg-white font-semibold"
                          />
                          <input
                            type="text"
                            value={sch.stdDeparture}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSchools((prev) => prev.map((s) => (s.id === sch.id ? { ...s, stdDeparture: val } : s)));
                            }}
                            className="px-2 py-1 border rounded bg-white font-semibold"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTimingSchoolId(sch.id)}
                        className="w-full mt-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Set Class-Wise Timing (KG1, 1 to 12)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 7: ADMIN OVERVIEW DASHBOARD & REPORTS / EXPORTS
        ==================================================================== */}
        {activeTab === 'dashboard' && roleMode === 'ADMIN' && (
          <div className="space-y-6">
            {/* Live Financial & Operational KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500">Nov 2026 Invoiced (Single-Count)</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{formatINR(companyMetrics.totalInvoiced)}</div>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Collected: {formatINR(companyMetrics.totalCollected)}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500">Pending / Overdue (Past 10th)</span>
                <div className="text-xl font-bold text-rose-600 mt-1">{formatINR(companyMetrics.totalOverdue)}</div>
                <span className="text-[11px] text-slate-500">No automatic late fee applied</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500">Unallocated Advance Credit</span>
                <div className="text-xl font-bold text-indigo-600 mt-1">{formatINR(companyMetrics.totalAdvanceCredit)}</div>
                <span className="text-[11px] text-slate-500">Pending Driver Cash: {formatINR(companyMetrics.pendingDriverCash)}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500">Driver Salary Payable</span>
                <div className="text-xl font-bold text-amber-600 mt-1">{formatINR(companyMetrics.totalDriverSalaryPayable)}</div>
                <span className="text-[11px] text-slate-500">Across {drivers.length} active drivers</span>
              </div>
            </div>

            {/* Chart + Export Center */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-3">
                  Van-Wise Morning vs Evening Occupancy & Seat Capacity
                </h3>
                <div className="relative h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={vehicles.map((v) => ({
                        name: v.code,
                        Morning: students.filter((s) => s.morningVehicleId === v.id).length,
                        Evening: students.filter((s) => s.eveningVehicleId === v.id).length,
                        Capacity: v.capacity
                      }))}
                    >
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Morning" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Evening" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Capacity" fill="#64748b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Reports & Excel/CSV/PDF Export Center
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Download company-wide reports with zero double-counting of dual-shift students.
                  </p>
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => handleExportCSV('COMPLETE_STUDENTS')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
                    >
                      <span>1. Complete Student & Shift Allocation Report (.CSV / Excel)</span>
                      <Download className="w-4 h-4 text-indigo-600" />
                    </button>
                    <button
                      onClick={() => handleExportCSV('PENDING_OVERDUE')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
                    >
                      <span>2. Pending & Overdue Fee Report (Past 10th Due Date)</span>
                      <Download className="w-4 h-4 text-rose-600" />
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
                    >
                      <span>3. Print / Save PDF Financial & Salary Summary</span>
                      <Printer className="w-4 h-4 text-emerald-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 8: AUDIT LOGS & RLS SECURITY MATRIX
        ==================================================================== */}
        {activeTab === 'audit' && roleMode === 'ADMIN' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Immutable System Audit Trail
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor & Role</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 px-3 text-slate-500">{log.timestamp}</td>
                      <td className="py-2.5 px-3 font-semibold">{log.actor}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{log.module}</td>
                      <td className="py-2.5 px-3 text-slate-700">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================================
            DRIVER MOBILE PORTAL (For Morning Driver & Evening Driver Modes)
        ==================================================================== */}
        {activeTab === 'driver_portal' && roleMode !== 'ADMIN' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                  {roleMode === 'MORNING_DRIVER' ? '☀️ MORNING DRIVER LOGIN' : '🌙 EVENING DRIVER LOGIN'}
                </span>
                <span className="text-xs text-slate-400">GJ-01-XX-1101 (VAN-01)</span>
              </div>
              <h2 className="text-lg font-bold mt-2">
                {roleMode === 'MORNING_DRIVER' ? 'Rameshbhai Thakor (DRV-101)' : 'Kamleshbhai Rabari (DRV-102)'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {roleMode === 'MORNING_DRIVER'
                  ? 'Permitted: Morning Attendance, Morning Van Student List & Morning Student Fee Collection.'
                  : 'Permitted: Evening Attendance & Evening Van Student List Only. Fee Collection & Financial Reports are strictly locked.'}
              </p>

              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <button
                  onClick={() => setActiveTab('attendance')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <CalendarCheck className="w-4 h-4" /> Mark Attendance
                </button>
                {roleMode === 'MORNING_DRIVER' ? (
                  <button
                    onClick={() => setActiveTab('fees')}
                    className="py-2.5 px-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <IndianRupee className="w-4 h-4" /> Collect Morning Fee
                  </button>
                ) : (
                  <div className="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700">
                    <Lock className="w-4 h-4 text-rose-400" /> Fees Locked (Evening RLS)
                  </div>
                )}
              </div>
            </div>

            {/* Driver's Own Salary Statement Card (if enabled by Admin) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900">My 50/50 Salary Entitlement (Nov 2026)</h3>
              {(() => {
                const drvId = roleMode === 'MORNING_DRIVER' ? 'drv-1' : 'drv-2';
                const st = salaryCalculations.driverStatements.find((d) => d.driver.id === drvId);
                if (!st) return null;
                return (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Assigned Shift Students:</span>
                      <span className="font-bold">{st.eligibleShiftsCount} Students</span>
                    </div>
                    <div className="flex justify-between">
                      <span>50% Shift Fee Share Earned:</span>
                      <span className="font-bold text-emerald-700">{formatINR(st.sharingPart)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t">
                      <span>Total Net Payable:</span>
                      <span>{formatINR(st.netPayable)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================
          MODAL 1: COMPLETE 360° STUDENT PROFILE & LEDGER
      ==================================================================== */}
      {profileStudent && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600">{profileStudent.code}</span>
                <h3 className="text-lg font-bold text-slate-900">{profileStudent.name}</h3>
                <p className="text-xs text-slate-500">
                  {profileStudent.className}-{profileStudent.division} •{' '}
                  {schools.find((s) => s.id === profileStudent.schoolId)?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border">
                <div className="text-slate-500">Parent / Father Mobile</div>
                <div className="font-bold mt-0.5">{profileStudent.parentName}</div>
                <div className="text-indigo-600 font-semibold">{profileStudent.fatherMobile}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border">
                <div className="text-slate-500">Monthly Transport Fee</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{formatINR(profileStudent.monthlyFee)}</div>
                <div className="text-emerald-700 font-semibold">Advance Credit: {formatINR(profileStudent.advanceCredit)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border">
                <div className="text-slate-500">Current Van Allocation</div>
                <div className="font-semibold mt-0.5">
                  ☀️ M: {vehicles.find((v) => v.id === profileStudent.morningVehicleId)?.regNumber || 'None'}
                </div>
                <div className="font-semibold">
                  🌙 E: {vehicles.find((v) => v.id === profileStudent.eveningVehicleId)?.regNumber || 'None'}
                </div>
              </div>
            </div>

            <div className="text-xs space-y-2">
              <h4 className="font-bold text-slate-900">Student Financial Ledger (Single Invoice Per Month)</h4>
              {invoices
                .filter((i) => i.studentId === profileStudent.id)
                .map((inv) => (
                  <div key={inv.id} className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 flex justify-between">
                    <div>
                      <span className="font-bold">{inv.invoiceNo}</span> ({inv.month}) • Due: {inv.dueDate}
                    </div>
                    <div className="font-bold">
                      Fee: {formatINR(inv.feeSnapshot)} | Paid: {formatINR(inv.paidAmount)} | Balance:{' '}
                      <span className="text-rose-700">{formatINR(Math.max(0, inv.feeSnapshot - inv.paidAmount))}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: MOBILE / CLICK SHIFT ASSIGNMENT DIALOG
      ==================================================================== */}
      {quickAssignModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Assign {quickAssignModal.shift} Vehicle for{' '}
                {students.find((s) => s.id === quickAssignModal.studentId)?.name}
              </h3>
              <button onClick={() => setQuickAssignModal(null)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    assignStudentToVehicle(quickAssignModal.studentId, quickAssignModal.shift, v.id);
                    setQuickAssignModal(null);
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 hover:border-indigo-500 flex items-center justify-between text-xs font-semibold"
                >
                  <span>{v.regNumber} ({v.code}) — {v.model}</span>
                  <span className="text-indigo-600">Select →</span>
                </button>
              ))}
              <button
                onClick={() => {
                  assignStudentToVehicle(quickAssignModal.studentId, quickAssignModal.shift, null);
                  setQuickAssignModal(null);
                }}
                className="w-full p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
              >
                Remove from {quickAssignModal.shift} Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: AUDITED PAYMENT REVERSAL MODAL
      ==================================================================== */}
      {reversalModalPayment && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-rose-700">
              Reverse Payment {reversalModalPayment.receiptNo} ({formatINR(reversalModalPayment.amount)})
            </h3>
            <p className="text-xs text-slate-600">
              Financial records are never silently deleted. Reversing this receipt will log an audit record and restore the student's invoice balance.
            </p>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Enter mandatory reversal reason (e.g. Wrong student selected)"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReversalModalPayment(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReversePayment}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
              >
                Confirm Audited Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: ADD NEW STUDENT MODAL
      ==================================================================== */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateStudent} className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Add New Student to Central Database</h3>
              <button type="button" onClick={() => setShowAddStudentModal(false)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="font-semibold block mb-1">Student Full Name</label>
              <input
                type="text"
                value={newStuName}
                onChange={(e) => setNewStuName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
                placeholder="e.g. Kabir Sharma"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">School</label>
                <select
                  value={newStuSchool}
                  onChange={(e) => setNewStuSchool(e.target.value)}
                  className="w-full px-2 py-2 border rounded-xl"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Class / Standard (Manual)</label>
                <input
                  type="text"
                  value={newStuClass}
                  onChange={(e) => setNewStuClass(e.target.value)}
                  placeholder="e.g. KG1, 1, 5, 10"
                  className="w-full px-3 py-2 border rounded-xl font-semibold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Parent Name</label>
                <input
                  type="text"
                  value={newStuParent}
                  onChange={(e) => setNewStuParent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="Father/Guardian Name"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Father Mobile</label>
                <input
                  type="text"
                  value={newStuMobile}
                  onChange={(e) => setNewStuMobile(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="10-digit mobile"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Mother's Mobile</label>
                <input
                  type="text"
                  value={newStuMotherMobile}
                  onChange={(e) => setNewStuMotherMobile(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="Optional 10-digit"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Division / Section</label>
                <input
                  type="text"
                  value={newStuDivision}
                  onChange={(e) => setNewStuDivision(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="A / B / C"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Residential Address</label>
                <input
                  type="text"
                  value={newStuAddress}
                  onChange={(e) => setNewStuAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="Society, Area, City"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Admission Date</label>
                <input
                  type="date"
                  value={newStuAdmissionDate}
                  onChange={(e) => setNewStuAdmissionDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold block mb-1">Monthly Fee (₹)</label>
                <input
                  type="number"
                  value={newStuFee}
                  onChange={(e) => setNewStuFee(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">☀️ Morning Van</label>
                <select
                  value={newStuMorningVan}
                  onChange={(e) => setNewStuMorningVan(e.target.value)}
                  className="w-full px-2 py-2 border rounded-xl"
                >
                  <option value="">None</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">🌙 Evening Van</label>
                <select
                  value={newStuEveningVan}
                  onChange={(e) => setNewStuEveningVan(e.target.value)}
                  className="w-full px-2 py-2 border rounded-xl"
                >
                  <option value="">None</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.code}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="font-semibold block mb-1">Notes</label>
              <input
                type="text"
                value={newStuNotes}
                onChange={(e) => setNewStuNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
                placeholder="Any special instruction"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold">
              Save Student
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          MODAL 4B: EDIT STUDENT RECORD MODAL
      ==================================================================== */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveStudentEdit} className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">
                Edit Student: {editingStudent.name} ({editingStudent.code})
              </h3>
              <button type="button" onClick={() => setEditingStudent(null)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="font-semibold block mb-1">Full Name</label>
              <input
                type="text"
                value={editingStudent.name}
                onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Class / Standard (Manual)</label>
                <input
                  type="text"
                  value={editingStudent.className}
                  onChange={(e) => setEditingStudent({ ...editingStudent, className: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Division / Section</label>
                <input
                  type="text"
                  value={editingStudent.division}
                  onChange={(e) => setEditingStudent({ ...editingStudent, division: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Monthly Transport Fee (₹)</label>
                <input
                  type="number"
                  value={editingStudent.monthlyFee}
                  onChange={(e) => setEditingStudent({ ...editingStudent, monthlyFee: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Status</label>
                <select
                  value={editingStudent.status}
                  onChange={(e) => setEditingStudent({ ...editingStudent, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full px-3 py-2 border rounded-xl font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Parent Name</label>
                <input
                  type="text"
                  value={editingStudent.parentName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Father Mobile</label>
                <input
                  type="text"
                  value={editingStudent.fatherMobile}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fatherMobile: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold">
              Save Changes to Student Database
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          MODAL 4C: BULK EXCEL / CSV IMPORT WITH DUPLICATE DETECTION
      ==================================================================== */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">
                Bulk Import Students (CSV / Excel Rows with Duplicate Check)
              </h3>
              <button onClick={() => setShowBulkImportModal(false)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600">
              Format per line: <span className="font-mono font-semibold">Name, SchoolCode, Class, Division, ParentName, FatherMobile, Address, MonthlyFee</span>
            </p>
            <textarea
              rows={5}
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              className="w-full p-3 border rounded-xl font-mono text-[11px]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="px-3 py-2 rounded-xl bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImportStudents}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
              >
                Validate & Import Students
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4D: ADD NEW VAN TO CENTRAL VAN DATABASE
      ==================================================================== */}
      {showAddVanModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newVanReg.trim()) {
                notify('Please enter Vehicle Registration Number.', 'error');
                return;
              }
              const createdVan: Vehicle = {
                id: `veh-${Date.now()}`,
                code: `VAN-0${vehicles.length + 1}`,
                regNumber: newVanReg.trim().toUpperCase(),
                model: newVanModel.trim() || 'School Van',
                capacity: Number(newVanCap) || 8,
                morningDriverId: newVanMorningDrv,
                eveningDriverId: newVanEveningDrv,
                helperName: newVanHelperName.trim()
                  ? `${newVanHelperName.trim()} (${newVanHelperMobile.trim()})`
                  : 'No Helper',
                status: newVanStatus,
                notes: newVanNotes.trim()
              };
              setVehicles((prev) => [...prev, createdVan]);
              setNewVanReg('');
              setNewVanHelperName('');
              setNewVanHelperMobile('');
              setNewVanNotes('');
              setShowAddVanModal(false);
              logAudit('VEHICLE_CREATED', 'Central Van Database', `Added ${createdVan.code} (${createdVan.regNumber}) with capacity ${createdVan.capacity}`);
              notify(`Added ${createdVan.regNumber} (${createdVan.code}) to Central Van Database!`, 'success');
            }}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">Add New Vehicle to Central Van Database</h3>
              <button type="button" onClick={() => setShowAddVanModal(false)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Registration Number</label>
                <input
                  type="text"
                  value={newVanReg}
                  onChange={(e) => setNewVanReg(e.target.value)}
                  placeholder="GJ-01-XX-5505"
                  className="w-full px-3 py-2 border rounded-xl font-bold uppercase"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={newVanCap}
                  onChange={(e) => setNewVanCap(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Vehicle Model (Manual)</label>
                <input
                  type="text"
                  value={newVanModel}
                  onChange={(e) => setNewVanModel(e.target.value)}
                  placeholder="Type Van Model (e.g. Eeco, Omni, Winger)"
                  className="w-full px-3 py-2 border rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Vehicle Status</label>
                <select
                  value={newVanStatus}
                  onChange={(e) => setNewVanStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE')}
                  className="w-full px-2 py-2 border rounded-xl font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">☀️ Morning Driver</label>
                <select
                  value={newVanMorningDrv}
                  onChange={(e) => setNewVanMorningDrv(e.target.value)}
                  className="w-full px-2 py-2 border rounded-xl"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">🌙 Evening Driver</label>
                <select
                  value={newVanEveningDrv}
                  onChange={(e) => setNewVanEveningDrv(e.target.value)}
                  className="w-full px-2 py-2 border rounded-xl"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Helper Name (Optional)</label>
                <input
                  type="text"
                  value={newVanHelperName}
                  onChange={(e) => setNewVanHelperName(e.target.value)}
                  placeholder="e.g. Shantaben"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Helper Mobile</label>
                <input
                  type="text"
                  value={newVanHelperMobile}
                  onChange={(e) => setNewVanHelperMobile(e.target.value)}
                  placeholder="98249..."
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold block mb-1">Notes</label>
              <input
                type="text"
                value={newVanNotes}
                onChange={(e) => setNewVanNotes(e.target.value)}
                placeholder="Route / PUC / Insurance or maintenance notes"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold">
              Save Vehicle to Central Van Database
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          MODAL 4E: EDIT EXISTING VAN IN CENTRAL VAN DATABASE
      ==================================================================== */}
      {editingVan && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setVehicles((prev) => prev.map((v) => (v.id === editingVan.id ? editingVan : v)));
              logAudit('VEHICLE_UPDATED', 'Central Van Database', `Updated ${editingVan.code} (${editingVan.regNumber})`);
              notify(`Updated ${editingVan.regNumber} in Central Van Database!`, 'success');
              setEditingVan(null);
            }}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">
                Edit Vehicle: {editingVan.code} ({editingVan.regNumber})
              </h3>
              <button type="button" onClick={() => setEditingVan(null)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Registration Number</label>
                <input
                  type="text"
                  value={editingVan.regNumber}
                  onChange={(e) => setEditingVan({ ...editingVan, regNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={editingVan.capacity}
                  onChange={(e) => setEditingVan({ ...editingVan, capacity: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1">Model</label>
                <input
                  type="text"
                  value={editingVan.model}
                  onChange={(e) => setEditingVan({ ...editingVan, model: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Status</label>
                <select
                  value={editingVan.status}
                  onChange={(e) => setEditingVan({ ...editingVan, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' })}
                  className="w-full px-2 py-2 border rounded-xl font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-semibold block mb-1">Helper Name & Mobile</label>
              <input
                type="text"
                value={editingVan.helperName}
                onChange={(e) => setEditingVan({ ...editingVan, helperName: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Notes</label>
              <input
                type="text"
                value={editingVan.notes || ''}
                onChange={(e) => setEditingVan({ ...editingVan, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold">
              Save Vehicle Changes
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          MODAL 4F: ADMIN OVERRIDE CONFIRMATION FOR INACTIVE / MAINTENANCE VAN
      ==================================================================== */}
      {inactiveOverrideConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <h3 className="font-bold text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Confirm Admin Override for Non-Active Vehicle
            </h3>
            <p className="text-slate-600">
              This vehicle is currently marked as INACTIVE or MAINTENANCE. Do you want to explicitly override this restriction and allocate the student?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setInactiveOverrideConfirm(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { studentId, shift, vehicleId } = inactiveOverrideConfirm;
                  setStudents((prev) =>
                    prev.map((s) =>
                      s.id === studentId
                        ? shift === 'MORNING'
                          ? { ...s, morningVehicleId: vehicleId }
                          : { ...s, eveningVehicleId: vehicleId }
                        : s
                    )
                  );
                  logAudit('ADMIN_OVERRIDE_ALLOCATION', 'Central Van Database', `Admin overrode non-active vehicle status for student ${studentId} (${shift})`);
                  setInactiveOverrideConfirm(null);
                  notify('Allocated student with explicit Admin override.', 'warning');
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold"
              >
                Confirm Admin Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4G: START FRESH FROM ZERO (CLEAR DEMO DATA) OR RESTORE DEMO
      ==================================================================== */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Start Fresh from 0 (Clear Demo Data)
              </h3>
              <button onClick={() => setShowResetModal(false)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600">
              इससे अभी मौजूद सारा डेमो डेटा (Demo Schools, Students, Vans, Drivers, Invoices, Receipts, Attendance) साफ हो जाएगा और आपका सिस्टम बिल्कुल <strong>0 से</strong> आपके असली बिज़नेस डेटा के लिए खाली हो जाएगा।
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSchools([]);
                  setDrivers([]);
                  setVehicles([]);
                  setStudents([]);
                  setInvoices([]);
                  setPayments([]);
                  setAttendance([]);
                  setAllocationHistory([]);
                  setDriverVanHistory([]);
                  setSalaryApprovals({});
                  setSelectedStudentId(null);
                  setShowResetModal(false);
                  logAudit('SYSTEM_RESET_TO_ZERO', 'System', 'Cleared all demo records to start fresh from 0');
                  notify('All demo data cleared! Now add your real Schools, Drivers, Vans & Students from 0.', 'success');
                }}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Clear All Demo Data (Start from 0)
              </button>
              <button
                onClick={() => {
                  setSchools(INITIAL_SCHOOLS);
                  setDrivers(INITIAL_DRIVERS);
                  setVehicles(INITIAL_VEHICLES);
                  setStudents(INITIAL_STUDENTS);
                  setInvoices(INITIAL_INVOICES);
                  setPayments(INITIAL_PAYMENTS);
                  setAttendance(INITIAL_ATTENDANCE);
                  setShowResetModal(false);
                  notify('Demo sample data restored for testing.', 'success');
                }}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
              >
                Restore Demo Sample Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4H: CLASS-WISE TIMING TABLE (KG1, KG2, CLASS 1 TO 12)
      ==================================================================== */}
      {timingSchoolId && (() => {
        const targetSch = schools.find((s) => s.id === timingSchoolId);
        if (!targetSch) return null;
        const baseList = ['Nursery', 'LKG', 'UKG', 'KG', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
        const extraKeys = Object.keys(targetSch.classTimings || {}).filter((k) => !baseList.includes(k));
        const allClassRows = [...baseList, ...extraKeys];

        const updateClassTime = (clsName: string, field: 'arrival' | 'departure', value: string) => {
          setSchools((prev) =>
            prev.map((s) => {
              if (s.id !== targetSch.id) return s;
              const isKG = ['Nursery', 'LKG', 'UKG', 'KG', 'KG1', 'KG2'].includes(clsName);
              const existing = s.classTimings?.[clsName] || {
                arrival: isKG ? s.kgArrival : s.stdArrival,
                departure: isKG ? s.kgDeparture : s.stdDeparture
              };
              return {
                ...s,
                classTimings: {
                  ...(s.classTimings || {}),
                  [clsName]: { ...existing, [field]: value }
                }
              };
            })
          );
        };

        return (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 text-xs max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-[11px] font-bold text-indigo-600">{targetSch.code}</span>
                  <h3 className="font-bold text-base text-slate-900">
                    Class-Wise Timings — {targetSch.name}
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    हर क्लास (KG1, KG2, Class 1 से 12) के बाजू में सुबह Arrival और दोपहर Departure टाइम खुद डालें—स्टूडेंट रिकॉर्ड अपने आप अपडेट हो जाएंगे।
                  </p>
                </div>
                <button onClick={() => setTimingSchoolId(null)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add Custom Class Name */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customClassName}
                  onChange={(e) => setCustomClassName(e.target.value)}
                  placeholder="Add Custom Class (e.g. Jr. KG, Sr. KG, Playgroup)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!customClassName.trim()) return;
                    updateClassTime(customClassName.trim(), 'arrival', targetSch.kgArrival);
                    setCustomClassName('');
                    notify(`Added custom class "${customClassName.trim()}"!`, 'success');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500"
                >
                  + Add Class
                </button>
              </div>

              {/* Class-Wise Arrival & Departure Grid */}
              <div className="overflow-y-auto border border-slate-200 rounded-xl flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Class / Standard</th>
                      <th className="py-2.5 px-3">☀️ Arrival Time (सुबह)</th>
                      <th className="py-2.5 px-3">🌙 Departure Time (छुट्टी)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {allClassRows.map((cls) => {
                      const isKG = ['Nursery', 'LKG', 'UKG', 'KG', 'KG1', 'KG2'].includes(cls);
                      const rowTime = targetSch.classTimings?.[cls] || {
                        arrival: isKG ? targetSch.kgArrival : targetSch.stdArrival,
                        departure: isKG ? targetSch.kgDeparture : targetSch.stdDeparture
                      };
                      return (
                        <tr key={cls} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{cls}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={rowTime.arrival}
                              onChange={(e) => updateClassTime(cls, 'arrival', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-amber-50/40 font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={rowTime.departure}
                              onChange={(e) => updateClassTime(cls, 'departure', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-sky-300 rounded-lg bg-sky-50/40 font-semibold"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t">
                <button
                  onClick={() => {
                    logAudit('CLASS_TIMINGS_UPDATED', 'Schools & Timings', `Updated class-wise timings for ${targetSch.name}`);
                    notify(`Saved class-wise timings for ${targetSch.name}!`, 'success');
                    setTimingSchoolId(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Save & Apply to All Students
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          MODAL 5: SUPABASE CONNECTION & SQL MIGRATION GUIDE
      ==================================================================== */}
      {showSupabaseModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Connect Live Supabase PostgreSQL Database
                </h3>
              </div>
              <button onClick={() => setShowSupabaseModal(false)} className="p-1 rounded bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-1.5">
              <div className="font-bold">How to connect your Supabase account in 3 steps:</div>
              <div>1. Open the generated <span className="font-mono font-bold">supabase_schema.sql</span> file and paste it into your Supabase SQL Editor to create all 21 tables, indexes, and strict RLS policies.</div>
              <div>2. Copy your Project URL (<span className="font-mono">VITE_SUPABASE_URL</span>) and Anon Public Key (<span className="font-mono">VITE_SUPABASE_ANON_KEY</span>) from Supabase Settings → API.</div>
              <div>3. Never expose your <span className="font-mono">service_role</span> secret key in the frontend code.</div>
            </div>

            <div className="space-y-2">
              <label className="font-semibold block">VITE_SUPABASE_URL</label>
              <input
                type="text"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
              <label className="font-semibold block">VITE_SUPABASE_ANON_KEY</label>
              <input
                type="password"
                value={sbAnonKey}
                onChange={(e) => setSbAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSupabaseModal(false);
                  notify('Supabase configuration saved for client initialization.', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold"
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
