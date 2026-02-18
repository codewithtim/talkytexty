<!--
  Sync Impact Report
  ═══════════════════════════════════════════════════════════
  Version change: N/A → 1.0.0 (initial ratification)

  Added principles:
    - I. Test-First (TDD)
    - II. Simplicity / YAGNI
    - III. Type Safety
    - IV. Convention over Configuration
    - V. Domain-Driven Design

  Added sections:
    - Core Principles (5 principles)
    - Quality Gates
    - Security Standards
    - Governance

  Removed sections: N/A (initial version)

  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ no changes needed
      (Constitution Check section is dynamically filled)
    - .specify/templates/spec-template.md — ✅ no changes needed
      (template is principle-agnostic by design)
    - .specify/templates/tasks-template.md — ✅ no changes needed
      (test-first guidance already present in template)
    - .specify/templates/checklist-template.md — ✅ no changes needed
      (dynamically generated from context)

  Follow-up TODOs: None
  ═══════════════════════════════════════════════════════════
-->

# text-to-code Constitution

## Core Principles

### I. Test-First (TDD)

Tests MUST be written before implementation code. The Red-Green-Refactor
cycle is strictly enforced:

1. Write a failing test that defines the desired behavior
2. Obtain user approval on test intent
3. Confirm the test fails (Red)
4. Write the minimum code to make the test pass (Green)
5. Refactor while keeping tests green (Refactor)

No production code may be written without a corresponding failing test.
Integration tests MUST cover cross-boundary interactions (Rust ↔ React,
Tauri commands, IPC channels). Contract tests MUST verify API surfaces
between frontend and backend.

### II. Simplicity / YAGNI

Every feature MUST start with the simplest viable implementation.
Code MUST NOT be written for hypothetical future requirements.

- Three similar lines of code are preferable to a premature abstraction
- No utility modules, helper layers, or abstractions for one-time use
- Feature flags and backwards-compatibility shims are prohibited unless
  explicitly justified in a Complexity Tracking table
- If a simpler alternative exists, it MUST be chosen unless a concrete,
  present-tense requirement demands otherwise

### III. Type Safety

Strict typing MUST be enforced across all layers of the stack:

- **Rust**: All public functions MUST have explicit type signatures.
  `unwrap()` is prohibited in production code; use proper error handling
  with `Result<T, E>` and the `?` operator.
- **TypeScript/React**: `strict: true` MUST be enabled in tsconfig.
  `any` is prohibited. All component props and Tauri command payloads
  MUST be fully typed. Shared types between Rust and TypeScript MUST
  be generated or kept in sync via a single source of truth.
- **CSS/Tailwind**: Tailwind config MUST define a constrained design
  token set. Arbitrary values (e.g., `w-[347px]`) are prohibited
  unless explicitly justified.

### IV. Convention over Configuration

The project MUST follow established patterns and conventions to reduce
cognitive overhead and onboarding friction:

- Directory structure MUST follow the layout defined in the
  implementation plan without deviation
- Naming conventions MUST be consistent: `snake_case` for Rust,
  `camelCase` for TypeScript, `kebab-case` for file names and CSS
- New patterns MUST NOT be introduced when an existing convention
  covers the use case
- Framework and library idioms (Tauri commands, React hooks, Tailwind
  utility classes) MUST be preferred over custom abstractions

### V. Domain-Driven Design

The codebase MUST be organized around business domain concepts, not
technical layers:

- Domain models MUST use ubiquitous language shared between
  specification, code, and user-facing text
- Bounded contexts MUST have clear boundaries with explicit interfaces
  between them
- Business logic MUST reside in domain modules, not in UI components
  or infrastructure code
- Tauri commands MUST map to domain operations, not CRUD endpoints
- Data transformations at boundaries (e.g., Rust structs ↔ TypeScript
  interfaces) MUST preserve domain semantics

## Quality Gates

All code MUST pass the following gates before merge:

- **Automated tests**: All existing tests MUST pass. New functionality
  MUST include tests per Principle I
- **Type checking**: `cargo check` and `tsc --noEmit` MUST pass with
  zero errors and zero warnings
- **Linting**: `cargo clippy` (deny warnings) and ESLint MUST pass
  with zero violations
- **Formatting**: `cargo fmt --check` and Prettier MUST report no
  formatting differences
- **Build**: `cargo build --release` and frontend production build
  MUST succeed without warnings
- **Review**: At minimum, the author MUST perform a self-review
  checklist before requesting merge

## Security Standards

- All user input MUST be validated at system boundaries (Tauri command
  handlers, IPC message receivers, file system operations)
- Dependencies MUST be audited: `cargo audit` and `npm audit` MUST
  report no known critical or high vulnerabilities before merge
- Secrets (API keys, tokens, credentials) MUST NOT appear in source
  code, configuration files, or version control history
- File system access from the frontend MUST use Tauri's scoped
  allowlist; direct `fs` access is prohibited
- Tauri's CSP (Content Security Policy) MUST be configured to the
  most restrictive setting that permits required functionality

## Governance

This constitution is the authoritative source of development standards
for the text-to-code project. It supersedes all other practices,
conventions, or ad-hoc decisions when conflicts arise.

**Amendment procedure**:

1. Propose the change with rationale in a PR modifying this file
2. Document the specific principle(s) affected and why
3. Provide a migration plan for any existing code that would violate
   the amended principle
4. Update the version number per semantic versioning rules below
5. Update dependent templates if the amendment changes mandatory
   sections or task categories

**Versioning policy**:

- MAJOR: Principle removal, redefinition, or backward-incompatible
  governance change
- MINOR: New principle or section added, or materially expanded
  guidance
- PATCH: Clarifications, wording improvements, typo fixes

**Compliance review**:

- Every PR MUST include a self-assessment against applicable principles
- The plan template's Constitution Check section MUST be filled before
  implementation begins
- Violations MUST be documented in the Complexity Tracking table with
  explicit justification if retained

**Version**: 1.0.0 | **Ratified**: 2026-02-18 | **Last Amended**: 2026-02-18
