import { db } from "../index";
import { eq, isNull, and, sql } from "drizzle-orm";
import { PgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * Abstract Base Repository for Drizzle ORM.
 * Implements common CRUD operations with automated soft-delete filtering.
 */
export abstract class BaseRepository<
  TTable extends PgTable,
  TIdCol extends PgColumn = any,
  TDeletedAtCol extends PgColumn = any
> {
  protected constructor(
    protected readonly table: TTable,
    protected readonly idCol: TIdCol,
    protected readonly deletedAtCol: TDeletedAtCol
  ) {}

  /**
   * Find all records that are not soft-deleted.
   */
  async findAll() {
    return (await db
      .select()
      .from(this.table as any)
      .where(isNull(this.deletedAtCol))) as (typeof this.table.$inferSelect)[];
  }

  /**
   * Find a single record by ID, ensuring it's not soft-deleted.
   */
  async findOneById(id: string) {
    const results = await db
      .select()
      .from(this.table as any)
      .where(
        and(
          eq(this.idCol, id),
          isNull(this.deletedAtCol)
        )
      )
      .limit(1);
    return (results[0] as typeof this.table.$inferSelect) || null;
  }

  /**
   * Create a new record.
   */
  async create(values: typeof this.table.$inferInsert) {
    const [result] = await (db.insert(this.table as any).values(values).returning() as any);
    return result as typeof this.table.$inferSelect;
  }

  /**
   * Update an existing record.
   */
  async update(id: string, values: Partial<typeof this.table.$inferInsert>) {
    const [result] = await (db
      .update(this.table as any)
      .set(values)
      .where(eq(this.idCol, id))
      .returning() as any);
    return result as typeof this.table.$inferSelect;
  }

  /**
   * Soft delete a record by setting its deletedAt timestamp.
   */
  async softDelete(id: string) {
    const [result] = await (db
      .update(this.table as any)
      .set({ deletedAt: new Date() } as any)
      .where(eq(this.idCol, id))
      .returning() as any);
    
    if (!result) throw new Error(`${this.table.constructor.name} soft delete failed: ID ${id} not found`);
    return true;
  }

  /**
   * Restore a soft-deleted record.
   */
  async restore(id: string) {
    await db
      .update(this.table as any)
      .set({ deletedAt: null } as any)
      .where(eq(this.idCol, id));
    return true;
  }

  /**
   * Check if a record exists and is not soft-deleted.
   */
  async exists(id: string) {
    const [row] = await (db
      .select({ count: sql<number>`count(*)` })
      .from(this.table as any)
      .where(
        and(
          eq(this.idCol, id),
          isNull(this.deletedAtCol)
        )
      ) as any);
    return Number(row?.count || 0) > 0;
  }
}
