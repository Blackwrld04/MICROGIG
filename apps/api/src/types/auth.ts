export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  accountType: "CLIENT" | "FREELANCER";
  isAdmin: boolean;
  isSeller: boolean;
  sessionId: string;
};
