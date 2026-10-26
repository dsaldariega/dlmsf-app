export type Member = {
  id: number;
  name: string;
  heads: number | null;
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