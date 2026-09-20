import time
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.models import Entity, EntityLink
from app.schemas.schemas import GraphHopEdge, GraphTraversalResponse

def traverse_graph_cte(
    db: Session,
    case_id: str,
    source_entity_id: Optional[str] = None,
    max_hops: int = 4,
    limit: int = 500
) -> GraphTraversalResponse:
    """
    Executes a high-performance Recursive Common Table Expression (CTE) query
    to traverse deep mule hops and entity chains up to max_hops.
    Includes cycle prevention and sub-2-second hop performance over large datasets.
    """
    t0 = time.perf_counter()

    # Pre-fetch case entity labels for fast lookup
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    label_map = {e.entity_id: f"{e.entity_type} {e.normalized_key}" for e in entities}
    valid_ids = set(label_map.keys())

    # Build SQL with CTE
    if source_entity_id:
        sql = text("""
            WITH RECURSIVE entity_hops(link_id, source_entity, target_entity, link_type, confidence, hop_level, path) AS (
                SELECT
                    link_id,
                    source_entity,
                    target_entity,
                    link_type,
                    confidence,
                    1 AS hop_level,
                    source_entity || '->' || target_entity AS path
                FROM entity_links
                WHERE source_entity = :source_id

                UNION ALL

                SELECT
                    l.link_id,
                    l.source_entity,
                    l.target_entity,
                    l.link_type,
                    l.confidence,
                    h.hop_level + 1 AS hop_level,
                    h.path || '->' || l.target_entity AS path
                FROM entity_links l
                JOIN entity_hops h ON l.source_entity = h.target_entity
                WHERE h.hop_level < :max_hops
                  AND instr(h.path, l.target_entity) = 0
            )
            SELECT link_id, source_entity, target_entity, link_type, confidence, hop_level
            FROM entity_hops
            LIMIT :limit;
        """)
        params = {
            "source_id": source_entity_id,
            "max_hops": max_hops,
            "limit": limit
        }
    else:
        # Traverse all links within the case
        sql = text("""
            WITH RECURSIVE entity_hops(link_id, source_entity, target_entity, link_type, confidence, hop_level, path) AS (
                SELECT
                    link_id,
                    source_entity,
                    target_entity,
                    link_type,
                    confidence,
                    1 AS hop_level,
                    source_entity || '->' || target_entity AS path
                FROM entity_links
                WHERE source_entity IN (SELECT entity_id FROM entities WHERE case_id = :case_id)

                UNION ALL

                SELECT
                    l.link_id,
                    l.source_entity,
                    l.target_entity,
                    l.link_type,
                    l.confidence,
                    h.hop_level + 1 AS hop_level,
                    h.path || '->' || l.target_entity AS path
                FROM entity_links l
                JOIN entity_hops h ON l.source_entity = h.target_entity
                WHERE h.hop_level < :max_hops
                  AND instr(h.path, l.target_entity) = 0
            )
            SELECT DISTINCT link_id, source_entity, target_entity, link_type, confidence, hop_level
            FROM entity_hops
            LIMIT :limit;
        """)
        params = {
            "case_id": case_id,
            "max_hops": max_hops,
            "limit": limit
        }

    rows = db.execute(sql, params).fetchall()
    t1 = time.perf_counter()
    latency_ms = round((t1 - t0) * 1000, 2)

    hops: List[GraphHopEdge] = []
    seen = set()
    for row in rows:
        link_id, src_id, tgt_id, l_type, conf, hop_lvl = row
        edge_key = (src_id, tgt_id, hop_lvl)
        if edge_key in seen:
            continue
        seen.add(edge_key)

        hops.append(GraphHopEdge(
            hop_level=int(hop_lvl),
            source_id=str(src_id),
            source_label=label_map.get(str(src_id), str(src_id)[:12]),
            target_id=str(tgt_id),
            target_label=label_map.get(str(tgt_id), str(tgt_id)[:12]),
            link_type=str(l_type),
            confidence=float(conf),
            direction="OUTBOUND"
        ))

    return GraphTraversalResponse(
        case_id=case_id,
        source_entity_id=source_entity_id,
        max_hops=max_hops,
        total_hops_found=len(hops),
        traversal_time_ms=latency_ms,
        hops=hops
    )
