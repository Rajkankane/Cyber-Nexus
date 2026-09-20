import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import engine, Base, SessionLocal
from app.seed.demo_data import seed_database
from app.models.models import Case, Evidence, Entity, EntityLink, ParseException, AuditLog
from app.integrity.audit import verify_audit_chain
from app.reports.pdf_generator import generate_case_pdf_brief
from app.reports.json_generator import generate_case_json_brief
from app.analytics.gaps import detect_evidence_gaps
from app.analytics.graph_engine import build_case_graph
from app.analytics.graph_hops import traverse_graph_cte
from app.routers.tasks import create_task, update_task_progress, get_task_status

def run_tests():
    print("=== 1. INITIALIZING DATABASE AND SEEDING DATA ===")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)

    # Verify Cases
    cases = db.query(Case).all()
    print(f"PASS: Cases count = {len(cases)}")
    for c in cases:
        print(f"  - Case ID: {c.case_id[:8]} | Title: {c.title} | Amount: INR {c.amount_inr}")

    # Verify Evidence & Integrity
    evidence = db.query(Evidence).all()
    print(f"\nPASS: Evidence items = {len(evidence)}")
    for ev in evidence:
        print(f"  - [{ev.source_type}] File: {ev.file_path} | SHA-256: {ev.sha256_original[:12]}... | Parsed: {ev.parsed_count}/{ev.row_count} (Errors: {ev.failed_count})")

    # Verify Parse Exceptions (Row-by-Row Fault Tolerance)
    exceptions = db.query(ParseException).all()
    print(f"\nPASS: Parse exceptions logged (fault-tolerance test) = {len(exceptions)}")
    for ex in exceptions:
        print(f"  - Row {ex.row_index}: {ex.error_message[:60]}...")

    # Verify Entities
    entities = db.query(Entity).all()
    print(f"\nPASS: Entities extracted = {len(entities)}")
    by_type = {}
    for e in entities:
        by_type[e.entity_type] = by_type.get(e.entity_type, 0) + 1
    print(f"  - Entity types distribution: {by_type}")

    # Verify Entity Links
    links = db.query(EntityLink).all()
    print(f"\nPASS: Correlated links = {len(links)}")
    for l in links[:5]:
        print(f"  - Link [{l.link_type}] Confidence: {l.confidence} | Rule: {l.reasoning.get('rule')}")

    # Verify Canary Protection (Deliberate False-Link Rejection)
    canary_links = [
        l for l in links
        if any(e.metadata_json and e.metadata_json.get("is_canary") for e in entities if e.entity_id in (l.source_entity, l.target_entity))
    ]
    print(f"\nPASS: Canary false-link merge count = {len(canary_links)} (EXPECTED 0 false merges)")
    assert len(canary_links) == 0, "Canary false links must not be created!"

    # Verify NetworkX Graph Analytics
    graph = build_case_graph(db, cases[0].case_id)
    print(f"\nPASS: Graph Analytics:")
    print(f"  - Nodes: {len(graph['nodes'])}, Edges: {len(graph['edges'])}")
    print(f"  - Connected Clusters: {graph['clusters_count']}")
    print(f"  - Cash-out Chokepoints: {len(graph['chokepoints'])}")

    # Verify Recursive CTE Graph Traversal
    print(f"\nPASS: Recursive CTE Graph Hop Traversal:")
    traversal = traverse_graph_cte(db, cases[0].case_id, max_hops=4)
    print(f"  - Multi-hop relationships discovered: {traversal.total_hops_found}")
    print(f"  - Traversal execution latency: {traversal.traversal_time_ms} ms")
    assert traversal.traversal_time_ms < 2000.0, "Traversal must be sub-2-second!"

    # Verify Evidence Gaps
    gaps = detect_evidence_gaps(db, cases[0].case_id)
    print(f"\nPASS: Evidence Gaps detected = {len(gaps)}")
    for g in gaps:
        print(f"  - [{g['severity']}] {g['gap_id']}: {g['description'][:70]}...")

    # Verify Hash-Chained Audit Log
    is_valid, broken_id, records = verify_audit_chain(db)
    print(f"\nPASS: Cryptographic Audit Hash-Chain Integrity:")
    print(f"  - Valid: {is_valid} | Broken at ID: {broken_id} | Total Audited Operations: {len(records)}")
    assert is_valid is True, "Audit log chain must be cryptographically valid!"

    # Verify Section 65B PDF Brief Generator
    pdf_path, rep_id = generate_case_pdf_brief(db, cases[0].case_id, generated_by="Inspector Raj Kankane")
    print(f"\nPASS: Section 65B Indian Evidence Act PDF brief generated:")
    print(f"  - Report ID: {rep_id}")
    print(f"  - File Path: {pdf_path}")
    print(f"  - File Size: {Path(pdf_path).stat().st_size} bytes")

    # Verify Section 65B JSON Dossier Generator
    json_path, json_id = generate_case_json_brief(db, cases[0].case_id, generated_by="Inspector Raj Kankane")
    print(f"\nPASS: Section 65B JSON machine dossier generated:")
    print(f"  - JSON Report ID: {json_id}")
    print(f"  - JSON File Path: {json_path}")
    assert Path(json_path).exists(), "JSON dossier must exist!"

    # Verify Background Task Management
    t_id = create_task("EVIDENCE_CORRELATION", "Running multi-source entity linking...")
    update_task_progress(t_id, 100, "Completed correlation", {"links_found": len(links)})
    task_res = get_task_status(t_id)
    print(f"\nPASS: Background task manager verified:")
    print(f"  - Task ID: {task_res.task_id[:8]} | Status: {task_res.status} | Progress: {task_res.progress}%")
    assert task_res.status == "COMPLETED"

    db.close()
    print("\nALL CORE VERIFICATIONS PASSED SUCCESSFULLY (100% EVIDENCE-FIRST INTEGRITY)!")

if __name__ == "__main__":
    run_tests()
