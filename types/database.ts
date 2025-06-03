import { Int32 } from "react-native/Libraries/Types/CodegenTypes";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  price: number;
  purchase_date: string;
}


export interface Post {
  id: string;
  title: string;
  details: string;
  time_start: string | null;
  time_end: string | null;
  days_of_week: Int32[] | null;
  is_forever: boolean;
  is_hidden: boolean;
  valid_until: string | null;
};