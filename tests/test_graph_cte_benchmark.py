import sys
import time
import uuid
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import Base
from app.models.models import Case, Entity, EntityLink
from app.analytics.graph_hops import traverse_graph_cte

def test_10k_graph_cte_benchmark():
    print("=== STARTING 10,000-LINK RECURSIVE CTE BENCHMARK ===")
    test_db_url = "sqlite:///:memory:"
    engine = create_engine(test_db_url, echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    case_id = str(uuid.uuid4())
    case = Case(case_id=case_id, title="Synthetic Benchmark Case", amount_inr=1000000.0)
    db.add(case)
    db.commit()

    print("Generating 1,000 synthetic entities...")
    entities = []
    for i in range(1000):
        ent = Entity(
            entity_id=f"ent-{i:05d}",
            case_id=case_id,
            entity_type="ACCOUNT" if i % 2 == 0 else "UPI",
            normalized_key=f"SYNTHETIC_MULE_{i:05d}",
            raw_value=f"Synthetic Node {i}"
        )
        entities.append(ent)
    db.add_all(entities)
    db.commit()

    print("Generating 10,000 synthetic entity links...")
    links = []
    # Build a complex scale-free/layered graph with multiple hops and branching
    for i in range(10000):
        src_idx = i % 1000
        tgt_idx = (i * 7 + 13) % 1000
        if src_idx == tgt_idx:
            tgt_idx = (tgt_idx + 1) % 1000
        link = EntityLink(
            link_id=f"link-{i:06d}",
            source_entity=f"ent-{src_idx:05d}",
            target_entity=f"ent-{tgt_idx:05d}",
            link_type="FUND_TRANSFER",
            confidence=0.850 + (i % 15) * 0.01,
            evidence_ids=["bench-ev-001"]
        )
        links.append(link)
        if len(links) >= 1000:
            db.add_all(links)
            db.commit()
            links = []
    if links:
        db.add_all(links)
        db.commit()

    total_links = db.query(EntityLink).count()
    total_entities = db.query(Entity).count()
    print(f"Database successfully populated with {total_entities} entities and {total_links} links.")

    print("\nExecuting recursive CTE traversal query (max_hops=5 from seed entity)...")
    t0 = time.perf_counter()
    res = traverse_graph_cte(db, case_id=case_id, source_entity_id="ent-00000", max_hops=5, limit=500)
    t1 = time.perf_counter()
    duration = t1 - t0

    print(f"BENCHMARK RESULT:")
    print(f"  - Total Hops Found: {res.total_hops_found}")
    print(f"  - Traversal Latency: {duration:.4f} seconds ({res.traversal_time_ms} ms)")
    print(f"  - Target SLA: < 2.0000 seconds")

    assert duration < 2.0, f"Query took {duration:.4f}s which is >= 2.0s SLA!"
    print("\n[SUCCESS] Recursive CTE query passed benchmark: sub-2-second hop performance verified!")
    db.close()

if __name__ == "__main__":
    test_10k_graph_cte_benchmark()
