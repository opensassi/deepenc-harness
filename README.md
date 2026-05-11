# deepenc-harness

Build and test tooling for the deepenc encoder — a CLI wrapper around the parent project's Makefile and CTest suite.

## Usage

Run the CLI directly without cloning:

```bash
npx deepenc-harness build
npx deepenc-harness test
npx deepenc-harness build --test
```

### Commands

| Command | Description |
| ------- | ----------- |
| `build` | Build the parent encoder library via `make install-{variant}{-shared}` |
| `test`  | Run the parent test suite via `ctest --test-dir build/{variant}{-shared}` |

### Global Options

| Option | Description |
| ------ | ----------- |
| `--config <path>` | Path to configuration file |
| `--verbose` | Enable verbose logging |
| `--output <format>` | Output format: text, json, csv (default: text) |
| `--help` | Show help message |

### Build Options

| Option | Description |
| ------ | ----------- |
| `-v, --variant <type>` | Build variant: release, debug, relwithdebinfo (default: release) |
| `--static` | Build static libraries (default: shared) |
| `-c, --clean` | Clean before building |
| `-j, --jobs <N>` | Number of parallel jobs |
| `-t, --test` | Run tests after building |

### Examples

```bash
# Build release shared (default)
deepenc-harness build

# Build debug static and run tests
deepenc-harness build --variant debug --static --test

# Run tests against existing release-shared build
deepenc-harness test

# Clean build with 8 parallel jobs
deepenc-harness build --clean --jobs 8
```

## Development

Clone the repository and set up the harness:

```bash
git clone <repository-url>
cd deepenc-harness
npm install
npm run build
```

## Development Workflow

| Script | Purpose |
| ------ | ------- |
| `npm install` | Install all project dependencies (exact versions pinned) |
| `npm run build` | Compile TypeScript sources to `lib/` (strict mode, ESM) |
| `npm test` | Run the unit test suite with Jest |
| `npm run coverage` | Run tests and enforce 90% coverage thresholds |
| `npm run lint` | Lint all TypeScript sources with ESLint |
| `npm run format` | Auto-format code with Prettier |
| `npm run prepare` | Build the library (automatically triggered by `npm install`) |

## Testing Guidelines

- Tests are co-located with the source file they test (e.g., `src/config.test.ts` for `src/config.ts`).
- Jest is configured with `ts-jest` for seamless ESM support.
- All tests run in a Node environment; no DOM.
- `buildCommand` and `testCommand` use mocked `child_process.execSync` to avoid shelling out.
- CLI argument parsing is tested directly against `parseArgs()` without module mocking.
- **Coverage thresholds are strictly enforced at 90%** (branches, functions, lines, statements). If coverage falls below the threshold, the `coverage` script exits with code 1 and the change must be reworked.
- Write tests that exercise all public methods and all major code paths.

## AI Usage in Development

This project is developed with the assistance of AI tools.

- **Tools**: Visual Studio Code, Cline (and its fork Dirac), DeepSeek (via API and open-weights models).
- **Key files**:
  - `technical-specification.md` — the complete system design, diagrams, and testing plan.
- **Specification creation**: `technical-specification.md` was generated iteratively using an Interactive System Design Agent prompt. This prompt enables a conversational design loop that produced the full specification with architecture and sequence diagrams.
- **Development loop**:
  1. Refine the design with the design agent until the specification is stable.
  2. Hand the final specification to a coding agent (via Cline/Dirac) to generate the complete npm package, run the tests, and meet the coverage thresholds.
  3. If issues are found, iterate on the specification before re-generating the code.
- **Model hosting**: For faster inference or data residency, open-weights DeepSeek models can be served via US-based endpoints such as NVIDIA NIM or HuggingFace Inference Endpoints. The coding agent is agnostic to the backend.

## Contributing

Contributions must adhere to the technical specification. Before opening a pull request:

- Ensure your code follows the project's linting and formatting setup (`npm run lint` and `npm run format`).
- All existing and new tests must pass.
- The coverage threshold (90%) must be met; run `npm run coverage` to confirm.
- Do not modify the `coverageThreshold` values in `jest.config.js`.
- If the specification is updated, regenerate the relevant parts of the implementation using the above AI-assisted workflow.
