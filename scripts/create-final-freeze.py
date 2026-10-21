#!/usr/bin/env python3
"""Create and finalize a deterministic, no-sidecar source/evidence freeze."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import stat
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path

SIDECARS = {".DS_Store"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_sidecar(path: str) -> bool:
    return any(part.startswith("._") or part in SIDECARS for part in Path(path).parts)


def source_paths(repo: Path) -> list[str]:
    output = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=repo,
    )
    paths = sorted(filter(None, output.decode().split("\0")), key=lambda value: value.encode())
    selected = [value for value in paths if (repo / value).exists() or (repo / value).is_symlink()]
    sidecars = [value for value in selected if is_sidecar(value)]
    if sidecars:
        raise RuntimeError(f"Source contains forbidden metadata sidecars: {sidecars}")
    return selected


def checksum_lines(root: Path, paths: list[str]) -> str:
    lines = []
    for relative in paths:
        target = root / relative
        if target.is_symlink():
            digest = hashlib.sha256(os.readlink(target).encode()).hexdigest()
        else:
            digest = sha256_file(target)
        lines.append(f"{digest}  {relative}\n")
    return "".join(lines)


def write_canonical_tar_gz(output: Path, root: Path, paths: list[str], prefix: str = "") -> None:
    with output.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                for relative in sorted(paths, key=lambda value: value.encode()):
                    if is_sidecar(relative):
                        raise RuntimeError(f"Forbidden archive member: {relative}")
                    source = root / relative
                    archive_name = f"{prefix}{relative}"
                    info = tarfile.TarInfo(archive_name)
                    info.uid = 0
                    info.gid = 0
                    info.uname = "root"
                    info.gname = "root"
                    info.mtime = 0
                    if source.is_symlink():
                        info.type = tarfile.SYMTYPE
                        info.linkname = os.readlink(source)
                        info.mode = 0o777
                        archive.addfile(info)
                    else:
                        info.size = source.stat().st_size
                        info.mode = 0o755 if source.stat().st_mode & stat.S_IXUSR else 0o644
                        with source.open("rb") as stream:
                            archive.addfile(info, stream)


def verify_archive(path: Path) -> list[str]:
    with tarfile.open(path, "r:gz") as archive:
        members = [member.name for member in archive.getmembers()]
    forbidden = [member for member in members if is_sidecar(member)]
    if forbidden:
        raise RuntimeError(f"Archive contains forbidden metadata sidecars: {forbidden}")
    return members


def snapshot(args: argparse.Namespace) -> None:
    repo = Path(args.repo).resolve()
    freeze = Path(args.freeze).resolve()
    freeze.mkdir(parents=True, exist_ok=False)
    paths = source_paths(repo)
    source_manifest = checksum_lines(repo, paths)
    (freeze / "source-files.sha256").write_text(source_manifest)
    source_root = hashlib.sha256(source_manifest.encode()).hexdigest()
    (freeze / "source-root.sha256").write_text(f"{source_root}\n")
    (freeze / "source-files.json").write_text(json.dumps(paths, indent=2) + "\n")
    archive = freeze / "source.tar.gz"
    write_canonical_tar_gz(archive, repo, paths, "source/")
    members = verify_archive(archive)
    (freeze / "source-archive-members.txt").write_text("\n".join(members) + "\n")
    (freeze / "source-archive.sha256").write_text(f"{sha256_file(archive)}  source.tar.gz\n")
    print(json.dumps({"sourceRootSha256": source_root, "sourceFiles": len(paths), "sourceArchiveSha256": sha256_file(archive)}))


def finalize(args: argparse.Namespace) -> None:
    repo = Path(args.repo).resolve()
    freeze = Path(args.freeze).resolve()
    evidence = Path(args.evidence).resolve()
    metadata = json.loads(Path(args.metadata).read_text())
    expected_manifest = (freeze / "source-files.sha256").read_text()
    paths = json.loads((freeze / "source-files.json").read_text())
    current_paths = source_paths(repo)
    if current_paths != paths or checksum_lines(repo, current_paths) != expected_manifest:
        raise RuntimeError("Source changed after fingerprint capture; discard this freeze.")
    evidence_paths = sorted(
        [str(path.relative_to(evidence)) for path in evidence.rglob("*") if path.is_file() or path.is_symlink()],
        key=lambda value: value.encode(),
    )
    forbidden = [value for value in evidence_paths if is_sidecar(value)]
    if forbidden:
        raise RuntimeError(f"Evidence contains forbidden metadata sidecars: {forbidden}")
    evidence_manifest = checksum_lines(evidence, evidence_paths)
    (freeze / "evidence-files.sha256").write_text(evidence_manifest)
    source_root = (freeze / "source-root.sha256").read_text().strip()
    manifest = {
        "formatVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceRootSha256": source_root,
        "sourceArchiveSha256": sha256_file(freeze / "source.tar.gz"),
        "sourceFilesManifestSha256": sha256_file(freeze / "source-files.sha256"),
        "evidenceFilesManifestSha256": sha256_file(freeze / "evidence-files.sha256"),
        "sourceFileCount": len(paths),
        "evidenceFileCount": len(evidence_paths),
        **metadata,
    }
    manifest_path = freeze / "freeze-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    (freeze / "freeze-manifest.sha256").write_text(f"{sha256_file(manifest_path)}  freeze-manifest.json\n")

    combined_root = freeze / ".combined"
    combined_root.mkdir()
    freeze_files = [
        "source.tar.gz", "source-files.sha256", "source-root.sha256", "source-files.json",
        "source-archive-members.txt", "source-archive.sha256", "evidence-files.sha256",
        "freeze-manifest.json", "freeze-manifest.sha256",
    ]
    for name in freeze_files:
        os.link(freeze / name, combined_root / name)
    evidence_link = combined_root / "evidence"
    evidence_link.symlink_to(evidence, target_is_directory=True)
    combined_paths = freeze_files + [f"evidence/{value}" for value in evidence_paths]
    final_archive = freeze / "openfront-law-firm-final-freeze.tar.gz"
    # Resolve evidence paths explicitly rather than archiving directory metadata or resource forks.
    with final_archive.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                for relative in sorted(combined_paths, key=lambda value: value.encode()):
                    source = (evidence / relative.removeprefix("evidence/")) if relative.startswith("evidence/") else (freeze / relative)
                    info = tarfile.TarInfo(relative)
                    info.uid = info.gid = 0
                    info.uname = info.gname = "root"
                    info.mtime = 0
                    info.size = source.stat().st_size
                    info.mode = 0o644
                    with source.open("rb") as stream:
                        archive.addfile(info, stream)
    members = verify_archive(final_archive)
    (freeze / "final-archive-members.txt").write_text("\n".join(members) + "\n")
    (freeze / "final-archive.sha256").write_text(f"{sha256_file(final_archive)}  {final_archive.name}\n")
    for temporary in combined_root.iterdir():
        temporary.unlink()
    combined_root.rmdir()
    print(json.dumps({"sourceRootSha256": source_root, "evidenceFiles": len(evidence_paths), "finalArchiveSha256": sha256_file(final_archive)}))


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    snapshot_parser = subparsers.add_parser("snapshot")
    snapshot_parser.add_argument("--repo", default=".")
    snapshot_parser.add_argument("--freeze", required=True)
    snapshot_parser.set_defaults(handler=snapshot)
    finalize_parser = subparsers.add_parser("finalize")
    finalize_parser.add_argument("--repo", default=".")
    finalize_parser.add_argument("--freeze", required=True)
    finalize_parser.add_argument("--evidence", required=True)
    finalize_parser.add_argument("--metadata", required=True)
    finalize_parser.set_defaults(handler=finalize)
    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
