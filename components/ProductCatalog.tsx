import React, { useEffect, useState } from 'react';
import { getCatalogProducts, type CatalogProduct } from '../services/catalogService';

interface ProductCatalogProps {
  onSelectProduct: (product: CatalogProduct) => void;
  selectedProductId?: string | null;
}

type CategoryFilter = 'all' | 'men' | 'women' | 'kids';

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ onSelectProduct, selectedProductId }) => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<CatalogProduct[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [categoryFilter, searchQuery, products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const catalogProducts = await getCatalogProducts();
      setProducts(catalogProducts);
    } catch (error) {
      console.error('Error loading catalog products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.subcategory?.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleViewProduct = (product: CatalogProduct) => {
    window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Browse Fashion Catalog</h3>
        <p className="text-sm text-zinc-400">Select a product to try on</p>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'men', 'women', 'kids'] as CategoryFilter[]).map((category) => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                categoryFilter === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400">Loading products...</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400 text-center">
            <p className="mb-2">No products found</p>
            <p className="text-sm text-zinc-500">
              {categoryFilter !== 'all' ? `Try a different category or search term` : 'Check back later for new products'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-zinc-800/50 rounded-lg border-2 overflow-hidden transition-all cursor-pointer hover:border-indigo-500 ${
                selectedProductId === product.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500'
                  : 'border-zinc-700'
              }`}
              onClick={() => onSelectProduct(product)}
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-zinc-900">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23333" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                  }}
                />
                {selectedProductId === product.id && (
                  <div className="absolute top-2 right-2 bg-indigo-500 rounded-full p-1">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-3">
                <h4 className="text-white font-semibold text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
                  {product.name}
                </h4>
                {product.price && (
                  <p className="text-indigo-400 font-bold text-sm mb-2">₹{product.price}</p>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-zinc-500 capitalize">{product.category}</span>
                  {product.subcategory && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-xs text-zinc-500 capitalize">{product.subcategory}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewProduct(product);
                  }}
                  className="w-full px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold rounded transition"
                >
                  View on {product.source === 'ajio' ? 'Ajio' : 'Myntra'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className="text-center text-sm text-zinc-400 mt-4">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
        </div>
      )}
    </div>
  );
};

