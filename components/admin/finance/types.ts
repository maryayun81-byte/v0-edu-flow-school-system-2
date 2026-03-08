export interface TuitionEvent {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  tuition_fee?: number;
}

export interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  form_class?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  student_name: string;
  student_admission: string;
  event_id: string | null;
  event_name: string | null;
  payment_type: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
  notes: string | null;
  status: string;
  receipt_number: string | null;
  created_at: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string;
  student_name: string;
  event_name: string | null;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
  remaining_balance: number;
  status: string;
  published_at: string | null;
  created_at: string;
}
