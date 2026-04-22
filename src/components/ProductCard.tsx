import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, ExternalLink, Info } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-300"
    >
      {/* Location Badge */}
      <div className="absolute top-3 left-3 z-10">
        <span className="px-2 py-1 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
          {product.location}
        </span>
      </div>

      {/* Image Container */}
      <div className="aspect-square relative overflow-hidden bg-slate-50">
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-slate-800 tracking-tight leading-none truncate">{product.name}</h3>
          <span className="text-indigo-600 font-bold text-sm tracking-tight">${product.price.toFixed(2)}</span>
        </div>
        
        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {product.description}
        </p>

        {/* Specs Mini List */}
        {product.specs && product.specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.specs.slice(0, 2).map((spec, i) => (
              <span key={i} className="text-[9px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                {spec}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => onAddToCart(product)}
          className="w-full mt-auto bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all duration-200 active:scale-95"
        >
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
};
