declare global {
  namespace Express {
    interface Request {
      auth?: {
        payload?: {
          sub?: string;
          email?: string;
          name?: string;
          picture?: string;
          scope?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      user?: {
        id: string;
        auth_provider_id: string;
        email?: string | null;
        name?: string | null;
        avatar_url?: string | null;
        created_at: string;
        updated_at: string;
      };
    }
  }
}

export {};
