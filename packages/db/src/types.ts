import type { Generated } from "kysely";

export interface SeminarTable {
  id: Generated<number>;
}

export interface Database {
  seminar: SeminarTable;
}
