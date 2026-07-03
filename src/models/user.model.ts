import bcrypt from 'bcryptjs';
import { Document, model, Schema } from 'mongoose';

export enum UserType {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  userType: UserType;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    userType: {
      type: String,
      enum: Object.values(UserType),
      default: UserType.CUSTOMER,
    },
  },
  { timestamps: true }
);

// Hash the password before persisting whenever it has been modified.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Never leak the password hash in JSON responses.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.password;
    return obj;
  },
});

export const User = model<IUser>('User', userSchema);
