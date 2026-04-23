export interface SizePrice {
  size: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Base price
  sizePrices?: SizePrice[];
  image: string;
  location: string;
  stock: number;
  specs?: string[];
  colors?: string[];
  sizes?: string[];
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: string;
  location: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  selectedColor?: string;
  selectedSize?: string;
}
