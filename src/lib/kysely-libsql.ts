import type { Client, InValue, Transaction } from "@libsql/client";
import {
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryResult,
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";

// Dialecte Kysely minimal au-dessus du client libSQL : utilisé par Better Auth pour partager
// la même connexion que le reste du site (SQLite en local, Turso en production).
export class LibsqlDialect implements Dialect {
  constructor(private readonly client: Client) {}
  createAdapter() {
    return new SqliteAdapter();
  }
  createDriver(): Driver {
    return new LibsqlDriver(this.client);
  }
  createQueryCompiler() {
    return new SqliteQueryCompiler();
  }
  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}

class LibsqlDriver implements Driver {
  constructor(private readonly client: Client) {}
  async init() {}
  async acquireConnection() {
    return new LibsqlConnection(this.client);
  }
  async beginTransaction(connection: LibsqlConnection) {
    await connection.begin();
  }
  async commitTransaction(connection: LibsqlConnection) {
    await connection.commit();
  }
  async rollbackTransaction(connection: LibsqlConnection) {
    await connection.rollback();
  }
  async releaseConnection() {}
  async destroy() {}
}

class LibsqlConnection implements DatabaseConnection {
  private tx: Transaction | null = null;
  constructor(private readonly client: Client) {}

  async begin() {
    this.tx = await this.client.transaction("write");
  }
  async commit() {
    await this.tx?.commit();
    this.tx = null;
  }
  async rollback() {
    await this.tx?.rollback();
    this.tx = null;
  }

  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const rs = await (this.tx ?? this.client).execute({ sql: query.sql, args: query.parameters as InValue[] });
    const rows = rs.rows.map((row) => Object.fromEntries(rs.columns.map((name, index) => [name, row[index]])) as R);
    return { rows, numAffectedRows: BigInt(rs.rowsAffected), insertId: rs.lastInsertRowid };
  }

  async *streamQuery(): AsyncIterableIterator<never> {
    throw new Error("Le dialecte libSQL ne gère pas le streaming.");
  }
}
