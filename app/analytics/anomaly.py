from typing import Dict, Any
from app.models.models import Entity

_clf = None

def get_isolation_forest():
    global _clf
    if _clf is None:
        try:
            import numpy as np
            from sklearn.ensemble import IsolationForest
            baseline_data = np.array([
                [20.0, 0, 10, 1],
                [25.0, 1, 10, 1],
                [30.0, 1, 12, 2],
                [22.0, 0, 15, 3],
                [28.0, 1, 11, 1],
                [85.0, 3, 10, 1],
                [90.0, 4, 15, 3],
                [15.0, 0, 14, 4],
                [24.0, 1, 10, 1],
                [75.0, 2, 12, 2],
            ])
            _clf = IsolationForest(contamination=0.2, random_state=42)
            _clf.fit(baseline_data)
        except Exception as e:
            print(f"Warning initializing IsolationForest: {e}")
            _clf = False
    return _clf

TYPE_CODES = {
    "PHONE": 1,
    "ACCOUNT": 2,
    "DEVICE": 3,
    "UPI": 4,
    "APK": 5,
    "EMAIL": 6,
    "IP": 7
}

def evaluate_anomaly_flag(entity: Entity, score: float, factors: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes a non-authoritative anomaly flag using scikit-learn IsolationForest.
    Never blends into or overrides the primary rule-based score.
    """
    clf = get_isolation_forest()
    if not clf:
        # Fallback heuristic if sklearn unavailable or failed
        is_anomalous = score >= 75.0 or len(factors) >= 2
        return {
            "is_anomalous": is_anomalous,
            "badge_text": "Statistically unusual — review recommended" if is_anomalous else "Within statistical norms",
            "anomaly_score": round(score / 100.0, 3),
            "model": "Rule-Aligned Anomaly Heuristic",
            "disclaimer": "Secondary non-authoritative hint. Primary rule-based score remains authoritative."
        }

    try:
        import numpy as np
        type_code = TYPE_CODES.get(entity.entity_type, 0)
        val_len = len(entity.normalized_key or "")
        factor_count = len(factors)

        vector = np.array([[score, factor_count, val_len, type_code]])
        prediction = clf.predict(vector)[0]  # -1 = anomaly, 1 = normal
        anomaly_score = float(clf.decision_function(vector)[0])

        is_anomalous = bool(prediction == -1)

        return {
            "is_anomalous": is_anomalous,
            "badge_text": "Statistically unusual — review recommended" if is_anomalous else "Within statistical norms",
            "anomaly_score": round(anomaly_score, 4),
            "model": "scikit-learn IsolationForest (Offline Unsupervised)",
            "disclaimer": "Secondary non-authoritative hint. Primary rule-based score remains authoritative."
        }
    except Exception as e:
        return {
            "is_anomalous": False,
            "badge_text": "Within statistical norms",
            "anomaly_score": 0.0,
            "error": str(e)
        }
