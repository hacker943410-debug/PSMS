export type ActionResult<T = unknown> =
  | {
      ok: true;
      data?: T;
      message?: string;
      redirectTo?: string;
    }
  | {
      ok: false;
      code?: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };
