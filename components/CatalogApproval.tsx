import React, { useEffect, useState } from 'react';
import {
  getPendingProducts,
  approveProduct,
  rejectProduct,
  updateProductStatus,
  addProductToCatalog,
  addProductToPending,
  type PendingProduct,
} from '../services/catalogService';
import { analyzeClothItem } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface CatalogApprovalProps {
  onClose: () => void;
}

type StatusFilter = 'all' | 'pending' | 'needs_link' | 'approved' | 'rejected';

export const CatalogApproval: React.FC<CatalogApprovalProps> = ({ onClose }) => {
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<PendingProduct[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);
  const [earnkaroLink, setEarnkaroLink] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // New product form state
  const [newProduct, setNewProduct] = useState({
    source_url: '',
    image_url: '',
    name: '',
    price: '',
    description: '',
    category: '' as 'men' | 'women' | 'kids' | '',
    subcategory: '',
    source: 'ajio' as 'ajio' | 'myntra',
  });

  useEffect(() => {
    loadPendingProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [statusFilter, pendingProducts]);

  // Auto-extract product data from URL
  useEffect(() => {
    if (newProduct.source_url) {
      const extractData = async () => {
        try {
          const urlObj = new URL(newProduct.source_url);
          const hostname = urlObj.hostname.toLowerCase();
          
          // Detect source
          let source: 'ajio' | 'myntra' = 'ajio';
          if (hostname.includes('myntra')) {
            source = 'myntra';
          }
          
          // Extract product name from URL path
          const pathParts = urlObj.pathname.split('/').filter(p => p);
          let productName = '';
          
          if (source === 'ajio') {
            // Ajio URL format: /product-name/p/product-id
            // Find the part before /p/
            const pIndex = pathParts.indexOf('p');
            if (pIndex > 0) {
              productName = pathParts[pIndex - 1]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
          } else if (source === 'myntra') {
            // Myntra URL format: /product-name/product-id
            // Usually the last meaningful part before numbers
            for (let i = pathParts.length - 1; i >= 0; i--) {
              const part = pathParts[i];
              if (part && !part.match(/^\d+$/)) {
                productName = part
                  .split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                break;
              }
            }
          }
          
          // Try to fetch price from page (may fail due to CORS)
          let fetchedPrice = '';
          try {
            // Use a CORS proxy or try direct fetch
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(newProduct.source_url)}`);
            if (response.ok) {
              const data = await response.json();
              const html = data.contents;
              
              // Try to extract price from HTML
              if (source === 'ajio') {
                // Ajio price patterns
                const priceMatch = html.match(/₹[\d,]+|Rs\.?\s*[\d,]+/i);
                if (priceMatch) {
                  fetchedPrice = priceMatch[0].replace(/[₹Rs.,\s]/gi, '');
                }
              } else if (source === 'myntra') {
                // Myntra price patterns
                const priceMatch = html.match(/₹[\d,]+|Rs\.?\s*[\d,]+/i);
                if (priceMatch) {
                  fetchedPrice = priceMatch[0].replace(/[₹Rs.,\s]/gi, '');
                }
              }
            }
          } catch (fetchError) {
            // Price fetch failed, that's okay - user can enter manually
            console.log('Could not fetch price from page:', fetchError);
          }
          
          // Update form if we extracted data
          if (productName || source !== newProduct.source || fetchedPrice) {
            setNewProduct(prev => ({
              ...prev,
              source,
              name: prev.name || productName,
              price: prev.price || fetchedPrice,
            }));
          }
        } catch (error) {
          // Invalid URL, ignore
          console.log('Could not extract data from URL:', error);
        }
      };
      
      extractData();
    }
  }, [newProduct.source_url]);

  const loadPendingProducts = async () => {
    try {
      setLoading(true);
      const products = await getPendingProducts();
      setPendingProducts(products);
    } catch (error) {
      console.error('Error loading pending products:', error);
      setMessage({ type: 'error', text: 'Failed to load pending products' });
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    if (statusFilter === 'all') {
      setFilteredProducts(pendingProducts);
    } else {
      setFilteredProducts(pendingProducts.filter(p => p.status === statusFilter));
    }
  };

  const handleApprove = async (product: PendingProduct) => {
    if (!product.earnkaro_link) {
      // If no EarnKaro link, set status to needs_link
      try {
        await updateProductStatus(product.id, 'needs_link');
        setMessage({ type: 'error', text: 'Please add EarnKaro link before approving' });
        loadPendingProducts();
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to update product status' });
      }
      return;
    }

    try {
      setLoading(true);
      await approveProduct(product.id, product.earnkaro_link);
      setMessage({ type: 'success', text: 'Product approved and added to catalog!' });
      loadPendingProducts();
      setSelectedProduct(null);
      setEarnkaroLink('');
    } catch (error) {
      console.error('Error approving product:', error);
      setMessage({ type: 'error', text: 'Failed to approve product' });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (productId: string) => {
    if (!confirm('Are you sure you want to reject this product?')) return;

    try {
      setLoading(true);
      await rejectProduct(productId);
      setMessage({ type: 'success', text: 'Product rejected' });
      loadPendingProducts();
    } catch (error) {
      console.error('Error rejecting product:', error);
      setMessage({ type: 'error', text: 'Failed to reject product' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEarnkaroLink = async (productId: string, link: string) => {
    if (!link.trim()) {
      setMessage({ type: 'error', text: 'Please enter EarnKaro link' });
      return;
    }

    try {
      setLoading(true);
      
      // Update the product with EarnKaro link using Supabase directly
      const { data, error } = await supabase
        .from('pending_products')
        .update({
          earnkaro_link: link,
          status: 'needs_link',
        })
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      // Update local state
      setPendingProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? { ...p, earnkaro_link: link, status: 'needs_link' as const }
            : p
        )
      );

      setMessage({ type: 'success', text: 'EarnKaro link added. You can now approve the product.' });
      setEarnkaroLink('');
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error adding EarnKaro link:', error);
      setMessage({ type: 'error', text: 'Failed to add EarnKaro link' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeProduct = async () => {
    if (!newProduct.image_url) {
      setMessage({ type: 'error', text: 'Please provide an image URL' });
      return;
    }

    try {
      setAnalyzing(true);
      setMessage(null);

      // Fetch image and convert to base64 for analysis
      const response = await fetch(newProduct.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const analysis = await analyzeClothItem(base64);

          // Update form with AI suggestions
          setNewProduct(prev => ({
            ...prev,
            category: (analysis.clothingType.toLowerCase().includes('men') || 
                      analysis.clothingType.toLowerCase().includes('male') ||
                      analysis.clothingType.toLowerCase().includes('boy')) ? 'men' :
                     (analysis.clothingType.toLowerCase().includes('women') || 
                      analysis.clothingType.toLowerCase().includes('female') ||
                      analysis.clothingType.toLowerCase().includes('girl') ||
                      analysis.clothingType.toLowerCase().includes('dress')) ? 'women' :
                     (analysis.clothingType.toLowerCase().includes('kid') || 
                      analysis.clothingType.toLowerCase().includes('child')) ? 'kids' : prev.category,
            subcategory: analysis.clothingType,
            description: prev.description || `${analysis.color} ${analysis.clothingType} with ${analysis.pattern} pattern. ${analysis.texture} fabric, ${analysis.fit} fit.`,
          }));

          setMessage({ type: 'success', text: 'Product analyzed! Review and adjust the suggestions.' });
        } catch (error) {
          console.error('Error analyzing product:', error);
          setMessage({ type: 'error', text: 'Failed to analyze product. Please fill manually.' });
        } finally {
          setAnalyzing(false);
        }
      };

      reader.onerror = () => {
        setMessage({ type: 'error', text: 'Failed to load image for analysis' });
        setAnalyzing(false);
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error analyzing product:', error);
      setMessage({ type: 'error', text: 'Failed to analyze product' });
      setAnalyzing(false);
    }
  };

  const handleAddNewProduct = async () => {
    if (!newProduct.name || !newProduct.image_url || !newProduct.category || !newProduct.source_url) {
      setMessage({ type: 'error', text: 'Please fill all required fields (Name, Image URL, Category, Source URL)' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null); // Clear previous messages
      
      console.log('Adding product:', {
        source_url: newProduct.source_url,
        image_url: newProduct.image_url,
        name: newProduct.name,
        category: newProduct.category,
        source: newProduct.source,
      });
      
      const result = await addProductToPending({
        source_url: newProduct.source_url,
        image_url: newProduct.image_url,
        name: newProduct.name,
        price: newProduct.price ? parseFloat(newProduct.price) : undefined,
        description: newProduct.description || undefined,
        category: newProduct.category as 'men' | 'women' | 'kids',
        subcategory: newProduct.subcategory || undefined,
        source: newProduct.source,
      });

      console.log('Product added successfully:', result);

      setMessage({ type: 'success', text: 'Product added to pending queue!' });
      setShowAddProduct(false);
      setNewProduct({
        source_url: '',
        image_url: '',
        name: '',
        price: '',
        description: '',
        category: '',
        subcategory: '',
        source: 'ajio',
      });
      await loadPendingProducts(); // Wait for reload to complete
    } catch (error: any) {
      console.error('Error adding product - Full error:', error);
      console.error('Error details:', {
        message: error?.message,
        error: error?.error,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      
      // Show detailed error message
      let errorMessage = 'Failed to add product. ';
      if (error?.message) {
        errorMessage += error.message;
      } else if (error?.error?.message) {
        errorMessage += error.error.message;
      } else if (error?.code) {
        errorMessage += `Error code: ${error.code}`;
      } else {
        errorMessage += 'Please check console for details.';
      }
      
      // Check for common RLS errors
      if (error?.code === '42501' || error?.message?.includes('permission') || error?.message?.includes('policy')) {
        errorMessage += ' (Permission denied - make sure you are logged in as admin)';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
      needs_link: 'bg-orange-900/30 text-orange-300 border-orange-700',
      approved: 'bg-green-900/30 text-green-300 border-green-700',
      rejected: 'bg-red-900/30 text-red-300 border-red-700',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-900 w-full max-w-7xl h-[90vh] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Catalog Management</h2>
              <p className="text-xs text-zinc-400">Manage product catalog and pending approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddProduct(!showAddProduct)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
            >
              {showAddProduct ? 'Cancel' : '+ Add Product'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-900/20 rounded-full transition group"
              title="Close"
            >
              <svg className="w-6 h-6 text-zinc-400 group-hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-4 mt-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Add Product Form */}
        {showAddProduct && (
          <div className="mx-4 mt-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <h3 className="text-white font-semibold mb-4">Add New Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Source URL (Ajio/Myntra)</label>
                <input
                  type="text"
                  value={newProduct.source_url}
                  onChange={(e) => setNewProduct({ ...newProduct, source_url: e.target.value })}
                  placeholder="https://www.ajio.com/..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProduct.image_url}
                    onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={handleAnalyzeProduct}
                    disabled={analyzing || !newProduct.image_url}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {analyzing ? 'Analyzing...' : 'AI Analyze'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Floral Summer Dress"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  placeholder="999"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Category *</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                >
                  <option value="">Select Category</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Subcategory</label>
                <input
                  type="text"
                  value={newProduct.subcategory}
                  onChange={(e) => setNewProduct({ ...newProduct, subcategory: e.target.value })}
                  placeholder="Dress, Shirt, Pant, etc."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Source</label>
                <select
                  value={newProduct.source}
                  onChange={(e) => setNewProduct({ ...newProduct, source: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                >
                  <option value="ajio">Ajio</option>
                  <option value="myntra">Myntra</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Product description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleAddNewProduct}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
              >
                {loading ? 'Adding...' : 'Add to Pending Queue'}
              </button>
            </div>
          </div>
        )}

        {/* Status Filters */}
        <div className="px-4 pt-4 flex gap-2 border-b border-zinc-800">
          {(['all', 'pending', 'needs_link', 'approved', 'rejected'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} ({status === 'all' ? pendingProducts.length : pendingProducts.filter(p => p.status === status).length})
            </button>
          ))}
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-auto p-4">
          {loading && filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-zinc-400">Loading products...</div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-zinc-400">No products found</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4 hover:border-zinc-600 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                      {product.price && (
                        <p className="text-indigo-400 font-semibold">₹{product.price}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge(product.status)}`}>
                      {product.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-lg mb-3 bg-zinc-900"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23333" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                    }}
                  />

                  <div className="space-y-2 mb-3">
                    {product.category && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Category:</span>
                        <span className="text-xs text-zinc-300 capitalize">{product.category}</span>
                      </div>
                    )}
                    {product.trend_score !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Trend:</span>
                        <span className="text-xs text-zinc-300">{(product.trend_score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {product.quality_score !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Quality:</span>
                        <span className="text-xs text-zinc-300">{(product.quality_score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  {product.status === 'needs_link' && (
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="Paste EarnKaro link here"
                        value={earnkaroLink}
                        onChange={(e) => setEarnkaroLink(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-xs mb-2"
                      />
                      <button
                        onClick={() => handleAddEarnkaroLink(product.id, earnkaroLink)}
                        className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
                      >
                        Add Link
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {product.status === 'pending' || product.status === 'needs_link' ? (
                      <>
                        <button
                          onClick={() => {
                            if (product.earnkaro_link) {
                              handleApprove(product);
                            } else {
                              setSelectedProduct(product);
                              setEarnkaroLink('');
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          {product.earnkaro_link ? 'Approve' : 'Add Link'}
                        </button>
                        <button
                          onClick={() => handleReject(product.id)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-zinc-500 w-full text-center py-2">
                        {product.status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

