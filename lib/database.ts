import { supabase } from './supabase';
import { Purchase } from '../types/database';

export async function recordPurchase(
  userId: string,
  productId: string,
  productName: string,
  price: number
) {
  return await supabase.from('purchases').insert({
    user_id: userId,
    product_id: productId,
    product_name: productName,
    price: price,
  });
}

export async function getUserPurchases(userId: string) {
  return await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false });
}

export async function getUserRole(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
    
  return { role: data?.role, error };
}
