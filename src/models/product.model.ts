import { Document, model, Schema, Types } from 'mongoose';

export interface IProduct extends Document {
  productName: string;
  url: string;
  price: number;
  description: string;
  createdBy: Types.ObjectId;
}

const productSchema = new Schema<IProduct>(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const Product = model<IProduct>('Product', productSchema);
