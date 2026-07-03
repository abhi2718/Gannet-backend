import { Document, model, Schema } from "mongoose";

/**
 * A pre-sales enquiry submitted by a (not-logged-in) website visitor through
 * the popup form. All fields are required strings.
 */
/**
 * Lifecycle of an enquiry as worked by the sales/admin team.
 */
export enum QueryStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CONVERTED = 'converted',
}

export interface IQuery extends Document {
  fullName: string;
  mobileNumber: string;
  email: string;
  city: string;
  requirement: string;
  message: string;
  status: QueryStatus;
}

const querySchema = new Schema<IQuery>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    requirement: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: Object.values(QueryStatus),
      default: QueryStatus.NEW,
      index: true,
    },
  },
  { timestamps: true },
);

export const Query = model<IQuery>("Query", querySchema);
