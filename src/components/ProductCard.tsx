import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, ExternalLink, Info, Palette, Ruler } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, selectedColor?: string, selectedSize?: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [selectedColor, setSelectedColor] = React.useState<string>(product.colors && product.colors.length > 0 ? product.colors[0] : '');
  const [selectedSize, setSelectedSize] = React.useState<string>(product.sizes && product.sizes.length > 0 ? product.sizes[0] : '');

  const currentPrice = React.useMemo(() => {
    if (product.sizePrices && product.sizePrices.length > 0 && selectedSize) {
      const sizePrice = product.sizePrices.find(sp => sp.size === selectedSize);
      if (sizePrice) return sizePrice.price;
    }
    return product.price;
  }, [product.price, product.sizePrices, selectedSize]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-300 relative"
    >
      {/* Location & Stock Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <span className="px-2 py-1 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
          {product.location}
        </span>
        {product.stock <= 0 && (
          <span className="px-2 py-1 bg-red-500 text-white rounded-md text-[10px] font-bold uppercase tracking-wider shadow-md animate-pulse">
            Out of Stock
          </span>
        )}
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
          <h3 className="font-bold text-slate-800 tracking-tight leading-none truncate pr-2">{product.name}</h3>
          <span className="text-indigo-600 font-bold text-sm tracking-tight whitespace-nowrap">{currentPrice.toFixed(2)} SAR</span>
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

        {/* Configuration Block (Color & Size) */}
        {( (product.colors && product.colors.length > 0) || (product.sizes && product.sizes.length > 0) ) && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-4">
            {/* Color Selector */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1 tracking-[0.1em]">
                  <Palette className="w-2.5 h-2.5" /> Core Finish
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all border ${
                        selectedColor === color 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div>
                <label className="text-[8px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1 tracking-[0.1em]">
                  <Ruler className="w-2.5 h-2.5" /> Object Scale
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all border ${
                        selectedSize === size 
                          ? 'bg-slate-800 border-slate-800 text-white shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onAddToCart(product, selectedColor, selectedSize)}
          disabled={product.stock <= 0}
          className={`w-full mt-4 font-black py-3 rounded-lg text-[9px] uppercase tracking-[0.2em] shadow-lg transition-all duration-200 active:scale-[0.98] ${
            product.stock <= 0 
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' 
              : 'bg-slate-800 text-white shadow-slate-100 hover:bg-indigo-600'
          }`}
        >
          {product.stock <= 0 ? 'Unavailable' : 'Add to Cart'}
        </button>
      </div>
    </motion.div>
  );
};
