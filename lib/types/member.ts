export type Member = {
  id: number;
  name: string;
  heads: number;
  roles: string;
};

export type MemberOption = {
  id: number;
  name: string;
};

export type MemberCount = {
  id: number;
  heads: number;
};

export type Toast = {
  id: number;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};