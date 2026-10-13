export function isUpdateAvailable(currentBuildId, publishedBuildId) {
  return Boolean(
    currentBuildId &&
      publishedBuildId &&
      currentBuildId !== publishedBuildId,
  )
}

export async function fetchPublishedBuildId(fetcher = fetch) {
  const response = await fetcher(`/version.json?check=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`A consulta da versão falhou (HTTP ${response.status}).`)
  }

  const publishedVersion = await response.json()
  if (
    !publishedVersion ||
    typeof publishedVersion.buildId !== "string" ||
    !publishedVersion.buildId
  ) {
    throw new Error("O endpoint de versão retornou um identificador inválido.")
  }

  return publishedVersion.buildId
}
