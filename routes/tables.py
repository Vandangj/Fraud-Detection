from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import inspect, Table, MetaData, select, func, or_, and_, desc, asc, cast, String

from database import engine, get_db

router = APIRouter(
    prefix="/tables",
    tags=["Database Tables Explorer"]
)

# Cache reflected metadata
metadata = MetaData()
metadata.reflect(bind=engine)


def get_inspector():
    return inspect(engine)


def get_allowed_tables() -> List[str]:
    insp = get_inspector()
    return insp.get_table_names()


# Cache for row counts to prevent slow count(*) on 8M row tables on every request
_table_counts_cache = {}
_cache_time = 0

def get_table_row_counts(conn) -> Dict[str, int]:
    import time
    global _table_counts_cache, _cache_time
    now = time.time()
    if _table_counts_cache and (now - _cache_time < 300): # 5 min cache
        return _table_counts_cache

    counts = {}
    try:
        # Fast query via information_schema for MySQL
        result = conn.execute(
            select(
                Table('tables', MetaData(), schema='information_schema', autoload_with=engine).c.table_name,
                Table('tables', MetaData(), schema='information_schema', autoload_with=engine).c.table_rows
            ).where(
                Table('tables', MetaData(), schema='information_schema', autoload_with=engine).c.table_schema == 'fraud_detection'
            )
        ).fetchall()
        for r in result:
            counts[r[0]] = int(r[1] or 0)
    except Exception:
        pass

    # Exact counts for smaller tables
    for small_t in ["models", "drift_reports", "frauds"]:
        try:
            t_obj = metadata.tables.get(small_t)
            if t_obj is not None:
                counts[small_t] = conn.execute(select(func.count()).select_from(t_obj)).scalar() or 0
        except Exception:
            pass

    _table_counts_cache = counts
    _cache_time = now
    return counts


@router.get("/")
def list_database_tables():
    """
    Returns list of all tables in the database with column schemas,
    primary keys, and row counts.
    """
    insp = get_inspector()
    table_names = insp.get_table_names()
    tables_summary = []

    with engine.connect() as conn:
        counts_map = get_table_row_counts(conn)
        for t_name in table_names:
            cols = []
            try:
                for col in insp.get_columns(t_name):
                    col_info = {
                        "name": col["name"],
                        "type": str(col["type"]),
                        "nullable": col.get("nullable", True),
                        "default": str(col.get("default", "")) if col.get("default") is not None else None,
                        "primary_key": False
                    }
                    cols.append(col_info)

                pk_constraint = insp.get_pk_constraint(t_name)
                pk_cols = pk_constraint.get("constrained_columns", [])
                for col_info in cols:
                    if col_info["name"] in pk_cols:
                        col_info["primary_key"] = True

                total_rows = counts_map.get(t_name, 0)
                if total_rows == 0:
                    t_obj = metadata.tables.get(t_name)
                    if t_obj is not None and t_name not in ["users", "transactions"]:
                        total_rows = conn.execute(select(func.count()).select_from(t_obj)).scalar() or 0

                tables_summary.append({
                    "table_name": t_name,
                    "columns": cols,
                    "primary_key": pk_cols,
                    "total_rows": total_rows
                })
            except Exception as e:
                print(f"[Table Inspect Warning] Error inspecting table {t_name}: {e}")
                tables_summary.append({
                    "table_name": t_name,
                    "columns": [],
                    "primary_key": [],
                    "total_rows": 0,
                    "error": str(e)
                })

    return tables_summary



@router.get("/{table_name}")
def get_table_data(
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=500),
    sort_by: Optional[str] = None,
    order: Optional[str] = Query("desc", regex="^(asc|desc)$"),
    search: Optional[str] = None,
    filter_column: Optional[str] = None,
    filter_operator: Optional[str] = Query(None, regex="^(eq|neq|gt|gte|lt|lte|contains|startswith|is_null|not_null|is_true|is_false)$"),
    filter_value: Optional[str] = None
):
    """
    Paginated, searchable, and filterable data reader for any valid database table.
    """
    allowed_tables = get_allowed_tables()
    if table_name not in allowed_tables:
        raise HTTPException(
            status_code=404,
            detail=f"Table '{table_name}' does not exist in database. Available tables: {allowed_tables}"
        )

    t_obj = metadata.tables.get(table_name)
    if t_obj is None:
        metadata.reflect(bind=engine)
        t_obj = metadata.tables.get(table_name)
        if t_obj is None:
            raise HTTPException(status_code=500, detail=f"Failed to reflect schema for table '{table_name}'")

    columns = [{"name": c.name, "type": str(c.type), "primary_key": c.primary_key} for c in t_obj.columns]
    column_names = [c.name for c in t_obj.columns]

    conditions = []

    # 1. Global search across text / string-cast columns
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        search_conds = []
        for col in t_obj.columns:
            # Search strings and varchar or cast numbers
            search_conds.append(cast(col, String).ilike(search_term))
        if search_conds:
            conditions.append(or_(*search_conds))

    # 2. Specific column filter
    if filter_column and filter_column in column_names and filter_operator:
        col = t_obj.c[filter_column]
        if filter_operator == "eq":
            conditions.append(col == filter_value)
        elif filter_operator == "neq":
            conditions.append(col != filter_value)
        elif filter_operator == "gt":
            conditions.append(col > filter_value)
        elif filter_operator == "gte":
            conditions.append(col >= filter_value)
        elif filter_operator == "lt":
            conditions.append(col < filter_value)
        elif filter_operator == "lte":
            conditions.append(col <= filter_value)
        elif filter_operator == "contains":
            conditions.append(cast(col, String).ilike(f"%{filter_value}%"))
        elif filter_operator == "startswith":
            conditions.append(cast(col, String).ilike(f"{filter_value}%"))
        elif filter_operator == "is_null":
            conditions.append(col.is_(None))
        elif filter_operator == "not_null":
            conditions.append(col.isnot(None))
        elif filter_operator == "is_true":
            conditions.append(col == True)
        elif filter_operator == "is_false":
            conditions.append(col == False)

    with engine.connect() as conn:
        # Get total unfiltered count
        total_rows = conn.execute(select(func.count()).select_from(t_obj)).scalar() or 0

        # Query with conditions
        base_query = select(t_obj)
        count_query = select(func.count()).select_from(t_obj)

        if conditions:
            base_query = base_query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
            filtered_rows = conn.execute(count_query).scalar() or 0
        else:
            filtered_rows = total_rows

        # Sorting
        if sort_by and sort_by in column_names:
            sort_col = t_obj.c[sort_by]
            base_query = base_query.order_by(asc(sort_col) if order == "asc" else desc(sort_col))
        else:
            # Default sort by primary key descending if available
            pks = [c for c in t_obj.columns if c.primary_key]
            if pks:
                base_query = base_query.order_by(desc(pks[0]))

        # Pagination
        offset = (page - 1) * page_size
        base_query = base_query.offset(offset).limit(page_size)

        result_rows = conn.execute(base_query).fetchall()

        # Format rows into JSON serializable dicts
        rows = []
        for r in result_rows:
            row_dict = {}
            for col_idx, col in enumerate(t_obj.columns):
                val = r[col_idx]
                if hasattr(val, "isoformat"):
                    row_dict[col.name] = val.isoformat()
                elif hasattr(val, "to_eng_string"):
                    row_dict[col.name] = float(val)
                elif isinstance(val, bytes):
                    row_dict[col.name] = "<binary>"
                elif val is not None and type(val).__name__ == "Decimal":
                    row_dict[col.name] = float(val)
                else:
                    row_dict[col.name] = val
            rows.append(row_dict)

        total_pages = max(1, (filtered_rows + page_size - 1) // page_size)

    return {
        "table_name": table_name,
        "columns": columns,
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "filtered_rows": filtered_rows,
        "total_pages": total_pages,
        "rows": rows
    }
