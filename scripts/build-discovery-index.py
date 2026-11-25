# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["numpy==2.2.6", "scikit-learn==1.7.2", "scipy==1.15.3"]
# ///
"""Rebuild with uv run scripts/build-discovery-index.py from the repository root.

LSA projects TF-IDF weighted synopsis words into one shared anime/manga vector
space. The Worker embeds queries with the same fitted projection. Training
libraries are offline build dependencies. A small set of distinctive terms and
explicit trope evidence supplement dense similarity for literal requests.
"""
import base64
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[1]
TERMS_PER_DOC = 6
DIM = 40


def pack(array, dtype):
    return base64.b64encode(np.asarray(array, dtype=dtype).tobytes()).decode("ascii")


def load_corpus():
    docs, groups, masks = [], {}, []
    source = hashlib.sha256()
    tropes = json.loads((ROOT / "src/assistant/discoveryTropes.json").read_text())
    source.update(json.dumps(tropes, sort_keys=True).encode())
    source.update(f"lsa4-v1:{DIM}:{TERMS_PER_DOC}".encode())
    for media in ("anime", "manga"):
        records = json.loads((ROOT / f"cleaned_{media}_data.json").read_text())
        ids = []
        for row in sorted(records, key=lambda item: item["mal_id"]):
            synopsis = re.split(r"\[written by mal rewrite\]|\(source:", row.get("synopsis") or "", flags=re.I)[0].strip()
            if not synopsis:
                continue
            tags = [*row.get("genres", {}), *row.get("themes", {}), *row.get("demographics", {})]
            document = synopsis + " " + " ".join(tags)
            ids.append(row["mal_id"])
            docs.append(document)
            source.update(f"{media}:{row['mal_id']}:{document}\n".encode())
            evidence_text = " ".join([document, row["title"], row.get("title_english") or ""])
            text = " " + re.sub(r"[^a-z0-9]+", " ", evidence_text.lower()) + " "
            mask = sum(1 << i for i, trope in enumerate(tropes)
                       if any(" " + phrase + " " in text for phrase in trope["evidence"]))
            if {"Fantasy","Comedy"}.issubset(tags):
                mask |= 1 << next(i for i,t in enumerate(tropes) if t["name"] == "Fantasy comedy")
            masks.append(mask)
        groups[media] = {"ids":pack(ids,"<u4"), "indexed":len(ids), "catalog":len(records)}

    return docs, groups, masks, source


def main():
    docs, groups, masks, source = load_corpus()
    vectorizer = TfidfVectorizer(max_features=6000, min_df=3, max_df=0.8,
                                 stop_words="english", token_pattern=r"(?u)\b[a-z0-9]{2,}\b",
                                 sublinear_tf=True, dtype=np.float32)
    words = vectorizer.fit_transform(docs)
    lsa = TruncatedSVD(DIM, n_iter=7, random_state=2026)
    vectors = normalize(lsa.fit_transform(words))
    # Fold IDF into the query projection. Normalizing a query before multiplying
    # has no effect on cosine ordering; both projected vectors are unit-scaled.
    projection = lsa.components_.T * vectorizer.idf_[:,None]
    if not np.isfinite(vectors).all() or not np.isfinite(projection).all():
        raise ValueError("Embedding training produced non-finite coordinates")
    scales = np.abs(projection).max(axis=0) / 127
    if np.any(scales <= 0):
        raise ValueError("Embedding training produced an empty component")
    keywords = np.zeros((len(docs), TERMS_PER_DOC), dtype="<u2")
    for i in range(len(docs)):
        row = words.getrow(i)
        order = np.argsort(-row.data, kind="stable")[:TERMS_PER_DOC]
        keywords[i,:len(order)] = row.indices[order] + 1
    # Cosine comparison is invariant to per-document scale. Store signed
    # 4-bit coordinates in pairs; expand to int8 once per Worker isolate.
    scale = np.abs(vectors).max(axis=1, keepdims=True)
    quantized = np.rint(vectors * 7 / np.maximum(scale, 1e-9)).astype(np.int8) + 7
    packed_vectors = (quantized[:, ::2] << 4) | quantized[:, 1::2]
    data = {"version":1, "source_sha256":source.hexdigest(), "dimensions":DIM,
            "groups":groups, "vocabulary":vectorizer.get_feature_names_out().tolist(),
            "projection":pack(np.rint(projection/scales),"i1"), "scales":scales.tolist(),
            "vectors":pack(packed_vectors,"u1"), "keywords":pack(keywords,"<u2"),
            "terms_per_doc":TERMS_PER_DOC,"tropes":pack(masks,"<u2")}
    target = ROOT / "src/assistant/discoveryIndex.json"
    target.write_text(json.dumps(data, separators=(",",":"))+"\n")
    print(f"{len(docs)} synopses, {DIM} dimensions, {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    with threadpool_limits(limits=2):
        main()
