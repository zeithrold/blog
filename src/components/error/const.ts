export interface PageError {
  title: string
  message: string
}

export type PageErrorReceipe = Record<number, PageError>

export const ERROR: PageErrorReceipe = {
  404: {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
  },
  400: {
    title: 'Bad Request',
    message: 'The request you made is invalid.',
  },
  401: {
    title: 'Unauthorized',
    message: 'You are not authorized to access this page.',
  },
  403: {
    title: 'Forbidden',
    message: 'You are not allowed to access this page.',
  },
  500: {
    title: 'Internal Server Error',
    message: 'An error occurred while processing your request.',
  },
}
