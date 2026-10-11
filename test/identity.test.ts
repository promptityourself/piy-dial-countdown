/**
 * Holds every copy of the plugin's UUID to the manifest.
 *
 * The UUID is written in more places than any other string in the repo: the manifest, the folder
 * that ships, the `@action` decorators, the build, the release, the mock host, CI. The decorators
 * cannot read it — the SDK wants a literal — so the copies have to be checked instead. A copy left
 * behind after 5.0.0's move would build a plugin whose actions Stream Deck never routes to, or
 * release a folder that no longer exists.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string): string => readFileSync(resolve(ROOT, path), "utf8");

const SHIPPED = readdirSync(ROOT).filter((name) => name.endsWith(".sdPlugin"));
const manifest = JSON.parse(read(`${SHIPPED[0]}/manifest.json`)) as {
	UUID: string;
	Actions: { UUID: string }[];
};

/** Every place outside the plugin folder that names it, by its folder or its UUID. */
const REFERENCES = [
	"rollup.config.mjs",
	"package.json",
	".github/workflows/ci.yml",
	".gitignore",
	"tools/release.mjs",
	"tools/mock-host.mjs",
	"tools/make-icons.mjs",
	"tools/check-version.mjs"
];

/** Anything shaped like a reverse-DNS plugin id: `com.<org>.<name>`, as the manifest schema allows. */
const ID = /\bcom\.[a-z0-9-]+\.[a-z0-9-]+\b/g;

describe("the plugin's UUID", () => {
	it("is one folder, and the folder is named after it", () => {
		assert.equal(SHIPPED.length, 1, `exactly one *.sdPlugin folder ships: ${SHIPPED.join(", ")}`);
		assert.equal(SHIPPED[0], `${manifest.UUID}.sdPlugin`);
	});

	it("prefixes both action UUIDs", () => {
		assert.equal(manifest.Actions.length, 2, "precondition: the dial action and the key action");
		for (const { UUID } of manifest.Actions) {
			assert.ok(UUID.startsWith(`${manifest.UUID}.`), `${UUID} is not under ${manifest.UUID}`);
		}
	});

	it("is what the @action decorators register, action for action", () => {
		const registered = ["src/actions/dial-countdown.ts", "src/actions/key-countdown.ts"].map((file) => {
			const found = read(file).match(/@action\(\{ UUID: "([^"]+)" \}\)/);
			assert.ok(found, `${file} carries no @action UUID`);
			return found[1];
		});
		assert.deepEqual(registered.sort(), manifest.Actions.map(({ UUID }) => UUID).sort());
	});

	it("is the only plugin id the build, the release and CI name", () => {
		let seen = 0;
		for (const file of REFERENCES) {
			assert.ok(existsSync(resolve(ROOT, file)), `precondition: ${file} exists`);
			for (const [id] of read(file).matchAll(ID)) {
				seen++;
				assert.equal(id, manifest.UUID, `${file} names ${id}, not ${manifest.UUID}`);
			}
		}
		// The positive control: a scan that matched nothing would pass every assertion above.
		assert.ok(seen >= REFERENCES.length, `only ${seen} ids found across ${REFERENCES.length} files`);
	});
});
