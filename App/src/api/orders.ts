import api from './axios';
import type { Order, CreateOrderRequest } from '../types/Order';

export const getUserOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get('/orders/my-orders');
    return response.data || [];
  } catch (error: any) {
    console.error('Error obteniendo pedidos del usuario:', error);
    throw new Error(error.response?.data?.error || 'Error obteniendo pedidos');
  }
};

export const createOrder = async (orderData: CreateOrderRequest): Promise<Order> => {
  try {
    const response = await api.post('/orders', orderData);
    return response.data.order;
  } catch (error: any) {
    console.error('Error creando pedido:', error);
    throw new Error(error.response?.data?.error || 'Error creando pedido');
  }
};