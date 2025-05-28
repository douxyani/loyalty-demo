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
