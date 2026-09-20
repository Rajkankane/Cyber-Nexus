from typing import Dict, Any, List
import networkx as nx
from sqlalchemy.orm import Session
from app.models.models import Entity, EntityLink, RiskScore

def build_case_graph(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Constructs the NetworkX directed graph for a case,
    computes connected components, betweenness centrality, and prepares Cytoscape payload.
    """
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    links = db.query(EntityLink).all()

    # Filter links that belong to this case's entities
    entity_map = {e.entity_id: e for e in entities}
    case_links = [l for l in links if l.source_entity in entity_map and l.target_entity in entity_map]

    G = nx.DiGraph()

    # Add nodes
    for e in entities:
        G.add_node(
            e.entity_id,
            label=e.normalized_key,
            entity_type=e.entity_type,
            raw_value=e.raw_value
        )

    # Add edges
    for l in case_links:
        G.add_edge(
            l.source_entity,
            l.target_entity,
            link_id=l.link_id,
            link_type=l.link_type,
            confidence=float(l.confidence),
            reasoning=l.reasoning or {},
            evidence_ids=l.evidence_ids or []
        )

    # Undirected copy for connected components
    UG = G.to_undirected()
    components = list(nx.connected_components(UG))
    cluster_mapping = {}
    for cluster_idx, comp in enumerate(components):
        for node_id in comp:
            cluster_mapping[node_id] = f"Cluster-{cluster_idx + 1}"

    # Betweenness Centrality (identifies cash-out chokepoints)
    centrality = {}
    if len(G.nodes) > 1:
        try:
            centrality = nx.betweenness_centrality(G)
        except Exception:
            centrality = {n: 0.0 for n in G.nodes}
    else:
        centrality = {n: 0.0 for n in G.nodes}

    # Threshold for chokepoints
    sorted_centrality = sorted(centrality.items(), key=lambda x: x[1], reverse=True)
    chokepoints = []
    if sorted_centrality and sorted_centrality[0][1] > 0.15:
        chokepoints = [node_id for node_id, score in sorted_centrality if score >= 0.15]
    elif sorted_centrality and sorted_centrality[0][1] > 0:
        chokepoints = [sorted_centrality[0][0]]

    # Get latest risk scores for nodes
    risk_scores = db.query(RiskScore).all()
    score_map = {rs.entity_id: float(rs.score) for rs in risk_scores}
    band_map = {
        rs.entity_id: "High" if float(rs.score) >= 70 else ("Medium" if float(rs.score) >= 40 else "Low")
        for rs in risk_scores
    }

    # Build Cytoscape nodes
    cytoscape_nodes = []
    for e in entities:
        is_choke = e.entity_id in chokepoints
        node_score = score_map.get(e.entity_id, 25.0)
        conf_band = band_map.get(e.entity_id, "Low")

        # In-degree / Out-degree
        in_deg = G.in_degree(e.entity_id) if e.entity_id in G else 0
        out_deg = G.out_degree(e.entity_id) if e.entity_id in G else 0

        # Check if Canary entity
        is_canary = (e.metadata_json or {}).get("is_canary", False) or "CANARY" in str(e.raw_value)

        cytoscape_nodes.append({
            "id": e.entity_id,
            "label": e.normalized_key,
            "type": e.entity_type,
            "score": node_score,
            "confidence_band": conf_band,
            "is_chokepoint": is_choke,
            "is_canary": is_canary,
            "raw_value": e.raw_value,
            "cluster": cluster_mapping.get(e.entity_id, "Cluster-1"),
            "centrality": round(centrality.get(e.entity_id, 0.0), 3),
            "in_degree": in_deg,
            "out_degree": out_deg,
            "metadata": e.metadata_json or {}
        })

    # Build Cytoscape edges
    cytoscape_edges = []
    for l in case_links:
        conf_val = float(l.confidence)
        c_band = "High" if conf_val >= 0.7 else ("Medium" if conf_val >= 0.4 else "Low")
        cytoscape_edges.append({
            "id": l.link_id,
            "source": l.source_entity,
            "target": l.target_entity,
            "type": l.link_type,
            "confidence": conf_val,
            "confidence_band": c_band,
            "reasoning": l.reasoning or {},
            "evidence_ids": l.evidence_ids or []
        })

    return {
        "nodes": cytoscape_nodes,
        "edges": cytoscape_edges,
        "clusters_count": len(components),
        "chokepoints": chokepoints
    }
