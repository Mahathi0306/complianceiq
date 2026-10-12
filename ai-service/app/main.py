import json
import logging
import os
from pathlib import Path

from fastapi import FastAPI

from . import fallbacks, prompts
from .llm import Llm, parse_json_object
from .retriever import Retriever
from .schemas import (
    AskRequest,
    AskResponse,
    ContextRequest,
    ExplainRiskRequest,
    ExplainRiskResponse,
    ExtractRequest,
    ExtractResponse,
    GeneratedResponse,
    ParseQueryRequest,
    ParseQueryResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

POLICY_DIR = os.getenv("POLICY_DIR", str(Path(__file__).resolve().parent.parent / "policies"))

app = FastAPI(title="ComplianceIQ AI Service", version="1.0.0")
llm = Llm()
retriever = Retriever(POLICY_DIR)

SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
RULE_TYPES = {"THRESHOLD", "STRUCTURING", "VELOCITY", "DORMANT", "CIRCULAR"}
STATUSES = {"OPEN", "IN_CASE", "DISMISSED"}


def generate(system: str, payload: dict, fallback_text: str) -> GeneratedResponse:
    if llm.enabled:
        try:
            text = llm.complete(system, json.dumps(payload, default=str))
            if text:
                return GeneratedResponse(text=text, model=llm.model)
        except Exception:
            logger.exception("model call failed, using template output")
    return GeneratedResponse(text=fallback_text, model="template")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": llm.model if llm.enabled else "template", "policies": len(retriever.chunks)}


@app.post("/summarize", response_model=GeneratedResponse)
def summarize(request: ContextRequest) -> GeneratedResponse:
    return generate(prompts.SUMMARY_SYSTEM, request.context, fallbacks.summarize(request.context))


@app.post("/str-draft", response_model=GeneratedResponse)
def str_draft(request: ContextRequest) -> GeneratedResponse:
    return generate(prompts.STR_SYSTEM, request.context, fallbacks.str_draft(request.context))


@app.post("/explain-risk", response_model=ExplainRiskResponse)
def explain_risk(request: ExplainRiskRequest) -> ExplainRiskResponse:
    fallback = fallbacks.explain_risk(request.score, request.level, request.breakdown)
    result = generate(prompts.RISK_SYSTEM, request.model_dump(), fallback)
    return ExplainRiskResponse(text=result.text)


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    sources = retriever.search(request.question, limit=3)
    cited = [{"title": s["title"], "snippet": s["snippet"][:400]} for s in sources]
    if not sources:
        return AskResponse(answer="The policy library has nothing relevant to that question.", sources=[])
    if llm.enabled:
        try:
            numbered = "\n\n".join(f"[{i + 1}] {s['title']}\n{s['snippet']}" for i, s in enumerate(sources))
            content = f"Question: {request.question}\n\nPolicy excerpts:\n{numbered}"
            if request.context:
                content += f"\n\nCase data:\n{json.dumps(request.context, default=str)}"
            answer = llm.complete(prompts.ASK_SYSTEM, content)
            if answer:
                return AskResponse(answer=answer, sources=cited)
        except Exception:
            logger.exception("model call failed, returning retrieved guidance")
    top = sources[0]
    return AskResponse(answer=f"Most relevant guidance ({top['title']}): {top['snippet']}", sources=cited)


@app.post("/extract", response_model=ExtractResponse)
def extract(request: ExtractRequest) -> ExtractResponse:
    if not llm.enabled:
        return ExtractResponse(fields={}, confidence=0.0)
    try:
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": request.mimeType, "data": request.imageBase64},
            },
            {"type": "text", "text": prompts.EXTRACT_PROMPT},
        ]
        parsed = parse_json_object(llm.complete("You read documents precisely.", content, max_tokens=400))
    except Exception:
        logger.exception("document extraction failed")
        return ExtractResponse(fields={}, confidence=0.0)
    if not parsed:
        return ExtractResponse(fields={}, confidence=0.0)
    confidence = parsed.pop("confidence", 0.0)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.0
    fields = {key: value for key, value in parsed.items() if value not in (None, "")}
    return ExtractResponse(fields=fields, confidence=confidence)


@app.post("/parse-query", response_model=ParseQueryResponse)
def parse_query(request: ParseQueryRequest) -> ParseQueryResponse:
    result = fallbacks.heuristic_query(request.query)
    if llm.enabled:
        try:
            parsed = parse_json_object(llm.complete(prompts.QUERY_SYSTEM, request.query, max_tokens=120)) or {}
            severity = str(parsed.get("severity") or "").upper()
            rule_type = str(parsed.get("ruleType") or "").upper()
            status = str(parsed.get("status") or "").upper()
            days = parsed.get("days")
            result = {
                "severity": severity if severity in SEVERITIES else result["severity"],
                "ruleType": rule_type if rule_type in RULE_TYPES else result["ruleType"],
                "status": status if status in STATUSES else result["status"],
                "days": days if isinstance(days, int) and 0 < days <= 365 else result["days"],
            }
        except Exception:
            logger.exception("query parsing failed, using keyword matching")
    return ParseQueryResponse(**result)
