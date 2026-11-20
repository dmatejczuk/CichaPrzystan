import { useEffect, useState } from 'react'

const STORAGE_KEY = 'savedPlaces'

function loadSavedPlaces() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

export function useSavedPlaces() {
  const [savedPlaces, setSavedPlaces] = useState(loadSavedPlaces)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlaces))
  }, [savedPlaces])

  function isSaved(place) {
    return savedPlaces.some((saved) => saved.id === place.id)
  }

  function toggleSaved(place) {
    setSavedPlaces((current) =>
      current.some((saved) => saved.id === place.id)
        ? current.filter((saved) => saved.id !== place.id)
        : [...current, place],
    )
  }

  return { savedPlaces, isSaved, toggleSaved }
}
