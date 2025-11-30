from flask import Flask, jsonify, request
from similarity import cosine_score, cosine_scores


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

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
