import { useQuery } from '@tanstack/react-query'
import { triviaIntegration } from './config'

export interface TriviaData {
  question: string
  category: string
  choices: string[]
  correctIndex: number
}

export function useTrivia() {
  return useQuery({
    queryKey: ['trivia'],
    queryFn: () => triviaIntegration.api.get<TriviaData>('/question'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
