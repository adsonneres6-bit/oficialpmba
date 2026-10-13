import assert from "node:assert/strict"
import test from "node:test"
import { fetchPublishedBuildId, isUpdateAvailable } from "./appUpdates.js"

test("detects a different published build and ignores the loaded build", () => {
  assert.equal(isUpdateAvailable("commit-a", "commit-b"), true)
  assert.equal(isUpdateAvailable("commit-a", "commit-a"), false)
  assert.equal(isUpdateAvailable("", "commit-b"), false)
})

test("fetches the published build without using browser cache", async () => {
  let request
  const buildId = await fetchPublishedBuildId(async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      json: async () => ({ buildId: "deployed-build" }),
    }
  })

  assert.equal(buildId, "deployed-build")
  assert.match(request.url, /^\/version\.json\?check=/)
  assert.equal(request.options.cache, "no-store")
})

test("rejects a missing or malformed published version", async () => {
  await assert.rejects(
    fetchPublishedBuildId(async () => ({
      ok: false,
      status: 503,
    })),
    /HTTP 503/,
  )
  await assert.rejects(
    fetchPublishedBuildId(async () => ({
      ok: true,
      json: async () => ({ buildId: "" }),
    })),
    /identificador inválido/,
  )
})
