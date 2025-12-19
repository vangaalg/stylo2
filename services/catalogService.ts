import { supabase } from './supabaseClient';

export interface PendingProduct {
  id: string;
  source_url: string;
  image_url: string;
  name: string;
  price: number | null;
  description: string | null;
  category: 'men' | 'women' | 'kids' | null;
  subcategory: string | null;
  trend_score: number | null;
  quality_score: number | null;
  source: 'ajio' | 'myntra';
  status: 'pending' | 'approved' | 'rejected' | 'needs_link';
  earnkaro_link: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  ai_suggested_at: string;
}

export interface CatalogProduct {
  id: string;
  category: 'men' | 'women' | 'kids';
  subcategory: string | null;
  name: string;
  description: string | null;
  image_url: string;
  affiliate_url: string;
  original_product_url: string;
  source: 'ajio' | 'myntra';
  price: number | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Get all pending products for admin review
export const getPendingProducts = async (status?: string): Promise<PendingProduct[]> => {
  try {
    let query = supabase
      .from('pending_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching pending products:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPendingProducts:', error);
    throw error;
  }
};

// Get a single pending product by ID
export const getPendingProductById = async (id: string): Promise<PendingProduct | null> => {
  try {
    const { data, error } = await supabase
      .from('pending_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching pending product:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getPendingProductById:', error);
    return null;
  }
};

// Approve a pending product and move it to catalog
export const approveProduct = async (
  productId: string,
  earnkaroLink: string
): Promise<CatalogProduct> => {
  try {
    // Get the pending product
    const pendingProduct = await getPendingProductById(productId);
    if (!pendingProduct) {
      throw new Error('Pending product not found');
    }

    if (!pendingProduct.category) {
      throw new Error('Product category is required');
    }

    // Insert into product_catalog
    const { data: catalogProduct, error: insertError } = await supabase
      .from('product_catalog')
      .insert([
        {
          category: pendingProduct.category,
          subcategory: pendingProduct.subcategory,
          name: pendingProduct.name,
          description: pendingProduct.description,
          image_url: pendingProduct.image_url,
          affiliate_url: earnkaroLink,
          original_product_url: pendingProduct.source_url,
          source: pendingProduct.source,
          price: pendingProduct.price,
          currency: 'INR',
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting into catalog:', insertError);
      throw insertError;
    }

    // Update pending product status
    const { error: updateError } = await supabase
      .from('pending_products')
      .update({
        status: 'approved',
        earnkaro_link: earnkaroLink,
        approved_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (updateError) {
      console.error('Error updating pending product:', updateError);
      // Don't throw - product is already in catalog
    }

    return catalogProduct;
  } catch (error) {
    console.error('Error in approveProduct:', error);
    throw error;
  }
};

// Reject a pending product
export const rejectProduct = async (productId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('pending_products')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (error) {
      console.error('Error rejecting product:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in rejectProduct:', error);
    throw error;
  }
};

// Update product status
export const updateProductStatus = async (
  productId: string,
  status: 'pending' | 'approved' | 'rejected' | 'needs_link'
): Promise<void> => {
  try {
    const updateData: any = {
      status,
    };

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString();
    } else if (status === 'rejected') {
      updateData.rejected_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('pending_products')
      .update(updateData)
      .eq('id', productId);

    if (error) {
      console.error('Error updating product status:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateProductStatus:', error);
    throw error;
  }
};

// Get catalog products for users (active products only)
export const getCatalogProducts = async (
  category?: 'men' | 'women' | 'kids'
): Promise<CatalogProduct[]> => {
  try {
    let query = supabase
      .from('product_catalog')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching catalog products:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getCatalogProducts:', error);
    throw error;
  }
};

// Get a single catalog product by ID
export const getCatalogProductById = async (id: string): Promise<CatalogProduct | null> => {
  try {
    const { data, error } = await supabase
      .from('product_catalog')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching catalog product:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCatalogProductById:', error);
    return null;
  }
};

// Add a new product directly to catalog (for manual entry)
export const addProductToCatalog = async (
  productData: {
    category: 'men' | 'women' | 'kids';
    subcategory?: string;
    name: string;
    description?: string;
    image_url: string;
    affiliate_url: string;
    original_product_url: string;
    source: 'ajio' | 'myntra';
    price?: number;
  }
): Promise<CatalogProduct> => {
  try {
    const { data, error } = await supabase
      .from('product_catalog')
      .insert([
        {
          ...productData,
          currency: 'INR',
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding product to catalog:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in addProductToCatalog:', error);
    throw error;
  }
};

// Update a catalog product
export const updateCatalogProduct = async (
  productId: string,
  updates: Partial<CatalogProduct>
): Promise<CatalogProduct> => {
  try {
    const { data, error } = await supabase
      .from('product_catalog')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating catalog product:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateCatalogProduct:', error);
    throw error;
  }
};

// Deactivate a catalog product
export const deactivateCatalogProduct = async (productId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('product_catalog')
      .update({ is_active: false })
      .eq('id', productId);

    if (error) {
      console.error('Error deactivating product:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deactivateCatalogProduct:', error);
    throw error;
  }
};

// Add a product to pending queue (for AI suggestions or manual entry)
export const addProductToPending = async (
  productData: {
    source_url: string;
    image_url: string;
    name: string;
    price?: number;
    description?: string;
    category?: 'men' | 'women' | 'kids';
    subcategory?: string;
    trend_score?: number;
    quality_score?: number;
    source: 'ajio' | 'myntra';
  }
): Promise<PendingProduct> => {
  try {
    const { data, error } = await supabase
      .from('pending_products')
      .insert([
        {
          ...productData,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding product to pending:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in addProductToPending:', error);
    throw error;
  }
};

