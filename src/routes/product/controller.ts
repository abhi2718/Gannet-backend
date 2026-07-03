import { Request, Response } from 'express';
import { IUser } from '../../models/user.model';
import { Product } from '../../models/product.model';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';

/**
 * POST /api/products — create a product owned by the current user.
 */
export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const product = await Product.create({ ...req.body, createdBy: user.id });
  res.status(201).json({ success: true, data: product });
});

/**
 * GET /api/products — list all products.
 */
export const listProducts = catchAsync(async (_req: Request, res: Response) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res
    .status(200)
    .json({ success: true, count: products.length, data: products });
});

/**
 * GET /api/products/:id — fetch a single product.
 */
export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  res.status(200).json({ success: true, data: product });
});

/**
 * PATCH /api/products/:id — update a product.
 */
export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  res.status(200).json({ success: true, data: product });
});

/**
 * DELETE /api/products/:id — remove a product.
 */
export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  res.status(200).json({ success: true, data: null });
});
