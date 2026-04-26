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
import { Product, CartItem } from './types';
import { MOCK_PRODUCTS } from './constants';
import { motion } from 'motion/react';
import { Radar, ShoppingCart, Package, Shield } from 'lucide-react';
import { db, testFirestoreConnection } from './lib/firebase';
import { collection, onSnapshot, query, addDoc, getDocs } from 'firebase/firestore';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = sessionStorage.getItem('fidgethub_admin_session') === 'authorized';
  return isAuth ? <>{children}</> : <Navigate to="/admin" replace />;
};

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('fidgethub_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    localStorage.setItem('fidgethub_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    testFirestoreConnection();
    
    // Security: Clear legacy persistent auth logs if any
    localStorage.removeItem('fidgethub_auth');
    
    // Real-time products sync
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const prods = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        setProducts(prods);
        setLoading(false);

        // Seed mock data if empty (for first run)
        const hasSeededBefore = localStorage.getItem('fidgethub_initial_seed_applied');
        if (prods.length === 0 && !snapshot.metadata.fromCache && !isSeeding && !hasSeededBefore) {
          setIsSeeding(true);
          const seed = async () => {
            for (const p of MOCK_PRODUCTS) {
              const { id, ...rest } = p;
              await addDoc(collection(db, 'products'), rest);
            }
            localStorage.setItem('fidgethub_initial_seed_applied', 'true');
          };
          seed().finally(() => setIsSeeding(false));
        }
      },
      error: (error) => {
        console.error("Products sync error:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isSeeding]);

  const addToCart = (product: Product, selectedColor?: string, selectedSize?: string) => {
    // Stock limit check
    const currentInCart = cartItems.find(item => item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize)?.quantity || 0;
    
    if (currentInCart >= product.stock) {
      alert(`Cannot add more. Only ${product.stock} units available in stock.`);
      return;
    }

    // Determine size-specific price
    let itemPrice = product.price;
    if (selectedSize && product.sizePrices) {
      const sp = product.sizePrices.find(p => p.size === selectedSize);
      if (sp) itemPrice = sp.price;
    }

    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize);
      if (existing) {
        return prev.map(item => (item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize) ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: itemPrice, image: product.image, quantity: 1, selectedColor, selectedSize }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (id: string, color: string | undefined, size: string | undefined, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id && item.selectedColor === color && item.selectedSize === size) {
        if (delta > 0) {
          const product = products.find(p => p.id === id);
          if (product && item.quantity >= product.stock) {
            alert(`Maximum stock reached (${product.stock} units).`);
            return item;
          }
        }
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
                  {loading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className="aspect-square bg-slate-50 animate-pulse rounded-2xl border border-slate-100 flex items-center justify-center">
                        <Radar className="w-8 h-8 text-slate-200 animate-spin-slow" />
                      </div>
                    ))
                  ) : (
                    products.map(product => (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        onAddToCart={addToCart} 
                      />
                    ))
                  )}
                </div>
              </section>

            </main>
          } />

          <Route path="/admin" element={<AdminDashboard />} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        <Cart 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          products={products}
          onUpdateQuantity={updateCartQuantity}
          onRemove={removeFromCart}
          onClear={() => setCartItems([])}
        />
      </div>
    </Router>
  );
}
