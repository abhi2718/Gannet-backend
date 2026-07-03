import { Document, model, Schema, Types } from 'mongoose';

/**
 * Order lifecycle stages. An order moves through these (or is cancelled).
 */
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  OUT_FOR_DELIVERY = 'out for delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface IOrder extends Document {
  orderId: string;
  customerName: string;
  customerPhone: string;
  bottleSize: string;
  quantity: number;
  amount: number;
  estimatedDelivery: Date;
  status: OrderStatus;
  user: Types.ObjectId;
}

// Human-readable, unique business id (distinct from the Mongo _id).
const generateOrderId = (): string =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      default: generateOrderId,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    bottleSize: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedDelivery: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + SEVEN_DAYS_MS),
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);
