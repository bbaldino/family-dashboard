import { useQuery } from '@tanstack/react-query'
import { wordOfTheDayIntegration } from './config'

export interface WordOfTheDayData {
  word: string
  partOfSpeech: string | null
  definition: string
  example: string | null
}

export function useWordOfTheDay() {
  return useQuery({
    queryKey: ['word-of-the-day'],
    queryFn: () => wordOfTheDayIntegration.api.get<WordOfTheDayData>('/today'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
