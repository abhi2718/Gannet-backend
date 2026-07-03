import { IUser } from '../models/user.model';

// Augment Express' Request so authenticated handlers can read `req.user`.
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export {};
