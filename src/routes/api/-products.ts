import { createServerFn } from '@tanstack/react-start';
import { query, queryOne, execute } from '../../lib/database';

// Interface untuk Product
export interface Product {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  size: string;
  stock: number;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

// Get all products dengan variants
export const getProducts = createServerFn(
  { method: 'GET' },
  async (): Promise<ProductWithVariants[]> => {
    try {
      const products = await query<Product>(
        'SELECT * FROM products WHERE is_active = TRUE ORDER BY id DESC'
      );

      const productsWithVariants = await Promise.all(
        products.map(async (product) => {
          const variants = await query<ProductVariant>(
            'SELECT * FROM product_variants WHERE product_id = ?',
            [product.id]
          );
          return { ...product, variants };
        })
      );

      return productsWithVariants;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new Error('Failed to fetch products');
    }
  }
);

// Get single product dengan variants
export const getProductById = createServerFn(
  { method: 'GET' },
  async (productId: number): Promise<ProductWithVariants | null> => {
    try {
      const product = await queryOne<Product>(
        'SELECT * FROM products WHERE id = ? AND is_active = TRUE',
        [productId]
      );

      if (!product) return null;

      const variants = await query<ProductVariant>(
        'SELECT * FROM product_variants WHERE product_id = ?',
        [product.id]
      );

      return { ...product, variants };
    } catch (error) {
      console.error('Error fetching product:', error);
      throw new Error('Failed to fetch product');
    }
  }
);

// Get products by category
export const getProductsByCategory = createServerFn(
  { method: 'GET' },
  async (categoryId: number): Promise<ProductWithVariants[]> => {
    try {
      const products = await query<Product>(
        'SELECT * FROM products WHERE category_id = ? AND is_active = TRUE ORDER BY id DESC',
        [categoryId]
      );

      const productsWithVariants = await Promise.all(
        products.map(async (product) => {
          const variants = await query<ProductVariant>(
            'SELECT * FROM product_variants WHERE product_id = ?',
            [product.id]
          );
          return { ...product, variants };
        })
      );

      return productsWithVariants;
    } catch (error) {
      console.error('Error fetching category products:', error);
      throw new Error('Failed to fetch category products');
    }
  }
);

// Check stock availability
export const checkStockAvailability = createServerFn(
  { method: 'POST' },
  async (productId: number, size: string, quantity: number): Promise<boolean> => {
    try {
      const variant = await queryOne<ProductVariant>(
        'SELECT * FROM product_variants WHERE product_id = ? AND size = ?',
        [productId, size]
      );

      if (!variant) return false;
      return variant.stock >= quantity;
    } catch (error) {
      console.error('Error checking stock:', error);
      return false;
    }
  }
);
