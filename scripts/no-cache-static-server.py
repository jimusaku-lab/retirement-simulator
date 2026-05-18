#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    shared_plan_file: Path | None = None

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/plan":
            self.handle_plan_get()
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] == "/api/plan":
            self.handle_plan_write()
            return
        self.send_error(404)

    def do_PUT(self) -> None:
        if self.path.split("?", 1)[0] == "/api/plan":
            self.handle_plan_write()
            return
        self.send_error(404)

    def handle_plan_get(self) -> None:
        if self.shared_plan_file is None or not self.shared_plan_file.exists():
            self.send_json(404, {"error": "shared plan is empty"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(self.shared_plan_file.read_bytes())

    def handle_plan_write(self) -> None:
        if self.shared_plan_file is None:
            self.send_json(503, {"error": "shared plan file is not configured"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)
        try:
            parsed = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json(400, {"error": "invalid json"})
            return
        if parsed.get("version") != 1 or not isinstance(parsed.get("scenarios"), list) or not parsed["scenarios"]:
            self.send_json(400, {"error": "invalid retirement plan"})
            return

        self.shared_plan_file.parent.mkdir(parents=True, exist_ok=True)
        if self.shared_plan_file.exists():
            backup_dir = self.shared_plan_file.parent / "backups"
            backup_dir.mkdir(parents=True, exist_ok=True)
            backup_path = backup_dir / f"shared-plan-{self.date_time_string().replace(' ', '_').replace(':', '')}.json"
            backup_path.write_bytes(self.shared_plan_file.read_bytes())
        tmp_path = self.shared_plan_file.with_suffix(".tmp")
        tmp_path.write_bytes(json.dumps(parsed, ensure_ascii=False, indent=2).encode("utf-8"))
        os.replace(tmp_path, self.shared_plan_file)
        self.send_json(200, {"ok": True})

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve static files with no browser cache.")
    parser.add_argument("port", type=int)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--directory", required=True)
    parser.add_argument("--shared-plan-file")
    args = parser.parse_args()

    class ConfiguredHandler(NoCacheHandler):
        shared_plan_file = Path(args.shared_plan_file) if args.shared_plan_file else None

    handler = partial(ConfiguredHandler, directory=args.directory)
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
