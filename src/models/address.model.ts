import { Document, model, Schema, Types } from 'mongoose';

export interface IAddress extends Document {
  street: string;
  pinCode: string;
  city: string;
  landmark?: string;
  user: Types.ObjectId;
}

/**
 * A postal address that belongs to a user. A single user may own many
 * addresses (indexed `user` ref); an order later references one of them.
 * `pinCode` is a string so leading zeros are preserved.
 */
const addressSchema = new Schema<IAddress>(
  {
    street: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    pinCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 200,
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

export const Address = model<IAddress>('Address', addressSchema);
