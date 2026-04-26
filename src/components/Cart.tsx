import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, X, Trash2, Plus, Minus, CreditCard, Send, CheckCircle, Palette, Ruler } from 'lucide-react';
import { CartItem, Order, Product } from '../types';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  products: Product[];
  onUpdateQuantity: (id: string, color: string | undefined, size: string | undefined, delta: number) => void;
  onRemove: (id: string, color: string | undefined, size: string | undefined) => void;
  onClear: () => void;
}

export const Cart = ({ isOpen, onClose, items, products, onUpdateQuantity, onRemove, onClear }: CartProps) => {
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'success'>('cart');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '', location: '' });
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    
    const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locs = snapshot.docs.map(doc => doc.data().name) as string[];
      setAvailableLocations(locs);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const newOrder = {
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      location: customer.location,
      items: [...items],
      total,
      status: 'pending',
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'orders'), newOrder);
      setCheckoutStep('success');
      setTimeout(() => {
        onClear();
        onClose();
        setCheckoutStep('cart');
        setCustomer({ name: '', email: '', phone: '', address: '', location: '' });
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, 'create', 'orders');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[70] border-l border-slate-200 flex flex-col shadow-2xl"
          >
            <div className="h-14 flex items-center justify-between px-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                Active <span className="text-indigo-600">Cart</span>
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {checkoutStep === 'cart' && (
                <>
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <ShoppingBag className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-tight">Cart is Empty</p>
                      <p className="text-xs text-slate-300 mt-2">Add some fidgets to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div key={`${item.id}-${item.selectedColor}-${item.selectedSize}`} className="flex gap-4 p-3 bg-slate-50 border border-slate-100 rounded-xl group transition-all hover:border-indigo-100">
                          <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-slate-800 uppercase truncate mb-1">{item.name}</h4>
                            <div className="flex flex-wrap gap-2 mb-1">
                              {item.selectedColor && (
                                <div className="text-[8px] font-black uppercase text-indigo-500 flex items-center gap-1">
                                  <Palette className="w-2 h-2" /> {item.selectedColor}
                                </div>
                              )}
                              {item.selectedSize && (
                                <div className="text-[8px] font-black uppercase text-slate-800 flex items-center gap-1">
                                  <Ruler className="w-2 h-2" /> {item.selectedSize}
                                </div>
                              )}
                            </div>
                            <div className="text-indigo-600 font-bold text-xs tracking-tight">{item.price.toFixed(2)} SAR</div>
                            <div className="flex items-center gap-3 mt-2">
                              <button onClick={() => onUpdateQuantity(item.id, item.selectedColor, item.selectedSize, -1)} className="p-1 border border-slate-200 hover:bg-white rounded"><Minus className="w-2.5 h-2.5 text-slate-400" /></button>
                              <span className="font-bold text-xs text-slate-600">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQuantity(item.id, item.selectedColor, item.selectedSize, 1)} 
                                disabled={item.quantity >= (products.find(p => p.id === item.id)?.stock || 0)}
                                className="p-1 border border-slate-200 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-2.5 h-2.5 text-slate-400" />
                              </button>
                            </div>
                          </div>
                          <button onClick={() => onRemove(item.id, item.selectedColor, item.selectedSize)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg h-fit transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {checkoutStep === 'shipping' && (
                <form onSubmit={handleCheckout} className="space-y-5">
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-6">
                    <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em] flex items-center gap-2 mb-1">
                      <Send className="w-3 h-3" /> Delivery Details
                    </h3>
                    <p className="text-[11px] text-indigo-400 leading-tight">Please provide your details below.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Full Name</label>
                      <input required type="text" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} className="hardware-input w-full bg-slate-50" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Collection Location (Hub)</label>
                      {availableLocations.length === 0 ? (
                        <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 font-bold uppercase tracking-tighter">
                          System Offline: No hubs available in current sector.
                        </div>
                      ) : (
                        <select 
                          required 
                          value={customer.location} 
                          onChange={e => setCustomer({...customer, location: e.target.value})} 
                          className="hardware-input w-full bg-slate-50"
                        >
                          <option value="">Select Destination Hub</option>
                          {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Email</label>
                      <input required type="email" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} className="hardware-input w-full bg-slate-50" placeholder="john@example.com" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Phone</label>
                      <input required type="tel" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="hardware-input w-full bg-slate-50" placeholder="+1 (555) 000-0000" />
                    </div>
                  </div>
                  
                  <div className="pt-4 flex gap-2">
                    <button type="button" onClick={() => setCheckoutStep('cart')} className="px-4 py-3 border border-slate-200 text-slate-400 font-bold rounded-xl uppercase text-[10px] hover:bg-slate-50">Back</button>
                    <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                      Confirm Final Order <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}

              {checkoutStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl shadow-green-100">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight mb-2">Authorization Confirmed</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Awaiting departure sequence from sector-7 control base.</p>
                </div>
              )}
            </div>

            {items.length > 0 && checkoutStep === 'cart' && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Order Value</span>
                  <span className="text-xl font-black text-indigo-600 tracking-tight">{total.toFixed(2)} SAR</span>
                </div>
                <button
                  onClick={() => setCheckoutStep('shipping')}
                  className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Proceed to Checkout <CreditCard className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const CheckCircleIcon = CheckCircle; // Using imported lucide icon
