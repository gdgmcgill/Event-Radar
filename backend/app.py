from flask import Flask, jsonify, request
from similarity import CATEGORY_ORDER, cosine_score, cosine_scores, tags_to_vector


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health() -> tuple[dict, int]:
        return {"status": "ok"}, 200

    @app.post("/similarity/score")
    def similarity_score():
        data = request.get_json(force=True, silent=True) or {}
        user_vec = data.get("user_vector")
        event_vec = data.get("event_vector")
        event_vecs = data.get("event_vectors")

        if user_vec is None:
            return {"error": "user_vector is required"}, 400

        # Single comparison
        if event_vec is not None and event_vecs is None:
            try:
                score = cosine_score(user_vec, event_vec)
            except ValueError as exc:
                return {"error": str(exc)}, 400
            except Exception as exc:
                return {"error": "failed to compute similarity", "detail": str(exc)}, 500
            return {"score": score}, 200

        # Batch comparison
        if event_vecs is not None:
            try:
                scores = cosine_scores(user_vec, event_vecs)
            except ValueError as exc:
                return {"error": str(exc)}, 400
            except Exception as exc:
                return {"error": "failed to compute similarity", "detail": str(exc)}, 500
            return {"scores": scores}, 200

        return {"error": "provide event_vector or event_vectors"}, 400

    @app.post("/similarity/events-score")
    def similarity_events_score():
        data = request.get_json(force=True, silent=True) or {}
        user_tags = data.get("user_tags") or []
        events = data.get("events") or []

        if not isinstance(user_tags, list):
            return {"error": "user_tags must be a list"}, 400
        if not isinstance(events, list):
            return {"error": "events must be a list"}, 400

        user_vec = tags_to_vector([str(t) for t in user_tags])
        event_vectors = []
        event_ids = []

        for event in events:
            tags = event.get("tags") or []
            vec = tags_to_vector([str(t) for t in tags])
            event_vectors.append(vec)
            event_ids.append(event.get("id"))

        scores = cosine_scores(user_vec, event_vectors)

        return {
          "category_order": CATEGORY_ORDER,
          "user_vector": user_vec,
          "events": [
              {"id": event_ids[i], "vector": event_vectors[i], "score": scores[i]}
              for i in range(len(event_vectors))
          ],
        }, 200

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
