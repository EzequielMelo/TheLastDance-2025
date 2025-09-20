// Augmenta Express.Request para agregar `user`
declare global {
  namespace Express {
    interface Request {
      user: {
        appUserId: string;
        position_code: string; // 'cocinero' | 'bartender' | etc.
      };
    }
  }
}

// Hace que este .d.ts sea tratado como un módulo y no se lo saltee
export {};