# Security policy

This repository holds `@skeleton-playground/core` (a TypeScript kit for object detection apps and MCP
servers) and two example apps. It was built for a hackathon and is at version 0.x, so treat it as early software.

## Reporting a problem

Please report security problems privately, not in a public issue. Use GitHub's
**Security → Report a vulnerability** on this repository. Include what you did, what you expected, and
what happened. Reports are handled on a best-effort basis by the maintainer. There is no bug bounty.

## What the package tries to protect

A model chooses the file paths in MCP tool calls, so the main risk is a tool reading files it should not.
`createNodeImageDecoder` requires an `allowedRoot` folder and refuses anything outside it (symlinks
followed), reads only JPEG and PNG (checked from the first bytes), and limits file size, image size and
base64 input. Reports that show a way around these limits are in scope.

## Known limits

- **Your tool handlers are your responsibility.** The kit cannot stop a handler you write from reading files
  with `fs` directly. Pass paths through the decoder.
- **Model weights are downloaded at runtime** from the model publishers' hosts (storage.googleapis.com
  for COCO-SSD, tfhub.dev for MobileNet). They are not bundled, pinned or hash-checked. Use the
  `modelUrl` option to load a copy you host yourself.
- **The repository's security checks are pattern checks.** `mcp-security.test.ts` catches known-bad
  patterns in agent configs, launchers and app sources. It does not prove an app is safe.
- **The `security-reviewer` agent is an AI reviewer.** It is read-only, but its findings can be wrong or
  incomplete. Do not treat a PASS as a guarantee.
- **Detection output is untrusted.** Labels come from a model and can be wrong. Treat text returned to an
  agent as untrusted input.

## Supported versions

Only the latest published version gets fixes.
