/**
 * User handler: no explicit DB I/O; just returns new state
 */
export interface UserState {
  id: string;
  name: string;
  email: string;
}

export const UserHandler = {
  async mount({ userid, userId }: { userid?: string; userId?: string } = {}): Promise<UserState> {
    const id = userId || userid || "currentUser";
    // Include demo-only error fields (empty by default)
    return { id, name: "Guest", email: "" } as any;
  },

  async save_profile(payload: any, current: UserState): Promise<UserState> {
    const next: any = { ...current };
    // Demo-only inline field errors (not persisted in core)
    if (typeof payload?.name === "string") next.name = payload.name;
    if (typeof payload?.email === "string") {
      const email = String(payload.email);
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      next.error_email = valid ? "" : "Please enter a valid email address.";
      if (valid) next.email = email;
    }
    return next as UserState;
  }
};
