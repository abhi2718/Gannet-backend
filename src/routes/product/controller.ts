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
export const listProducts = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    data: products,
  });
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
