"""Convert CI security scanner JSON reports into simple HTML evidence.

The converter intentionally uses only the Python standard library so it can run
inside minimal CI images after Python is available.
"""

from __future__ import annotations

import argparse
import html
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MAX_ROWS = 200
MAX_CELL_CHARS = 360


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        rendered = json.dumps(value, ensure_ascii=False, sort_keys=True)
    else:
        rendered = str(value)
    if len(rendered) > MAX_CELL_CHARS:
        return rendered[: MAX_CELL_CHARS - 3] + "..."
    return rendered


def _severity_summary(rows: list[dict[str, Any]], key: str) -> list[tuple[str, Any]]:
    counts = Counter(str(row.get(key) or "unknown").lower() for row in rows)
    return [(f"{severity.title()} findings", count) for severity, count in sorted(counts.items())]


def _pip_audit(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    dependencies = data.get("dependencies", []) if isinstance(data, dict) else data if isinstance(data, list) else []
    rows = []
    vulnerability_count = 0
    for dependency in dependencies:
        vulns = dependency.get("vulns") or dependency.get("vulnerabilities") or []
        vulnerability_count += len(vulns)
        for vuln in vulns:
            rows.append(
                [
                    dependency.get("name"),
                    dependency.get("version"),
                    vuln.get("id") or vuln.get("vulnerability_id"),
                    vuln.get("fix_versions") or vuln.get("fixed_versions"),
                    vuln.get("description") or vuln.get("summary"),
                ]
            )
    summary = [
        ("Dependencies scanned", len(dependencies)),
        ("Vulnerable packages", sum(1 for dependency in dependencies if dependency.get("vulns") or dependency.get("vulnerabilities"))),
        ("Vulnerabilities", vulnerability_count),
    ]
    return summary, ["Package", "Installed", "Vulnerability", "Fix versions", "Description"], rows


def _npm_audit(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    vulnerabilities = data.get("vulnerabilities", {}) if isinstance(data, dict) else {}
    metadata = data.get("metadata", {}) if isinstance(data, dict) else {}
    rows = [
        [
            name,
            item.get("severity"),
            item.get("range"),
            item.get("fixAvailable"),
            item.get("via"),
        ]
        for name, item in vulnerabilities.items()
    ]
    vuln_meta = metadata.get("vulnerabilities", {}) if isinstance(metadata, dict) else {}
    summary = [("Vulnerability entries", len(rows))]
    summary.extend((f"{key.title()} vulnerabilities", value) for key, value in vuln_meta.items())
    return summary, ["Package", "Severity", "Range", "Fix available", "Via"], rows


def _bandit(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    results = data.get("results", []) if isinstance(data, dict) else []
    rows = [
        [
            item.get("issue_severity"),
            item.get("issue_confidence"),
            item.get("test_id"),
            item.get("filename"),
            item.get("line_number"),
            item.get("issue_text"),
        ]
        for item in results
    ]
    summary = [("Findings", len(rows))]
    summary.extend(_severity_summary(results, "issue_severity"))
    return summary, ["Severity", "Confidence", "Test", "File", "Line", "Issue"], rows


def _semgrep(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    results = data.get("results", []) if isinstance(data, dict) else []
    rows = []
    severity_rows = []
    for item in results:
        extra = item.get("extra", {}) or {}
        start = item.get("start", {}) or {}
        severity_rows.append({"severity": extra.get("severity")})
        rows.append(
            [
                extra.get("severity"),
                item.get("check_id"),
                item.get("path"),
                start.get("line"),
                extra.get("message"),
            ]
        )
    summary = [("Findings", len(rows))]
    summary.extend(_severity_summary(severity_rows, "severity"))
    return summary, ["Severity", "Rule", "Path", "Line", "Message"], rows


def _gitleaks(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    findings = data if isinstance(data, list) else data.get("findings", []) if isinstance(data, dict) else []
    rows = [
        [
            item.get("RuleID"),
            item.get("Description"),
            item.get("File"),
            item.get("StartLine"),
            item.get("Commit"),
            item.get("Author"),
        ]
        for item in findings
    ]
    return [("Findings", len(rows))], ["Rule", "Description", "File", "Line", "Commit", "Author"], rows


def _checkov(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    results = data.get("results", {}) if isinstance(data, dict) else {}
    failed = results.get("failed_checks", []) if isinstance(results, dict) else []
    passed = results.get("passed_checks", []) if isinstance(results, dict) else []
    skipped = results.get("skipped_checks", []) if isinstance(results, dict) else []
    summary_data = data.get("summary", {}) if isinstance(data, dict) else {}
    rows = [
        [
            item.get("check_id"),
            item.get("check_name"),
            item.get("file_path"),
            item.get("file_line_range"),
            item.get("resource"),
            item.get("guideline"),
        ]
        for item in failed
    ]
    summary = [
        ("Failed checks", len(failed)),
        ("Passed checks", len(passed)),
        ("Skipped checks", len(skipped)),
    ]
    if isinstance(summary_data, dict):
        summary.extend((key.replace("_", " ").title(), value) for key, value in summary_data.items() if isinstance(value, (int, str)))
    return summary, ["Check", "Name", "File", "Lines", "Resource", "Guideline"], rows


def _trivy(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    results = data.get("Results", []) if isinstance(data, dict) else []
    rows = []
    severity_items = []
    for result in results:
        target = result.get("Target")
        for vuln in result.get("Vulnerabilities") or []:
            severity_items.append({"Severity": vuln.get("Severity")})
            rows.append(
                [
                    vuln.get("Severity"),
                    target,
                    vuln.get("PkgName"),
                    vuln.get("InstalledVersion"),
                    vuln.get("FixedVersion"),
                    vuln.get("VulnerabilityID"),
                    vuln.get("Title"),
                ]
            )
    summary = [("Targets scanned", len(results)), ("Vulnerabilities", len(rows))]
    summary.extend(_severity_summary(severity_items, "Severity"))
    return summary, ["Severity", "Target", "Package", "Installed", "Fixed", "Vulnerability", "Title"], rows


def _generic(data: Any) -> tuple[list[tuple[str, Any]], list[str], list[list[Any]]]:
    if isinstance(data, list):
        return [("Top-level entries", len(data))], ["Entry"], [[item] for item in data[:MAX_ROWS]]
    if isinstance(data, dict):
        return [("Top-level keys", len(data))], ["Key", "Value"], [[key, value] for key, value in data.items()]
    return [("JSON value", type(data).__name__)], ["Value"], [[data]]


HANDLERS = {
    "pip-audit": _pip_audit,
    "npm-audit": _npm_audit,
    "bandit": _bandit,
    "semgrep": _semgrep,
    "gitleaks": _gitleaks,
    "checkov": _checkov,
    "trivy": _trivy,
}


def _render_summary(summary: list[tuple[str, Any]]) -> str:
    cards = []
    for label, value in summary:
        cards.append(
            "<div class=\"card\">"
            f"<div class=\"label\">{html.escape(str(label))}</div>"
            f"<div class=\"value\">{html.escape(_text(value))}</div>"
            "</div>"
        )
    return "\n".join(cards)


def _render_table(columns: list[str], rows: list[list[Any]]) -> str:
    if not rows:
        return "<p class=\"empty\">No findings were present in the parsed report section.</p>"
    header = "".join(f"<th>{html.escape(column)}</th>" for column in columns)
    body_rows = []
    for row in rows[:MAX_ROWS]:
        cells = "".join(f"<td>{html.escape(_text(value))}</td>" for value in row)
        body_rows.append(f"<tr>{cells}</tr>")
    note = ""
    if len(rows) > MAX_ROWS:
        note = f"<p class=\"note\">Showing first {MAX_ROWS} of {len(rows)} parsed findings. Full JSON artifact is retained separately.</p>"
    return f"{note}<table><thead><tr>{header}</tr></thead><tbody>{''.join(body_rows)}</tbody></table>"


def _style() -> str:
    return """
body { font-family: Arial, sans-serif; margin: 32px; color: #1f2933; background: #f7f9fb; }
main { max-width: 1180px; margin: 0 auto; }
h1 { margin-bottom: 4px; font-size: 28px; }
.meta { color: #52606d; margin: 4px 0; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 24px 0; }
.card { background: #fff; border: 1px solid #d9e2ec; border-radius: 6px; padding: 12px; }
.label { color: #52606d; font-size: 12px; text-transform: uppercase; }
.value { font-size: 22px; font-weight: 700; margin-top: 6px; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e2ec; }
th, td { padding: 9px 10px; border-bottom: 1px solid #edf2f7; text-align: left; vertical-align: top; font-size: 13px; }
th { background: #e8f0f7; color: #243b53; }
td { overflow-wrap: anywhere; }
.empty, .note, .error { background: #fff; border: 1px solid #d9e2ec; border-radius: 6px; padding: 12px; }
.error { border-color: #d64545; color: #8a1f1f; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #111827; color: #e5e7eb; padding: 16px; border-radius: 6px; }
"""


def render_html(title: str, tool: str, source: Path, data: Any | None, error: str | None, raw_text: str | None = None) -> str:
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    safe_title = html.escape(title)
    metadata = (
        f"<p class=\"meta\">Tool: {html.escape(tool)}</p>"
        f"<p class=\"meta\">Generated: {html.escape(generated)}</p>"
        f"<p class=\"meta\">Source JSON: {html.escape(source.name)}</p>"
    )
    if error:
        raw = f"<h2>Raw source preview</h2><pre>{html.escape((raw_text or '')[:4000])}</pre>" if raw_text else ""
        content = f"<div class=\"error\">{html.escape(error)}</div>{raw}"
    else:
        handler = HANDLERS.get(tool, _generic)
        try:
            summary, columns, rows = handler(data)
        except Exception as exc:  # pragma: no cover - defensive CI artifact handling
            handler = _generic
            summary, columns, rows = _generic(data)
            summary.append(("Parser fallback", f"{type(exc).__name__}: {exc}"))
        content = (
            f"<section class=\"summary\">{_render_summary(summary)}</section>"
            "<h2>Parsed Findings</h2>"
            f"{_render_table(columns, rows)}"
        )
        if handler is _generic:
            content += f"<h2>Pretty JSON</h2><pre>{html.escape(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True))}</pre>"
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<title>{safe_title}</title><style>{_style()}</style></head>"
        f"<body><main><h1>{safe_title}</h1>{metadata}{content}</main></body></html>"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert security scanner JSON into a readable HTML report.")
    parser.add_argument("--input", required=True, help="Input JSON report path")
    parser.add_argument("--output", required=True, help="Output HTML report path")
    parser.add_argument("--title", required=True, help="HTML report title")
    parser.add_argument("--tool", required=True, choices=sorted(HANDLERS.keys()) + ["generic"], help="Scanner schema to parse")
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.output)
    data = None
    error = None
    raw_text = None

    try:
        raw_text = source.read_text(encoding="utf-8")
        data = json.loads(raw_text)
    except FileNotFoundError:
        error = f"Input JSON report was not found: {source}"
    except json.JSONDecodeError as exc:
        error = f"Input JSON report is malformed: {exc}"
    except OSError as exc:
        error = f"Could not read input JSON report: {exc}"

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_html(args.title, args.tool, source, data, error, raw_text), encoding="utf-8")
    print(f"Wrote HTML security report: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
