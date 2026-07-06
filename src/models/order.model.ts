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

/**
 * A single product line within an order. An order may contain many of these
 * (e.g. different bottle sizes added to the same cart).
 */
export interface IOrderItem {
  bottleSize: string;
  quantity: number;
  amount: number;
}

export interface IOrder extends Document {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: IOrderItem[];
  totalAmount: number;
  estimatedDelivery: Date;
  status: OrderStatus;
  user: Types.ObjectId;
  address: Types.ObjectId;
}

// Human-readable, unique business id (distinct from the Mongo _id).
const generateOrderId = (): string =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// A product line inside an order. Stored as a subdocument (no own _id).
const orderItemSchema = new Schema<IOrderItem>(
  {
    bottleSize: { type: String, required: true, trim: true, maxlength: 60 },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

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
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) =>
          Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    totalAmount: {
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
    address: {
      type: Schema.Types.ObjectId,
      ref: 'Address',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);
