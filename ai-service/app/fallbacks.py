import re
from collections import Counter
from typing import Any, Optional

SEVERITIES = ["critical", "high", "medium", "low"]
RULE_WORDS = {
    "structuring": "STRUCTURING",
    "smurfing": "STRUCTURING",
    "velocity": "VELOCITY",
    "burst": "VELOCITY",
    "dormant": "DORMANT",
    "circular": "CIRCULAR",
    "layering": "CIRCULAR",
    "threshold": "THRESHOLD",
    "large": "THRESHOLD",
}


def money(value: Any) -> str:
    try:
        return f"INR {float(value):,.0f}"
    except (TypeError, ValueError):
        return "an unknown amount"


def sentence(text: str) -> str:
    return text[:1].upper() + text[1:]


def describe_alert(alert: dict[str, Any]) -> str:
    details = alert.get("details") or {}
    kind = alert.get("ruleType")
    if kind == "THRESHOLD":
        return f"a single transaction of {money(details.get('amount'))} crossed the {money(details.get('limit'))} limit"
    if kind == "STRUCTURING":
        return (
            f"{details.get('count')} deposits fell just under the reporting limit within "
            f"{details.get('windowHours')} hours"
        )
    if kind == "VELOCITY":
        return (
            f"{details.get('count')} transactions were made within {details.get('windowSeconds')} seconds, "
            f"above the allowed {details.get('maxCount')}"
        )
    if kind == "DORMANT":
        return f"an account inactive for {details.get('inactiveDays')} days moved {money(details.get('amount'))}"
    if kind == "CIRCULAR":
        path = " to ".join(details.get("path") or [])
        return f"funds moved in a loop across {details.get('hops')} hops ({path})"
    return f"rule {alert.get('rule')} was triggered"


def summarize(context: dict[str, Any]) -> str:
    customer = context.get("customer", {})
    alerts = context.get("alerts", [])
    totals = context.get("totals", {})
    opening = (
        f"Case {context.get('caseRef', '')} concerns {customer.get('alias', 'the customer')}, "
        f"rated {customer.get('riskLevel') or 'unrated'} risk"
    )
    if customer.get("riskScore") is not None:
        opening += f" with a score of {customer['riskScore']}"
    opening += f". The case holds {len(alerts)} alert(s)."
    findings = " ".join(f"{index + 1}. {sentence(describe_alert(a))}." for index, a in enumerate(alerts))
    activity = (
        f"Over the review period the account recorded {totals.get('count', 0)} transactions, "
        f"with {money(totals.get('inflow', 0))} received and {money(totals.get('outflow', 0))} sent."
    )
    steps = (
        "Next steps: confirm the source of funds with the customer, compare the activity with the declared "
        "income and expected volumes, and review any counterparties that appear more than once."
    )
    return "\n\n".join([opening, findings, activity, steps])


def str_draft(context: dict[str, Any]) -> str:
    customer = context.get("customer", {})
    alerts = context.get("alerts", [])
    totals = context.get("totals", {})
    grounds = "\n".join(f"- {sentence(describe_alert(a))} (severity {a.get('severity')})." for a in alerts)
    return (
        "Subject\n"
        f"{customer.get('alias', 'Customer')} ({customer.get('occupation', 'occupation not recorded')}, "
        f"{customer.get('country', 'country not recorded')}), risk rating {customer.get('riskLevel') or 'unrated'}.\n\n"
        "Grounds for suspicion\n"
        f"{grounds or '- No alerts recorded.'}\n\n"
        "Transaction overview\n"
        f"{totals.get('count', 0)} transactions reviewed, {money(totals.get('inflow', 0))} received and "
        f"{money(totals.get('outflow', 0))} sent.\n\n"
        "Alerts raised\n"
        f"{len(alerts)} alert(s) from the monitoring rules, listed above.\n\n"
        "Recommendation\n"
        "Escalate for officer review. Source of funds and the purpose of the activity are not yet established."
    )


def explain_risk(score: int, level: str, breakdown: list[dict[str, Any]]) -> str:
    if not breakdown:
        return f"The customer scored {score} ({level}) because no risk factors were triggered."
    ordered = sorted(breakdown, key=lambda item: item.get("points", 0), reverse=True)
    parts = "; ".join(f"{item.get('detail')} (+{item.get('points')})" for item in ordered[:3])
    return f"The customer scored {score}, which is {level} risk. Main factors: {parts}."


def heuristic_query(query: str) -> dict[str, Optional[Any]]:
    lower = query.lower()
    severity = next((s.upper() for s in SEVERITIES if re.search(rf"\b{s}\b", lower)), None)
    rule_type = next((value for word, value in RULE_WORDS.items() if word in lower), None)
    status = None
    if re.search(r"\bopen\b|\bpending\b", lower):
        status = "OPEN"
    elif "dismissed" in lower or "false positive" in lower:
        status = "DISMISSED"
    elif "in case" in lower or "escalated" in lower:
        status = "IN_CASE"
    days = None
    explicit = re.search(r"(\d+)\s*days?", lower)
    if explicit:
        days = min(365, int(explicit.group(1)))
    elif "today" in lower or "last 24" in lower:
        days = 1
    elif "week" in lower:
        days = 7
    elif "month" in lower:
        days = 30
    return {"severity": severity, "ruleType": rule_type, "status": status, "days": days}
