// SQLite store with normalized tables based on mapping + schema
// Requires: better-sqlite3 (install in your app: npm i better-sqlite3)

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  // Defer error until store is constructed
}

function sanitizeIdent(name) {
  const safe = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!safe) throw new Error('Invalid identifier');
  return safe;
}

function sqlType(jsType) {
  switch (jsType) {
    case 'string': return 'TEXT';
    case 'number': return 'REAL';
    case 'integer': return 'INTEGER';
    case 'boolean': return 'INTEGER';
    default: return 'TEXT';
  }
}

function toDbValue(val) {
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

class SqliteMappedStore {
  constructor(dbPath, { mapping, schema }) {
    if (!Database) throw new Error("better-sqlite3 is required. Install with 'npm i better-sqlite3'.");
    if (!dbPath) throw new Error('SqliteMappedStore requires a dbPath');
    if (!mapping || !schema) throw new Error('SqliteMappedStore requires mapping and schema');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.mapping = mapping;
    this.schema = schema;
    this._tableEnsured = new Set();
  }

  typeInfo(type) {
    const def = (this.schema && this.schema.$defs && this.schema.$defs[type]) || null;
    const m = (this.mapping && this.mapping[type] && this.mapping[type]['x-nc:store']) || null;
    if (!def || !m) throw new Error(`Missing schema/mapping for type '${type}'`);
    const entity = sanitizeIdent(m.entity || `${type.toLowerCase()}s`);
    const pk = sanitizeIdent(m.pk || 'id');
    return { def, entity, pk };
  }

  ensureMainTable(type) {
    const { def, entity, pk } = this.typeInfo(type);
    const key = `main:${entity}`;
    if (this._tableEnsured.has(key)) return { entity, pk };
    // Create table with pk and scalar columns
    const cols = [];
    cols.push(`${pk} TEXT PRIMARY KEY`);
    const props = def.properties || {};
    for (const [name, prop] of Object.entries(props)) {
      if (name === pk) continue;
      if (prop && typeof prop === 'object') {
        if (prop.type === 'array') continue; // handled as child
        if (prop.type && prop.type !== 'object') {
          cols.push(`${sanitizeIdent(name)} ${sqlType(prop.type)}`);
        }
      }
    }
    const sql = `CREATE TABLE IF NOT EXISTS ${entity} (${cols.join(', ')})`;
    this.db.prepare(sql).run();
    this._tableEnsured.add(key);
    return { entity, pk };
  }

  // Ensure child tables for array-of-object relations (by $ref)
  ensureChildTables(type) {
    const { def, entity: parentEntity, pk: parentPk } = this.typeInfo(type);
    const props = def.properties || {};
    for (const [name, prop] of Object.entries(props)) {
      if (!prop || typeof prop !== 'object') continue;
      if (prop.type !== 'array' || !prop.items) continue;
      const ref = prop.items.$ref;
      if (!ref || !ref.startsWith('#/$defs/')) continue;
      const childType = ref.slice('#/$defs/'.length);
      const { def: childDef, entity: childEntity } = this.typeInfo(childType);
      const fk = sanitizeIdent(`${parentEntity.slice(0, -1)}_${parentPk}`); // e.g., todo_list_id
      const key = `child:${childEntity}:${fk}`;
      if (this._tableEnsured.has(key)) continue;
      const childCols = [];
      const childProps = childDef.properties || {};
      for (const [cname, cprop] of Object.entries(childProps)) {
        if (!cprop || typeof cprop !== 'object') continue;
        if (cprop.type && cprop.type !== 'array' && cprop.type !== 'object') {
          childCols.push(`${sanitizeIdent(cname)} ${sqlType(cprop.type)}`);
        }
      }
      childCols.push(`${fk} TEXT`);
      const sql = `CREATE TABLE IF NOT EXISTS ${childEntity} (${childCols.join(', ')})`;
      this.db.prepare(sql).run();
      // Index on fk
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_${childEntity}_${fk} ON ${childEntity}(${fk})`).run();
      this._tableEnsured.add(key);
    }
  }

  async load(type, id) {
    const { def, entity, pk } = this.typeInfo(type);
    this.ensureMainTable(type);
    this.ensureChildTables(type);
    const row = this.db.prepare(`SELECT * FROM ${entity} WHERE ${pk} = ?`).get(id);
    if (!row) return null;
    const obj = {};
    const props = def.properties || {};
    for (const [name, prop] of Object.entries(props)) {
      if (prop && typeof prop === 'object') {
        if (prop.type === 'array' && prop.items && prop.items.$ref) {
          const childType = prop.items.$ref.replace('#/$defs/', '');
          const { entity: childEntity, pk: _cpk } = this.typeInfo(childType);
          const fk = sanitizeIdent(`${entity.slice(0, -1)}_${pk}`);
          const items = this.db.prepare(`SELECT * FROM ${childEntity} WHERE ${fk} = ?`).all(id);
          // Convert booleans back if needed (INTEGER 0/1)
          obj[name] = items.map((r) => castRow(r, this.schema.$defs[childType].properties));
        } else if (prop.type && prop.type !== 'object') {
          obj[name] = fromDbValue(row[sanitizeIdent(name)], prop.type);
        }
      }
    }
    // Ensure pk present
    obj[pk] = id;
    return obj;
  }

  async persist(type, id, _diff, full) {
    const { def, entity, pk } = this.typeInfo(type);
    this.ensureMainTable(type);
    this.ensureChildTables(type);
    const props = def.properties || {};
    // Upsert main row
    const colNames = [pk];
    const colVals = [id];
    const placeholders = ['?'];
    for (const [name, prop] of Object.entries(props)) {
      if (!prop || typeof prop !== 'object') continue;
      if (prop.type && prop.type !== 'object' && prop.type !== 'array') {
        colNames.push(sanitizeIdent(name));
        colVals.push(toDbValue(full[name]));
        placeholders.push('?');
      }
    }
    const insertSql = `INSERT INTO ${entity} (${colNames.join(',')}) VALUES (${placeholders.join(',')})
      ON CONFLICT(${pk}) DO UPDATE SET ${colNames.slice(1).map((c) => `${c}=excluded.${c}`).join(', ')}`;
    try {
      this.db.prepare(insertSql).run(colVals);
    } catch (e) {
      // Fallback for older SQLite without ON CONFLICT DO UPDATE
      const qMarks = colNames.map(() => '?').join(',');
      this.db.prepare(`REPLACE INTO ${entity} (${colNames.join(',')}) VALUES (${qMarks})`).run(colVals);
    }

    // Replace child arrays
    for (const [name, prop] of Object.entries(props)) {
      if (!prop || typeof prop !== 'object') continue;
      if (!(prop.type === 'array' && prop.items && prop.items.$ref)) continue;
      const childType = prop.items.$ref.replace('#/$defs/', '');
      const { def: childDef, entity: childEntity } = this.typeInfo(childType);
      const fk = sanitizeIdent(`${entity.slice(0, -1)}_${pk}`);
      const arr = Array.isArray(full[name]) ? full[name] : [];
      const childProps = childDef.properties || {};
      // Delete existing
      this.db.prepare(`DELETE FROM ${childEntity} WHERE ${fk} = ?`).run(id);
      // Insert current
      if (arr.length) {
        const cCols = [];
        const valueExtractors = [];
        for (const [cname, cprop] of Object.entries(childProps)) {
          if (!cprop || typeof cprop !== 'object') continue;
          if (cprop.type && cprop.type !== 'array' && cprop.type !== 'object') {
            cCols.push(sanitizeIdent(cname));
            valueExtractors.push((item) => toDbValue(item[cname]));
          }
        }
        cCols.push(fk);
        valueExtractors.push(() => id);
        const q = `INSERT INTO ${childEntity} (${cCols.join(',')}) VALUES (${cCols.map(() => '?').join(',')})`;
        const stmt = this.db.prepare(q);
        for (const item of arr) {
          stmt.run(valueExtractors.map((fn) => fn(item)));
        }
      }
    }
  }
}

function castRow(row, props) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'rowid') continue;
    const prop = props && props[k];
    if (prop && prop.type === 'boolean') out[k] = !!v;
    else out[k] = v;
  }
  return out;
}

function fromDbValue(val, typ) {
  if (typ === 'boolean') return !!val;
  return val;
}

module.exports = { SqliteMappedStore };

