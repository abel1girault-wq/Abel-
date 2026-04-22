/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { AdminDashboard } from './components/AdminDashboard';
import { Cart } from './components/Cart';
import { MOCK_PRODUCTS } from './constants';
import { Product, CartItem } from './types';
import { motion } from 'motion/react';
import { Radar, ShoppingCart, Package, Shield } from 'lucide-react';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = sessionStorage.getItem('fidgethub_auth_session') === 'active';
  return isAuth ? <>{children}</> : <Navigate to="/" replace />;
};

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Security: Clear legacy persistent auth logs if any
    localStorage.removeItem('fidgethub_auth');
    
    const stored = localStorage.getItem('fidgethub_products');
    if (stored) {
      setProducts(JSON.parse(stored));
    } else {
      setProducts(MOCK_PRODUCTS);
      localStorage.setItem('fidgethub_products', JSON.stringify(MOCK_PRODUCTS));
    }
  }, []);

  const addToCart = (product: Product, selectedColor?: string, selectedSize?: string) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize);
      if (existing) {
        return prev.map(item => (item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize) ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1, selectedColor, selectedSize }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (id: string, color: string | undefined, size: string | undefined, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id && item.selectedColor === color && item.selectedSize === size) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string, color: string | undefined, size: string | undefined) => {
    setCartItems(prev => prev.filter(item => !(item.id === id && item.selectedColor === color && item.selectedSize === size)));
  };

  const cartItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Router>
      <div className="min-h-screen bg-tactical-bg selection:bg-tactical-accent selection:text-black">
        <Navbar cartCount={cartItemsCount} onOpenCart={() => setIsCartOpen(true)} />
        
        <Routes>
          <Route path="/" element={
            <main className="pt-14 pb-12 flex flex-col min-h-screen">
              {/* Hero Section - High Impact */}
              <section className="relative h-[80vh] flex items-center justify-center bg-white overflow-hidden shrink-0">
                <div className="absolute inset-0 pointer-events-none opacity-[0.4] bristol-grid" />
                <div className="relative z-10 px-6 max-w-7xl mx-auto text-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 mb-6 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">System Ready // Series 01 Launch</span>
                  </motion.div>
                  <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 uppercase leading-[0.9] mb-8">
                    3D <br />
                    <span className="text-indigo-600">Fidgets</span>
                  </h1>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                      onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
                    >
                      View Collection
                    </button>
                  </div>
                </div>
                
                {/* Visual Accent */}
                <div className="absolute bottom-10 left-10 flex flex-col gap-2 opacity-20 hidden lg:flex">
                  <div className="w-1 h-32 bg-slate-200" />
                  <span className="text-[10px] whitespace-nowrap rotate-90 origin-left mt-32 font-black text-slate-400 uppercase tracking-widest leading-none">Axis Control // 001</span>
                </div>
              </section>

              {/* Main Collection Display */}
              <section id="collection" className="py-24 px-6 max-w-7xl mx-auto w-full flex-1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase leading-none mb-3">
                      Current <span className="text-indigo-600">Products</span>
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      All units available for immediate departure. High availability in current sectors.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-400">
                    <span className="flex items-center gap-2 underline underline-offset-4 decoration-indigo-600">All Items</span>
                    <span>/</span>
                    <span className="hover:text-indigo-600 cursor-pointer transition-colors">Limited Release</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {products.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onAddToCart={addToCart} 
                    />
                  ))}
                </div>
              </section>

            </main>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard onProductsChange={() => {
                const stored = localStorage.getItem('fidgethub_products');
                if (stored) setProducts(JSON.parse(stored));
              }} />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        <Cart 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={updateCartQuantity}
          onRemove={removeFromCart}
          onClear={() => setCartItems([])}
        />
      </div>
    </Router>
  );
}
